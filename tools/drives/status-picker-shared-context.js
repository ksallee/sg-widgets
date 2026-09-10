// Every status picker on the page reads the Status table through the one context, so the
// page costs one statuses read however many pickers it draws, in either framework.
//
//   pnpm qa --start --path /widgets/status-picker/ --framework both --drive tools/drives/status-picker-shared-context.js
//
// `window.sgDemoReads` counts what reached the mock (apps/site/src/demos/_shared/client.ts).
// Both islands mount whatever the framework control shows, so both panes are counted.
const notes = [];
const panes = () => $$('[data-pane]').filter((p) => p.querySelector('[data-slot="status-picker"]'));
const pickers = (pane) => [...pane.querySelectorAll('[data-slot="status-picker"]')];

async function until(read, timeoutMs = 20000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(150);
  }
}

const mounted = await until(() => (panes().length === 2 ? panes() : null));
if (!mounted) return { verdict: `FAIL ${panes().length} of 2 panes drew a status picker` };

// A picker still loading has a read on its way, so the count is only final once none is.
const settled = await until(() =>
  mounted.every((pane) => pickers(pane).length > 1 && pickers(pane).every((p) => !p.dataset.loading))
    ? mounted
    : null,
);
if (!settled) return { verdict: 'FAIL a status picker never left its loading state' };

for (const pane of mounted) notes.push(`${pane.dataset.pane}: ${pickers(pane).length} status pickers`);

const reads = window.sgDemoReads ?? {};
const drawn = mounted.reduce((n, pane) => n + pickers(pane).length, 0);
notes.push(`reads: ${JSON.stringify(reads)}`);

const statuses = reads.statuses ?? 0;
if (statuses !== 1) return { verdict: `FAIL ${drawn} status pickers made ${statuses} statuses reads`, notes };

// The options come from the schema, and one field on one project is read once whatever asks.
const schemaReads = (reads.fields ?? 0) + (reads.fieldWithProject ?? 0);
notes.push(`schema reads: ${schemaReads}`);
if (schemaReads > 4) return { verdict: `FAIL ${drawn} pickers made ${schemaReads} schema reads`, notes };

return {
  verdict: `PASS ${drawn} status pickers over two panes made one statuses read and ${schemaReads} schema reads`,
  notes,
};
