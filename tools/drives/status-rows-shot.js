// Opens a status multi picker and holds it open, for a shot of the list rows.
//
//   pnpm qa --start --path /widgets/status-multi-picker/ --framework svelte --drive tools/drives/status-rows-shot.js --shot shots/x.png

async function until(read, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

// A pane that is not on show keeps its widgets in the DOM, so the drawn one is the one
// to open.
const drawn = () => $$('[data-pane]').find((pane) => pane.getBoundingClientRect().height > 0);
const widget = await until(() => {
  const pane = drawn();
  const el = pane && $('[data-demo="p70"] [data-slot="status-multi-picker"]', pane);
  return el && !el.dataset.loading ? el : null;
});
if (!widget) return { verdict: 'FAIL no status multi picker settled' };
widget.scrollIntoView({ block: 'start' });
await wait(300);

// A closed popup stays in the DOM in one framework, so only rows on show count, and
// one framework opens on a click where the other opens on a pointer press.
const listed = () =>
  $$('[data-slot="status-multi-picker-option"]').filter(
    (row) => !row.closest('[data-closed]') && row.getClientRects().length > 0,
  );
const control = $('[data-slot="status-multi-picker-control"]', widget);
let rows = null;
for (const gesture of [() => control.click(), () => {
  control.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  control.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
}]) {
  gesture();
  rows = await until(() => (listed().length > 0 ? listed() : null), 4000);
  if (rows) break;
}
await wait(600);

return { verdict: rows ? `PASS ${rows.length} rows on show` : 'FAIL the list never opened' };
