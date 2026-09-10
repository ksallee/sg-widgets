// Escape closes the popup and clears the query. On a picker that is already closed
// it does nothing: the selection and the chips survive it.
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both --drive tools/drives/picker-escape.js

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

  const chips = () => $$('[data-chip]', box).map((chip) => chip.textContent.trim());
  const control = $('[data-slot="entity-picker-control"]', box);
  const input = $('[data-slot="entity-picker-input"]', control);
  if (!control || !input) {
    failures.push(`${framework}: the token field has no control or caret`);
    continue;
  }
  const started = chips();

  press(control);
  if (!(await until(popup))) {
    failures.push(`${framework}: a press on the field did not open the list`);
    continue;
  }
  input.focus({ preventScroll: true });
  typeInto(input, 'char');
  await until(() => $$('[data-picker="entity-multi"] [data-slot="entity-picker-option"]').length > 0);

  // Escape while the popup shows: it closes, and the query goes with it.
  key(input, 'Escape');
  const closed = await until(() => !popup(), 3000);
  const queryAfter = input.value;
  const heldAfterClose = chips();
  if (!closed) failures.push(`${framework}: Escape did not close the list`);
  if (queryAfter !== '') failures.push(`${framework}: the query still reads "${queryAfter}" after Escape`);
  if (heldAfterClose.length !== started.length) {
    failures.push(`${framework}: Escape changed the selection (${heldAfterClose.length} of ${started.length} chips left)`);
  }

  // Escape on a closed picker: nothing at all, and above all not a cleared value.
  key(input, 'Escape');
  key(control, 'Escape');
  await wait(250);
  const heldAfterClosedEscape = chips();
  const reopened = Boolean(popup());
  if (heldAfterClosedEscape.length !== started.length) {
    failures.push(
      `${framework}: Escape on a closed picker cleared the selection (${heldAfterClosedEscape.length} of ${started.length} chips left)`,
    );
  }
  if (reopened) failures.push(`${framework}: Escape on a closed picker opened the list`);

  seen[framework] = {
    started: started.length,
    closed: Boolean(closed),
    queryAfter,
    heldAfterClose: heldAfterClose.length,
    heldAfterClosedEscape: heldAfterClosedEscape.length,
    reopened,
  };
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

$('[data-demo-case="tokens"]')?.scrollIntoView({ block: 'center' });
await wait(200);

return {
  verdict:
    failures.length === 0
      ? 'PASS Escape closes the list and clears the query, and a closed picker keeps its selection'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
