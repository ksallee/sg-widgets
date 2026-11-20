// Bulk edit on the entity-table page: three selected rows, a description typed in one of them, the
// confirm, and all three read back with it while the rows around them keep theirs. A locked cell
// opens no editor and carries its reason. Tab in an inline editor commits and moves along the row.
//
//   PUBLIC_SG_DEMO_BOTH=1 pnpm qa --start --path /widgets/entity-table/ --framework both --drive tools/drives/entity-table-bulk.js

const failures = [];
const seen = {};

async function until(read, tries = 60) {
  for (let i = 0; i < tries; i += 1) {
    const value = read();
    if (value) return value;
    await wait(100);
  }
  return read();
}

/** A press with modifiers, the way a mouse makes one. */
function press(el, mods = {}) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse', ...mods }));
  }
}

/** Type into an input the way a person does, so both frameworks see the change. */
function type(input, text) {
  const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set;
  setter.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function keydown(target, key, mods = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
}

const text = (cell) => cell?.querySelector('[data-slot="field-value"]')?.textContent.trim() ?? '';

async function drive(pane, framework) {
  const fail = (what) => failures.push(`${framework}: ${what}`);
  const rows = () => [...pane.querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]')];
  const cell = (at, column) => rows()[at]?.querySelector(`td[data-column="${column}"]`);
  const picked = () => rows().map((row, at) => (row.dataset.state === 'selected' ? at : -1)).filter((at) => at >= 0);

  if (!(await until(() => rows().length >= 8, 80))) return fail('fewer than 8 rows drew');
  [...pane.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Inline editor')?.click();
  await wait(200);
  pane.querySelector('[data-slot="entity-table"]').scrollIntoView({ block: 'center' });
  seen[framework] = {};

  // A locked cell: no editor, the reason on hover and to a screen reader.
  const locked = pane.querySelector('[data-slot="entity-table"] td[data-locked="true"]');
  if (!locked) fail('no locked cell drew');
  else {
    const reason = locked.getAttribute('title');
    const spoken = locked.querySelector('.sr-only')?.textContent.trim();
    if (reason !== 'An approved Version keeps its description.') fail(`the locked cell says "${reason}"`);
    if (spoken !== reason) fail(`the locked cell tells a screen reader "${spoken}"`);
    if (locked.hasAttribute('data-editable')) fail('the locked cell is marked editable');
    if (locked.getAttribute('tabindex') !== '0') fail('the locked cell takes no keyboard cursor');
    locked.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    await wait(250);
    if (locked.querySelector('input,textarea')) fail('a double-click opened an editor on the locked cell');
    seen[framework].locked = reason;
  }

  // Tab in an inline editor commits and moves to the next editable cell of the row.
  const code = cell(5, 'code');
  code.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const codeInput = await until(() => code.querySelector('input,textarea'));
  if (!codeInput) fail('no inline editor opened on the code cell');
  else {
    type(codeInput, 'renamed by the bulk drive');
    await wait(100);
    keydown(codeInput, 'Tab');
    const landed = await until(() => text(cell(5, 'code')) === 'renamed by the bulk drive');
    if (!landed) fail(`Tab left the code reading "${text(cell(5, 'code'))}"`);
    const focused = await until(() => {
      const active = document.activeElement;
      return active?.matches?.('td[data-editable]') && active.closest('tr') === rows()[5] && active.dataset.column !== 'code'
        ? active
        : null;
    }, 20);
    if (!focused) fail(`Tab left the focus on ${document.activeElement?.tagName} ${document.activeElement?.dataset?.column ?? ''}`);
    else seen[framework].tabMovedTo = focused.dataset.column;
  }

  // Three rows selected, a description typed in the middle one, the confirm, all three changed.
  const before = { above: text(cell(0, 'description')), below: text(cell(4, 'description')) };
  press(cell(1, 'code'));
  press(cell(3, 'code'), { shiftKey: true });
  if (!(await until(() => JSON.stringify(picked()) === '[1,2,3]', 20))) return fail(`rows ${JSON.stringify(picked())} are selected, expected [1,2,3]`);
  const target = cell(2, 'description');
  if (!target.getAttribute('title')?.includes('all 3 selected rows')) fail(`the cell's hint reads "${target.getAttribute('title')}"`);
  target.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
  const input = await until(() => target.querySelector('input,textarea'));
  if (!input) return fail('no inline editor opened on the description cell');
  const typed = `bulk ${framework}`;
  type(input, typed);
  await wait(100);
  keydown(input, 'Enter', input.tagName === 'TEXTAREA' ? { ctrlKey: true } : {});
  const dialog = await until(() => [...document.querySelectorAll('[data-demo="bulk-confirm"]')].find((el) => el.checkVisibility()));
  if (!dialog) return fail('no confirm opened');
  seen[framework].confirm = dialog.querySelector('h2,[data-slot="dialog-title"]')?.textContent.trim();
  if (!seen[framework].confirm?.includes('on 3 Versions')) fail(`the confirm reads "${seen[framework].confirm}"`);
  dialog.querySelector('[data-demo="bulk-confirm-ok"]').click();
  const all = await until(() => [1, 2, 3].every((at) => text(cell(at, 'description')) === typed), 80);
  if (!all) fail(`after the confirm the three rows read ${JSON.stringify([1, 2, 3].map((at) => text(cell(at, 'description'))))}`);
  if (text(cell(0, 'description')) !== before.above || text(cell(4, 'description')) !== before.below) fail('a row outside the selection changed');
  seen[framework].bulk = [1, 2, 3].map((at) => text(cell(at, 'description')));
  // The shot shows the edited column: scroll the table body, not the page, to it.
  const scroller = pane.querySelector('[data-slot="entity-table-scroll"]');
  scroller.scrollLeft = cell(2, 'description').offsetLeft - 120;
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-sg-demo] [data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  await drive(pane, framework);
}

if (Object.keys(seen).length === 0 && failures.length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS a locked cell keeps its reason, Tab commits and moves, a bulk edit asks and changes the three selected rows only'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
