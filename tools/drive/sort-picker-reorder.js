// Flip the first key to descending, move it down, and read the sort string back.
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
  const sort = () => $('[data-testid="sort-string"]', pane).textContent.trim();
  const before = sort();

  press($('[data-slot="sort-trigger"]', pane));
  const key = await until(() => $('[data-slot="popover-content"] [data-slot="sort-key"]'), 'the key list');
  press($$('[data-slot="toggle-group-item"]', key).at(-1));
  await until(() => sort() !== before, 'the flipped direction');
  const flipped = sort();

  press($('[data-slot="popover-content"] [data-slot="sort-down"]'));
  await until(() => sort() !== flipped, 'the moved key');
  const moved = sort();

  await closePopovers();
  return { framework, before, flipped, moved };
}

const svelte = await run('svelte');
const react = await run('react');
const ok = (r) => r.before === 'sg_status_list,-code' && r.flipped === '-sg_status_list,-code' && r.moved === '-code,-sg_status_list';
const verdict = ok(svelte) && ok(react) ? 'PASS' : 'FAIL';
return { verdict: `${verdict} svelte ${svelte.before} -> ${svelte.flipped} -> ${svelte.moved}, react ${react.before} -> ${react.flipped} -> ${react.moved}` };
