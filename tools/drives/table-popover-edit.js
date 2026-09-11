// A text cell edits in a popover, a status cell edits in the cell.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework both --drive tools/drives/table-popover-edit.js
//
// Per framework: the description cell opens a popover carrying the field's name, the
// control and Cancel and Save; Enter commits and the cell reads the new value; a second
// edit closes on Escape and leaves the cell alone; the status cell opens its picker in
// the cell with no popover. Every console warning is collected and the run fails on one,
// `derived_inert` first: a commit that tears an editor down while its blur handler is
// still reading a derived logs it.
const warnings = [];
let step = 'load';
const realWarn = console.warn;
console.warn = function (...args) {
  const line = args.map((a) => String(a)).join(' ');
  warnings.push(line.includes('derived_inert') ? `[${step}] ${line}\n${new Error().stack}` : `[${step}] ${line}`);
  realWarn.apply(console, args);
};

function setValue(el, text) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

async function until(find, label) {
  for (let i = 0; i < 200; i++) {
    const found = find();
    if (found) return found;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

const openPopover = () => $$('[data-field-editor-popover]').find((el) => el.checkVisibility()) ?? null;

async function run(framework) {
  step = `${framework}: load`;
  const pane = await until(() => $(`[data-pane="${framework}"]`), `the ${framework} pane`);
  const rows = () => $$('[data-slot="entity-table"] tbody tr[data-row-key]', pane);
  await until(() => rows().length > 0 || null, 'the table rows');
  await wait(400);

  const cell = (column) => rows()[0].querySelector(`td[data-column="${column}"]`);
  const seen = {};

  // A text cell opens the editor in a popover, not in the cell.
  step = `${framework}: the popover opens`;
  cell('description').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const popover = await until(openPopover, 'the popover editor');
  seen.label = popover.querySelector('[data-slot="field-editor-label"]')?.textContent.trim() ?? '';
  seen.buttons = ['cancel', 'save']
    .filter((name) => popover.querySelector(`[data-slot="field-editor-${name}"]`) !== null)
    .join(' and ');
  seen.inCell = cell('description').querySelector('input, textarea') !== null;

  // Enter commits what the control holds, and the cell reads it.
  step = `${framework}: commit on Enter`;
  const typed = `popover edit by qa ${framework}`;
  const input = await until(() => popover.querySelector('input, textarea'), 'the text editor');
  input.focus();
  setValue(input, typed);
  await wait(120);
  key(input, 'Enter');
  await until(() => cell('description').textContent.trim() === typed || null, `the cell to read "${typed}"`);
  await until(() => openPopover() === null || null, 'the popover to close');
  seen.committed = cell('description').textContent.trim();

  // Escape closes the next one and leaves the value where it was.
  step = `${framework}: cancel on Escape`;
  cell('description').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const second = await until(openPopover, 'the popover editor again');
  const dropped = await until(() => second.querySelector('input, textarea'), 'the text editor again');
  dropped.focus();
  setValue(dropped, `${typed} dropped`);
  await wait(120);
  key(dropped, 'Escape');
  await until(() => openPopover() === null || null, 'the popover to close on Escape');
  await wait(300);
  seen.cancelled = cell('description').textContent.trim();

  // A status cell keeps its picker in the cell.
  step = `${framework}: status cell`;
  cell('sg_status_list').dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const status = await until(
    () => cell('sg_status_list').querySelector('[data-slot="status-picker"]'),
    'a status picker in the cell',
  );
  seen.statusInCell = status !== null;
  seen.statusPopover = openPopover() !== null;
  key(status.querySelector('[data-slot="select-trigger"], [data-slot="status-picker-trigger"]'), 'Escape');
  await until(
    () => cell('sg_status_list').querySelector('[data-slot="status-picker"]') === null || null,
    'the status cell to close',
  );

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
  if (pane.label !== 'Description') failures.push(`${pane.framework}: the popover label reads "${pane.label}"`);
  if (pane.buttons !== 'cancel and save') failures.push(`${pane.framework}: the footer held "${pane.buttons}"`);
  if (pane.inCell) failures.push(`${pane.framework}: the text editor stayed in the cell`);
  if (!pane.committed.startsWith('popover edit by qa')) failures.push(`${pane.framework}: Enter did not commit`);
  if (pane.cancelled !== pane.committed) {
    failures.push(`${pane.framework}: Escape left the cell reading "${pane.cancelled}"`);
  }
  if (!pane.statusInCell) failures.push(`${pane.framework}: the status cell drew no picker`);
  if (pane.statusPopover) failures.push(`${pane.framework}: the status cell opened a popover`);
}

const inert = warnings.filter((line) => line.includes('derived_inert'));
if (inert.length > 0) failures.push(`${inert.length} derived_inert warnings`);
if (warnings.length > 0) failures.push(`${warnings.length} console warnings`);

return {
  verdict:
    failures.length === 0
      ? `PASS a text cell edits in a popover and a status cell in the cell, in both frameworks, 0 warnings and no derived_inert`
      : `FAIL ${failures.join('; ')}`,
  panes,
  warnings: warnings.slice(0, 6),
};
