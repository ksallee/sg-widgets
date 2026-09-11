// Drive the entity-type pickers on the Combobox primitives: the list opens from the
// field, the query narrows it in the browser, and the multi picker's summary modes
// read the same in both frameworks.
//
// The pair keeps one page each, so each clause runs on the page that draws it: the
// field on the single page and on the multi picker's token field, the summary modes
// on the multi page.
//
//   pnpm qa --start --path /widgets/entity-type-picker/       --framework both --drive tools/drives/entity-type-picker-combobox.js
//   pnpm qa --start --path /widgets/entity-type-multi-picker/ --framework both --drive tools/drives/entity-type-picker-combobox.js

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

/** Either picker's popup: the single answers to `entity-type`, the multi to `entity-type-multi`. */
const POPUP = '[data-picker="entity-type"],[data-picker="entity-type-multi"]';
const OPTION = '[data-slot="entity-type-picker-option"]';
const popup = () => $(POPUP);
const rows = () => $$(`[data-picker="entity-type"] ${OPTION},[data-picker="entity-type-multi"] ${OPTION}`);

/** The token field each page draws: the single control, or the multi under `chips`. */
const FIELD =
  '[data-demo="single"] [data-slot="entity-type-picker-input"],[data-demo-summary="chips"] [data-slot="entity-type-picker-input"]';

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

let summaries = false;

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  const input = $(FIELD, pane);
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

  seen[framework] = { types: all.length, narrowed: codes };

  if (!$('[data-demo="summary"]', pane)) continue;
  summaries = true;

  const chips = summaryOf(pane, 'chips');
  const ellipsis = summaryOf(pane, 'ellipsis');
  const count = summaryOf(pane, 'count');
  Object.assign(seen[framework], { chips, ellipsis, count });

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
      ? `PASS the field opens the list and the query narrows it${summaries ? ', and the summary modes read the same' : ''}`
      : `FAIL ${failures.join('; ')}`,
  seen,
};
