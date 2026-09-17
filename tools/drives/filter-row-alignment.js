// A condition row's own controls stay on the row's first line, however tall its value grows.
//
//   pnpm qa --start --path /widgets/filter-editor/ --framework both --drive tools/drives/filter-row-alignment.js
//
// The demo tree holds rows on `is any of`, whose value is one line per value plus the row that
// adds one. The field picker, the operator menu and the remove control belong to the row and
// not to the value, so all three sit on the first value line's vertical centre whatever the
// list grows to. The row carries no grip: the remove control is its only control outside the
// wrapping band, and it holds its own `self-start` box.
const TOLERANCE = 1.5;

async function until(test, tries = 80) {
  for (let i = 0; i < tries && !test(); i += 1) await wait(250);
  return test();
}

const panes = () => $$('[data-sg-demo] [data-pane]').filter((p) => p.offsetParent !== null);

function box(el) {
  const r = el.getBoundingClientRect();
  const round = (n) => Math.round(n * 10) / 10;
  return { top: round(r.top), height: round(r.height), centre: round(r.top + r.height / 2) };
}

/** The row whose value holds more than one line, and every part measured against its first. */
function measure(pane) {
  const row = $$('[data-slot="filter-row"]', pane).find((r) => $$('[data-slot="filter-list-value"]', r).length >= 2);
  if (!row) return null;
  const lines = $$('[data-slot="filter-list-value"]', row);
  const field = $('[data-slot="filter-field"]', row);
  const parts = {
    field: box($('[data-slot="field-picker-trigger"]', field) ?? field),
    operator: box($('[data-slot="filter-operator"]', row)),
    remove: box($('[data-slot="filter-remove"]', row)),
  };
  const first = box(lines[0]);
  const offset = (part) => Math.round((parts[part].centre - first.centre) * 10) / 10;
  return {
    path: row.dataset.path,
    values: lines.length,
    row: box(row),
    ...parts,
    firstValue: first,
    lastValue: box(lines[lines.length - 1]),
    add: box($('[data-slot="filter-list-add"]', row)),
    offsets: { field: offset('field'), operator: offset('operator'), remove: offset('remove') },
    element: row,
  };
}

await until(() => panes().length > 0 && $$('[data-slot="filter-row"]').length > 0);
await wait(600);

const report = [];
const failures = [];
let framed = null;

for (const pane of panes()) {
  const framework = pane.getAttribute('data-pane');
  const m = measure(pane);
  if (!m) {
    failures.push(`${framework}: no row holds two values`);
    continue;
  }
  framed = framed ?? m.element;
  const { element, ...seen } = m;
  report.push({ framework, ...seen });

  // The check only means something on a row whose value is taller than one line.
  if (m.row.height <= m.firstValue.height + TOLERANCE) {
    failures.push(`${framework}: row ${m.path} is ${m.row.height}px, no taller than one value line`);
  }
  for (const part of ['field', 'operator', 'remove']) {
    const off = m.offsets[part];
    if (Math.abs(off) > TOLERANCE) {
      failures.push(`${framework}: the ${part} sits ${off}px off the first value line's centre`);
    }
  }
}

if (report.length === 0) failures.push('no framework pane was on show');

// The same run frames the screenshot on the row that grew.
framed?.scrollIntoView({ block: 'center' });
await wait(400);

const said = report
  .map((r) => `${r.framework} path=${r.path} values=${r.values} field=${r.offsets.field} operator=${r.offsets.operator} remove=${r.offsets.remove}`)
  .join('; ');

return {
  verdict: failures.length === 0 ? `PASS ${said}` : `FAIL ${failures.join('; ')}`,
  panes: report,
};
