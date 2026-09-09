// The result set under the editor follows the tree. Read the count and the rows, add a
// status condition that narrows the filter, and read both again.
//
//   pnpm qa --start --path /widgets/filter-editor/ --drive tools/drive/filter-editor-results.js
const CODE = 'fin';

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

// A popover is portalled to the body, so only one may be open while the other
// framework's pane is driven.
async function closePopovers() {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => $$('[data-slot="popover-content"]').length === 0 || null, 'the popover to close');
}

const countOf = (pane) => $('[data-testid="result-count"]', pane).textContent.trim();
const codesOf = (pane) =>
  $$('[data-slot="entity-table"] tbody tr[data-row-key]', pane).map((row) =>
    (row.querySelector('td[data-column="code"]')?.textContent ?? '').trim(),
  );

// The read is debounced, so a settled count is one that has stopped saying "Counting".
async function settled(pane) {
  const text = await until(() => {
    const now = countOf(pane);
    return now.includes('match') ? now : null;
  }, 'the count');
  await wait(300);
  return { count: text, codes: codesOf(pane) };
}

async function run(framework) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) throw new Error(`no ${framework} pane`);
  await closePopovers();
  const before = await settled(pane);

  const rows = () => $$('[data-slot="filter-row"]', pane);
  const rowCount = rows().length;
  press($('[data-slot="filter-add-condition"]', pane));
  await until(() => rows().length > rowCount, 'the new row');
  const rowAt = () => rows().at(-1);

  press($('[data-slot="filter-field"] [data-slot="field-picker-trigger"]', rowAt()));
  const search = await until(() => $('[data-picker="field"] [data-slot="command-input"]'), 'the field picker');
  setValue(search, 'sg_status_list');
  const items = () => $$('[data-picker="field"] [data-slot="command-item"]');
  const option = await until(() => (items().length === 1 ? items()[0] : null), 'the field list');
  await wait(120);
  press(option);
  await until(
    () => $('[data-slot="filter-field"] [data-slot="field-picker-label"]', rowAt())?.textContent.includes('Status'),
    'the chosen field',
  );

  press($('[data-slot="filter-operator"]', rowAt()));
  press(await until(() => $('[data-slot="select-item"][data-preset="in"]'), 'the operator menu'));
  await until(() => $('[data-slot="filter-operator"]', rowAt()).textContent.includes('is any of'), 'the operator');

  press($('[data-slot="status-multi-picker-trigger"]', rowAt()));
  await until(() => $(`[data-picker="status"] [data-status-code="${CODE}"]`), 'the status list');
  press($(`[data-picker="status"] [data-status-code="${CODE}"]`));
  await closePopovers();

  const after = await until(() => {
    const now = countOf(pane);
    return now.includes('match') && now !== before.count ? now : null;
  }, 'the count to move');
  await wait(300);

  return { framework, before, after: { count: after, codes: codesOf(pane) } };
}

const results = [await run('svelte'), await run('react')];

function ok(result) {
  const moved = result.before.count !== result.after.count;
  const rowsMoved = JSON.stringify(result.before.codes) !== JSON.stringify(result.after.codes);
  const counted = /^\d+ Versions? match/.test(result.before.count) && /^\d+ Versions? match/.test(result.after.count);
  return moved && rowsMoved && counted && result.before.codes.length > 0;
}

const verdict = results.every(ok) ? 'PASS' : 'FAIL';
return {
  verdict: `${verdict} ${results
    .map((r) => `${r.framework} ${r.before.count} (${r.before.codes.length} rows) -> ${r.after.count} (${r.after.codes.length} rows)`)
    .join(', ')}`,
  results,
};
