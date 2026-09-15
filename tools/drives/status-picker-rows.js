// A status offered as an option is a glyph and its name, never a badge: both status
// pickers and the filter bar's status facet draw the shared row, the status icon as the
// leading mark, the label with the matched runs bold, and the code or the count
// right-aligned. `showCode={false}` drops the code, a caller's own secondary replaces it,
// and a pick still lands in the control as a badge. The sprite cell carries the dark
// treatment on a dark page and nothing on a light one.
//
//   pnpm qa --start --path /widgets/status-picker/ --framework both --dark --drive tools/drives/status-picker-rows.js
//
// The single picker is on the page; the multi picker and the filter bar are opened in
// same-origin iframes, so all three are read in one run.
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

/** The drawing on a mark: `none` on a light page, the sprite's treatment on a dark one. */
const filterOf = (el) => el.ownerDocument.defaultView.getComputedStyle(el).filter;

/**
 * The sprite key of a mark drawn from the stock sprite. A status with no cell to draw
 * takes the neutral dot, which carries the key as well and is a token in both schemes.
 */
function spriteKey(el) {
  if (!el?.dataset.statusIcon) return '';
  const image = el.ownerDocument.defaultView.getComputedStyle(el).backgroundImage;
  return el.tagName === 'IMG' || image !== 'none' ? el.dataset.statusIcon : '';
}

/** What one list row draws, as the anatomy of rule 9. */
function anatomy(row) {
  const mark = row.querySelector('[data-slot="picker-row-leading"] [data-slot="status-glyph"]');
  return {
    code: row.dataset.option ?? row.dataset.statusCode ?? '',
    glyph: Boolean(mark),
    leading: Boolean(row.querySelector('[data-slot="picker-row-leading"]')),
    badge: Boolean(row.querySelector('[data-slot="status-badge"]')),
    label: row.querySelector('[data-slot="picker-row-name"]')?.textContent.trim() ?? '',
    sprite: spriteKey(mark),
    filter: mark ? filterOf(mark) : '',
    secondary: row.querySelector('[data-slot="picker-row-secondary"]')?.textContent.trim() ?? '',
  };
}

function readRows(rows, where) {
  const drawn = rows.map(anatomy);
  for (const row of drawn) {
    if (row.badge) failures.push(`${where}: ${row.code} draws a badge in the list`);
    if (!row.leading || !row.glyph) failures.push(`${where}: ${row.code} has no status glyph`);
    if (!row.label) failures.push(`${where}: ${row.code} has no text label`);
  }
  return drawn;
}

/** The mark carries the sprite's treatment on a dark page, and nothing on a light one. */
function readTreatment(drawn, where, dark) {
  const marks = drawn.filter((row) => row.sprite);
  if (marks.length === 0) {
    failures.push(`${where}: no row drew a sprite cell to read`);
    return '';
  }
  const treated = marks.filter((row) => row.filter && row.filter !== 'none');
  if (dark && treated.length !== marks.length) {
    failures.push(`${where}: ${marks.length - treated.length} of ${marks.length} marks carry no treatment in dark`);
  }
  if (!dark && treated.length > 0) failures.push(`${where}: ${treated.length} marks carry a treatment on a light page`);
  return marks[0].filter;
}

