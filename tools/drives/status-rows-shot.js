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

const widget = await until(() => {
  const el = $('[data-demo="p70"] [data-slot="status-multi-picker"]');
  return el && !el.dataset.loading ? el : null;
});
if (!widget) return { verdict: 'FAIL no status multi picker settled' };
widget.scrollIntoView({ block: 'start' });
await wait(300);

const control = $('[data-slot="status-multi-picker-control"]', widget);
control.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
control.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
control.click();
const rows = await until(() => {
  const found = $$('[data-slot="status-multi-picker-option"]');
  return found.length > 0 ? found : null;
}, 8000);
await wait(600);

return { verdict: rows ? `PASS ${rows.length} rows on show` : 'FAIL the list never opened' };
