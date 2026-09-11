// The frame range editor on the value-editor page: Enter commits, a refused range shows
// the error line, Escape restores, and leaving the control commits too.
//
//   pnpm qa --start --path /widgets/value-editor/ --framework both --drive tools/drives/value-editor-demo.js

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
    failures.push(`${framework}/cut: no editor to drive`);
    return null;
  }
  box.scrollIntoView({ block: 'center' });
  await wait(150);

  const value = () => readout.textContent.trim();
  const error = () => $('[data-slot="field-editor-error"]', box)?.textContent.trim() ?? '';
  const step = {};

  // Enter commits what parsed.
  input.focus();
  setValue(input, '1001-1200');
  key(input, 'Enter');
  step.committed = await until(() => (value() === '{"first":1001,"last":1200}' ? value() : null));
  if (!step.committed) failures.push(`${framework}/cut: Enter left the value at ${value()}`);

  // A range that runs backwards is refused, and the value it was is untouched.
  setValue(input, '1200-1001');
  key(input, 'Enter');
  step.refused = await until(() => error() || null);
  if (!step.refused) failures.push(`${framework}/cut: the refused range showed no error line`);
  if (value() !== '{"first":1001,"last":1200}') {
    failures.push(`${framework}/cut: the refused range reached the value (${value()})`);
  }

  // Escape restores the stored range and drops the message.
  key(input, 'Escape');
  const restored = await until(() => (input.value === '1001-1200' && error() === '' ? input.value : null));
  step.restored = restored ?? `${input.value} / ${error()}`;
  if (!restored) failures.push(`${framework}/cut: Escape left "${input.value}" and "${error()}"`);

  // Leaving the control commits too.
  setValue(input, '1002-1150');
  input.blur();
  step.blurred = await until(() => (value() === '{"first":1002,"last":1150}' ? value() : null));
  if (!step.blurred) failures.push(`${framework}/cut: leaving the control left the value at ${value()}`);

  // The row form wears the caller's message, not one a parse made.
  const row = $('[data-demo-case="delivery"] [data-slot="range-editor"]', pane);
  step.inline = row?.getAttribute('data-inline') ?? '';
  step.given = row ? ($('[data-slot="field-editor-error"]', row)?.textContent.trim() ?? '') : '';
  if (step.inline !== 'true') failures.push(`${framework}/delivery: the row form reads data-inline="${step.inline}"`);
  if (!step.given.startsWith('The site refused')) {
    failures.push(`${framework}/delivery: the caller's message reads "${step.given}"`);
  }

  return step;
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  seen[framework] = await drive(pane, framework);
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

$('[data-demo-case="cut"]')?.scrollIntoView({ block: 'center' });
await wait(200);

return {
  verdict:
    failures.length === 0
      ? 'PASS the editor commits on Enter and on leaving, refuses a backwards range, and restores on Escape'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
