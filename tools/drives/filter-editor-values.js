// The value controls the demo tree draws, and the frame the filter-editor screenshots take.
//
//   pnpm qa --start --path /widgets/filter-editor/ --framework svelte --shot shots/x.png \
//     --drive tools/drives/filter-editor-values.js
//
// The catalogue tree holds one raw list of values, one list field on many values, a colour
// pair and two relative windows, so the list editor, ListMultiPicker, ColorEditor and the
// count-and-unit pair are all on the page at once.
async function until(test, tries = 200) {
  for (let i = 0; i < tries && !test(); i += 1) await wait(50);
  return test();
}

const panes = () => $$('[data-sg-demo] [data-pane]');

if (!(await until(() => panes().length > 0 && $$('[data-slot="filter-row"]').length > 0))) {
  return { verdict: `FAIL ${panes().length} panes and ${$$('[data-slot="filter-row"]').length} rows after the wait` };
}
// The count line is debounced and the first read is a summarize, so both panes settle late.
await until(() => $$('[data-testid="result-count"]').every((p) => p.textContent.trim() !== 'Counting…'));
await wait(400);

const report = [];
const failures = [];

for (const pane of panes()) {
  const framework = pane.getAttribute('data-pane');
  const seen = {
    framework,
    lists: $$('[data-slot="filter-list"]', pane).length,
    listValues: $$('[data-slot="filter-list-value"]', pane).length,
    multiSelects: $$('[data-slot="list-multi-picker"]', pane).length,
    colours: $$('[data-slot="color-editor"]', pane).length,
    windows: $$('[data-slot="filter-window"]', pane).length,
    counts: $$('[data-slot="filter-window"] input[aria-label="Count"]', pane).map((i) => i.value),
    units: $$('[data-slot="filter-window"] [data-slot="list-picker"]', pane).map((s) => s.textContent.trim()),
    errors: $$('.text-destructive', pane).map((el) => el.textContent.trim()),
  };
  report.push(seen);

  if (seen.lists !== 1) failures.push(`${framework}: ${seen.lists} list editors, wanted 1`);
  if (seen.listValues !== 2) failures.push(`${framework}: ${seen.listValues} list values, wanted 2`);
  if (seen.multiSelects !== 1) failures.push(`${framework}: ${seen.multiSelects} multi selects, wanted 1`);
  if (seen.colours !== 2) failures.push(`${framework}: ${seen.colours} colour editors, wanted 2`);
  if (seen.windows !== 2) failures.push(`${framework}: ${seen.windows} relative windows, wanted 2`);
  if (seen.counts.join(',') !== '3,2') failures.push(`${framework}: counts read ${seen.counts.join(',')}, wanted 3,2`);
  if (!/months/i.test(seen.units[0] ?? '')) failures.push(`${framework}: the first unit reads "${seen.units[0]}"`);
  if (!/weeks/i.test(seen.units[1] ?? '')) failures.push(`${framework}: the second unit reads "${seen.units[1]}"`);
  if (seen.errors.length > 0) failures.push(`${framework}: ${seen.errors.join(' / ')}`);
}

// The same run frames the screenshots: the demo sits well down the page.
$('[data-sg-demo]')?.scrollIntoView({ block: 'start' });
await wait(400);

return {
  verdict:
    failures.length === 0
      ? `PASS the list editor, the multi select, both colour editors and both windows in ${report.length} pane(s)`
      : `FAIL ${failures.join('; ')}`,
  panes: report,
};
