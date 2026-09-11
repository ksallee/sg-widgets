// The collection on the collection-control page: the rows land, a press on a row's
// checkbox moves the selection, and the footer reports the set.
//
//   pnpm qa --start --path /widgets/collection-control/ --framework both --drive tools/drives/collection-control-demo.js

const failures = [];
const seen = {};

/** A press, the way a mouse makes one. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

async function until(read, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(50);
  }
}

async function drive(pane, framework) {
  const collection = $('[data-demo-case="collection"]', pane);
  if (!collection) {
    failures.push(`${framework}: the page drew no collection`);
    return null;
  }
  collection.scrollIntoView({ block: 'center' });

  const rows = await until(() => {
    const found = $$('[data-slot="review-queue-row"]', collection);
    return found.length > 0 ? found : null;
  });
  if (!rows) {
    failures.push(`${framework}: the collection drew no row`);
    return null;
  }

  const count = () => $('[data-demo="selection"]', pane)?.textContent.trim() ?? '';
  const before = count();
  const box = $('[data-slot="checkbox"]', rows[0]);
  if (!box) {
    failures.push(`${framework}: the first row carries no checkbox`);
    return null;
  }

  press(box);
  const after = await until(() => {
    const now = count();
    return now === '1 selected' ? now : null;
  });
  if (!after) failures.push(`${framework}: a press on the first row left the count at "${count()}"`);

  const marked = await until(() => rows[0].getAttribute('aria-selected') === 'true');
  if (!marked) failures.push(`${framework}: the row that was pressed is not marked as selected`);

  const reads = () => $('[data-slot="review-queue-range"]', collection)?.textContent.trim() ?? '';
  const range = await until(() => (/^\d+ to \d+ of \d+$/.test(reads()) ? reads() : null));
  if (!range) failures.push(`${framework}: the footer read "${reads()}"`);

  return { rows: rows.length, selection: after ?? count(), range: range ?? reads() };
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  seen[framework] = await drive(pane, framework);
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

$('[data-demo-case="collection"]')?.scrollIntoView({ block: 'center' });
await wait(200);

return {
  verdict:
    failures.length === 0
      ? 'PASS the rows landed, a press took one into the selection, and the footer reported the set'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
