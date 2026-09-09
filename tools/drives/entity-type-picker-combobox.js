// Drive the entity-type picker on the Combobox primitives: the list opens from the
// field, the query narrows it in the browser, and the summary modes read the same in
// both frameworks.
//
//   pnpm qa --start --path /widgets/entity-type-picker/ --framework both --drive tools/drives/entity-type-picker-combobox.js

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

async function until(read, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(100);
  }
}

const popup = () => $('[data-picker="entity-type"]');
const rows = () => $$('[data-picker="entity-type"] [data-slot="entity-type-picker-option"]');

/** Chips the control actually shows. The ones past the fit stay in the DOM, hidden. */
function summaryOf(pane, mode) {
  const box = $(`[data-demo-summary="${mode}"]`, pane);
  if (!box) return null;
  return {
    chips: $$('[data-chip]:not([hidden])', box).length,
    hidden: $$('[data-chip][hidden]', box).length,
    overflow: $('[data-slot="entity-type-picker-overflow"]', box)?.textContent.trim() ?? '',
    count: $('[data-slot="entity-type-picker-count"]', box)?.textContent.trim() ?? '',
  };
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  const input = $('[data-demo="single"] [data-slot="entity-type-picker-input"]', pane);
  if (!input) {
    failures.push(`${framework}: the control has no query input`);
    continue;
  }
  input.scrollIntoView({ block: 'center' });
  press(input);
  if (!(await until(popup))) {
    failures.push(`${framework}: a press on the field did not open the list`);
    continue;
  }
  const all = (await until(() => (rows().length > 0 ? rows() : null))) ?? [];
  typeInto(input, 'ver');
  const narrowed = await until(() => {
    const found = rows();
    return found.length > 0 && found.length < all.length ? found : null;
  });
  const codes = (narrowed ?? []).map((row) => row.dataset.entityType);
  if (!narrowed) failures.push(`${framework}: "ver" narrowed nothing out of ${all.length} types`);
  else if (!codes.includes('Version')) failures.push(`${framework}: "ver" did not offer Version`);

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await until(() => !popup());

  const chips = summaryOf(pane, 'chips');
  const ellipsis = summaryOf(pane, 'ellipsis');
  const count = summaryOf(pane, 'count');
  seen[framework] = { types: all.length, narrowed: codes, chips, ellipsis, count };

  if (chips?.chips !== 6) failures.push(`${framework}: chips drew ${chips?.chips} of 6`);
  if ((ellipsis?.chips ?? 0) === 0) failures.push(`${framework}: ellipsis drew no chip at all`);
  if ((ellipsis?.chips ?? 0) + (ellipsis?.hidden ?? 0) !== 6) {
    failures.push(`${framework}: ellipsis holds ${(ellipsis?.chips ?? 0) + (ellipsis?.hidden ?? 0)} chips, wanted 6`);
  }
  if (ellipsis?.overflow !== (ellipsis?.hidden ? `+${ellipsis.hidden}` : '')) {
    failures.push(`${framework}: ellipsis read "${ellipsis?.overflow}" for ${ellipsis?.hidden} hidden`);
  }
  if (count?.count !== '6 selected') failures.push(`${framework}: count read "${count?.count}"`);
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

$('[data-demo="summary"]')?.scrollIntoView({ block: 'center' });
await wait(300);

return {
  verdict:
    failures.length === 0
      ? 'PASS the field opens the list, the query narrows it, and the summary modes read the same'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
