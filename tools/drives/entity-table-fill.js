// The table fills its scrolling box: on a box wider than the columns, the last column takes the
// width the others leave; on a narrower one nothing changes and the box scrolls. In compact density
// a description stays on one line, whole in its title; in default density it wraps.
const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const root = () => pane().querySelector('[data-slot="entity-table"]');
const scroller = () => pane().querySelector('[data-slot="entity-table-scroll"]');
const bodyRows = () => [...pane().querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]')];
const compactToggle = () => [...pane().querySelectorAll('button[aria-pressed]')].find((b) => b.textContent.trim() === 'Compact');
const textSpan = () =>
  bodyRows()
    .map((r) => r.querySelector('td[data-column="description"] [data-slot="field-value"] > span'))
    .find((s) => s && s.textContent.trim().length > 0);

for (let i = 0; i < 40 && bodyRows().length === 0; i += 1) await wait(250);
if (!scroller()) return { verdict: 'FAIL no entity-table rendered' };
await wait(400);

const width = (el) => Math.round(el.getBoundingClientRect().width);
// The columns' drawn width: the docs page's own table styles add spacing around a table element.
const columns = () => [...scroller().querySelectorAll('thead th')].reduce((sum, th) => sum + th.getBoundingClientRect().width, 0);
const table = () => ({ getBoundingClientRect: () => ({ width: columns() }) });
const lastCol = () => parseFloat([...scroller().querySelectorAll('colgroup col')].at(-1)?.style.width ?? '0');

// Narrow: the columns overflow, the table keeps its own width and the box scrolls.
const narrow = { table: width(table()), box: scroller().clientWidth, last: lastCol() };
const scrolls = narrow.table >= narrow.box;

// Wide: the box is wider than the columns, the last column grows to fill it.
root().style.width = `${narrow.table + 600}px`;
await wait(500);
const wide = { table: width(table()), box: scroller().clientWidth, last: lastCol() };
const fills = Math.abs(wide.table - wide.box) <= 1 && wide.last >= narrow.last + 590;
root().style.width = '';

const toggle = compactToggle();
if (!toggle) return { verdict: 'FAIL no Compact toggle in the demo' };
if (toggle.getAttribute('aria-pressed') !== 'true') toggle.click();
await wait(500);
const compactSpan = textSpan();
const compactStyle = compactSpan ? getComputedStyle(compactSpan) : null;
const oneLine = compactStyle?.whiteSpace === 'nowrap' && compactStyle?.textOverflow === 'ellipsis' && compactSpan.getAttribute('title') === compactSpan.textContent;
const tallest = Math.max(...bodyRows().slice(0, 15).map((r) => Math.round(r.getBoundingClientRect().height)));

toggle.click();
await wait(500);
const defaultSpan = textSpan();
const wrapped = defaultSpan ? getComputedStyle(defaultSpan).whiteSpace === 'pre-wrap' : false;

const ok = scrolls && fills && oneLine && wrapped && tallest <= 40;
return {
  verdict: ok ? 'PASS the last column fills a wide box, a narrow box scrolls; compact text is one line, default wraps' : 'FAIL',
  narrow,
  wide,
  oneLine,
  compactTallestRow: tallest,
  wrapped
};
