// Live mode: the count under the editor is the site's own total for the tree.
//
//   pnpm qa --start --live --project 1180 --path /widgets/filter-editor/ --drive tools/drive/live-filter-editor-results.js
const source = $('[data-sg-demo]')?.dataset.source;
if (source !== 'live') return { verdict: `FAIL the toolbar is in ${source} mode, not live` };

const panes = () => $$('[data-sg-demo] [data-pane]');
const countOf = (pane) => ($('[data-testid="result-count"]', pane)?.textContent ?? '').trim();
const rowsOf = (pane) => $$('[data-slot="entity-table"] tbody tr[data-row-key]', pane).length;

for (let i = 0; i < 160; i++) {
  if (panes().every((pane) => countOf(pane).includes('match'))) break;
  await wait(250);
}
await wait(500);

const seen = panes().map((pane) => ({
  framework: pane.dataset.pane,
  count: countOf(pane),
  total: Number((countOf(pane).match(/^(\d+) Versions? match/) ?? [])[1] ?? NaN),
  rows: rowsOf(pane),
}));

const project = JSON.parse(localStorage.getItem('sg-demo:project') ?? 'null');
const ok = seen.length > 0 && seen.every((pane) => Number.isFinite(pane.total) && pane.total > 0 && pane.rows > 0);

return {
  verdict: `${ok ? 'PASS' : 'FAIL'} project ${project?.id} ${seen.map((p) => `${p.framework} ${p.count} ${p.rows} rows`).join(', ')}`,
  project,
  seen,
};
