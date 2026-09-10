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
  const count = () => $('[data-testid="result-count"]', pane).textContent.trim();
  await until(() => /^\d+ Shots? match/.test(count()), 'the first count');
  const before = count();

  const pillOf = () => $('[data-slot="filter-pill"][data-field="sg_status_list"]', pane);
  // An untouched facet is one quiet button; ticking a value replaces it with the
  // segmented pill, so the node is taken again after the edit.
  press(await until(pillOf, 'the status pill'));
  const option = await until(() => $('[data-slot="popover-content"] [data-option]'), 'the value list');
  const code = option.dataset.option;
  const shown = $('[data-slot="facet-count"]', option).textContent.trim();
  press(option);
  await closePopovers();

  await until(() => /^\d+ Shots? match/.test(count()) && count() !== before, 'the narrowed count');
  const pill = await until(() => pillOf()?.dataset.active === 'true' ? pillOf() : null, 'the segmented pill');
  // Base UI's select icon leaves a bare glyph inside its svg, which no one sees and
  // `textContent` does, so a segment is read by the words in it.
  const segments = ['field', 'operator', 'values'].map((part) =>
    ($(`[data-slot="filter-pill-${part}"]`, pill)?.textContent ?? '').replace(/[^\w ,]/g, '').trim(),
  );
  return { framework, code, shown, before, after: count(), segments, pill: pill.textContent.trim() };
}

const svelte = await run('svelte');
const react = await run('react');

// The pill's own count is the number of rows that value holds, so it is what the
// narrowed query must return, and the pill reads back as three segments.
const ok = (r) =>
  r.after.startsWith(`${r.shown} Shot`) && r.segments[1] === 'is any of' && r.segments[0] && r.segments[2];
const verdict = ok(svelte) && ok(react) ? 'PASS' : 'FAIL';
return {
  verdict: `${verdict} svelte ${svelte.code} ${svelte.before} -> ${svelte.after}, react ${react.code} ${react.before} -> ${react.after}`,
  segments: { svelte: svelte.segments, react: react.segments },
  counted: { svelte: svelte.shown, react: react.shown },
};
