// Click into the duration field, type `1h 30m`, press Enter, and check what was emitted.
// A duration is stored as a whole number of minutes (field_types/duration), so 90 is the answer.
//
//   pnpm qa --start --path /widgets/field-editor/ --framework both --drive tools/drives/field-editor-duration.js

function setValue(el, text) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  const setter = Object.getOwnPropertyDescriptor(proto.prototype, 'value').set;
  setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function press(el, key) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
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
  if (!row) {
    failures.push(`${framework}: no duration field`);
    continue;
  }

  $('[data-slot="field-editor-display"]', row).click();
  await wait(150);

  const input = $('input', row);
  if (!input) {
    failures.push(`${framework}: click did not open the editor`);
    continue;
  }
  input.focus();
  setValue(input, '1h 30m');
  await wait(80);

  // The hint is behind a prop the dispatcher does not set, so the field shows none here.
  const hint = $('[data-slot="number-editor-hint"]', row)?.textContent.trim() ?? '';
  press(input, 'Enter');
  await wait(200);

  const emitted = $('[data-demo-value="duration"]', pane).textContent.trim();
  const mode = $('[data-demo-field="duration"]', pane).dataset.mode;
  seen[framework] = { emitted, mode, hint };

  if (emitted !== '90') failures.push(`${framework}: emitted ${emitted}, wanted 90`);
  if (mode !== 'display') failures.push(`${framework}: still in ${mode} after Enter`);
  if (hint !== '') failures.push(`${framework}: hint read "${hint}", wanted none`);
}

return {
  verdict: failures.length === 0 ? 'PASS 1h 30m emits 90 in both frameworks' : `FAIL ${failures.join('; ')}`,
  seen,
};
