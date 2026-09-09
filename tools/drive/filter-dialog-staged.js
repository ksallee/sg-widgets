// Nothing leaves the dialog until Apply: drop a row and cancel, then drop it and apply.
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  }
}

async function until(find, label) {
  for (let i = 0; i < 80; i++) {
    const found = find();
    if (found) return found;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

// The dialog is portalled to the body, so only one may be open at a time.
async function closed() {
  await until(() => $$('[data-slot="dialog-content"]').length === 0 || null, 'the dialog to close');
}

async function open(pane) {
  await closed();
  press($$('[data-slot="filter-launch"]', pane).at(-1));
  return until(() => $('[data-slot="dialog-content"]'), 'the dialog');
}

async function run(framework) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) throw new Error(`no ${framework} pane`);
  const json = () => $('[data-testid="dialog-json"]', pane).textContent;
  const rows = () => JSON.parse(json()).conditions.length;
  const before = rows();

  let dialog = await open(pane);
  press($('[data-slot="filter-row"] [data-slot="filter-remove"]', dialog));
  await until(() => $$('[data-slot="filter-row"]', $('[data-slot="dialog-content"]')).length === before - 1, 'the drop');
  press($('[data-slot="filter-cancel"]', $('[data-slot="dialog-content"]')));
  await closed();
  const afterCancel = rows();

  dialog = await open(pane);
  press($('[data-slot="filter-row"] [data-slot="filter-remove"]', dialog));
  await until(() => $$('[data-slot="filter-row"]', $('[data-slot="dialog-content"]')).length === before - 1, 'the drop');
  press($('[data-slot="filter-apply"]', $('[data-slot="dialog-content"]')));
  await closed();
  const afterApply = rows();

  const count = $('[data-slot="filter-count"]', pane).textContent.trim();
  return { framework, before, afterCancel, afterApply, count };
}

const svelte = await run('svelte');
const react = await run('react');
const ok = (r) => r.before === 2 && r.afterCancel === 2 && r.afterApply === 1 && r.count === '1';
const verdict = ok(svelte) && ok(react) ? 'PASS' : 'FAIL';
return {
  verdict: `${verdict} svelte ${JSON.stringify(svelte)}, react ${JSON.stringify(react)}`,
};
