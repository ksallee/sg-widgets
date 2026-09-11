// Leaves a text cell of the first row in edit, for the popover-editor screenshots.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework svelte --shot shots/x.png \
//     --drive tools/drives/table-popover-shot.js
async function until(test, tries = 200) {
  for (let i = 0; i < tries && !test(); i += 1) await wait(50);
  return test();
}

const pane = () => $$('[data-sg-demo] [data-pane]').find((p) => p.offsetParent !== null) ?? document;
const rows = () => $$('[data-slot="entity-table"] tbody tr[data-row-key]', pane());
const popover = () => $$('[data-field-editor-popover]').find((el) => el.checkVisibility()) ?? null;

if (!(await until(() => rows().length > 0))) return { verdict: 'FAIL no rows rendered' };
await wait(600);

// The description column sits past the pane's right edge, so the body scrolls to it first.
const cell = rows()[0].querySelector('td[data-column="description"]');
cell.scrollIntoView({ block: 'nearest', inline: 'center' });
await wait(200);
$('[data-sg-demo]')?.scrollIntoView({ block: 'start' });
await wait(400);

cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
if (!(await until(() => popover() !== null))) return { verdict: 'FAIL the text cell opened no popover' };
await wait(400);

return { verdict: 'PASS a text cell is in edit, in a popover' };
