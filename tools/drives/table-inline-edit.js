// Leaves a status cell of the first row in edit, for the inline-edit screenshots.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework svelte --shot shots/x.png \
//     --drive tools/drives/table-inline-edit.js
async function until(test, tries = 200) {
  for (let i = 0; i < tries && !test(); i += 1) await wait(50);
  return test();
}

const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const rows = () => $$('[data-slot="entity-table"] tbody tr[data-row-key]', pane());

if (!(await until(() => rows().length > 0))) return { verdict: 'FAIL no rows rendered' };
await wait(600);

const cell = rows()[0].querySelector('td[data-column="sg_status_list"]');
cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
// The status editor opens in a popover by default, so the picker is looked for there too.
const statusPicker = () =>
  document.querySelector('[data-field-editor-popover] [data-slot="status-picker"]') ?? cell.querySelector('[data-slot="status-picker"]');
if (!(await until(() => statusPicker() !== null))) {
  return { verdict: 'FAIL the status cell opened no picker' };
}

// The status column sits past the pane's right edge, so the body scrolls to it first.
cell.scrollIntoView({ block: 'nearest', inline: 'center' });
await wait(200);
$('[data-sg-demo]')?.scrollIntoView({ block: 'start' });
await wait(400);

return { verdict: 'PASS a status cell is in edit' };
