// Change the page size, walk to page 2, sort a header, see no column menu,
// edit a description in place, then group by status.
// Both islands stay mounted, so everything is scoped to the pane on show.
const notes = [];
const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const table = () => pane().querySelector('[data-slot="entity-table"]');
const bodyRows = () => [...pane().querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]')];
const groupRows = () => [...pane().querySelectorAll('[data-slot="entity-table-group"]')];
const heads = () => [...pane().querySelectorAll('[data-slot="entity-table"] thead th')];
const range = () => pane().querySelector('[data-slot="entity-table-range"]')?.textContent.trim() ?? '';
const firstCode = () => bodyRows()[0]?.querySelector('td[data-column="code"]')?.textContent.trim();

async function until(test, tries = 60) {
  for (let i = 0; i < tries && !test(); i += 1) await wait(200);
  return test();
}

// Base UI opens on a click, Bits UI on pointerdown, and neither answers the other.
async function open(trigger, role) {
  for (const gesture of ['click', 'pointer']) {
    if (gesture === 'click') trigger.click();
    else {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
      trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
    }
    const found = await until(() => document.querySelectorAll(`[role="${role}"]`).length > 0, 12);
    if (found) break;
  }
  return [...document.querySelectorAll(`[role="${role}"]`)];
}

function press(element) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, button: 0 }));
  }
}

for (let i = 0; i < 40 && bodyRows().length === 0; i += 1) await wait(250);
if (!table()) return { verdict: 'FAIL no entity-table rendered' };
await wait(600);
if (bodyRows().length === 0) return { verdict: 'FAIL no rows rendered' };

// The first page of 25, counted by one summarize call.
notes.push(`page 1 reads "${range()}" over ${bodyRows().length} rows`);
if (!(await until(() => range() === '1 to 25 of 320'))) {
  return { verdict: `FAIL the range reads "${range()}", expected "1 to 25 of 320"`, notes };
}

// Page size: the select reopens the set at the first row.
const sizes = await open(pane().querySelector('[data-slot="entity-table-page-size"] [data-slot="select-trigger"]'), 'option');
const option = sizes.find((i) => i.textContent.trim() === '50');
if (!option) return { verdict: `FAIL the page size select offered ${sizes.length} options, none of them 50`, notes };
press(option);
if (!(await until(() => range() === '1 to 50 of 320'))) {
  return { verdict: `FAIL after a page size of 50 the range reads "${range()}"`, notes };
}
notes.push(`page size 50 reads "${range()}" over ${bodyRows().length} rows`);

// Page 2 of the same set.
pane().querySelector('[data-slot="entity-table-pager"] button[aria-label="Next page"]').click();
if (!(await until(() => range() === '51 to 100 of 320'))) {
  return { verdict: `FAIL page 2 reads "${range()}", expected "51 to 100 of 320"`, notes };
}
notes.push(`page 2 reads "${range()}"`);

// Sorting goes through the source, so the first row changes and the page reopens.
const beforeSort = firstCode();
pane().querySelector('[data-slot="entity-table"] th[data-column="code"] button[data-sortable]').click();
await until(() => firstCode() !== beforeSort);
const afterSort = firstCode();
notes.push(`first row: ${beforeSort} -> ${afterSort}`);
if (!afterSort || afterSort === beforeSort) return { verdict: 'FAIL the first row did not change after sorting', notes };

// The column menu is opt-in and the demo leaves it off: no header carries a trigger.
// Hiding a column goes through the column picker in the toolbar, which its own drive covers.
if (pane().querySelector('[data-slot="entity-table"] th [data-slot="dropdown-menu-trigger"]')) {
  return { verdict: 'FAIL a header carries a column menu although columnMenu is off', notes };
}
notes.push('no column menu on the headers');

// Inline edit: double-click the description, type, Enter. No editorFor is given, so the
// cell opens the field editor's own control for the type.
const cell = bodyRows()[0].querySelector('td[data-column="description"]');
cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
await wait(300);
// The description cell opens its editor in a popover, portalled out of the cell.
const popover = $$('[data-field-editor-popover]').find((el) => el.checkVisibility()) ?? cell;
const input = cell.querySelector('input, textarea') ?? popover.querySelector('input, textarea');
if (!input) return { verdict: 'FAIL no editor opened on the description cell', notes };
const typed = 'edited in place by qa';
const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set;
setter.call(input, typed);
input.dispatchEvent(new Event('input', { bubbles: true }));
await wait(200);
// A text cell edits in a textarea inside a popover: Ctrl with Enter commits.
input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, bubbles: true }));
const shownNow = () => bodyRows()[0].querySelector('td[data-column="description"]')?.textContent.trim();
if (!(await until(() => shownNow() === typed))) {
  return { verdict: `FAIL the cell reads "${shownNow()}", expected "${typed}"`, notes };
}
notes.push(`cell now: ${shownNow()}`);

// Grouping is TanStack's over the loaded page, under the order the server produced.
[...pane().querySelectorAll('button')].find((b) => b.textContent.trim() === 'Group by status').click();
if (!(await until(() => groupRows().length > 0))) return { verdict: 'FAIL grouping produced no headers', notes };
await wait(400);
const stated = Number(groupRows()[0].querySelector('button').lastElementChild.textContent.trim());
const rowsBefore = bodyRows().length;
notes.push(`group headers: ${groupRows().length}, the first states ${stated}`);
groupRows()[0].querySelector('button').click();
if (!(await until(() => bodyRows().length === rowsBefore - stated))) {
  return { verdict: `FAIL collapsing left ${bodyRows().length} rows, expected ${rowsBefore - stated}`, notes };
}
notes.push(`collapsing the first group hid ${stated} rows`);

return { verdict: 'PASS page size, paging, sorting, no column menu, popover edit and grouping', notes };
