// A row with no field is not a filter: adding one must leave the serialised value alone.
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

async function run(framework) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) throw new Error(`no ${framework} pane`);
  const json = () => $('[data-testid="filter-json"]', pane).textContent;
  const before = json();
  const rows = $$('[data-slot="filter-row"]', pane).length;

  press($('[data-slot="filter-add-condition"][data-path=""]', pane));
  await until(() => $$('[data-slot="filter-row"]', pane).length === rows + 1, 'the blank row');
  await wait(200);

  return { framework, unchanged: json() === before, rows: $$('[data-slot="filter-row"]', pane).length };
}

const svelte = await run('svelte');
const react = await run('react');
const pass = svelte.unchanged && react.unchanged && svelte.rows === 7 && react.rows === 7;
return {
  verdict: `${pass ? 'PASS' : 'FAIL'} svelte rows=${svelte.rows} unchanged=${svelte.unchanged}, react rows=${react.rows} unchanged=${react.unchanged}`,
};
