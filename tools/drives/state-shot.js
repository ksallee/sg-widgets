// Put the empty and the error state of a collection in frame for a screenshot: arm
// the read that fails, wait for the line, then scroll the pair to the top.
//
//   pnpm qa --start --path /widgets/grouped-list/ --framework svelte --shot out.png \
//     --drive tools/drives/state-shot.js
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

const states = await until(() => pane.querySelector('[data-demo-case="states"]'));
if (!states) return { verdict: 'FAIL no states demo' };
const lists = () => [...states.querySelectorAll('[data-slot="grouped-list"]')];
if (!(await until(() => lists().length === 2 && lists()[0].querySelector('[data-slot="state-line"]')))) {
  return { verdict: 'FAIL the empty list never settled' };
}

states.querySelector('[data-arm-failure]').click();
const line = await until(() => lists()[1].querySelector('[data-slot="grouped-list-page-error"]'));
if (!line) return { verdict: 'FAIL no error line' };

// The failed page keeps its rows, so the line is at the bottom of the scroller.
lists()[1].querySelector('[data-slot="grouped-list-scroll"]').scrollTop = 9999;
states.scrollIntoView({ block: 'start' });
window.scrollBy(0, -24);
await wait(400);

return { verdict: 'PASS the empty and the error state are in frame' };
