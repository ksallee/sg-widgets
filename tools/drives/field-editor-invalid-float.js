// Type something that is not a number into the float field and press Enter. Invalid input
// never emits: the control goes invalid, names the reason, and the stored value stands.
//
//   pnpm qa --start --path /widgets/field-editor/ --framework both --drive tools/drives/field-editor-invalid-float.js

function setValue(el, text) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
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

  const before = $('[data-demo-value="float"]', pane).textContent.trim();
  const row = $('[data-demo-field="float"]', pane);
  if (!row) {
    failures.push(`${framework}: no float field`);
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
  setValue(input, 'not a number');
  await wait(80);
  press(input, 'Enter');
  await wait(200);

  const after = $('[data-demo-value="float"]', pane).textContent.trim();
  const invalid = $('input', row)?.getAttribute('aria-invalid');
  const message = $('[data-slot="field-editor-error"]', row)?.textContent.trim() ?? '';
  const mode = $('[data-demo-field="float"]', pane).dataset.mode;
  seen[framework] = { before, after, invalid, message, mode };

  if (after !== before) failures.push(`${framework}: emitted ${after}, wanted no change from ${before}`);
  if (invalid !== 'true') failures.push(`${framework}: aria-invalid is ${invalid}`);
  if (message.length === 0) failures.push(`${framework}: no parse error shown`);
  if (mode !== 'edit') failures.push(`${framework}: left the editor while invalid`);
}

return {
  verdict:
    failures.length === 0
      ? 'PASS invalid float sets the invalid state and emits nothing in both frameworks'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
