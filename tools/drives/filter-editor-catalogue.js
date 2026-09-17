// Every row of the seeded catalogue tree, read back off the page.
//
//   pnpm qa --start --path /widgets/filter-editor/ --framework both \
//     --drive tools/drives/filter-editor-catalogue.js
//
// The table below is the demo's first tree, group by group. A row passes when its field
// trigger reads a resolved path rather than the raw one the demo seeded, its operator
// reads the menu entry that path's data type puts on the operator, and its value draws
// the control that data type and that arity call for. Both frameworks draw one tree, so
// both are measured against one table.
//
// `value` is a selector inside the row's value cell, `null` for an entry that carries its
// own value and draws no editor. `inner` is what a range, a list or a window holds.
const ROWS = [
  // text
  { path: '0.0', field: 'Version Name', operator: 'contains', value: '[data-slot="text-editor"]' },
  { path: '0.1', field: 'Version Name', operator: 'starts with', value: '[data-slot="text-editor"]' },
  { path: '0.2', field: 'Path to Movie', operator: 'ends with', value: '[data-slot="text-editor"]' },
  { path: '0.3', field: 'Description', operator: 'does not contain', value: '[data-slot="text-editor"]' },
  { path: '0.4', field: 'Department', operator: 'is not', value: '[data-slot="text-editor"]' },

  // number, float, percent, duration
  { path: '1.0', field: 'First Frame', operator: 'between', value: '[data-slot="filter-range"]', inner: '[data-slot="number-editor"]', innerCount: 2 },
  { path: '1.1', field: 'Last Frame', operator: 'greater than', value: '[data-slot="number-editor"]' },
  { path: '1.2', field: 'Frame Count', operator: 'less than', value: '[data-slot="number-editor"]' },
  { path: '1.3', field: 'First Frame', operator: 'is any of', value: '[data-slot="filter-list"]', inner: '[data-slot="number-editor"]', innerCount: 2 },
  { path: '1.4', field: 'Movie Frame Rate', operator: 'is not', value: '[data-slot="number-editor"]' },
  { path: '1.5', field: 'Complexity', operator: 'greater than', value: '[data-slot="number-editor"]' },
  { path: '1.6', field: 'Working Duration', operator: 'greater than', value: '[data-slot="number-editor"]' },

  // entity and multi_entity
  { path: '2.0', field: 'Sequence', operator: 'is', value: '[data-slot="entity-picker"][data-multiple="false"]' },
  { path: '2.1', field: 'Artist', operator: 'is not', value: '[data-slot="entity-picker"][data-multiple="false"]' },
  { path: '2.2', field: 'Link', operator: 'is any of', value: '[data-slot="entity-picker"][data-multiple="true"]' },
  { path: '2.3', field: 'Assets', operator: 'is none of', value: '[data-slot="entity-picker"][data-multiple="true"]' },
  { path: '2.4', field: 'Link', operator: 'type is', value: '[data-slot="text-editor"]' },
  { path: '2.5', field: 'Link', operator: 'type is not', value: '[data-slot="text-editor"]' },
  { path: '2.6', field: 'Playlists', operator: 'name contains', value: '[data-slot="text-editor"]' },

  // status_list and list
  { path: '3.0', field: 'Status', operator: 'is any of', value: '[data-slot="status-multi-picker"]' },
  { path: '3.1', field: 'Status', operator: 'is none of', value: '[data-slot="status-multi-picker"]' },
  { path: '3.2', field: 'Status', operator: 'is', value: '[data-slot="status-picker"]' },
  { path: '3.3', field: 'Version Type', operator: 'is', value: '[data-slot="list-picker"]' },
  { path: '3.4', field: 'Status', operator: 'is any of', value: '[data-slot="list-multi-picker"]' },

  // date and date_time
  { path: '4.0', field: 'Turnover Date', operator: 'is', value: '[data-slot="date-editor"]' },
  { path: '4.1', field: 'Start Date', operator: 'is not', value: '[data-slot="date-editor"]' },
  { path: '4.2', field: 'Turnover Date', operator: 'between', value: '[data-slot="filter-range"]', inner: '[data-slot="date-editor"]', innerCount: 2 },
  { path: '4.3', field: 'Date Created', operator: 'after', value: '[data-slot="date-time-editor"]' },
  { path: '4.4', field: 'Date Created', operator: 'before', value: '[data-slot="date-time-editor"]' },
  { path: '4.5', field: 'Date Created', operator: 'in the last', value: '[data-slot="filter-window"]', inner: '[data-slot="list-picker"]', innerCount: 1 },
  { path: '4.6', field: 'Turnover Date', operator: 'in the next', value: '[data-slot="filter-window"]', inner: '[data-slot="list-picker"]', innerCount: 1 },
  { path: '4.7', field: 'Date Updated', operator: 'yesterday', value: null },
  { path: '4.8', field: 'Date Created', operator: 'this week', value: null },
  { path: '4.9', field: 'Turnover Date', operator: 'next month', value: null },

  // checkbox, colour and the empty pair
  { path: '5.0', field: 'Client Approved', operator: 'is', value: '[data-slot="checkbox-editor"]' },
  { path: '5.1', field: 'Omitted', operator: 'is', value: '[data-slot="checkbox-editor"]' },
  { path: '5.2.0', field: 'Bar Colour', operator: 'is', value: '[data-slot="color-editor"]' },
  { path: '5.2.1', field: 'Bar Colour', operator: 'is not', value: '[data-slot="color-editor"]' },
  { path: '5.2.2.0', field: 'Department', operator: 'is empty', value: null },
  { path: '5.2.2.1', field: 'Department', operator: 'is not empty', value: null },
];

