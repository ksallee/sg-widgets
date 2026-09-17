// The table's toolbar offers exactly the columns it shows, a linked one included, and sorts on it.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework both --drive tools/drive/entity-table-linked-sort.js
const LINKED = 'entity.Shot.sg_turnover_date';
/** The page draws several tables; the toolbar demo is the one carrying a sort picker. */
const panes = () =>
  $$('[data-sg-demo] [data-pane]').filter((pane) => pane.querySelector('[data-slot="sort-trigger"]'));

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

const drawn = (el) => Boolean(el) && !el.closest('[data-closed]') && el.getClientRects().length > 0;

async function until(read, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(50);
  }
}

const labelOf = (row) => (row.children[1]?.children[0]?.children[0]?.textContent ?? '').trim();
const column = (pane) =>
  [...pane.querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]')].map((row) =>
    (row.querySelector(`td[data-column="${LINKED}"]`)?.textContent ?? '').trim(),
  );

await until(() => panes().length === 2, 20000);

const seen = [];
for (const pane of panes()) {
  await until(() => column(pane).length > 0, 20000);
  press($('[data-slot="sort-trigger"]', pane));
  const panel = await until(() => $$('[data-picker="sort"]').filter(drawn)[0]);
  press($('[data-slot="field-picker-trigger"]', panel));
  const popup = await until(() => $$('[data-picker="field"]').filter(drawn)[0]);
  const rows = await until(() => {
    const found = $$('[data-slot="command-item"]', popup);
    return found.length > 0 ? found : null;
  });
  const offered = rows.map(labelOf);
  const linked = rows.find((row) => labelOf(row).includes('Turnover Date'));
  if (linked) press(linked);
  const key = await until(() => $(`[data-slot="sort-key"][data-field="${LINKED}"]`, panel));
  await wait(1200);
  // The cell draws the date the way a reader wants it, so the order is read on the date itself.
  const values = column(pane).filter(Boolean).map((text) => Date.parse(text));
  seen.push({
    framework: pane.dataset.pane,
    offered,
    flat: rows.every((row) => !row.querySelector('[data-slot="field-picker-descend"]')),
    breadcrumb: Boolean($('[data-slot="field-picker-breadcrumb"]', popup)),
    key: Boolean(key),
    ordered: values.length > 1 && values.every((v, i) => i === 0 || values[i - 1] <= v),
    first: column(pane).filter(Boolean).slice(0, 4),
  });
  // Every popup is portalled to the body, so this pane's are closed before the next is read.
  press($('[data-slot="field-picker-trigger"]', panel));
  press($('[data-slot="sort-trigger"]', pane));
  await until(() => $$('[data-picker="sort"]').filter(drawn).length === 0);
  await wait(300);
}

const ok =
  seen.length === 2 &&
  seen.every((p) => p.flat && !p.breadcrumb && p.key && p.ordered && p.offered.some((l) => l.includes('Turnover Date')));
return {
  verdict: `${ok ? 'PASS' : 'FAIL'} ${seen.map((p) => `${p.framework} ${p.offered.length} offered, linked key ${p.key}, ordered ${p.ordered}`).join(', ')}`,
  seen,
};
