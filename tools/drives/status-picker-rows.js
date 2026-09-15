// Both status pickers list the shared picker row with the status as its label: a badge
// with a surface of its own, on the chip step under the control, never a bare glyph
// beside plain text. `showCode={false}` drops the code, a caller's own secondary
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

/** Set a controlled input's value the way a keystroke does. */
function type(input, text) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  setter ? setter.call(input, text) : (input.value = text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
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

/** The chip ladder: a badge sits one step under the control it is in. */
const CHIP_HEIGHT = { sm: 20, md: 24, lg: 32 };

/** True where a colour is drawn at all rather than left transparent. */
const opaque = (colour) => Boolean(colour) && !/^(transparent$|rgba\(.*,\s*0\s*\)$)/.test(colour);

/** What one list row draws, as the anatomy of rule 9, with the status as its label. */
function anatomy(row) {
  const badge = row.querySelector('[data-slot="picker-row-label"] [data-slot="status-badge"]');
  const style = badge && badge.ownerDocument.defaultView.getComputedStyle(badge);
  return {
    code: row.dataset.option ?? row.dataset.statusCode ?? '',
    bare: Boolean(row.querySelector('[data-slot="status-badge"][data-variant="glyph"]')),
    leading: Boolean(row.querySelector('[data-slot="picker-row-leading"]')),
    badge: Boolean(badge),
    icon: Boolean(badge?.querySelector('[data-slot="status-glyph"]')),
    label: badge?.textContent.trim() ?? '',
    height: badge ? Math.round(badge.getBoundingClientRect().height) : 0,
    // A badge in a row is a surface: the pill's own border and fill, which is what a
    // bare sprite on a dark page has none of.
    surface: Boolean(style) && parseFloat(style.borderTopWidth) > 0 && opaque(style.borderTopColor) && opaque(style.backgroundColor),
    secondary: row.querySelector('[data-slot="picker-row-secondary"]')?.textContent.trim() ?? '',
  };
}

function readRows(rows, where, size) {
  const drawn = rows.map(anatomy);
  for (const row of drawn) {
    if (!row.badge) failures.push(`${where}: ${row.code} draws no badge in the list`);
    if (row.bare) failures.push(`${where}: ${row.code} still draws the bare glyph`);
    if (row.leading) failures.push(`${where}: ${row.code} keeps a leading slot beside its badge`);
    if (row.badge && !row.surface) failures.push(`${where}: ${row.code}'s badge has no surface of its own`);
    if (row.badge && row.height !== CHIP_HEIGHT[size]) {
      failures.push(`${where}: ${row.code}'s badge stands ${row.height}px, not the ${CHIP_HEIGHT[size]}px step under a ${size} control`);
    }
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
  const options = () => live($$('[data-slot="status-picker-option"]'));
  let lastTrigger = null;
  /** The control ladder the open picker stands on, which the badge takes a step under. */
  let lastSize = 'md';
  const openSingle = async (demo) => {
    const settled = await until(() => {
      const el = $(`[data-demo="${demo}"] [data-slot="status-picker"]`, pane);
      return el && !el.dataset.loading ? el : null;
    }, 15000);
    lastSize = settled?.dataset.size ?? 'md';
    const trigger = settled && $('[data-slot="status-picker-control"]', settled);
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
    const drawn = readRows(listed, `${framework} status-picker`, lastSize);
    const ip = drawn.find((row) => row.code === 'ip');
    if (!ip) failures.push(`${framework}: the status picker has no ip row`);
    else if (ip.secondary !== 'ip') failures.push(`${framework}: ip reads "${ip.secondary}" as its secondary, not the code`);
    note.picker = drawn.slice(0, 3);

    // A pick closes the list and lands in the control as a badge.
    const apr = listed.find((row) => row.dataset.option === 'apr');
    if (apr) {
      apr.click();
      pointer(apr);
    }
    // The control already holds a badge, so the wait is for the picked code, not for any.
    const chosen = await until(() => {
      const badge = $(`[data-demo="p70"] [data-slot="status-picker-value"] [data-slot="status-badge"]`, pane);
      return badge?.dataset.statusCode === 'apr' ? badge : null;
    }, 4000);
    note.pickedBadge = chosen?.dataset.statusCode ?? $(`[data-demo="p70"] [data-slot="status-picker-value"] [data-slot="status-badge"]`, pane)?.dataset.statusCode ?? '';
    if (note.pickedBadge !== 'apr') failures.push(`${framework}: the picked status is "${note.pickedBadge}" in the control, not a badge for apr`);
  }
  if (!(await dismiss(document, options, lastTrigger))) failures.push(`${framework}: a status picker list would not close`);

  const bare = await openSingle('no-code');
  if (bare) {
    const withCode = readRows(bare, `${framework} status-picker showCode=false`, lastSize).filter((row) => row.secondary);
    note.noCode = withCode.length;
    if (withCode.length > 0) failures.push(`${framework}: showCode={false} left ${withCode.length} codes on the rows`);
  }
  if (!(await dismiss(document, options, lastTrigger))) failures.push(`${framework}: a status picker list would not close`);

  const own = await openSingle('own-secondary');
  if (own) {
    const drawn = readRows(own, `${framework} status-picker secondary`, lastSize);
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
    lastSize = settled?.dataset.size ?? 'md';
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
    const drawn = readRows(mListed, `${framework} status-multi-picker`, lastSize);
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

    // The badge is the row's label, so the search box's matched runs are bold inside it.
    const input = $('[data-slot="status-multi-picker-input"]', doc);
    if (!input) failures.push(`${framework}: the status multi picker popup has no search box`);
    else {
      type(input, 'in');
      const marked = await until(() => {
        const runs = $$('[data-slot="status-multi-picker-option"] [data-slot="status-badge"] .font-semibold', doc);
        return runs.length > 0 ? runs : null;
      }, 4000);
      note.marked = marked?.map((run) => run.textContent) ?? [];
      if (!marked) failures.push(`${framework}: no badge marked the query's run in the multi picker list`);
      type(input, '');
      await wait(200);
    }
  }
  if (!(await dismiss(doc, mRows))) failures.push(`${framework}: a status multi picker list would not close`);

  const mBare = await openMulti('no-code');
  if (mBare) {
    const withCode = readRows(mBare, `${framework} status-multi-picker showCode=false`, lastSize).filter((row) => row.secondary);
    note.multiNoCode = withCode.length;
    if (withCode.length > 0) failures.push(`${framework}: showCode={false} left ${withCode.length} codes on the multi rows`);
  }
  if (!(await dismiss(doc, mRows))) failures.push(`${framework}: a status multi picker list would not close`);

  const mOwn = await openMulti('own-secondary');
  if (mOwn) {
    const drawn = readRows(mOwn, `${framework} status-multi-picker secondary`, lastSize);
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
      ? 'PASS both status pickers list picker rows whose label is a badge on the chip step, with its own surface and its matched runs, showCode and a caller secondary shape them, and a pick lands as a badge'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
