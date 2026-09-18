// Every value control the editor can draw, measured against a one-line row.
//
//   pnpm qa --start --path /widgets/filter-editor/ --drive tools/drives/filter-editor-stress.js --viewport 2200x1600
//
// The stage is pinned to two panes of exactly 800, 1000 and 1200px, so the editor is
// that width less the pane's own `p-4`. Every row is built through the editor's own
// controls: the field picker chooses a field of the data type, and the operator select
// names every preset that type offers, so the matrix is whatever `presetsFor` allows.
// A combination passes when the row is as tall as the `Version Name is` row at the same
// width. Nothing is allowed to wrap: the row's remove control sits outside the wrapping
// band, so every width the field, operator and value fit in is a one-line row.
//
// The run leaves each row on its widest preset at 1000px, which is what the screenshots
// take.
const WIDTHS = [800, 1000, 1200];
const ALLOWED_TO_WRAP = [];
const WIDEST = ['between', 'in_last', 'in', 'name_contains', 'is', 'is_empty'];

// One field per filterable data type on Version. `percent`, `duration`, `date` and
// `timecode` are not on Version itself and are reached through Link, which is what a
// person does. `url` is not filterable and is asserted absent instead.
const FIELDS = [
  { type: 'text', label: 'Version Name' },
  { type: 'number', label: 'First Frame' },
  { type: 'float', label: 'Movie Frame Rate' },
  { type: 'checkbox', label: 'Client Approved' },
  { type: 'date_time', label: 'Date Created' },
  { type: 'list', label: 'Version Type' },
  { type: 'status_list', label: 'Status' },
  { type: 'entity', label: 'Artist' },
  { type: 'multi_entity', label: 'Playlists' },
  { type: 'image', label: 'Thumbnail' },
  { type: 'percent', link: 'Shot', label: 'Complexity' },
  { type: 'duration', link: 'Shot', label: 'Working Duration' },
  { type: 'date', link: 'Shot', label: 'Turnover Date' },
  { type: 'timecode', link: 'Sequence', label: 'Timecode' },
];

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  }
}

function setValue(el, text) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function until(find, label) {
  for (let i = 0; i < 200; i++) {
    const found = find();
    if (found) return found;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

/**
 * The surfaces that are open now. Base UI keeps a closed select or popover mounted, so
 * a query that reaches into every surface answers from the pane driven a moment ago.
 */
function openSurfaces() {
  return $$('[data-slot="popover-content"], [data-slot="select-content"]').filter(
    (el) => !el.hasAttribute('data-closed') && el.getAttribute('data-state') !== 'closed' && el.checkVisibility(),
  );
}

function within(selector) {
  return openSurfaces().flatMap((surface) => (surface.matches(selector) ? [surface] : $$(selector, surface)));
}

async function closeOverlays() {
  await until(() => openSurfaces().length === 0 || null, 'the overlays to close');
}

const stage = () => $('[data-stage]');

/** Both panes exactly `width` wide. The editor inside gets `width` less the pane padding. */
function setWidth(width) {
  const figure = stage().closest('[data-sg-demo]');
  figure.style.width = `${width * 2 + 2}px`;
  figure.style.maxWidth = 'none';
  stage().style.gridTemplateColumns = `${width}px ${width}px`;
  stage().style.width = 'max-content';
}

const rowsOf = (pane) => $$('[data-slot="filter-row"]', pane);
const height = (el) => Math.round(el.getBoundingClientRect().height);

const fieldList = () => within('[data-picker="field"]')[0] ?? null;

function items() {
  const list = fieldList();
  return list ? $$('[data-slot="command-item"]', list) : [];
}

function itemFor(label) {
  return items().find((item) => [...item.querySelectorAll('span')].some((s) => s.textContent.trim() === label));
}

/**
 * The row for a label, once the list has stopped moving. Typing re-renders the list, so
 * a node taken while it is still filtering is detached by the time it is pressed.
 */
async function settledItem(label) {
  await wait(150);
  let seen = -1;
  for (let i = 0; i < 200; i++) {
    const count = items().length;
    if (count === seen && itemFor(label)) return itemFor(label);
    seen = count;
    await wait(50);
  }
  throw new Error(`timed out waiting for the ${label} row`);
}

/** Add a condition and point it at one field, descending through a link when asked. */
async function addRow(pane, spec) {
  const before = rowsOf(pane).length;
  press($('[data-slot="filter-add-condition"][data-path=""]', pane));
  await until(() => rowsOf(pane).length > before, 'the new row');
  const row = () => rowsOf(pane).at(-1);

  press($('[data-slot="filter-field"] [data-slot="field-picker-trigger"]', row()));
  const search = await until(() => (fieldList() ? $('[data-slot="command-input"]', fieldList()) : null), 'the field picker');

  if (spec.link) {
    setValue(search, 'Link');
    press($('[data-slot="field-picker-descend"]', await settledItem('Link')));
    press(await settledItem(spec.link));
    await until(() => within('[data-slot="field-picker-breadcrumb"]')[0], 'the breadcrumb');
    setValue($('[data-slot="command-input"]', fieldList()), spec.label);
  } else {
    setValue(search, spec.label);
  }

  press(await settledItem(spec.label));
  await closeOverlays();
  await until(
    () => $('[data-slot="filter-field"] [data-slot="field-picker-label"]', row())?.textContent.includes(spec.label),
    `${spec.label} on the row`,
  );
}

/** Every preset the row's operator select offers, in menu order. The menu closes on the first. */
async function presetsOf(row) {
  press($('[data-slot="filter-operator"]', row));
  const found = await until(() => {
    const list = within('[data-slot="select-item"][data-preset]');
    return list.length > 0 ? list : null;
  }, 'the operator menu');
  const ids = found.map((item) => item.getAttribute('data-preset'));
  press(within(`[data-slot="select-item"][data-preset="${ids[0]}"]`)[0]);
  await closeOverlays();
  return ids;
}

async function setPreset(row, id) {
  press($('[data-slot="filter-operator"]', row));
  const item = await until(() => within(`[data-slot="select-item"][data-preset="${id}"]`)[0], `the ${id} entry`);
  press(item);
  await closeOverlays();
  await wait(40);
}

async function clearTree(pane) {
  // Every editor on the page is emptied, and the demo's first tree is a catalogue: the
  // cap is the rows now drawn, with room for the group headers between them.
  const tries = rowsOf(pane).length * 2 + 20;
  for (let i = 0; i < tries; i++) {
    const button = $('[data-slot="filter-row"] [data-slot="filter-remove"], [data-slot="filter-group"] [data-slot="filter-group"] [data-slot="filter-remove"]', pane);
    if (!button) break;
    press(button);
    await wait(60);
  }
  await until(() => rowsOf(pane).length === 0 || null, 'an empty tree');
}

async function run(framework) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) throw new Error(`no ${framework} pane`);
  await closeOverlays();
  await until(() => $('[data-slot="filter-editor"]', pane), 'the editor');
  await until(() => rowsOf(pane).length > 0 || null, 'the demo tree');
  await clearTree(pane);

  const rows = [];
  for (const spec of FIELDS) {
    await addRow(pane, spec);
    // The tree re-renders on every edit, so a row is held by its index, never by node.
    rows.push({ spec, at: rowsOf(pane).length - 1 });
  }
  const rowAt = (row) => rowsOf(pane)[row.at];

  // `url` is not filterable, so the field picker never offers it: no operator, no value.
  const trigger = $('[data-slot="filter-field"] [data-slot="field-picker-trigger"]', rowAt(rows[0]));
  press(trigger);
  const search = await until(() => (fieldList() ? $('[data-slot="command-input"]', fieldList()) : null), 'the field picker');
  setValue(search, 'Uploaded Movie');
  await wait(400);
  const urlOffered = Boolean(itemFor('Uploaded Movie'));
  press(trigger);
  await closeOverlays();

  // The one-line baseline: `Version Name is`, a plain text editor, at each width.
  const text = rows.find((r) => r.spec.type === 'text');
  await setPreset(rowAt(text), 'is');
  const baseline = {};
  for (const width of WIDTHS) {
    setWidth(width);
    await wait(30);
    baseline[width] = height(rowAt(text));
  }

  const measured = [];
  for (const row of rows) {
    const presets = await presetsOf(rowAt(row));
    for (const preset of presets) {
      await setPreset(rowAt(row), preset);
      const heights = {};
      for (const width of WIDTHS) {
        setWidth(width);
        await wait(30);
        heights[width] = height(rowAt(row));
      }
      measured.push({ type: row.spec.type, preset, heights });
    }
    const widest = WIDEST.find((id) => presets.includes(id)) ?? presets.at(-1);
    if (widest) await setPreset(rowAt(row), widest);
  }

  return { framework, baseline, measured, urlOffered, types: rows.map((r) => r.spec.type) };
}

