// Build a status condition by hand in both panes and check what it serialises to.
// Add condition -> pick Status in the field picker -> pick "is any of" -> tick two
// statuses in the multi picker -> read the JSON.
const CODES = ['rev', 'fin'];

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
  setValue(search, 'sg_status_list');
  const rows = () => $$('[data-picker="field"] [data-slot="command-item"]');
  const option = await until(() => (rows().length === 1 ? rows()[0] : null), 'the field list');
  await wait(120);
  press(option);
  await until(
    () => $('[data-slot="filter-field"] [data-slot="field-picker-label"]', rowAt())?.textContent.includes('Status'),
    'the chosen field',
  );

  press($('[data-slot="filter-operator"]', rowAt()));
  press(await until(() => $('[data-slot="select-item"][data-preset="in"]'), 'the operator menu'));
  await until(() => $('[data-slot="filter-operator"]', rowAt()).textContent.includes('is any of'), 'the chosen operator');

  press($('[data-slot="status-multi-picker-trigger"]', rowAt()));
  await until(() => $(`[data-picker="status"] [data-status-code="${CODES[0]}"]`), 'the status list');
  for (const code of CODES) {
    press($(`[data-picker="status"] [data-status-code="${code}"]`));
    await wait(80);
  }
  await closePopovers();

  const filters = JSON.parse($('[data-testid="filter-json"]', pane).textContent);
  const added = filters.conditions.filter((c) => Array.isArray(c) && c[0] === 'sg_status_list' && c[1] === 'in');
  return { framework, added, path: rowAt().dataset.path };
}

const svelte = await run('svelte');
const react = await run('react');

function ok(result) {
  const last = result.added.at(-1);
  return Array.isArray(last) && CODES.every((code) => last[2].includes(code)) && last[2].length === CODES.length;
}

const verdict = ok(svelte) && ok(react) ? 'PASS' : 'FAIL';
return { verdict: `${verdict} svelte=${JSON.stringify(svelte.added.at(-1))} react=${JSON.stringify(react.added.at(-1))}` };
