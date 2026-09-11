// Both status pickers list the shared picker row: the status glyph, the label and the
// code, never a badge. `showCode={false}` drops the code, a caller's own secondary
// replaces it, and a pick still lands in the control as a badge.
//
//   pnpm qa --start --path /widgets/status-picker/ --framework both --drive tools/drives/status-picker-rows.js
//
// The single picker is on the page; the multi picker is opened in a same-origin iframe,
// so both are read in one run.
const failures = [];
const seen = {};

async function until(read, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

function pointer(el) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
}

/** Base UI opens on a click, Bits UI on pointerdown, and one answers where the other does not. */
async function press(el, listed) {
  for (const gesture of [() => el.click(), () => pointer(el)]) {
    gesture();
    const rows = await until(() => (listed().length > 0 ? listed() : null), 3000);
    if (rows) return rows;
  }
  return null;
}

/** Close an open list: the trigger toggles, and a press outside the popup also shuts it. */
async function dismiss(doc, listed, toggle) {
  for (let i = 0; i < 10 && listed().length > 0; i += 1) {
    if (toggle) {
      toggle.click();
      pointer(toggle);
    }
    pointer(doc.body);
    doc.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
    doc.body.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button: 0 }));
    (doc.activeElement ?? doc.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(200);
  }
  return listed().length === 0;
}

/** Load a page of this site into an iframe and answer its document. */
async function frame(path) {
  const el = document.createElement('iframe');
  el.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:900px;opacity:0;z-index:-1';
  el.src = path;
  const ready = new Promise((resolve) => el.addEventListener('load', resolve, { once: true }));
  document.body.appendChild(el);
  await ready;
  return el.contentDocument;
}

/** What one list row draws, as the anatomy of rule 9. */
function anatomy(row) {
  return {
    code: row.dataset.statusCode ?? '',
    glyph: Boolean(row.querySelector('[data-slot="status-glyph"]')),
    leading: Boolean(row.querySelector('[data-slot="picker-row-leading"]')),
    label: row.querySelector('[data-slot="picker-row-name"]')?.textContent.trim() ?? '',
    secondary: row.querySelector('[data-slot="picker-row-secondary"]')?.textContent.trim() ?? '',
    badge: Boolean(row.querySelector('[data-slot="status-badge"]')),
  };
}

