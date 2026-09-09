// Sort by a header, select two rows, group by status, and edit a description cell in place.
// Both islands stay mounted, so everything is scoped to the pane on show.
const notes = [];
const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const table = () => pane().querySelector('[data-slot="entity-table"]');
const bodyRows = () => [...pane().querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]')];
const groupRows = () => [...pane().querySelectorAll('[data-slot="entity-table-group"]')];
const firstCode = () => bodyRows()[0]?.querySelector('td[data-column="code"]')?.textContent.trim();

for (let i = 0; i < 40 && bodyRows().length === 0; i += 1) await wait(250);
if (!table()) return { verdict: 'FAIL no entity-table rendered' };
await wait(600);
if (bodyRows().length === 0) return { verdict: 'FAIL no rows rendered' };
// 150 rows load; a virtualised body renders a window, not the lot.
notes.push(`rows in the DOM: ${bodyRows().length} of 150 loaded`);
if (bodyRows().length >= 150) return { verdict: 'FAIL the body is not virtualised', notes };

// Sorting goes through the source, so the first row changes.
const beforeSort = firstCode();
pane().querySelector('[data-slot="entity-table"] th[data-column="code"] button').click();
for (let i = 0; i < 40 && firstCode() === beforeSort; i += 1) await wait(200);
const afterSort = firstCode();
notes.push(`first row: ${beforeSort} -> ${afterSort}`);
if (!afterSort || afterSort === beforeSort) return { verdict: 'FAIL the first row did not change after sorting', notes };

// Two checkboxes, and the demo's count follows.
const boxes = [...pane().querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key] [data-slot="checkbox"]')];
boxes[0].click();
boxes[1].click();
await wait(300);
const count = pane().querySelector('[data-testid="selection-count"]').textContent.trim();
notes.push(`selection: ${count}`);
if (!count.startsWith('2 ')) return { verdict: `FAIL selection reads "${count}", expected 2`, notes };

// Group by status: headers carry a count, and collapsing one hides its rows.
[...pane().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Group by status').click();
for (let i = 0; i < 40 && groupRows().length === 0; i += 1) await wait(200);
await wait(400);
if (groupRows().length === 0) return { verdict: 'FAIL grouping produced no headers', notes };
notes.push(`group headers on screen: ${groupRows().length}, first reads "${groupRows()[0].textContent.trim()}"`);
// The body is virtualised, so a collapse changes which rows are on screen, not how many.
const firstKey = () => bodyRows()[0]?.dataset.rowKey;
const beforeCollapse = firstKey();
groupRows()[0].querySelector('button').click();
for (let i = 0; i < 20 && firstKey() === beforeCollapse; i += 1) await wait(200);
if (firstKey() === beforeCollapse) return { verdict: 'FAIL collapsing a group hid nothing', notes };
notes.push(`collapsing the first group moved the top row from ${beforeCollapse} to ${firstKey()}`);
groupRows()[0].querySelector('button').click();
await wait(400);

// Inline edit: double-click the description, type, Enter.
const cell = bodyRows()[0].querySelector('td[data-column="description"]');
cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
await wait(250);
const input = cell.querySelector('input');
if (!input) return { verdict: 'FAIL no editor opened on the description cell', notes };
const typed = 'edited in place by qa';
Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, typed);
input.dispatchEvent(new Event('input', { bubbles: true }));
await wait(150);
input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
const shownNow = () => bodyRows()[0].querySelector('td[data-column="description"]')?.textContent.trim();
for (let i = 0; i < 40 && shownNow() !== typed; i += 1) await wait(200);
notes.push(`cell now: ${shownNow()}`);
if (shownNow() !== typed) return { verdict: `FAIL the cell reads "${shownNow()}", expected "${typed}"`, notes };

return { verdict: 'PASS virtualisation, sort, selection, grouping and inline edit', notes };
