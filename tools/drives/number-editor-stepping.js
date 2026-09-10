// Press Up on the duration field, then hold its increment button. A duration steps by a
// quarter of an hour (field_types/duration), so 480 goes to 495 on one press, and a hold
// repeats past that.
//
//   pnpm qa --start --path /widgets/number-editor/ --framework both --drive tools/drives/number-editor-stepping.js

function press(el, key, init = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init }));
}

function pointer(el, type, init = {}) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, ...init }));
}

const seen = {};
const failures = [];

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) {
    failures.push(`${framework}: no pane`);
    continue;
  }

  const row = $('[data-demo-field="duration"]', pane);
  const readout = () => $('[data-demo-value="duration"]', pane).textContent.trim();
  if (!row) {
    failures.push(`${framework}: no duration field`);
    continue;
  }

  const input = $('[data-slot="number-editor"] input[role="spinbutton"]', row);
  if (!input) {
    failures.push(`${framework}: no spinbutton`);
    continue;
  }

  const before = readout();
  input.focus();
  press(input, 'ArrowUp');
  await wait(200);
  const afterKey = readout();
  const shown = input.value;

  // A hold repeats after 400ms, then every 60ms. Half a second of holding is worth
  // several steps; the assertion is only that it kept going.
  const increment = $('[data-slot="number-editor-increment"]', row);
  pointer(increment, 'pointerdown');
  await wait(900);
  pointer(increment, 'pointerup');
  increment.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(150);
  const afterHold = Number(readout());

  seen[framework] = { before, afterKey, shown, afterHold };

  if (before !== '480') failures.push(`${framework}: started at ${before}, wanted 480`);
  if (afterKey !== '495') failures.push(`${framework}: Up gave ${afterKey}, wanted 495`);
  if (shown !== '8:15') failures.push(`${framework}: input reads "${shown}", wanted "8:15"`);
  if (!(afterHold >= 495 + 15 * 4)) failures.push(`${framework}: a held stepper reached ${afterHold}, wanted at least 555`);

  const valueNow = input.getAttribute('aria-valuenow');
  if (valueNow !== String(afterHold)) failures.push(`${framework}: aria-valuenow is ${valueNow}, not ${afterHold}`);
}

// The percent field stops at its bound: its increment goes disabled once the value is 100.
for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) continue;
  const row = $('[data-demo-field="percent"]', pane);
  const input = $('input[role="spinbutton"]', row);
  input.focus();
  press(input, 'PageUp');
  await wait(200);
  const value = $('[data-demo-value="percent"]', pane).textContent.trim();
  const stuck = $('[data-slot="number-editor-increment"]', row).disabled;
  seen[framework].percent = { value, stuck };
  if (value !== '100') failures.push(`${framework}: Page Up on percent gave ${value}, wanted 100`);
  if (!stuck) failures.push(`${framework}: the percent increment is still enabled at 100`);
}

return {
  verdict:
    failures.length === 0
      ? 'PASS Up steps a duration 480 to 495 and a held stepper repeats, in both frameworks'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
