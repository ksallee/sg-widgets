// The output section of a filter demo: a settled count and the rows behind it, in both
// panes. Used on the pages whose result set is not driven, to prove it reads.
//
//   pnpm qa --start --path /widgets/filter-bar/ --drive tools/drive/filter-results-render.js
const panes = () => $$('[data-sg-demo] [data-pane]');
const countOf = (pane) => ($('[data-testid="result-count"]', pane)?.textContent ?? '').trim();
const rowsOf = (pane) => $$('[data-slot="entity-table"] tbody tr[data-row-key], [data-slot="grouped-list"] [data-row-key]', pane).length;

for (let i = 0; i < 160; i++) {
  if (panes().every((pane) => countOf(pane).includes('match'))) break;
  await wait(250);
}
await wait(600);

const seen = panes().map((pane) => ({
  framework: pane.dataset.pane,
  count: countOf(pane),
  rows: rowsOf(pane),
}));

const ok = seen.length === 2 && seen.every((pane) => /^\d+ \w+s? match/.test(pane.count) && pane.rows > 0);
return {
  verdict: `${ok ? 'PASS' : 'FAIL'} ${seen.map((p) => `${p.framework} ${p.count} ${p.rows} rows`).join(', ')}`,
  seen,
};
