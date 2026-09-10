// The demo tree's relative-date rows, and what the site answers for the tree holding them.
//
//   pnpm qa --start --path /widgets/filter-editor/ --drive tools/drives/filter-editor-dates.js --framework both
//
// The tree opens with `created_at in_last [3, MONTH]` and `entity.Shot.sg_turnover_date
// in_next [2, WEEK]`. A pane passes when both rows draw their count and unit, the serialised
// filter names both relations, and the result set under the editor answers a count of rows
// rather than a refusal.
async function until(test, tries = 80) {
  for (let i = 0; i < tries && !test(); i += 1) await wait(250);
  return test();
}

const panes = () => $$('[data-sg-demo] [data-pane]');

function rowsOf(pane) {
  return $$('[data-slot="filter-row"]', pane).map((row) => ({
    field: $('[data-slot="field-picker-label"]', row)?.textContent.trim() ?? '',
    // Base UI prints the select's own chevron inside the trigger, so the label is a prefix.
    operator: ($('[data-slot="filter-operator"]', row)?.textContent.trim() ?? '').replace(/[^a-z ]/gi, '').trim(),
    value: $('[data-slot="filter-value"]', row)?.textContent.trim() ?? '',
    count: $('[data-slot="filter-value"] input[aria-label="Count"]', row)?.value ?? null,
  }));
}

await until(() => panes().length > 0 && $$('[data-slot="filter-row"]').length > 0);
// The count line is debounced and the first read is a summarize, so both panes settle late.
await until(() => $$('[data-testid="result-count"]').every((p) => p.textContent.trim() !== 'Counting…'));

const report = [];
const failures = [];

for (const pane of panes()) {
  const framework = pane.getAttribute('data-pane');
  const rows = rowsOf(pane);
  const relative = rows.filter((row) => row.operator === 'in the last' || row.operator === 'in the next');
  const json = $('[data-testid="filter-json"]', pane)?.textContent ?? '';
  const count = $('[data-testid="result-count"]', pane)?.textContent.trim() ?? '';
  const matched = /^(\d+) Versions? match/.exec(count);
  const errors = $$('.text-destructive', pane).map((el) => el.textContent.trim());

  report.push({ framework, rows, count, errors });

  if (relative.length !== 2) failures.push(`${framework}: ${relative.length} relative rows, wanted 2`);
  for (const row of relative) {
    if (!row.count || Number(row.count) < 1) failures.push(`${framework}: ${row.operator} has no count`);
    if (!/month|week/i.test(row.value)) failures.push(`${framework}: ${row.operator} has no unit`);
  }
  if (!json.includes('in_last') || !json.includes('in_next')) {
    failures.push(`${framework}: the serialised filter names neither in_last nor in_next`);
  }
  if (!matched) failures.push(`${framework}: the count line reads "${count}"`);
  else if (Number(matched[1]) === 0) failures.push(`${framework}: the tree matched no rows`);
  if (errors.length > 0) failures.push(`${framework}: ${errors.join(' / ')}`);
}

// The same run frames the screenshots: the demo sits well down the page.
$('[data-sg-demo]')?.scrollIntoView({ block: 'start' });
await wait(400);

const counts = report.map((r) => `${r.framework} ${r.count}`).join('; ');

return {
  verdict: failures.length === 0 ? `PASS ${counts}` : `FAIL ${failures.join('; ')}`,
  panes: report,
};