const isDark = () => document.documentElement.classList.contains('dark');

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  const note = {};

  /* ---------------------------------------------------------------- single */

  // A closed popup stays in the DOM carrying `data-closed`, so only live rows count.
  const live = (rows) => rows.filter((row) => !row.closest('[data-closed]') && row.getClientRects().length > 0);
  const options = () => live($$('[data-slot="status-picker-option"]'));
  let lastTrigger = null;
  const openSingle = async (demo) => {
    const settled = await until(() => {
      const el = $(`[data-demo="${demo}"] [data-slot="status-picker"]`, pane);
      return el && !el.dataset.loading ? el : null;
    }, 15000);
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
    const drawn = readRows(listed, `${framework} status-picker`);
    const ip = drawn.find((row) => row.code === 'ip');
    if (!ip) failures.push(`${framework}: the status picker has no ip row`);
    else if (ip.secondary !== 'ip') failures.push(`${framework}: ip reads "${ip.secondary}" as its secondary, not the code`);
    note.picker = drawn.slice(0, 3);

    // The treatment follows the page: read it in the theme the run is in, then in the
    // other one, with the same rows on show, then back, so the frames below read the
    // theme the run was asked for.
    const startedDark = isDark();
    note.treatment = {};
    note.treatment[startedDark ? 'dark' : 'light'] = readTreatment(drawn, `${framework} status-picker`, startedDark);
    harness.set({ theme: startedDark ? 'light' : 'dark' });
    await wait(400);
    const flipped = options().map(anatomy);
    note.treatment[isDark() ? 'dark' : 'light'] = readTreatment(flipped, `${framework} status-picker flipped`, isDark());
    harness.set({ theme: startedDark ? 'dark' : 'light' });
    await wait(400);

    // A pick closes the list and lands in the control as a badge.
    const apr = options().find((row) => row.dataset.option === 'apr');
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

    // The row's label is text, so the search box's matched runs are bold in its name.
    const input = $('[data-slot="status-multi-picker-input"]', doc);
    if (!input) failures.push(`${framework}: the status multi picker popup has no search box`);
    else {
      type(input, 'in');
      const marked = await until(() => {
        const runs = $$('[data-slot="status-multi-picker-option"] [data-slot="picker-row-name"] .font-semibold', doc);
        return runs.length > 0 ? runs : null;
      }, 4000);
      note.marked = marked?.map((run) => run.textContent) ?? [];
      if (!marked) failures.push(`${framework}: no row marked the query's run in the multi picker list`);
      type(input, '');
      await wait(200);
    }
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

  /* ------------------------------------------------------------ facet rows */

  const bar = await frame('/widgets/filter-bar/');
  const bPane = await until(() => $(`[data-pane="${framework}"]`, bar), 15000);
  const pill = bPane && (await until(() => $('[data-slot="filter-pill"][data-field="sg_status_list"]', bPane), 15000));
  if (!pill) {
    failures.push(`${framework}: the filter bar drew no status pill`);
    seen[framework] = note;
    continue;
  }
  const facetRows = () => live($$('[data-option]', bar));
  // A pill's popover takes the whole press, and a press that lands before the island
  // has hydrated does nothing, so the press is repeated until the list answers. The
  // counts are read before the rows are drawn, which is what each wait is for.
  const facetTrigger = $('[data-slot="filter-pill-trigger"]', pill);
  let opened = null;
  for (let i = 0; i < 6 && !opened; i += 1) {
    for (const kind of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      facetTrigger.dispatchEvent(new PointerEvent(kind, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
    }
    facetTrigger.click();
    opened = await until(() => (facetRows().length > 0 ? facetRows() : null), 5000);
  }
  if (!opened) failures.push(`${framework}: the status facet listed no value`);
  else {
    const drawn = opened.map((row) => {
      const mark = row.querySelector('[data-slot="status-glyph"]');
      const sprite = spriteKey(mark);
      return {
        key: row.dataset.option,
        glyph: Boolean(mark),
        badge: Boolean(row.querySelector('[data-slot="status-badge"]')),
        label: row.querySelector('[title]')?.textContent.trim() ?? '',
        count: row.querySelector('[data-slot="facet-count"]')?.textContent.trim() ?? '',
        sprite,
        filter: sprite ? filterOf(mark) : '',
      };
    });
    note.facets = drawn.slice(0, 3);
    for (const row of drawn) {
      if (row.badge) failures.push(`${framework} facet: ${row.key} draws a badge in the checklist`);
      if (!row.glyph) failures.push(`${framework} facet: ${row.key} has no status glyph`);
      if (!row.label) failures.push(`${framework} facet: ${row.key} has no text label`);
      if (!row.count) failures.push(`${framework} facet: ${row.key} lost its count`);
    }
    // The frame reads the same stored theme, which the drive left on its second setting.
    const barDark = bar.documentElement.classList.contains('dark');
    const sprites = drawn.filter((row) => row.sprite);
    const treated = sprites.filter((row) => row.filter !== 'none');
    note.facetTreatment = { theme: barDark ? 'dark' : 'light', filter: sprites[0]?.filter ?? '' };
    if (sprites.length === 0) failures.push(`${framework} facet: no row drew a sprite cell to read`);
    if (barDark && treated.length !== sprites.length) {
      failures.push(`${framework} facet: ${sprites.length - treated.length} marks carry no treatment in dark`);
    }
    if (!barDark && treated.length > 0) failures.push(`${framework} facet: ${treated.length} marks carry a treatment on a light page`);

    // A ticked value is what the filter holds, and the pill draws it as a badge.
    opened[0].click();
    pointer(opened[0]);
    const badged = await until(
      () => $('[data-slot="filter-pill"][data-field="sg_status_list"] [data-slot="status-badge"]', bPane),
      6000,
    );
    note.pillBadge = badged?.dataset.statusCode ?? '';
    if (!badged) failures.push(`${framework} facet: the pill drew no badge for the value it holds`);
  }

  seen[framework] = note;
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS both status pickers and the status facet list a glyph mark before a text label, no badge in a row, the sprite treated in dark and left alone in light, the code and the count right-aligned, and a pick still lands as a badge'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
