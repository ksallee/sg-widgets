// Read a narrow `ellipsis` control and prove the fit: whole chips only, nothing cut,
// `+n` equal to the hidden count, one line high, and the search box in the popup
// rather than in the control. Works on whichever multi picker the page carries.
//
//   pnpm qa --start --path /widgets/status-multi-picker/ --framework both --drive tools/drives/multi-picker-fit.js
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both --drive tools/drives/multi-picker-fit.js
//   pnpm qa --start --path /widgets/entity-type-multi-picker/ --framework both --drive tools/drives/multi-picker-fit.js

const failures = [];
const seen = {};

/** A press, the way a mouse makes one: the field opens on pointerdown. */
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

/** The three multi pickers, by the slot prefix each one stamps on its parts. */
const PICKERS = [
  { slot: 'status-multi-picker', row: 'status-multi-picker-badges', popup: 'status', narrow: '[data-demo="summary-ellipsis-narrow"]', token: '[data-demo="summary-chips-5"]' },
  { slot: 'entity-picker', row: 'entity-picker-chips', popup: 'entity-multi', narrow: '[data-demo-summary="ellipsis-narrow"]', token: '[data-demo-summary="chips"]' },
  { slot: 'entity-type-picker', row: 'entity-type-picker-chips', popup: 'entity-type-multi', narrow: '[data-demo-summary="ellipsis-narrow"]', token: '[data-demo-summary="chips"]' },
];

const picker = PICKERS.find((p) => $(`[data-slot="${p.slot}-control"]`));
if (!picker) return { verdict: 'FAIL no multi picker on this page' };

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  const box = $(picker.narrow, pane);
  if (!box) {
    failures.push(`${framework}: no narrow ellipsis demo`);
    continue;
  }
  box.scrollIntoView({ block: 'center' });
  await wait(200);

  const control = $(`[data-slot="${picker.slot}-control"]`, box);
  const row = $(`[data-slot="${picker.row}"]`, box);
  if (!control || !row) {
    failures.push(`${framework}: the narrow ellipsis control has no chip row`);
    continue;
  }

  const visible = $$('[data-chip]:not([hidden])', row);
  const hiddenChips = $$('[data-chip][hidden]', row);
  const hidden = hiddenChips.length;
  // A hidden chip takes no room at all, rather than being drawn and clipped.
  const laidOut = hiddenChips.filter((chip) => chip.getBoundingClientRect().width > 0).length;
  const pill = $(`[data-slot="${picker.slot}-overflow"]`, row);
  const height = Math.round(control.getBoundingClientRect().height);
  const rowRight = row.getBoundingClientRect().right;

  // Nothing is cut: a chip is drawn whole or not at all, and none of them runs past
  // the row that clips it.
  const cut = visible
    .filter((chip) => chip.scrollWidth > chip.clientWidth + 1 || chip.getBoundingClientRect().right > rowRight + 1)
    .length;
  // The pill sits inside the row, after the last chip that fits.
  const pillInRow = pill ? pill.parentElement === row : hidden === 0;
  const pillAfterChips =
    !pill || visible.length === 0 || pill.getBoundingClientRect().left >= visible[visible.length - 1].getBoundingClientRect().right - 1;
  // The pill is drawn inside the row, not pushed out of it by what is hidden.
  const pillInView = !pill || pill.getBoundingClientRect().right <= rowRight + 1;
  // A summary trigger keeps no caret of its own; a token field keeps one.
  const caretInControl = Boolean($(`[data-slot="${picker.slot}-input"]`, control));
  const tokenControl = $(`${picker.token} [data-slot="${picker.slot}-control"]`, pane);
  const caretInToken = Boolean(tokenControl && $(`[data-slot="${picker.slot}-input"]`, tokenControl));

  seen[framework] = { visible: visible.length, hidden, laidOut, pill: pill?.textContent.trim() ?? '', height, cut, caretInControl, caretInToken };

  if (visible.length === 0) failures.push(`${framework}: the narrow control drew no chip at all`);
  if (cut > 0) failures.push(`${framework}: ${cut} of ${visible.length} visible chips are cut`);
  if (hidden > 0 && !pill) failures.push(`${framework}: ${hidden} chips hidden with no "+n"`);
  if (pill && pill.textContent.trim() !== `+${hidden}`) {
    failures.push(`${framework}: the pill reads "${pill.textContent.trim()}" for ${hidden} hidden`);
  }
  if (laidOut > 0) failures.push(`${framework}: ${laidOut} hidden chips are still laid out and clipped`);
  if (!pillInRow) failures.push(`${framework}: the "+n" pill is not inside the chip row`);
  if (!pillInView) failures.push(`${framework}: the "+n" pill is pushed past the row's edge`);
  if (!pillAfterChips) failures.push(`${framework}: the "+n" pill does not follow the last visible chip`);
  if (height > 40) failures.push(`${framework}: the control is ${height}px tall, wanted one line`);
  if (caretInControl) failures.push(`${framework}: the ellipsis control still holds an inline search input`);
  if (!caretInToken) failures.push(`${framework}: the chips control lost its inline caret`);

  // The search box lives in the popup and takes the caret when the list opens.
  press(control);
  const popup = await until(() => $(`[data-picker="${picker.popup}"]`));
  if (!popup) {
    failures.push(`${framework}: a press on the summary trigger did not open the list`);
    continue;
  }
  const search = $(`[data-slot="${picker.slot}-input"]`, popup);
  seen[framework].popupSearch = Boolean(search);
  seen[framework].searchFocused = search === document.activeElement;
  if (!search) failures.push(`${framework}: the popup has no search box`);
  else if (search !== document.activeElement) failures.push(`${framework}: the popup's search box did not take focus`);

  control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  search?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await until(() => !$(`[data-picker="${picker.popup}"]`), 2000);
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

$(picker.narrow)?.scrollIntoView({ block: 'center' });
await wait(200);

return {
  verdict:
    failures.length === 0
      ? 'PASS the narrow ellipsis control fits whole chips, counts the rest in "+n", stays one line, and searches from its popup'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
