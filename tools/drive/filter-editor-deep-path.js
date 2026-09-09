// Filter through a link. Add a condition, drill Link -> Sequence -> Sequence Name in
// the field picker, set "contains" and a value, and check the dotted path reaches the
// serialised filter.
//
//   pnpm qa --start --path /widgets/filter-editor/ --drive tools/drive/filter-editor-deep-path.js
const PATH = 'entity.Sequence.code';
const TEXT = 'comp';

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

function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
}

async function until(find, label) {
  for (let i = 0; i < 80; i++) {
    const found = find();
    if (found) return found;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

// A popover is portalled to the body, so only one may be open while the other
// framework's pane is driven.
async function closePopovers() {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => $$('[data-slot="popover-content"]').length === 0 || null, 'the popover to close');
}

function items() {
  return $$('[data-picker="field"] [data-slot="command-item"]');
}

async function run(framework) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) throw new Error(`no ${framework} pane`);
  await closePopovers();
  const before = $$('[data-slot="filter-row"]', pane).length;

  press($('[data-slot="filter-add-condition"]', pane));
  await until(() => $$('[data-slot="filter-row"]', pane).length > before, 'the new row');
  const rowAt = () => $$('[data-slot="filter-row"]', pane).at(-1);

  press($('[data-slot="filter-field"] [data-slot="field-picker-trigger"]', rowAt()));
  const search = await until(() => $('[data-picker="field"] [data-slot="command-input"]'), 'the field picker');

  // Link is a filterable field of its own, so the row selects it; the chevron descends.
  setValue(search, 'Link');
  const link = await until(() => (items().length === 1 ? items()[0] : null), 'the Link row');
  await wait(120);
  press($('[data-slot="field-picker-descend"]', link));

  // Link declares three target types, so the picker asks which one first.
  const sequence = await until(
    () => items().find((item) => item.textContent.trim().startsWith('Sequence')),
    'the target types',
  );
  press(sequence);

  await until(() => $('[data-slot="field-picker-breadcrumb"]'), 'the breadcrumb');
  setValue($('[data-picker="field"] [data-slot="command-input"]'), 'Sequence Name');
  const leaf = await until(() => (items().length === 1 ? items()[0] : null), 'the Sequence Name row');
  await wait(120);
  press(leaf);

  const label = await until(
    () => $('[data-slot="filter-field"] [data-slot="field-picker-label"]', rowAt())?.textContent.trim(),
    'the chosen path',
  );

  press($('[data-slot="filter-operator"]', rowAt()));
  press(await until(() => $('[data-slot="select-item"][data-preset="contains"]'), 'the operator menu'));
  await until(() => $('[data-slot="filter-operator"]', rowAt()).textContent.includes('contains'), 'the operator');

  const input = await until(() => $('[data-slot="text-editor"] input', rowAt()), 'the text editor');
  input.focus();
  setValue(input, TEXT);
  key(input, 'Enter');
  await wait(200);
  await closePopovers();

  const filters = JSON.parse($('[data-testid="filter-json"]', pane).textContent);
  const added = filters.conditions.find((c) => Array.isArray(c) && c[0] === PATH);
  return { framework, label, added };
}

const svelte = await run('svelte');
const react = await run('react');

function ok(result) {
  return (
    result.label === 'Link › Sequence Name' &&
    Array.isArray(result.added) &&
    result.added[1] === 'contains' &&
    result.added[2] === TEXT
  );
}

const verdict = ok(svelte) && ok(react) ? 'PASS' : 'FAIL';
return {
  verdict: `${verdict} svelte ${svelte.label} ${JSON.stringify(svelte.added)}, react ${react.label} ${JSON.stringify(react.added)}`,
};
