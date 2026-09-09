// Read what a person search matches and shows: the address under the name, "le" not
// matching everyone through the shared domain, and the matched run bold in the sub-label.
//
//   pnpm qa --start --path /widgets/user-picker/ --framework both --drive tools/drives/user-picker-address.js

const failures = [];
const seen = {};

function typeInto(input, text) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

async function until(read, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(100);
  }
}

const popover = () => $('[data-picker="entity"]');
const rows = () => $$('[data-picker="entity"] [data-slot="entity-picker-option"]');
const label = (row) => $('[data-slot="entity-picker-label"]', row)?.textContent.trim();
const sub = (row) => $('[data-slot="entity-picker-sub-label"]', row)?.textContent.trim();

async function search(pane, demoCase, query) {
  const trigger = $(`[data-demo-case="${demoCase}"] [data-slot="entity-picker-trigger"]`, pane);
  if (!trigger) return { error: `no trigger in ${demoCase}` };
  trigger.click();
  const box = await until(popover);
  if (!box) return { error: `${demoCase} did not open` };
  const input = await until(() => $('input', box));
  typeInto(input, query);
  await wait(700);
  const found = await until(() => (rows().length > 0 ? rows() : null), 3000);
  return { box, rows: found ?? [] };
}

async function close(box) {
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => !popover());
  await wait(200);
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  const narrow = await search(pane, 'by-address', 'le');
  if (narrow.error) {
    failures.push(`${framework}: ${narrow.error}`);
    continue;
  }
  const names = narrow.rows.map(label);
  if (names.length !== 1 || names[0] !== 'Cleo Dias') {
    failures.push(`${framework}: "le" matched ${JSON.stringify(names)}, wanted ["Cleo Dias"]`);
  }
  const subLabels = narrow.rows.map(sub);
  if (!subLabels.every((text) => (text ?? '').includes('@'))) {
    failures.push(`${framework}: the sub-label is not an address: ${JSON.stringify(subLabels)}`);
  }
  await close(narrow.box);

  // An address query matches the whole address, and the matched run is bold in the sub-label.
  const wide = await search(pane, 'by-address', 'ada.lovelace@');
  const bold = wide.rows.map((row) =>
    [...(($('[data-slot="entity-picker-sub-label"]', row)?.children) ?? [])]
      .filter((span) => span.className.includes('font-semibold'))
      .map((span) => span.textContent)
      .join(''),
  );
  if (wide.rows.map(label).join(',') !== 'Ada Lovelace') {
    failures.push(`${framework}: the address query matched ${JSON.stringify(wide.rows.map(label))}`);
  }
  if (bold[0] !== 'ada.lovelace@') {
    failures.push(`${framework}: the matched run in the sub-label is ${JSON.stringify(bold)}`);
  }
  await close(wide.box);

  seen[framework] = { le: names, subLabels, address: wide.rows.map(label), bold };
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

const stage = $$('[data-pane]').find((p) => p.offsetParent !== null) ?? document;
const shot = $('[data-demo-case="by-address"] [data-slot="entity-picker-trigger"]', stage);
if (shot) window.scrollTo({ top: shot.getBoundingClientRect().top + window.scrollY - 120 });
await wait(400);
shot?.click();
const box = await until(popover);
const input = await until(() => $('input', box ?? document));
if (input) typeInto(input, 'ada');
await until(() => rows().length > 0);
await wait(300);

return {
  verdict:
    failures.length === 0
      ? 'PASS a person is matched on the local part of the address and shows it under the name'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
