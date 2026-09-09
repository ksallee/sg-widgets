// Tick one status value in the first pill and check the row count follows.
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
  const count = () => $('[data-testid="matching"]', pane).textContent.trim();
  await until(() => /^\d+ matching/.test(count()), 'the first count');
  const before = count();

  const pill = await until(() => $('[data-slot="filter-pill"][data-field="sg_status_list"]', pane), 'the status pill');
  press(pill);
  const option = await until(() => $('[data-slot="popover-content"] [data-option]'), 'the value list');
  const code = option.dataset.option;
  const shown = $('[data-slot="facet-count"]', option).textContent.trim();
  press(option);
  await closePopovers();

  await until(() => /^\d+ matching/.test(count()) && count() !== before, 'the narrowed count');
  return { framework, code, shown, before, after: count(), pill: pill.textContent.trim() };
}

const svelte = await run('svelte');
const react = await run('react');

// The pill's own count is the number of rows that value holds, so it is what the
// narrowed query must return.
const ok = (r) => r.after.startsWith(`${r.shown} matching`) && r.pill.includes('is any of');
const verdict = ok(svelte) && ok(react) ? 'PASS' : 'FAIL';
return { verdict: `${verdict} svelte ${svelte.code} ${svelte.before} -> ${svelte.after}, react ${react.code} ${react.before} -> ${react.after}` };
