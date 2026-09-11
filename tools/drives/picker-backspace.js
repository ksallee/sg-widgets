// The chip keyboard model of a token field, walked in one go: Backspace in an empty
// query takes the caret to the last chip, the arrows walk the row, Backspace and Delete
// remove the chip under the caret and leave it on the neighbour, and a printable key
// gives the caret back to the input and lands in the query.
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both --drive tools/drives/picker-backspace.js

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
  const names = () => chips().map((chip) => chip.textContent.trim());
  /** The chip holding the caret, by the `data-armed` every picker's chip carries. */
  const caretChip = () => chips().findIndex((chip) => chip.dataset.armed === 'true');

  const control = $('[data-slot="entity-picker-control"]', box);
  const input = $('[data-slot="entity-picker-input"]', control);
  if (!control || !input) {
    failures.push(`${framework}: the token field has no control or caret`);
    continue;
  }
  const started = names();
  if (started.length < 3) {
    failures.push(`${framework}: the token field starts with ${started.length} chips, wanted at least 3`);
    continue;
  }
  const last = started[started.length - 1];

  press(control);
  await wait(200);
  input.focus({ preventScroll: true });

  // A query with text keeps Backspace for the text: the caret stays in the input.
  typeInto(input, 'prop');
  await wait(100);
  key(input, 'Backspace');
  await wait(100);
  const reachedWhileTyping = caretChip();
  if (reachedWhileTyping >= 0) failures.push(`${framework}: Backspace reached a chip while the query read "prop"`);

  typeInto(input, '');
  await wait(100);

  // Backspace in an empty query: the caret takes the last chip and the row is whole.
  key(input, 'Backspace');
  await until(() => caretChip() >= 0, 1500);
  const afterFirst = caretChip();
  const heldAfterFirst = names().length;
  if (afterFirst !== started.length - 1) {
    failures.push(`${framework}: Backspace left the caret on chip ${afterFirst}, wanted ${started.length - 1}`);
  }
  if (heldAfterFirst !== started.length) {
    failures.push(`${framework}: Backspace already removed a chip (${heldAfterFirst} of ${started.length} left)`);
  }

  // The arrows walk the row, and ArrowRight past the last chip gives the caret back.
  key(input, 'ArrowLeft');
  await wait(150);
  const afterLeft = caretChip();
  if (afterLeft !== started.length - 2) {
    failures.push(`${framework}: ArrowLeft left the caret on chip ${afterLeft}, wanted ${started.length - 2}`);
  }
  key(input, 'ArrowRight');
  await wait(150);
  key(input, 'ArrowRight');
  await wait(150);
  const afterRight = caretChip();
  if (afterRight >= 0) failures.push(`${framework}: ArrowRight past the last chip left the caret on chip ${afterRight}`);

  // Delete takes the chip under the caret and leaves the caret on its neighbour.
  key(input, 'Backspace');
  await until(() => caretChip() >= 0, 1500);
  key(input, 'Delete');
  const shrunk = await until(() => (names().length === started.length - 1 ? names() : null), 2000);
  if (!shrunk) {
    failures.push(`${framework}: Delete removed no chip`);
    continue;
  }
  if (shrunk.includes(last)) failures.push(`${framework}: Delete removed a chip other than "${last}"`);
  const afterDelete = caretChip();
  if (afterDelete !== shrunk.length - 1) {
    failures.push(`${framework}: the removal left the caret on chip ${afterDelete}, wanted ${shrunk.length - 1}`);
  }

  // A printable key gives the caret back to the input and lands in the query.
  key(input, 'a');
  await wait(200);
  const afterTyping = caretChip();
  const heldAfterTyping = names().length;
  const wrote = input.value;
  if (afterTyping >= 0) failures.push(`${framework}: typing left the caret on chip ${afterTyping}`);
  if (heldAfterTyping !== shrunk.length) failures.push(`${framework}: typing removed a chip`);
  if (wrote !== 'a') failures.push(`${framework}: typing over a chip wrote "${wrote}" into the query, wanted "a"`);

  typeInto(input, '');
  key(input, 'Escape');
  await until(() => !$('[data-picker="entity-multi"]'), 2000);

  seen[framework] = {
    started: started.length,
    reachedWhileTyping,
    afterFirst,
    heldAfterFirst,
    afterLeft,
    afterRight,
    removed: last,
    heldAfterDelete: shrunk.length,
    afterDelete,
    afterTyping,
    wrote,
  };
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

$('[data-demo-case="tokens"]')?.scrollIntoView({ block: 'center' });
await wait(200);

return {
  verdict:
    failures.length === 0
      ? 'PASS Backspace takes the caret to the last chip, the arrows walk the row, Delete removes the one under it, and typing gives the caret back'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
