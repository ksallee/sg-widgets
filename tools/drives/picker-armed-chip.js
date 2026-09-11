// Leave the token field with the caret on its last chip, so the shot shows it.
// Backspace on an empty caret reaches the chip without opening the list. The page
// releases the chip when it loses focus, and a capture does exactly that, so
// an interval keeps pressing Backspace until the shot is taken.
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework svelte \
//     --drive tools/drives/picker-armed-chip.js --shot shots/armed-chip-svelte-light.png
function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true, cancelable: true }));
}
async function until(read, t = 4000) {
  const d = Date.now() + t;
  for (;;) { const v = read(); if (v) return v; if (Date.now() > d) return null; await wait(50); }
}

// Both panes are in the DOM; only the shown one is worth arming.
const pane = $$('[data-pane]').find((p) => p.offsetParent !== null);
if (!pane) return { verdict: 'FAIL no framework pane was on show' };
const box = $('[data-demo-case="tokens"]', pane);
if (!box) return { verdict: 'FAIL no token field demo' };
box.scrollIntoView({ block: 'center' });
await wait(400);

const armedNow = () => $$('[data-chip][data-armed="true"]', box).length;
const input = $('[data-slot="entity-picker-input"]', box);
if (!input) return { verdict: 'FAIL the token field has no caret' };

function arm() {
  input.focus({ preventScroll: true });
  key(input, 'Backspace');
}

arm();
await until(() => armedNow() > 0);
setInterval(() => {
  if (armedNow() === 0) arm();
}, 80);
await wait(500);

const armed = armedNow();
const chips = $$('[data-chip]', box).length;
return {
  verdict:
    armed === 1 && chips === 3
      ? `PASS ${pane.dataset.pane}: the caret is on the last chip and it is still there`
      : `FAIL ${pane.dataset.pane}: ${armed} armed, ${chips} chips`,
  pane: pane.dataset.pane,
  armed,
  chips,
};
