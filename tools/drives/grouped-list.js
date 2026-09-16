// Collapse a group, count its rows, select two, and read the list grouped on a derived key:
// every row under a header belongs to the record the header names, and the sort stays the
// caller's.
const notes = [];
const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const lists = () => [...pane().querySelectorAll('[data-slot="grouped-list"]')];
const main = () => lists()[0];
const groups = (root = main()) => [...root.querySelectorAll('[data-slot="grouped-list-group"]')];
const rows = (root = main()) => [...root.querySelectorAll('[data-slot="grouped-list-row"]')];

for (let i = 0; i < 40 && (!main() || groups().length === 0); i += 1) await wait(250);
if (!main() || groups().length === 0) return { verdict: 'FAIL the list rendered no groups' };
notes.push(`groups: ${groups().length}, rows: ${rows().length}`);
if (groups().length < 2) return { verdict: 'FAIL fewer than two groups', notes };

// The header count is the rows loaded under it.
const first = groups()[0];
const header = first.querySelector('button');
const shown = first.querySelectorAll('[data-slot="grouped-list-row"]').length;
// The count is the last element of the header row; the label beside it is a FieldValue.
const stated = Number(header.lastElementChild.textContent.trim());
notes.push(`first group states ${stated} and shows ${shown}`);
if (stated !== shown) return { verdict: `FAIL the header count is ${stated} against ${shown} rows`, notes };

const before = rows().length;
header.click();
await wait(300);
if (rows().length !== before - shown) {
  return { verdict: `FAIL collapsing left ${rows().length} rows, expected ${before - shown}`, notes };
}
notes.push(`collapsing the first group hid ${shown} rows`);
header.click();
await wait(300);

const boxes = rows().map((r) => r.querySelector('[data-slot="checkbox"]'));
boxes[0].click();
boxes[1].click();
await wait(300);
const count = pane().querySelector('[data-testid="selection-count"]').textContent.trim();
notes.push(`selection: ${count}`);
if (!count.startsWith('2 ')) return { verdict: `FAIL selection reads "${count}", expected 2`, notes };

// The derived key: the header names the record, and its count is the rows under it.
const derived = pane().querySelector('[data-demo-case="derived"] [data-slot="grouped-list"]');
if (!derived) return { verdict: 'FAIL no list grouped on a derived key', notes };
for (let i = 0; i < 40 && groups(derived).length === 0; i += 1) await wait(250);
const keyed = groups(derived);
if (keyed.length < 2) return { verdict: `FAIL the derived list drew ${keyed.length} groups`, notes };
const heads = keyed.map((g) => {
  const line = g.querySelector('button');
  return { label: line.firstElementChild.nextElementSibling.textContent.trim(), stated: Number(line.lastElementChild.textContent.trim()) };
});
notes.push(`derived groups: ${heads.map((h) => `${h.label}/${h.stated}`).join(', ')}`);
if (heads.some((h) => h.label === '')) return { verdict: 'FAIL a derived header drew no label', notes };
const mismatch = keyed.findIndex((g, i) => g.querySelectorAll('[data-slot="grouped-list-row"]').length !== heads[i].stated);
if (mismatch !== -1) return { verdict: `FAIL derived group ${mismatch} states ${heads[mismatch].stated} against its rows`, notes };

// A Version's code opens on the code of the record it is of, so every row under a header
// carries the header's label, and no header's label is another header's.
const rowLabel = (row) => row.querySelector('[data-slot="grouped-list-row-label"] span span').textContent.trim();
for (const [i, g] of keyed.entries()) {
  const strays = [...g.querySelectorAll('[data-slot="grouped-list-row"]')]
    .map(rowLabel)
    .filter((label) => !label.startsWith(`${heads[i].label}_`));
  if (strays.length > 0) {
    return { verdict: `FAIL derived group "${heads[i].label}" holds ${strays.length} rows of another record: ${strays.join(', ')}`, notes };
  }
}
if (new Set(heads.map((h) => h.label)).size !== heads.length) {
  return { verdict: 'FAIL a record is split over two derived groups', notes };
}
notes.push(`every row under a derived header is a version of its record`);

// A derived key leaves the source's sort as the caller set it: on code, not on the record.
const sortLine = pane().querySelector('[data-demo-case="derived"] [data-testid="derived-sort"]')?.textContent.trim();
notes.push(`derived list: ${sortLine}`);
if (sortLine !== 'Sorted on code') return { verdict: `FAIL the derived list reads "${sortLine}", expected "Sorted on code"`, notes };

return { verdict: 'PASS grouping, counts, collapse, selection, the derived key, its rows and its sort', notes };
