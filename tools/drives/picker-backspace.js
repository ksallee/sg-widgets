// Backspace in an empty query walks the chips of a token field: the first press
// arms the last chip, the second removes it. Typing disarms it again, and a query
// with text keeps Backspace for the text.
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
  const armed = () => $$('[data-chip][data-armed="true"]', box);
  const names = () => chips().map((chip) => chip.textContent.trim());

  const control = $('[data-slot="entity-picker-control"]', box);
  const input = $('[data-slot="entity-picker-input"]', control);
  if (!control || !input) {
    failures.push(`${framework}: the token field has no control or caret`);
    continue;
  }
  const started = names();
  if (started.length < 2) {
    failures.push(`${framework}: the token field starts with ${started.length} chips, wanted at least 2`);
    continue;
  }
  const last = started[started.length - 1];

  press(control);
  await wait(200);
  input.focus({ preventScroll: true });

  // A query with text keeps Backspace for the text: no chip is armed.
  typeInto(input, 'prop');
  await wait(100);
  key(input, 'Backspace');
  await wait(100);
  const armedWhileTyping = armed().length;
  if (armedWhileTyping > 0) failures.push(`${framework}: Backspace armed a chip while the query read "prop"`);

  typeInto(input, '');
  await wait(100);

  // First Backspace: the last chip is armed and every chip is still there.
  key(input, 'Backspace');
  await until(() => armed().length > 0, 1500);
  const afterFirst = armed();
  const heldAfterFirst = names().length;
  if (afterFirst.length !== 1) failures.push(`${framework}: the first Backspace armed ${afterFirst.length} chips, wanted 1`);
  else if (afterFirst[0] !== chips()[chips().length - 1]) {
    failures.push(`${framework}: the first Backspace armed a chip other than the last`);
  }
  if (heldAfterFirst !== started.length) {
    failures.push(`${framework}: the first Backspace already removed a chip (${heldAfterFirst} of ${started.length} left)`);
  }

  // Second Backspace: the armed chip goes, and nothing is left armed.
  key(input, 'Backspace');
  const shrunk = await until(() => (names().length === started.length - 1 ? names() : null), 2000);
  if (!shrunk) {
    failures.push(`${framework}: the second Backspace removed no chip`);
    continue;
  }
  if (shrunk.includes(last)) failures.push(`${framework}: the second Backspace removed a chip other than "${last}"`);
  if (armed().length > 0) failures.push(`${framework}: a chip stayed armed after the removal`);

  // Arming again, then typing: the chip is released rather than removed.
  key(input, 'Backspace');
  await until(() => armed().length > 0, 1500);
  typeInto(input, 'a');
  key(input, 'a');
  await wait(150);
  const armedAfterTyping = armed().length;
  const heldAfterTyping = names().length;
  if (armedAfterTyping > 0) failures.push(`${framework}: typing left a chip armed`);
  if (heldAfterTyping !== shrunk.length) failures.push(`${framework}: typing removed a chip`);

  typeInto(input, '');
  key(input, 'Escape');
  await until(() => !$('[data-picker="entity-multi"]'), 2000);

  seen[framework] = {
    started: started.length,
    armedWhileTyping,
    armedAfterFirst: afterFirst.length,
    heldAfterFirst,
    heldAfterSecond: shrunk.length,
    removed: last,
    armedAfterTyping,
  };
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

$('[data-demo-case="tokens"]')?.scrollIntoView({ block: 'center' });
await wait(200);

return {
  verdict:
    failures.length === 0
      ? 'PASS the first Backspace arms the last chip, the second removes it, and typing releases it'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
