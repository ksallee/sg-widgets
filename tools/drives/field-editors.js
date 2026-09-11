// Every data type opens its own editor, and a commit leaves the console clean.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework both --drive tools/drives/field-editors.js
//
// Per framework: a status cell opens StatusPicker, an entity cell opens EntityPicker, a
// text cell commits on Enter and on a press outside, and a colour condition added in the
// filter dialog opens ColorEditor. Svelte logs `derived_inert` when a commit tears an
// editor down while its blur handler is still reading a derived, so every warning the
// page makes is collected and the run fails on one; the step and the stack come with it.
const warnings = [];
let step = 'load';
const realWarn = console.warn;
console.warn = function (...args) {
  const line = args.map((a) => String(a)).join(' ');
  warnings.push(line.includes('derived_inert') ? `[${step}] ${line}\n${new Error().stack}` : `[${step}] ${line}`);
  realWarn.apply(console, args);
};

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  }
}

// A press on the page body, which is what closes an open editor. The whole sequence:
// a cell listens for the pointer going down, a popover for the press that follows.
function pressOutside() {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    document.body.dispatchEvent(
      type.startsWith('pointer')
        ? new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' })
        : new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }),
    );
  }
}

function setValue(el, text) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(el, name, init = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...init }));
}

async function until(find, label) {
  for (let i = 0; i < 200; i++) {
    const found = find();
    if (found) return found;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function openSurfaces() {
  return $$('[data-slot="popover-content"], [data-slot="select-content"], [data-picker]').filter(
    (el) => !el.hasAttribute('data-closed') && el.getAttribute('data-state') !== 'closed' && el.checkVisibility(),
  );
}

function within(selector) {
  return openSurfaces().flatMap((surface) => (surface.matches(selector) ? [surface] : $$(selector, surface)));
}

// A text cell opens its editor in a popover, portalled out of the cell; a picker cell
// opens it in the cell.
const editorInput = (cell) =>
  cell.querySelector('input, textarea') ??
  ($$('[data-field-editor-popover]').find((el) => el.checkVisibility()) ?? cell).querySelector('input, textarea');

const fieldList = () => within('[data-picker="field"]')[0] ?? null;
const fieldItems = () => (fieldList() ? $$('[data-slot="command-item"]', fieldList()) : []);
const itemFor = (label) =>
  fieldItems().find((i) => [...i.querySelectorAll('span')].some((s) => s.textContent.trim() === label));

// The field list is filled from the schema, so its rows have to stop moving first.
async function settledItem(label) {
  await wait(150);
  let seen = -1;
  for (let i = 0; i < 200; i++) {
    const count = fieldItems().length;
    if (count === seen && itemFor(label)) return itemFor(label);
    seen = count;
    await wait(50);
  }
  throw new Error(`timed out waiting for the ${label} row`);
}

async function run(framework) {
  step = `${framework}: load`;
  const pane = await until(() => $(`[data-pane="${framework}"]`), `the ${framework} pane`);
  const rows = () => $$('[data-slot="entity-table"] tbody tr[data-row-key]', pane);
  await until(() => rows().length > 0 || null, 'the table rows');
  await wait(400);

  const cell = (column) => rows()[0].querySelector(`td[data-column="${column}"]`);
  const seen = {};

  // A status cell opens the status picker, and Escape closes it.
  step = `${framework}: status cell`;
  cell('sg_status_list').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  // The status editor opens in a popover by default, so the picker is looked for there.
  const statusPicker = () =>
    document.querySelector('[data-field-editor-popover] [data-slot="status-picker"]') ??
    cell('sg_status_list').querySelector('[data-slot="status-picker"]');
  const status = await until(statusPicker, 'a status picker');
  seen.status = status.querySelector('[data-slot="status-picker-value"]')?.textContent.trim() ?? '';
  key(status.querySelector('[data-slot="status-picker-control"]'), 'Escape');
  await until(
    () => statusPicker() === null || null,
    'the status cell to close',
  );

  // An entity cell opens the entity picker, and a press outside closes it.
  step = `${framework}: entity cell`;
  cell('entity').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  // The entity editor opens in a popover by default, so the picker is looked for there.
  const entityPicker = () =>
    document.querySelector('[data-field-editor-popover] [data-slot="entity-picker"]') ??
    cell('entity').querySelector('[data-slot="entity-picker"]');
  const entity = await until(entityPicker, 'an entity picker');
  seen.entity = entity.querySelector('[data-slot="entity-picker-value"]')?.textContent.trim() ?? '';
  pressOutside();
  await until(() => entityPicker() === null || null, 'the entity cell to close');

  // A text cell commits on Enter. This is the gesture that logged derived_inert.
  step = `${framework}: commit on Enter`;
  const typed = `edited by qa ${framework}`;
  cell('description').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const input = await until(() => editorInput(cell('description')), 'the text editor');
  input.focus();
  setValue(input, typed);
  await wait(120);
  // A text field in a popover is a textarea: Enter adds a line, Ctrl with Enter commits.
  key(input, 'Enter', { ctrlKey: true });
  await until(() => cell('description').textContent.trim() === typed || null, `the cell to read "${typed}"`);
  seen.committed = cell('description').textContent.trim();

  // And on the press that lands outside it.
  step = `${framework}: commit on an outside press`;
  const alsoTyped = `${typed} again`;
  cell('description').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const second = await until(() => editorInput(cell('description')), 'the text editor again');
  second.focus();
  setValue(second, alsoTyped);
  await wait(120);
  pressOutside();
  await until(() => cell('description').textContent.trim() === alsoTyped || null, `the cell to read "${alsoTyped}"`);
  seen.outside = cell('description').textContent.trim();

  // A colour condition in the filter editor opens the colour editor.
  step = `${framework}: colour condition`;
  await until(() => $$('[data-slot="dialog-content"]').length === 0 || null, 'no open dialog');
  press($$('[data-slot="filter-launch"]', pane).at(-1));
  const dialog = await until(() => $('[data-slot="dialog-content"]'), 'the filter dialog');
  await wait(300);
  const conditionRows = () => $$('[data-slot="filter-row"]', dialog);
  const before = conditionRows().length;
  press($('[data-slot="filter-add-condition"][data-path=""]', dialog));
  await until(() => conditionRows().length > before || null, 'the new condition row');
  const row = () => conditionRows().at(-1);
  press($('[data-slot="filter-field"] [data-slot="field-picker-trigger"]', row()));
  const search = await until(() => (fieldList() ? $('[data-slot="command-input"]', fieldList()) : null), 'the field picker');
  setValue(search, 'Bar Colour');
  press(await settledItem('Bar Colour'));
  await until(() => openSurfaces().length === 0 || null, 'the field picker to close');
  const colour = await until(() => $('[data-slot="color-editor"]', row()), 'a colour editor on the row');
  seen.colour = ($('[data-slot="filter-operator"]', row())?.textContent ?? '').replace(/[^a-z ]/gi, '').trim();
  seen.colourSwatch = colour.querySelector('input[type="color"]') !== null;

  // Nothing here is meant to reach the demo's filter.
  press($('[data-slot="filter-cancel"]', dialog));
  await until(() => $$('[data-slot="dialog-content"]').length === 0 || null, 'the dialog to close');

  return { framework, ...seen };
}

const panes = [];
const failures = [];
for (const framework of ['svelte', 'react']) {
  try {
    panes.push(await run(framework));
  } catch (error) {
    failures.push(`${framework}: ${error.message}`);
  }
}

for (const pane of panes) {
  if (!pane.status) failures.push(`${pane.framework}: the status picker showed no code`);
  if (!pane.entity) failures.push(`${pane.framework}: the entity picker showed no row`);
  if (!pane.committed.startsWith('edited by qa')) failures.push(`${pane.framework}: Enter did not commit`);
  if (!pane.outside.endsWith('again')) failures.push(`${pane.framework}: the outside press did not commit`);
  if (pane.colour !== 'is') failures.push(`${pane.framework}: the colour row reads "${pane.colour}"`);
  if (!pane.colourSwatch) failures.push(`${pane.framework}: the colour condition drew no swatch`);
}

const inert = warnings.filter((line) => line.includes('derived_inert'));
if (inert.length > 0) failures.push(`${inert.length} derived_inert warnings`);

return {
  verdict:
    failures.length === 0
      ? `PASS status, entity, text and colour editors in both frameworks, ${warnings.length} warnings and no derived_inert`
      : `FAIL ${failures.join('; ')}`,
  panes,
  warnings: warnings.slice(0, 6),
};