function readRows(rows, where) {
  const drawn = rows.map(anatomy);
  for (const row of drawn) {
    if (row.badge) failures.push(`${where}: ${row.code} still draws a badge in the list`);
    if (!row.leading || !row.glyph) failures.push(`${where}: ${row.code} has no status glyph`);
    if (!row.label) failures.push(`${where}: ${row.code} has no label`);
  }
  return drawn;
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  const note = {};

  /* ---------------------------------------------------------------- single */

  // A closed popup stays in the DOM carrying `data-closed`, so only live rows count.
  const live = (rows) => rows.filter((row) => !row.closest('[data-closed]') && row.getClientRects().length > 0);
  const options = () => live($$('[role="option"][data-status-code]'));
  let lastTrigger = null;
  const openSingle = async (demo) => {
    const settled = await until(() => {
      const el = $(`[data-demo="${demo}"] [data-slot="status-picker"]`, pane);
      return el && !el.dataset.loading ? el : null;
    }, 15000);
    const trigger = settled && $('[data-slot="select-trigger"]', settled);
    if (!trigger) {
      failures.push(`${framework}: no ${demo} status picker to open`);
      return null;
    }
    lastTrigger = trigger;
    const rows = await press(trigger, options);
    if (!rows) failures.push(`${framework}: the ${demo} status picker listed nothing`);
    return rows;
  };

  const listed = await openSingle('p70');
  if (listed) {
    const drawn = readRows(listed, `${framework} status-picker`);
    const ip = drawn.find((row) => row.code === 'ip');
    if (!ip) failures.push(`${framework}: the status picker has no ip row`);
    else if (ip.secondary !== 'ip') failures.push(`${framework}: ip reads "${ip.secondary}" as its secondary, not the code`);
    note.picker = drawn.slice(0, 3);

    // A pick closes the list and lands in the control as a badge.
    const apr = listed.find((row) => row.dataset.statusCode === 'apr');
    if (apr) {
      apr.click();
      pointer(apr);
    }
    const chosen = await until(
      () => $(`[data-demo="p70"] [data-slot="status-picker-value"] [data-slot="status-badge"]`, pane),
      4000,
    );
    note.pickedBadge = chosen?.dataset.statusCode ?? '';
    if (note.pickedBadge !== 'apr') failures.push(`${framework}: the picked status is "${note.pickedBadge}" in the control, not a badge for apr`);
  }
  if (!(await dismiss(document, options, lastTrigger))) failures.push(`${framework}: a status picker list would not close`);

  const bare = await openSingle('no-code');
  if (bare) {
    const withCode = readRows(bare, `${framework} status-picker showCode=false`).filter((row) => row.secondary);
    note.noCode = withCode.length;
    if (withCode.length > 0) failures.push(`${framework}: showCode={false} left ${withCode.length} codes on the rows`);
  }
  if (!(await dismiss(document, options, lastTrigger))) failures.push(`${framework}: a status picker list would not close`);

  const own = await openSingle('own-secondary');
  if (own) {
    const drawn = readRows(own, `${framework} status-picker secondary`);
    note.ownSecondary = drawn.find((row) => row.code === 'ip')?.secondary ?? '';
    if (note.ownSecondary !== 'Animation') failures.push(`${framework}: the caller's secondary reads "${note.ownSecondary}", not Animation`);
  }
  if (!(await dismiss(document, options, lastTrigger))) failures.push(`${framework}: a status picker list would not close`);

  /* ----------------------------------------------------------------- multi */

  const doc = await frame('/widgets/status-multi-picker/');
  const mPane = await until(() => $(`[data-pane="${framework}"]`, doc), 15000);
  if (!mPane) {
    failures.push(`${framework}: the status multi picker page drew no pane`);
    seen[framework] = note;
    continue;
  }
  const mRows = () => live($$('[data-slot="status-multi-picker-option"]', doc));
  const openMulti = async (demo) => {
    const settled = await until(() => {
      const el = $(`[data-demo="${demo}"] [data-slot="status-multi-picker"]`, mPane);
      return el && !el.dataset.loading ? el : null;
    }, 15000);
    const control = settled && $('[data-slot="status-multi-picker-control"]', settled);
    if (!control) {
      failures.push(`${framework}: no ${demo} status multi picker to open`);
      return null;
    }
    const rows = await press(control, mRows);
    if (!rows) failures.push(`${framework}: the ${demo} status multi picker listed nothing`);
    return rows;
  };

  const mListed = await openMulti('both');
  if (mListed) {
    const drawn = readRows(mListed, `${framework} status-multi-picker`);
    const boxes = mListed.filter((row) => row.querySelector('[data-slot="status-multi-picker-check"]')).length;
    note.multi = drawn.slice(0, 3);
    note.checkboxes = boxes;
    if (boxes !== mListed.length) failures.push(`${framework}: ${mListed.length - boxes} multi rows lost their checkbox`);
    const ip = drawn.find((row) => row.code === 'ip');
    if (ip && ip.secondary !== 'ip') failures.push(`${framework}: the multi picker's ip row reads "${ip.secondary}" as its secondary`);

    // A pick lands in the control as a badge chip.
    const rev = mListed.find((row) => row.dataset.statusCode === 'rev');
    if (rev) {
      rev.click();
      pointer(rev);
    }
    const chip = await until(
      () => $('[data-demo="both"] [data-slot="status-multi-picker-chip"] [data-status-code="rev"]', mPane),
      4000,
    );
    note.chip = chip?.dataset.statusCode ?? '';
    if (note.chip !== 'rev') failures.push(`${framework}: the picked status did not land in the control as a badge chip`);
  }
  if (!(await dismiss(doc, mRows))) failures.push(`${framework}: a status multi picker list would not close`);

  const mBare = await openMulti('no-code');
  if (mBare) {
    const withCode = readRows(mBare, `${framework} status-multi-picker showCode=false`).filter((row) => row.secondary);
    note.multiNoCode = withCode.length;
    if (withCode.length > 0) failures.push(`${framework}: showCode={false} left ${withCode.length} codes on the multi rows`);
  }
  if (!(await dismiss(doc, mRows))) failures.push(`${framework}: a status multi picker list would not close`);

  const mOwn = await openMulti('own-secondary');
  if (mOwn) {
    const drawn = readRows(mOwn, `${framework} status-multi-picker secondary`);
    note.multiOwnSecondary = drawn.find((row) => row.code === 'ip')?.secondary ?? '';
    if (note.multiOwnSecondary !== 'Animation') failures.push(`${framework}: the multi picker's own secondary reads "${note.multiOwnSecondary}"`);
  }
  if (!(await dismiss(doc, mRows))) failures.push(`${framework}: a status multi picker list would not close`);

  seen[framework] = note;
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS both status pickers list picker rows with the glyph, the label and the code, showCode and a caller secondary shape them, and a pick lands as a badge'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
