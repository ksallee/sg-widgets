// Read the secondary column of the multi picker: a status badge where the demo asks
// for one, nothing in the default section, and a first page with nothing typed.
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both --drive tools/drives/entity-picker-secondary.js

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

const popover = () => $('[data-picker="entity-multi"]');
const rows = () => $$('[data-picker="entity-multi"] [data-slot="entity-picker-option"]');

/** Open one demo's picker, type, and wait for the rows the query answers. */
async function search(pane, demoCase, query) {
  const trigger = $(`[data-demo-case="${demoCase}"] [data-slot="entity-picker-trigger"]`, pane);
  if (!trigger) return { error: `no trigger in ${demoCase}` };
  trigger.click();
  const box = await until(popover);
  if (!box) return { error: `${demoCase} did not open` };
  const input = await until(() => $('input', box));
  if (!input) return { error: `${demoCase} has no search input` };
  if (query) typeInto(input, query);
  // Past the 250ms debounce and the mock's latency, then the rows for this query.
  const matched = await until(() => {
    const found = rows();
    return found.length > 0 && found.every((row) => row.textContent.includes(query)) ? found : null;
  });
  return { box, input, rows: matched ?? [] };
}

async function close(box) {
  box.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => !popover());
  await wait(200);
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  // Nothing typed: the first page, and no secondary column.
  const first = await search(pane, 'multi', '');
  if (first.error) {
    failures.push(`${framework}: ${first.error}`);
    continue;
  }
  if (first.rows.length === 0) failures.push(`${framework}: an open picker showed no rows`);
  const idle = first.rows.filter((row) => row.querySelector('[data-slot="entity-picker-secondary"]')).length;
  const hashes = first.rows.filter((row) => row.textContent.includes('#')).length;
  if (idle !== 0) failures.push(`${framework}: ${idle} rows show a secondary by default`);
  if (hashes !== 0) failures.push(`${framework}: ${hashes} rows still show an id`);
  await close(first.box);

  const status = await search(pane, 'status-secondary', 'sh0');
  if (status.error) {
    failures.push(`${framework}: ${status.error}`);
    continue;
  }
  const badges = status.rows.filter((row) => row.querySelector('[data-slot="status-badge"]')).length;
  const codes = status.rows
    .map((row) => row.querySelector('[data-slot="status-badge"]')?.dataset.statusCode)
    .filter(Boolean);
  if (status.rows.length === 0) failures.push(`${framework}: "sh0" matched no row`);
  if (badges !== status.rows.length) {
    failures.push(`${framework}: ${badges} of ${status.rows.length} rows carry a status badge`);
  }
  await close(status.box);

  const plain = await search(pane, 'multi', 'sh0');
  if (plain.error) {
    failures.push(`${framework}: ${plain.error}`);
    continue;
  }
  const secondaries = plain.rows.filter((row) => row.querySelector('[data-slot="entity-picker-secondary"]')).length;
  if (secondaries !== 0) failures.push(`${framework}: ${secondaries} searched rows show a secondary`);
  await close(plain.box);

  seen[framework] = { idle: first.rows.length, matched: status.rows.length, badges, codes, secondaries, hashes };
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

// Leave the status demo open, so the screenshot shows the column that changed.
const stage = $$('[data-pane]').find((p) => p.offsetParent !== null) ?? document;
const shot = $('[data-demo-case="status-secondary"] [data-slot="entity-picker-trigger"]', stage);
shot?.scrollIntoView({ block: 'center' });
shot?.click();
await until(() => rows().length > 0);
await wait(300);

return {
  verdict:
    failures.length === 0
      ? 'PASS an open picker lists a first page with no secondary, and the status secondary is a badge on every row'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
