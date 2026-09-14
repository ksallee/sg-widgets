// A pick made while the caret sits on a chip releases the chip: the caret goes back
// to the input, no chip stays armed, and the next Backspace reaches the chip just
// added rather than the one that was armed before the pick.
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both --drive tools/drives/picker-pick-releases-chip.js

const failures = [];
const seen = {};

/** A press, the way a mouse makes one: the field opens on pointerdown. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true, cancelable: true }));
}

async function until(read, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(50);
  }
}

const popup = () => $('[data-picker="entity-multi"]');
const rows = () => $$('[data-picker="entity-multi"] [data-slot="entity-picker-option"]');

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  const box = $('[data-demo-case="tokens"]', pane);
  if (!box) {
    failures.push(`${framework}: no token field demo`);
    continue;
  }
  box.scrollIntoView({ block: 'center' });
  await wait(200);

  const chips = () => $$('[data-chip]', box);
  const armed = () => $$('[data-chip][data-armed="true"]', box);
  const armedIndex = () => chips().findIndex((chip) => chip.dataset.armed === 'true');
  const input = $('[data-slot="entity-picker-input"]', box);
  const control = $('[data-slot="entity-picker-control"]', box);
  if (!input || !control) {
    failures.push(`${framework}: the token field has no caret or control`);
    continue;
  }
  const before = chips().length;

  // Open the list from the field, then walk the caret onto the chip before the last.
  // The chosen rows are drawn at once, pinned; the page with fresh rows lands after.
  const fresh = () => rows().filter((one) => one.dataset.selectedEntity !== 'true');
  press(control);
  if (!(await until(() => popup() && fresh().length > 0))) {
    failures.push(`${framework}: a press on the field did not open a list with rows to pick`);
    continue;
  }
  input.focus({ preventScroll: true });
  key(input, 'Backspace');
  if (!(await until(() => armedIndex() === before - 1))) {
    failures.push(`${framework}: Backspace did not arm the last chip`);
    continue;
  }
  key(document.activeElement, 'ArrowLeft');
  if (!(await until(() => armedIndex() === before - 2))) {
    failures.push(`${framework}: ArrowLeft did not arm the previous chip`);
    continue;
  }
  if (!popup()) {
    failures.push(`${framework}: arming a chip closed the list`);
    continue;
  }

  // A mouse pick on a row that is not yet chosen.
  const row = fresh()[0];
  if (!row) {
    failures.push(`${framework}: every row is already chosen`);
    continue;
  }
  press(row);
  if (!(await until(() => chips().length === before + 1))) {
    failures.push(`${framework}: the pick added no chip`);
    continue;
  }
  await wait(150);

  const afterPick = { armed: armed().length, caretInInput: document.activeElement === input, open: !!popup() };
  if (afterPick.armed !== 0) failures.push(`${framework}: ${afterPick.armed} chip still armed after the pick`);
  if (!afterPick.caretInInput) failures.push(`${framework}: the caret did not go back to the input after the pick`);
  if (!afterPick.open) failures.push(`${framework}: the popup closed on a tick`);

  // From there, Backspace reaches the chip just added, not the one armed before.
  key(input, 'Backspace');
  const armedAfter = await until(() => (armedIndex() >= 0 ? armedIndex() : null));
  if (armedAfter !== before) failures.push(`${framework}: Backspace after the pick armed chip ${armedAfter}, wanted ${before}`);

  seen[framework] = { before, afterPick, armedAfter };

  // Leave the field as it was found: the caret back in the input, the list closed.
  key(document.activeElement, 'Escape');
  await until(() => !popup(), 2000);
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS a pick made with a chip armed releases the chip and the next Backspace reaches the new one'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