// Any control an editor draws inside a value cell. A pinned entry draws none of them.
const CONTROLS =
  '[data-slot="text-editor"], [data-slot="number-editor"], [data-slot="date-editor"], [data-slot="date-time-editor"],' +
  '[data-slot="color-editor"], [data-slot="url-editor"], [data-slot="checkbox-editor"], [data-slot="list-picker"],' +
  '[data-slot="list-multi-picker"], [data-slot="status-picker"], [data-slot="status-multi-picker"],' +
  '[data-slot="entity-picker"], [data-slot="filter-range"], [data-slot="filter-list"], [data-slot="filter-window"]';

async function until(test, tries = 200) {
  for (let i = 0; i < tries && !test(); i += 1) await wait(50);
  return test();
}

const panes = () => $$('[data-sg-demo] [data-pane]');

/** The catalogue is the page's first editor; the Note and the sized ones follow it. */
const catalogueOf = (pane) => $$('[data-slot="filter-editor"]', pane)[0] ?? null;

function operatorOf(row) {
  // Base UI prints the select's own chevron inside the trigger, so the label is a prefix.
  return ($('[data-slot="filter-operator"]', row)?.textContent.trim() ?? '').replace(/[^a-z ]/gi, '').trim();
}

if (!(await until(() => panes().length > 0 && panes().every((p) => catalogueOf(p) !== null)))) {
  return { verdict: 'FAIL no editor was drawn' };
}
// A field trigger draws a skeleton until the schema answers, and the count line is debounced.
await until(() => panes().every((p) => $$('[data-slot="field-picker-label"]', catalogueOf(p)).length >= ROWS.length), 400);
await until(() => $$('[data-testid="result-count"]').every((p) => p.textContent.trim() !== 'Counting…'), 400);
await wait(600);

const report = [];
const failures = [];

for (const pane of panes()) {
  const framework = pane.getAttribute('data-pane');
  const editor = catalogueOf(pane);
  const rows = $$('[data-slot="filter-row"]', editor);
  const seen = [];

  if (rows.length !== ROWS.length) failures.push(`${framework}: ${rows.length} rows, wanted ${ROWS.length}`);

  for (const want of ROWS) {
    const row = $(`[data-slot="filter-row"][data-path="${want.path}"]`, editor);
    if (!row) {
      failures.push(`${framework}: no row at ${want.path}`);
      continue;
    }
    const field = $('[data-slot="field-picker-label"]', row)?.textContent.trim() ?? '';
    const operator = operatorOf(row);
    const cell = $('[data-slot="filter-value"]', row);
    const drawn = $$(CONTROLS, cell).map((el) => el.getAttribute('data-slot'));
    seen.push({ path: want.path, field, operator, drawn });

    // A path the schema does not hold falls back to the raw dotted path.
    if (field === '') failures.push(`${framework} ${want.path}: the field trigger reads nothing`);
    else if (field.includes('.')) failures.push(`${framework} ${want.path}: the field reads the raw path "${field}"`);
    else if (!field.includes(want.field)) failures.push(`${framework} ${want.path}: the field reads "${field}", wanted ${want.field}`);

    if (operator !== want.operator) {
      failures.push(`${framework} ${want.path}: the operator reads "${operator}", wanted "${want.operator}"`);
    }

    if (want.value === null) {
      if (drawn.length > 0) failures.push(`${framework} ${want.path}: ${want.operator} drew ${drawn.join(', ')}`);
      continue;
    }
    const control = $(want.value, cell);
    if (!control) {
      failures.push(`${framework} ${want.path}: the value drew ${drawn.join(', ') || 'nothing'}, wanted ${want.value}`);
      continue;
    }
    if (want.inner) {
      const held = $$(want.inner, control).length;
      if (held !== want.innerCount) {
        failures.push(`${framework} ${want.path}: ${want.value} holds ${held} of ${want.inner}, wanted ${want.innerCount}`);
      }
    }
  }

  const errors = $$('.text-destructive', pane).map((el) => el.textContent.trim());
  if (errors.length > 0) failures.push(`${framework}: ${errors.join(' / ')}`);
  report.push({ framework, rows: rows.length, count: $('[data-testid="result-count"]', pane)?.textContent.trim() ?? '', seen });
}

if (report.length === 0) failures.push('no framework pane was on show');

// The same run frames the screenshots on the tree.
$('[data-sg-demo]')?.scrollIntoView({ block: 'start' });
await wait(400);

const said = report.map((r) => `${r.framework} ${r.rows} rows, ${r.count}`).join('; ');

return {
  verdict: failures.length === 0 ? `PASS ${ROWS.length} rows read back in each pane: ${said}` : `FAIL ${failures.join('; ')}`,
  panes: report,
};
