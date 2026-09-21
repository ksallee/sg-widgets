// Ticking a row in the multi picker is a selection, not a query: the search box keeps what
// was searched for and the site is not asked again.
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both --drive tools/drives/entity-multi-picker-tick-cost.js
//
// `window.sgDemoReads` counts what reached the mock (apps/site/src/demos/_shared/client.ts).

const failures = [];
const seen = {};

/** A press, the way a mouse makes one: the field opens on pointerdown. */
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

function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true, cancelable: true }));
}

async function until(read, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(100);
  }
}

const searches = () => (window.sgDemoReads ?? {}).search ?? 0;
const popup = () => $('[data-picker="entity-multi"]');
const rows = () => $$('[data-picker="entity-multi"] [data-slot="entity-picker-option"]');

/** The count once nothing is in flight: a debounced search lands well inside a second. */
async function settled() {
  for (;;) {
    const before = searches();
    await wait(700);
    if (searches() === before) return before;
  }
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  const control = $('[data-demo-case="multi"] [data-slot="entity-picker-control"]', pane);
  if (!control) {
    failures.push(`${framework}: no control to press`);
    continue;
  }
  control.scrollIntoView({ block: 'center' });
  press(control);
  if (!(await until(popup))) {
    failures.push(`${framework}: a press on the field did not open the list`);
    continue;
  }
  const input = $('[data-picker="entity-multi"] [data-slot="entity-picker-input"]');
  if (!input) {
    failures.push(`${framework}: the popup has no search box`);
    continue;
  }

  typeInto(input, 'sh010');
  const matched = await until(() => (rows().length > 0 ? rows() : null));
  if (!matched) {
    failures.push(`${framework}: "sh010" matched no row`);
    continue;
  }
  const before = await settled();

  press(matched[0]);
  const ticked = await until(() => rows().find((row) => row.dataset.checked === 'true'));
  if (!ticked) failures.push(`${framework}: the press ticked no row`);
  const after = await settled();
  const box = $('[data-picker="entity-multi"] [data-slot="entity-picker-input"]')?.value ?? '';
  seen[framework] = { before, after, box };

  if (after !== before) failures.push(`${framework}: ticking a row cost ${after - before} searches`);
  if (box !== 'sh010') failures.push(`${framework}: the search box reads "${box}" after the tick`);

  key(input, 'Escape');
  await until(() => !popup());
  await wait(300);
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS ticking a row costs no search and leaves the query in the box in both frameworks'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
