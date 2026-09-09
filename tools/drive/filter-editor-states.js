// The two states the result set has to hold: a filter that matches nothing, and one the
// site refuses. Neither may take the page down.
//
//   pnpm qa --start --path /widgets/filter-editor/ --drive tools/drive/filter-editor-states.js
//
// The mock implements the comparison relations and none of the calendar ones, so
// `Date Created today` is a 400 from a tree the editor itself offers.
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  }
}

function setValue(el, text) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function until(find, label) {
  for (let i = 0; i < 120; i++) {
    const found = find();
    if (found) return found;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function closePopovers() {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => $$('[data-slot="popover-content"]').length === 0 || null, 'the popover to close');
}

const countOf = (pane) => $('[data-testid="result-count"]', pane).textContent.trim();
const bodyOf = (pane) => ($('[data-slot="entity-table"] tbody', pane)?.textContent ?? '').trim();
const dataRows = (pane) => $$('[data-slot="entity-table"] tbody tr[data-row-key]', pane).length;

async function addRow(pane, field, preset) {
  const rows = () => $$('[data-slot="filter-row"]', pane);
  const before = rows().length;
  press($('[data-slot="filter-add-condition"]', pane));
  await until(() => rows().length > before, 'the new row');
  const rowAt = () => rows().at(-1);

  press($('[data-slot="filter-field"] [data-slot="field-picker-trigger"]', rowAt()));
  const search = await until(() => $('[data-picker="field"] [data-slot="command-input"]'), 'the field picker');
  setValue(search, field);
  const items = () => $$('[data-picker="field"] [data-slot="command-item"]');
  const option = await until(() => (items().length === 1 ? items()[0] : null), `the ${field} row`);
  await wait(120);
  press(option);
  await wait(120);

  press($('[data-slot="filter-operator"]', rowAt()));
  press(await until(() => $(`[data-slot="select-item"][data-preset="${preset}"]`), `the ${preset} entry`));
  await closePopovers();
  return rowAt();
}

async function settle(pane, was) {
  const text = await until(() => {
    const now = countOf(pane);
    return now && now !== was && now !== 'Counting…' ? now : null;
  }, 'the count to move');
  await wait(400);
  return text;
}

async function run(framework) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) throw new Error(`no ${framework} pane`);
  await closePopovers();
  const start = await until(() => (countOf(pane).includes('match') ? countOf(pane) : null), 'the first count');
  await wait(300);

  // Nothing matches: every Version in the fixtures carries a status.
  const emptyRow = await addRow(pane, 'sg_status_list', 'is_empty');
  const emptyCount = await settle(pane, start);
  const empty = { count: emptyCount, rows: dataRows(pane), body: bodyOf(pane) };

  press($('[aria-label="Remove condition"]', emptyRow));
  await settle(pane, emptyCount);

  // A relation the site refuses: the read fails and the failure is shown in place.
  await addRow(pane, 'created_at', 'today');
  const errorCount = await until(() => {
    const now = countOf(pane);
    return now && !now.includes('match') && now !== 'Counting…' ? now : null;
  }, 'the refusal');
  await wait(400);
  const failed = { count: errorCount, rows: dataRows(pane), body: bodyOf(pane) };

  return { framework, start, empty, failed };
}

const results = [await run('svelte'), await run('react')];

function ok(r) {
  return (
    r.empty.count === '0 Versions match' &&
    r.empty.rows === 0 &&
    r.empty.body.includes('No Version matches this filter') &&
    r.failed.rows === 0 &&
    r.failed.count.includes('does not implement') &&
    r.failed.body.includes('does not implement')
  );
}

const verdict = results.every(ok) ? 'PASS' : 'FAIL';
return {
  verdict: `${verdict} ${results.map((r) => `${r.framework} empty "${r.empty.count}" refused "${r.failed.count}"`).join(', ')}`,
  results: results.map((r) => ({
    framework: r.framework,
    start: r.start,
    empty: { count: r.empty.count, rows: r.empty.rows, body: r.empty.body },
    failed: { count: r.failed.count, rows: r.failed.rows, body: r.failed.body },
  })),
};
