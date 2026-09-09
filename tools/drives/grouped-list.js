// Collapse a group, count its rows, and select two.
const notes = [];
const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const groups = () => [...pane().querySelectorAll('[data-slot="grouped-list-group"]')];
const rows = () => [...pane().querySelectorAll('[data-slot="grouped-list-row"]')];

for (let i = 0; i < 40 && groups().length === 0; i += 1) await wait(250);
if (groups().length === 0) return { verdict: 'FAIL the list rendered no groups' };
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

return { verdict: 'PASS grouping, counts, collapse and selection', notes };
