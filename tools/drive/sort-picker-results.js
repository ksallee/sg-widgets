// The table under the picker is read in the order the picker's string asks for.
//
//   pnpm qa --start --path /widgets/sort-picker/ --drive tools/drive/sort-picker-results.js
const panes = () => $$('[data-sg-demo] [data-pane]');
const rowsOf = (pane) => $$('[data-slot="entity-table"] tbody tr[data-row-key]', pane);
const column = (pane, path) =>
  rowsOf(pane).map((row) => (row.querySelector(`td[data-column="${path}"]`)?.textContent ?? '').trim());

for (let i = 0; i < 160; i++) {
  if (panes().every((pane) => rowsOf(pane).length > 0)) break;
  await wait(250);
}
await wait(500);

const seen = panes().map((pane) => ({
  framework: pane.dataset.pane,
  sort: ($('[data-testid="sort-string"]', pane)?.textContent ?? '').trim(),
  statuses: column(pane, 'sg_status_list'),
  codes: column(pane, 'code'),
}));

// The first key is the status, so a status is one contiguous run of rows -- the cell
// shows the label, which does not sort like the code the API ordered on -- and the
// second key is the code descending, which holds inside every run.
function ordered(pane) {
  const labels = pane.statuses;
  const seen = new Set();
  for (let i = 0; i < labels.length; i += 1) {
    if (i > 0 && labels[i] !== labels[i - 1]) {
      if (seen.has(labels[i])) return false;
      seen.add(labels[i - 1]);
    }
    if (i > 0 && labels[i] === labels[i - 1] && pane.codes[i] > pane.codes[i - 1]) return false;
  }
  return labels.length > 0;
}

const ok = seen.length === 2 && seen.every((pane) => pane.sort === 'sg_status_list,-code' && ordered(pane));
return {
  verdict: `${ok ? 'PASS' : 'FAIL'} ${seen.map((p) => `${p.framework} ${p.sort} ${p.codes.length} rows`).join(', ')}`,
  seen: seen.map((p) => ({ ...p, statuses: p.statuses.slice(0, 6), codes: p.codes.slice(0, 6) })),
};
