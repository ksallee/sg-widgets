// Grouping by a path that is not a column, on the entity-table page: grouped by status, the Status
// column is removed in the Columns picker, and the rows stay grouped under their headers while no
// header, col or cell is drawn for it, and a group header still spans every drawn column.
//
//   PUBLIC_SG_DEMO_BOTH=1 pnpm qa --start --path /widgets/entity-table/ --framework both --drive tools/drives/entity-table-group-only.js

const KEY = 'sg-widgets:columns:Version';
const PATH = 'sg_status_list';
const failures = [];
const seen = {};

async function until(read, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    const value = read();
    if (value) return value;
    await wait(100);
  }
  return read();
}

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
}

async function closePopovers() {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => document.querySelectorAll('[data-picker="columns"]').length === 0, 20);
}

async function drive(pane, framework) {
  const fail = (what) => failures.push(`${framework}: ${what}`);
  const table = () => pane.querySelector('[data-slot="entity-table"] table');
  const heads = () => [...pane.querySelectorAll('[data-slot="entity-table"] thead th[data-column]')].map((th) => th.dataset.column);
  const groups = () => [...pane.querySelectorAll('[data-slot="entity-table-group"]')];
  if (!(await until(() => heads().length > 2))) return fail('the table drew no headers');

  const toggle = [...pane.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Group by status');
  if (!toggle) return fail('no Group by status toggle');
  toggle.click();
  if (!(await until(() => groups().length > 0))) return fail('grouping by status drew no group header');
  if (!heads().includes(PATH)) return fail('the Status column is not drawn before it is removed');
  const groupsBefore = groups().length;

  const trigger = pane.querySelector('[data-slot="entity-table-columns"]');
  if (!trigger) return fail('no Columns button');
  await closePopovers();
  trigger.click();
  let box = await until(() => document.querySelector('[data-picker="columns"]'), 15);
  if (!box) {
    press(trigger);
    box = await until(() => document.querySelector('[data-picker="columns"]'), 15);
  }
  if (!box) return fail('the Columns button opened nothing');
  const row = box.querySelector(`[data-slot="column-picker-column"][data-path="${PATH}"]`);
  if (!row) return fail('the picker lists no Status column');
  press(row.querySelector('[data-slot="column-picker-remove"]'));
  await closePopovers();
  if (!(await until(() => !heads().includes(PATH)))) return fail('the Status header is still drawn');

  const drawn = heads().length;
  const cols = table().querySelectorAll('colgroup col').length;
  const groupRows = groups();
  const span = Number(groupRows[0]?.querySelector('td')?.getAttribute('colspan'));
  const cells = pane.querySelectorAll(`[data-slot="entity-table"] td[data-column="${PATH}"]`).length;
  const colWidths = [...table().querySelectorAll('colgroup col')].reduce((n, col) => n + parseFloat(col.style.width), 0);
  const tableWidth = parseFloat(table().style.width);
  if (groupRows.length === 0) fail('removing the Status column dropped the grouping');
  if (groupRows.length !== groupsBefore) fail(`${groupsBefore} group headers became ${groupRows.length}`);
  if (cols !== drawn) fail(`${cols} cols for ${drawn} headers`);
  if (span !== drawn) fail(`a group header spans ${span} of ${drawn} columns`);
  if (cells > 0) fail(`${cells} Status cells are still drawn`);
  if (colWidths !== tableWidth) fail(`the cols add to ${colWidths}px, the table is ${tableWidth}px`);
  seen[framework] = { groups: groupRows.length, headers: drawn, labels: groupRows.map((g) => g.textContent.trim()).slice(0, 4) };
}

localStorage.removeItem(KEY);
for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-sg-demo] [data-pane="${framework}"]`);
  if (!pane) continue;
  await drive(pane, framework);
}
localStorage.removeItem(KEY);
$('[data-sg-demo]')?.scrollIntoView({ block: 'start' });
await wait(300);
if (Object.keys(seen).length === 0 && failures.length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS a group path that is not a column keeps its group headers, draws no header, col or cell, and the headers span the drawn columns'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
