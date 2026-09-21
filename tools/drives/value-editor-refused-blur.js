// Leaving a value editor on a draft it refuses keeps the text that was typed, next to the
// message saying why, so the correction is one edit away. Escape then restores the stored
// range, and a draft that parses is taken and read back in the stored form.
//
//   pnpm qa --start --path /widgets/value-editor/ --framework both --drive tools/drives/value-editor-refused-blur.js

const failures = [];
const seen = {};

function setValue(el, text) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

async function until(read, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(50);
  }
}

async function drive(pane, framework) {
  const box = $('[data-demo-case="cut"]', pane);
  const input = box && $('input', box);
  const readout = box && $('[data-demo-value]', box);
  if (!input || !readout) {
    failures.push(`${framework}: no editor to drive`);
    return null;
  }
  box.scrollIntoView({ block: 'center' });
  await wait(150);

  const value = () => readout.textContent.trim();
  const error = () => $('[data-slot="field-editor-error"]', box)?.textContent.trim() ?? '';
  const step = {};

  const stored = value();

  // A range that runs backwards is refused. Leaving the control neither takes it nor
  // throws it away: the text stands with the message under it.
  input.focus();
  setValue(input, '1200-1001');
  input.blur();
  step.message = (await until(() => error() || null)) ?? '';
  if (!step.message) failures.push(`${framework}: leaving on a refused range showed no message`);
  await wait(150);
  step.kept = input.value;
  if (input.value !== '1200-1001') failures.push(`${framework}: the typed text became "${input.value}"`);
  if (value() !== stored) failures.push(`${framework}: the refused range reached the value (${value()})`);

  // Escape puts the stored range back and drops the message.
  input.focus();
  key(input, 'Escape');
  const restored = await until(() => (input.value === '1001-1120' && error() === '' ? input.value : null));
  step.restored = restored ?? `${input.value} / ${error()}`;
  if (!restored) failures.push(`${framework}: Escape left "${input.value}" and "${error()}"`);

  // A draft that parses is taken on the way out and read back in the stored form, so the
  // control still follows the value it is not holding.
  input.focus();
  setValue(input, '1002 - 1150');
  input.blur();
  step.committed = await until(() => (value() === '{"first":1002,"last":1150}' ? value() : null));
  if (!step.committed) failures.push(`${framework}: leaving on a good range left the value at ${value()}`);
  const synced = await until(() => (input.value === '1002-1150' ? input.value : null));
  step.synced = synced ?? input.value;
  if (!synced) failures.push(`${framework}: the control reads "${input.value}", not the stored range`);

  return step;
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  seen[framework] = await drive(pane, framework);
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS leaving on a refused range keeps the typed text and its message, Escape restores, and a good range is taken'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
