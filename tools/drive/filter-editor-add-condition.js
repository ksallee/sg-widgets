// Build a status condition by hand in both panes and check what it serialises to.
// Add condition -> pick Status -> pick "is any of" -> tick two values -> read the JSON.
const CODES = ['rev', 'fin'];

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  }
}

async function until(find, label) {
  for (let i = 0; i < 60; i++) {
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
  const row = $$('[data-slot="filter-row"]', pane).at(-1);

  press($('[data-slot="filter-field"]', row));
  press(await until(() => $('[data-slot="popover-content"] [data-field="sg_status_list"]'), 'the field list'));
  await until(() => $('[data-slot="filter-field"]', row).textContent.includes('Status'), 'the chosen field');

  press($('[data-slot="filter-operator"]', row));
  press(await until(() => $('[data-slot="select-item"][data-preset="in"]'), 'the operator menu'));
  await until(() => $('[data-slot="filter-operator"]', row).textContent.includes('is any of'), 'the chosen operator');

  press($('[data-slot="filter-value-trigger"]', row));
  await until(() => $(`[data-slot="popover-content"] [data-option="${CODES[0]}"]`), 'the value list');
  for (const code of CODES) {
    press($(`[data-slot="popover-content"] [data-option="${code}"]`));
    await wait(60);
  }
  await closePopovers();

  const filters = JSON.parse($('[data-testid="filter-json"]', pane).textContent);
  const added = filters.conditions.filter((c) => Array.isArray(c) && c[0] === 'sg_status_list' && c[1] === 'in');
  return { framework, added, path: row.dataset.path };
}

const svelte = await run('svelte');
const react = await run('react');

function ok(result) {
  const last = result.added.at(-1);
  return Array.isArray(last) && CODES.every((code) => last[2].includes(code)) && last[2].length === CODES.length;
}

const verdict = ok(svelte) && ok(react) ? 'PASS' : 'FAIL';
return { verdict: `${verdict} svelte=${JSON.stringify(svelte.added.at(-1))} react=${JSON.stringify(react.added.at(-1))}` };
