// A fixed list of paths is drawn flat, the same way in both frameworks.
//
//   pnpm qa --start --path /widgets/field-picker/ --framework both --drive tools/drive/field-picker-options.js
//
// Three rows, no breadcrumb and no descend control; each row is its resolved path with
// the leaf's code beside it and its data type under it; the search box narrows the list
// on the label and on the path; a pick emits the path the caller wrote.
const panes = () => $$('[data-sg-demo] [data-pane]');

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

function typeInto(input, text) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** A closed popup lingers in the DOM carrying `data-closed`, so only a drawn one counts. */
const drawn = (el) => Boolean(el) && !el.closest('[data-closed]') && el.getClientRects().length > 0;

async function until(read, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(50);
  }
}

/** The row as it is drawn: the glyph, the label and its code, the sub-label. */
function read(row) {
  const body = row.children[1];
  const head = body.children[0];
  return {
    // The two lucide packages name their own icons differently, so the glyph is read by
    // which icon it is, not by the class string around it.
    glyph: (row.children[0]?.getAttribute('class') ?? '').match(/lucide-[a-z-]+/)?.[0] ?? '',
    label: (head.children[0]?.textContent ?? '').trim(),
    code: (head.children[1]?.textContent ?? '').trim(),
    sub: (body.children[1]?.textContent ?? '').trim(),
    classes: row.className,
    descend: Boolean(row.querySelector('[data-slot="field-picker-descend"]')),
  };
}

const seen = [];
for (const pane of panes()) {
  const demo = $('[data-demo="fixed"]', pane);
  press($('[data-slot="field-picker-trigger"]', demo));
  const popup = await until(() => $$('[data-picker="field"]').filter(drawn)[0]);
  const rows = await until(() => {
    const found = $$('[data-slot="command-item"]', popup);
    return found.length > 0 ? found : null;
  });
  const drawnRows = rows.map(read);
  const search = $('input[data-slot="command-input"]', popup);

  typeInto(search, 'turnover');
  const byLabel = await until(() => {
    const found = $$('[data-slot="command-item"]', popup);
    return found.length === 1 ? found.map(read) : null;
  });
  typeInto(search, 'entity.Shot');
  const byPath = await until(() => {
    const found = $$('[data-slot="command-item"]', popup);
    return found.length === 1 ? found.map(read) : null;
  });

  press($$('[data-slot="command-item"]', popup)[0]);
  const emitted = await until(() => {
    const text = (demo.lastElementChild?.textContent ?? '').trim();
    return text !== '—' ? text : null;
  });

  seen.push({
    framework: pane.dataset.pane,
    breadcrumb: Boolean($('[data-slot="field-picker-breadcrumb"]', popup)),
    rows: drawnRows,
    byLabel: byLabel?.map((r) => r.label) ?? [],
    byPath: byPath?.map((r) => r.label) ?? [],
    emitted,
    control: ($('[data-slot="field-picker-label"]', demo)?.textContent ?? '').trim(),
  });
  await wait(300);
}

const [svelte, react] = seen;
const flat = seen.every((p) => p.rows.length === 3 && !p.breadcrumb && p.rows.every((r) => !r.descend));
const labelled = seen.every(
  (p) =>
    p.rows[2].label === 'Link › Shot › Turnover Date' &&
    p.rows[2].code === 'sg_turnover_date' &&
    p.rows[2].sub === 'date' &&
    p.emitted === 'entity.Shot.sg_turnover_date' &&
    p.control === 'Link › Shot › Turnover Date',
);
const narrowed = seen.every((p) => p.byLabel.length === 1 && p.byPath.length === 1);
const same =
  seen.length === 2 &&
  JSON.stringify(svelte.rows) === JSON.stringify(react.rows) &&
  svelte.emitted === react.emitted &&
  svelte.control === react.control;
const ok = flat && labelled && narrowed && same;
return {
  verdict: `${ok ? 'PASS' : 'FAIL'} ${seen.map((p) => `${p.framework} ${p.rows.length} rows, breadcrumb ${p.breadcrumb}, search ${p.byLabel.length}/${p.byPath.length}, ${p.emitted}`).join(', ')}`,
  seen,
};
