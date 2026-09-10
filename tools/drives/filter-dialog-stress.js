// The widest condition row inside the dialog, against the same one-line baseline.
//
//   pnpm qa --start --path /widgets/filter-dialog/ --drive tools/drives/filter-dialog-stress.js
//
// The dialog takes the viewport up to 64rem, so at a 1400px viewport the editor inside it
// has about the 1000px the stress table measures on the page. `date_time between` is the
// widest combination the editor can draw and is what this checks.
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

function openSurfaces() {
  return $$('[data-slot="popover-content"], [data-slot="select-content"]').filter(
    (el) => !el.hasAttribute('data-closed') && el.getAttribute('data-state') !== 'closed' && el.checkVisibility(),
  );
}

function within(selector) {
  return openSurfaces().flatMap((surface) => (surface.matches(selector) ? [surface] : $$(selector, surface)));
}

const fieldList = () => within('[data-picker="field"]')[0] ?? null;
const items = () => (fieldList() ? $$('[data-slot="command-item"]', fieldList()) : []);
const itemFor = (label) => items().find((i) => [...i.querySelectorAll('span')].some((s) => s.textContent.trim() === label));

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

const dialog = () => $('[data-slot="dialog-content"]');
const rowsIn = () => $$('[data-slot="filter-row"]', dialog());
const height = (el) => Math.round(el.getBoundingClientRect().height);

async function addRow(label) {
  const before = rowsIn().length;
  press($('[data-slot="filter-add-condition"][data-path=""]', dialog()));
  await until(() => rowsIn().length > before, 'the new row');
  const row = () => rowsIn().at(-1);
  press($('[data-slot="filter-field"] [data-slot="field-picker-trigger"]', row()));
  const search = await until(() => (fieldList() ? $('[data-slot="command-input"]', fieldList()) : null), 'the field picker');
  setValue(search, label);
  press(await settledItem(label));
  await until(() => openSurfaces().length === 0 || null, 'the picker to close');
  await until(
    () => $('[data-slot="filter-field"] [data-slot="field-picker-label"]', row())?.textContent.includes(label),
    `${label} on the row`,
  );
  return rowsIn().length - 1;
}

async function setPreset(index, id) {
  press($('[data-slot="filter-operator"]', rowsIn()[index]));
  press(await until(() => within(`[data-slot="select-item"][data-preset="${id}"]`)[0], `the ${id} entry`));
  await until(() => openSurfaces().length === 0 || null, 'the menu to close');
  await wait(40);
}

async function run(framework) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) throw new Error(`no ${framework} pane`);
  await until(() => $$('[data-slot="dialog-content"]').length === 0 || null, 'no open dialog');
  press($$('[data-slot="filter-launch"]', pane).at(-1));
  await until(() => dialog(), 'the dialog');
  await wait(300);

  const width = Math.round(dialog().getBoundingClientRect().width);
  const editor = Math.round($('[data-slot="filter-editor"]', dialog()).getBoundingClientRect().width);

  const baseAt = await addRow('Version Name');
  await setPreset(baseAt, 'is');
  const baseline = height(rowsIn()[baseAt]);

  const dateAt = await addRow('Date Created');
  await setPreset(dateAt, 'between');
  const between = height(rowsIn()[dateAt]);

  // Nothing here is meant to reach the demo's filter.
  press($('[data-slot="filter-cancel"]', dialog()));
  await until(() => $$('[data-slot="dialog-content"]').length === 0 || null, 'the dialog to close');
  return { framework, width, editor, baseline, between };
}

const results = [await run('svelte'), await run('react')];
const ok = (r) => r.editor >= 900 && r.between === r.baseline;
const verdict = results.every(ok) ? 'PASS' : 'FAIL';
return {
  verdict: `${verdict} ${results
    .map((r) => `${r.framework} dialog ${r.width}px, editor ${r.editor}px, date_time between ${r.between}px on a ${r.baseline}px baseline`)
    .join('; ')}`,
  results,
};
