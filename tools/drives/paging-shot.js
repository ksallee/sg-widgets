// Put the table in `scroll` mode with a page appended and the scroller at the bottom,
// for a screenshot of the rows the scroller brought in and the count under them.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework svelte --dark \
//     --shot shots/98-entity-table-svelte-dark.png --drive tools/drives/paging-shot.js
async function until(fn, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = fn();
    if (value) return value;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

const pane = await until(() => $$('[data-demo-name="entity-table"] [data-pane]').find((p) => p.offsetParent !== null));
if (!pane) return { verdict: 'FAIL no demo pane' };
const rows = () => pane.querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]').length;
if (!(await until(() => rows() > 0))) return { verdict: 'FAIL no rows' };

const scroll = [...pane.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Scroll');
if (!scroll) return { verdict: 'FAIL no Scroll button' };
scroll.click();
if (!(await until(() => pane.querySelector('[data-slot="entity-table-sentinel"]') && rows() === 25))) {
  return { verdict: `FAIL scroll mode left ${rows()} rows` };
}

const scroller = pane.querySelector('[data-slot="entity-table-scroll"]');
const before = rows();
scroller.scrollTop = scroller.scrollHeight;
if (!(await until(() => rows() > before))) return { verdict: 'FAIL the scroller loaded no page' };
await wait(600);

pane.querySelector('[data-slot="entity-table"]').scrollIntoView({ block: 'start' });
window.scrollBy(0, -80);
await wait(400);
// One more page on the way, so the shot catches the skeleton row under the rows: the
// row is appended below the fold, so the scroller follows it down.
scroller.scrollTop = scroller.scrollHeight;
await until(() => pane.querySelector('[data-slot="entity-table-loading"]'), 2000);
scroller.scrollTop = scroller.scrollHeight;
const loading = Boolean(pane.querySelector('[data-slot="entity-table-loading"]'));
return { verdict: `PASS framed ${rows()} rows in scroll mode, loading row up: ${loading}` };
