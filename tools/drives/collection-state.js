// The collections' controlled props and their toolbar: a sort set from the SortPicker
// and a filter set from the FilterBar move the table's rows, a selection reads back
// through the two-way prop, a tree node opens through it, a disabled row is skipped by
// ArrowDown, and an editable cell says it can be edited.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework both --drive tools/drives/collection-state.js
//
// The tree and the grid live on their own pages, opened here in a same-origin iframe so
// everything is read in one run.
const notes = [];
const fail = (m) => ({ verdict: 'FAIL ' + m, notes });
const EDIT_HINT = 'Double-click or press Enter to edit';

async function until(fn, ms = 10000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

// Base UI opens on a click, Bits UI on pointerdown, and neither answers the other.
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
  }
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
}

function type(input, text) {
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(input), 'value')?.set;
  setter ? setter.call(input, text) : (input.value = text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

/** Shut whatever popup is open, and wait until it is gone. */
async function dismiss(gone) {
  for (let attempt = 0; attempt < 6 && !gone(); attempt += 1) {
    key(document.activeElement ?? document.body, 'Escape');
    key(document.body, 'Escape');
    await wait(150);
  }
  return gone();
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

/**
 * The colour the editable wash resolves to, measured on a probe inside the cell.
 *
 * A pointer cannot be moved from inside the page, so the hover state itself is not
 * reachable here: what is checked is that the utility the cell carries resolves to a
 * real colour, and that it is not the colour the cell already has.
 */
function washColour(el) {
  const probe = document.createElement('div');
  probe.className = 'bg-accent/50';
  el.appendChild(probe);
  const colour = getComputedStyle(probe).backgroundColor;
  probe.remove();
  return colour;
}

const seen = {};

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) return fail(`no ${framework} pane`);
  const table = () => pane.querySelector('[data-slot="entity-table"]');
  const rows = () => [...pane.querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]')];
  const cellsOf = (path) => rows().map((r) => r.querySelector(`td[data-column="${path}"]`)?.textContent.trim() ?? '');
  const codes = () => cellsOf('code');

  if (!(await until(() => rows().length > 0))) return fail(`${framework}: the table drew no row`);
  await wait(400);
  const firstCode = codes()[0];
  const startRows = rows().length;

  /* 1. A filter set from the toolbar's FilterBar moves the rows. --------------- */

  const pill = pane.querySelector('[data-slot="filter-bar"] [data-slot="filter-pill-trigger"]');
  if (!pill) return fail(`${framework}: no filter pill in the toolbar`);
  let options = null;
  for (let attempt = 0; attempt < 3 && !options; attempt += 1) {
    press(pill);
    options = await until(() => {
      const found = [...document.querySelectorAll('[data-option]')];
      return found.length > 0 ? found : null;
    }, 4000);
  }
  if (!options) return fail(`${framework}: the filter pill listed no value`);
  const wanted = options[0];
  const status = wanted.dataset.option;
  // The label is the one leaf span that is not the count.
  const statusLabel =
    [...wanted.querySelectorAll('span')]
      .find((el) => el.dataset.slot !== 'facet-count' && el.children.length === 0 && el.textContent.trim())
      ?.textContent.trim() ?? '';
  if (!statusLabel) return fail(`${framework}: the facet option "${status}" has no label`);
  press(wanted);
  if (!(await until(() => rows().length > 0 && rows().length !== startRows, 8000))) {
    // A facet whose count is the whole page leaves the row count alone; the cells still say so.
    await wait(600);
  }
  if (!(await dismiss(() => document.querySelectorAll('[data-option]').length === 0))) {
    return fail(`${framework}: the facet list would not close`);
  }
  await wait(300);
  const filtered = cellsOf('sg_status_list');
  const stray = filtered.filter((text) => text !== statusLabel);
  seen[`${framework} filter`] = { status, statusLabel, rows: rows().length, stray: stray.slice(0, 3) };
  if (filtered.length === 0) return fail(`${framework}: the filter left no row`);
  if (stray.length > 0) {
    return fail(`${framework}: ${stray.length} rows are not "${statusLabel}" after the filter, e.g. "${stray[0]}"`);
  }
  notes.push(`${framework}: the filter bar set ${status} and left ${filtered.length} rows, all "${statusLabel}"`);

  /* 2. A sort set from the toolbar's SortPicker moves the rows. ---------------- */

  const sortTrigger = pane.querySelector('[data-slot="sort-trigger"]');
  if (!sortTrigger) return fail(`${framework}: no sort picker in the toolbar`);
  let fieldTrigger = null;
  for (let attempt = 0; attempt < 3 && !fieldTrigger; attempt += 1) {
    press(sortTrigger);
    // The column picker holds a field picker too, so the one inside the sort popup is
    // found through the key list only that popup has.
    fieldTrigger = await until(() => {
      const popup = [...document.querySelectorAll('[data-slot="popover-content"]')].find((el) =>
        el.querySelector('[data-slot="sort-keys"]'),
      );
      return popup?.querySelector('[data-slot="field-picker-trigger"]') ?? null;
    }, 4000);
  }
  if (!fieldTrigger) return fail(`${framework}: the sort picker never opened`);
  let search = null;
  for (let attempt = 0; attempt < 3 && !search; attempt += 1) {
    press(fieldTrigger);
    // The field list is the popup that opened last, over the sort picker's own.
    search = await until(() => [...document.querySelectorAll('input[data-slot="command-input"]')].pop(), 4000);
  }
  if (!search) return fail(`${framework}: the sort picker's field list never opened`);
  type(search, 'code');
  await wait(300);
  const items = () => [...document.querySelectorAll('[data-slot="command-item"]')];
  const item = await until(() => items().find((el) => el.textContent.includes('Version Name')) ?? null, 6000);
  if (!item) {
    const offered = items()
      .slice(0, 4)
      .map((el) => el.textContent.trim().split('\n')[0]);
    return fail(`${framework}: the field list offered no "Version Name" for "code", it offered ${offered.join(' | ')}`);
  }
  press(item);
  const sortKey = await until(() => document.querySelector('[data-slot="sort-key"]'), 6000);
  if (!sortKey) return fail(`${framework}: no sort key was added`);
  if (sortKey.dataset.field !== 'code') {
    return fail(`${framework}: the sort key added is "${sortKey.dataset.field}", expected "code"`);
  }
  const descending = sortKey.querySelector('[aria-label="Descending"]');
  if (!descending) return fail(`${framework}: the sort key has no descending control`);
  press(descending);
  await wait(200);
  key(document.body, 'Escape');
  await wait(400);
  if (!(await until(() => codes()[0] && codes()[0] !== firstCode, 8000))) {
    return fail(`${framework}: the first row still reads "${codes()[0]}" after sorting by code descending`);
  }
  const sorted = codes().filter(Boolean);
  const ordered = [...sorted].sort().reverse();
  seen[`${framework} sort`] = { first: sorted[0], last: sorted[sorted.length - 1] };
  if (sorted.join('|') !== ordered.join('|')) {
    return fail(`${framework}: the rows are not code descending: ${sorted.slice(0, 3).join(', ')}`);
  }
  notes.push(
    `${framework}: the sort picker set code descending and the rows run ${sorted[0]} … ${sorted[sorted.length - 1]}`,
  );

  /* 3. A selection reads back through the two-way prop. ------------------------ */

  const count = () => pane.querySelector('[data-testid="selection-count"]')?.textContent.trim() ?? '';
  const box = rows()[0]?.querySelector('[data-slot="checkbox"]');
  if (!box) return fail(`${framework}: no row checkbox`);
  press(box);
  if (!(await until(() => count().startsWith('1 '), 4000))) {
    return fail(`${framework}: the selection reads "${count()}" after one tick, expected 1`);
  }
  press(box);
  if (!(await until(() => count().startsWith('0 '), 4000))) {
    return fail(`${framework}: the selection reads "${count()}" after untick, expected 0`);
  }
  notes.push(`${framework}: the two-way selection read 1 then 0`);

  /* 4. An editable cell says it can be edited. --------------------------------- */

  const editable = pane.querySelector('[data-slot="entity-table"] td[data-editable="true"]');
  if (!editable) return fail(`${framework}: no cell is marked editable`);
  const title = editable.getAttribute('title');
  const classes = [...editable.classList];
  const wanted_ = ['hover:bg-accent/50', 'focus-visible:bg-accent/50', 'transition-colors', 'duration-150'];
  const missing = wanted_.filter((name) => !classes.includes(name));
  const wash = washColour(editable);
  const resting = getComputedStyle(editable).backgroundColor;
  seen[`${framework} editable cell`] = { column: editable.dataset.column, title, wash, resting, missing };
  if (title !== EDIT_HINT) return fail(`${framework}: an editable cell's title reads "${title}"`);
  if (missing.length > 0) return fail(`${framework}: an editable cell lacks ${missing.join(', ')}`);
  if (!wash || wash === resting) {
    return fail(`${framework}: the editable wash reads ${wash} against a resting ${resting}`);
  }
  const plain = pane.querySelector('[data-slot="entity-table"] td[data-column="image"]');
  if (plain && (plain.getAttribute('title') === EDIT_HINT || plain.classList.contains('hover:bg-accent/50'))) {
    return fail(`${framework}: a cell that cannot be edited carries the edit affordance`);
  }
  notes.push(`${framework}: an editable cell reads "${title}" and washes to ${wash} over ${resting}`);

  /* 5. A tree node opens through the two-way prop. ----------------------------- */

  const treeDoc = await frame('/widgets/entity-tree/');
  const treePane = treeDoc.querySelector(`[data-pane="${framework}"]`);
  if (!treePane) return fail(`${framework}: no pane on the tree page`);
  const openAssets = await until(() => treePane.querySelector('[data-testid="open-assets"]'), 8000);
  if (!openAssets) return fail(`${framework}: the tree demo has no control that opens a branch`);
  await until(() => treePane.querySelectorAll('[data-slot="entity-tree-item-label"]').length > 1, 10000);
  const openCount = () => treePane.querySelector('[data-testid="expanded-count"]')?.textContent.trim() ?? '';
  const assets = () => [...treePane.querySelectorAll('[data-path]')].find((el) => el.dataset.path.endsWith('/Asset'));
  const before = openCount();
  if (assets()?.dataset.state !== 'closed') {
    return fail(`${framework}: the Asset branch is not shut to start with: "${assets()?.dataset.state}"`);
  }
  press(openAssets);
  const opened = await until(() => (assets()?.dataset.state === 'open' ? assets() : null), 10000);
  if (!opened) return fail(`${framework}: the Asset branch never opened through the prop, count "${openCount()}"`);
  seen[`${framework} tree`] = { before, after: openCount(), path: opened.dataset.path };
  if (openCount() === before) return fail(`${framework}: the open-path count did not move: "${openCount()}"`);
  notes.push(`${framework}: the tree went from "${before}" to "${openCount()}" and opened ${opened.dataset.path}`);

  /* 6. ArrowDown steps over a disabled row. ----------------------------------- */

  const gridDoc = await frame('/widgets/entity-grid/');
  const gridPane = gridDoc.querySelector(`[data-pane="${framework}"]`);
  if (!gridPane) return fail(`${framework}: no pane on the grid page`);
  const section = await until(() => gridPane.querySelector('[data-testid="grid-disabled"]'), 8000);
  if (!section) return fail(`${framework}: the grid demo has no disabled case`);
  const tiles = await until(() => {
    const found = [...section.querySelectorAll('[data-index]')];
    return found.length > 2 ? found : null;
  }, 10000);
  if (!tiles) return fail(`${framework}: the disabled grid drew no tile`);
  // One tile a row, so Down is one row and what it steps over is unambiguous.
  const list = section.querySelector('[role="listbox"]');
  list.style.gridTemplateColumns = 'repeat(1,minmax(0,1fr))';
  await wait(100);
  const disabled = tiles.map((t) => t.dataset.disabled === 'true');
  const from = disabled.findIndex((off, i) => !off && disabled[i + 1] === true && disabled.slice(i + 2).includes(false));
  if (from < 0) return fail(`${framework}: no enabled tile sits above a disabled one: ${disabled.join(',')}`);
  let wantedIndex = from + 1;
  while (disabled[wantedIndex]) wantedIndex += 1;
  tiles[from].focus();
  key(tiles[from], 'ArrowDown');
  await wait(200);
  const landed = tiles.indexOf(gridDoc.activeElement);
  seen[`${framework} grid`] = { disabled: disabled.join(','), from, landed, wanted: wantedIndex };
  if (landed !== wantedIndex) {
    return fail(`${framework}: ArrowDown from tile ${from} landed on ${landed}, expected ${wantedIndex}`);
  }
  if (tiles[from + 1].getAttribute('tabindex') !== '-1') {
    return fail(`${framework}: the disabled tile ${from + 1} is a tab stop`);
  }
  notes.push(
    `${framework}: ArrowDown went from tile ${from} to ${landed} over a disabled ${from + 1} (${disabled.join(',')})`,
  );
}

return {
  verdict:
    'PASS the toolbar drives the source, the selection and the tree read back through their props, ' +
    'a disabled row is skipped by ArrowDown, and an editable cell says so, in both frameworks',
  notes,
  seen,
};
