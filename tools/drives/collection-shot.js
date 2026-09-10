// Put a collection demo in frame for a screenshot: wait for its rows, then scroll the
// section worth looking at to the top of the viewport. On a page that draws a card of
// the caller's own that is the section; anywhere else it is the demo itself.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework svelte --shot out.png \
//     --drive tools/drives/collection-shot.js
async function until(fn, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    const v = fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

const pane = await until(() => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null));
if (!pane) return { verdict: 'FAIL no demo pane' };

// Rows first: a shot of a skeleton says nothing.
await until(() => pane.querySelectorAll('tbody tr[data-row-key], [data-row-key]').length > 0);
await wait(1200);
const section = pane.querySelector('[data-testid="grid-card"]') ?? pane;
section.scrollIntoView({ block: 'start' });
window.scrollBy(0, -80);
await wait(400);
return { verdict: `PASS framed ${section === pane ? 'the demo' : 'the custom card'}` };