const results = [await run('svelte'), await run('react')];

// One line at a width means the row is no taller than the text `is` row there.
function wrapped(entry, baseline, width) {
  return entry.heights[width] > baseline[width] + 1;
}

const table = [];
const failures = [];
for (const result of results) {
  for (const entry of result.measured) {
    const marks = WIDTHS.map((w) => `${w}:${wrapped(entry, result.baseline, w) ? 'wrapped' : 'one'}`);
    table.push(`${result.framework} ${entry.type} ${entry.preset} ${marks.join(' ')}`);
    for (const width of WIDTHS) {
      if (!wrapped(entry, result.baseline, width)) continue;
      const allowed = width === 800 && ALLOWED_TO_WRAP.includes(`${entry.type}|${entry.preset}`);
      failures.push({
        framework: result.framework,
        type: entry.type,
        preset: entry.preset,
        width,
        height: entry.heights[width],
        baseline: result.baseline[width],
        allowed,
      });
    }
  }
}

// The screenshots want the widest row of every type, at one pane of 1000px. The demo is
// floated over the page so both panes are in frame whatever the docs column is worth.
setWidth(1000);
const figure = stage().closest('[data-sg-demo]');
// The docs column is its own stacking context, so the demo moves out of it first.
document.body.append(figure);
figure.style.position = 'fixed';
figure.style.top = '0';
figure.style.left = '0';
figure.style.zIndex = '9999';
await wait(200);

const unexpected = failures.filter((f) => !f.allowed);
const counts = results.map((r) => {
  const mine = failures.filter((f) => f.framework === r.framework);
  const per = WIDTHS.map((w) => `${w}px ${mine.filter((f) => f.width === w).length} wrapped`);
  return `${r.framework} ${r.measured.length} combinations, ${per.join(', ')}`;
});

return {
  verdict: `${unexpected.length === 0 ? 'PASS' : 'FAIL'} ${counts.join('; ')}`,
  baseline: Object.fromEntries(results.map((r) => [r.framework, r.baseline])),
  urlOffered: Object.fromEntries(results.map((r) => [r.framework, r.urlOffered])),
  wrapped: failures,
  table,
};
