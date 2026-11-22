// Click to edit on the entity-table page. By default a plain click selects the row and a checkbox
// cell flips on one click and on Space, leaving the selection. With Edit on click, one click opens
// the editor with focus in it and leaves the selection; a click inside it keeps it; a click on
// another cell commits it and opens that one; Shift, Ctrl or Meta and a click on a cell that cannot
// be edited still select. First Frame is a 90px column: its inline editor is a bare field the cell's
// width, value selected, right aligned, arrows step, Escape restores, Enter writes. In a popover
// the steppers stay and focus lands in the field. Against a live site nothing is written.
//
//   PUBLIC_SG_DEMO_BOTH=1 pnpm qa --start --path /widgets/entity-table/ --framework both --viewport 1920x1080 --drive tools/drives/entity-table-click-edit.js

const failures = [];
const seen = {};
const live = $('[data-sg-demo]')?.dataset.source === 'live';

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

function type(input, text) {
  const setter = Object.getOwnPropertyDescriptor(input.constructor.prototype, 'value').set;
  setter.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function keydown(target, key, mods = {}) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...mods }));
}

/** A number's digits, whatever separators the locale draws. */
const digits = (value) => String(value).replace(/\D/g, '');
const text = (cell) => cell?.querySelector('[data-slot="field-value"]')?.textContent.trim() ?? '';
const button = (pane, label) => [...pane.querySelectorAll('button')].find((b) => b.textContent.trim() === label);

async function drive(pane, framework) {
  const fail = (what) => failures.push(`${framework}: ${what}`);
  const rows = () => [...pane.querySelectorAll('[data-slot="entity-table"] tbody tr[data-row-key]')];
  const cell = (at, column) => rows()[at]?.querySelector(`td[data-column="${column}"]`);
  const selected = (at) => rows()[at]?.dataset.state === 'selected';
  const editorIn = (el) => el?.querySelector('[data-slot="entity-table-editor"] input, [data-slot="entity-table-editor"] textarea');
  const mine = (at) => seen[framework][at] ?? (seen[framework][at] = {});

  if (!(await until(() => rows().length >= 12, 80))) return fail('fewer than 12 rows drew');
  button(pane, 'Inline editor')?.click();
  const onClick = pane.querySelector('[data-demo="edit-on-click"]');
  if (!onClick) return fail('no Edit on click toggle in the demo');
  if (onClick.getAttribute('aria-pressed') === 'true') onClick.click();
  await wait(200);
  pane.querySelector('[data-slot="entity-table"]').scrollIntoView({ block: 'center' });
  seen[framework] = {};

  // Default: a plain click selects, and the hint says double-click.
  const hint = cell(1, 'code')?.getAttribute('title');
  if (hint !== 'Double-click or press Enter to edit') fail(`the default hint reads "${hint}"`);
  press(cell(1, 'code'));
  if (!(await until(() => selected(1), 20))) fail('a plain click did not select the row by default');
  if (editorIn(cell(1, 'code'))) fail('a plain click opened an editor by default');
  press(cell(1, 'code'));
  await until(() => !selected(1), 20);
  mine('default').hint = hint;

  // A checkbox cell is a control. One click and Space flip it, in the default mode, without selecting.
  const box = () => cell(0, 'client_approved')?.querySelector('[data-slot="checkbox"]');
  const checked = () => box()?.getAttribute('aria-checked') ?? box()?.getAttribute('data-state');
  if (!box()) fail('the Client Approved cell draws no checkbox');
  else {
    const boxHint = cell(0, 'client_approved').getAttribute('title');
    if (boxHint !== 'Click or press Space to toggle') fail(`the checkbox hint reads "${boxHint}"`);
    mine('checkbox').hint = boxHint;
    mine('checkbox').role = box().getAttribute('role');
    if (!live) {
      const start = checked();
      press(box());
      const flipped = await until(() => checked() !== start, 60);
      if (!flipped) fail(`one click left the checkbox ${start}`);
      if (selected(0)) fail('a click on the checkbox cell selected the row');
      if (editorIn(cell(0, 'client_approved'))) fail('a click on the checkbox cell opened an editor');
      mine('checkbox').click = `${start} -> ${checked()}`;
      cell(0, 'client_approved').focus();
      keydown(cell(0, 'client_approved'), ' ');
      const back = await until(() => checked() === start, 60);
      if (!back) fail(`Space left the checkbox ${checked()}`);
      if (selected(0)) fail('Space on the checkbox cell selected the row');
      mine('checkbox').space = `-> ${checked()}`;
    }
  }

  // Edit on click.
  onClick.click();
  await wait(250);
  const clickHint = cell(5, 'code')?.getAttribute('title');
  if (clickHint !== 'Click or press Enter to edit') fail(`the click hint reads "${clickHint}"`);
  mine('click').hint = clickHint;

  press(cell(5, 'code'));
  const codeInput = await until(() => editorIn(cell(5, 'code')));
  if (!codeInput) return fail('one click opened no editor on the code cell');
  if (document.activeElement !== codeInput) fail(`focus is on ${document.activeElement?.tagName}, not the editor`);
  if (selected(5)) fail('a click to edit selected the row');
  const typed = `clicked ${framework}`;
  type(codeInput, typed);
  await wait(100);
  press(codeInput);
  await wait(200);
  if (editorIn(cell(5, 'code')) !== codeInput || codeInput.value !== typed) fail('a click inside the editor reset it');
  mine('click').focus = document.activeElement === codeInput ? 'editor input' : document.activeElement?.tagName;

  // A click on another editable cell commits this one and opens that one.
  if (live) {
    keydown(codeInput, 'Escape');
    await until(() => !editorIn(cell(5, 'code')), 20);
  }
  // The next editable cell along the row that is not a checkbox; on the mock, the description.
  const nextColumn =
    [...rows()[5].querySelectorAll('td[data-editable]')]
      .map((td) => td.dataset.column)
      .find((column) => column !== 'code' && !cell(5, column).querySelector('[data-slot="checkbox"]')) ?? 'description';
  mine('click').next = nextColumn;
  press(cell(5, nextColumn));
  const description = await until(() => editorIn(cell(5, nextColumn)));
  if (!description) fail('a click on the next cell opened no editor there');
  if (editorIn(cell(5, 'code'))) fail('the code editor stayed open');
  if (description && document.activeElement !== description) fail('focus did not move to the next editor');
  if (!live) {
    const committed = await until(() => text(cell(5, 'code')) === typed, 60);
    if (!committed) fail(`the code cell reads "${text(cell(5, 'code'))}" after the click away`);
    mine('click').committed = text(cell(5, 'code'));
  }
  if (description) {
    keydown(description, 'Escape');
    await until(() => !editorIn(cell(5, nextColumn)), 20);
  }

  // Meta, Ctrl and Shift still select; so does a cell that cannot be edited; a locked cell opens nothing.
  press(cell(6, 'code'), { metaKey: true });
  if (!(await until(() => selected(6), 20))) fail('Meta with a click did not select the row');
  if (editorIn(cell(6, 'code'))) fail('Meta with a click opened an editor');
  press(cell(6, 'code'), { ctrlKey: true });
  if (!(await until(() => !selected(6), 20))) fail('Ctrl with a click did not toggle the row back');
  press(cell(7, 'image'));
  if (!(await until(() => selected(7), 20))) fail('a click on the image cell did not select the row');
  press(cell(7, 'image'));
  await until(() => !selected(7), 20);
  const locked = pane.querySelector('[data-slot="entity-table"] td[data-locked="true"]');
  if (locked) {
    press(locked);
    await wait(200);
    if (locked.querySelector('input,textarea')) fail('a click opened an editor on the locked cell');
  }
  mine('select').modified = 'Meta selects, Ctrl clears, image cell selects';

  // The 90px First Frame column: a bare field, value selected, right aligned.
  // A row with a First Frame, so the step has a number to start from; the mock fills every row.
  const at = Math.max(8, rows().findIndex((row, index) => index >= 8 && digits(text(row.querySelector('td[data-column="sg_first_frame"]'))) !== ''));
  const frames = cell(at, 'sg_first_frame');
  const shown = text(frames);
  mine('number').row = at;
  mine('number').column = Math.round(frames.getBoundingClientRect().width);
  press(frames);
  const field = await until(() => editorIn(cell(at, 'sg_first_frame')));
  if (!field) return fail('one click opened no editor on First Frame');
  const box8 = cell(at, 'sg_first_frame').getBoundingClientRect();
  const fieldBox = field.getBoundingClientRect();
  const number = {
    steppers: cell(at, 'sg_first_frame').querySelectorAll('[data-slot="number-editor-decrement"],[data-slot="number-editor-increment"]').length,
    focused: document.activeElement === field,
    value: field.value,
    selection: [field.selectionStart, field.selectionEnd],
    align: getComputedStyle(field).textAlign,
    width: Math.round(fieldBox.width),
    inside: fieldBox.left >= box8.left - 0.5 && fieldBox.right <= box8.right + 0.5,
  };
  Object.assign(mine('number'), number);
  if (number.steppers !== 0) fail(`the inline number editor drew ${number.steppers} steppers`);
  if (!number.focused) fail(`focus is on ${document.activeElement?.tagName} ${document.activeElement?.dataset?.slot ?? ''}, not the number field`);
  if (digits(number.value) !== digits(shown)) fail(`the number field reads "${number.value}", the cell read "${shown}"`);
  if (number.selection[0] !== 0 || number.selection[1] !== number.value.length) fail(`the number's text is not selected: ${number.selection}`);
  if (number.align !== 'right') fail(`the number sits ${number.align}`);
  if (number.width < 40 || !number.inside) fail(`the number field is ${number.width}px wide, inside the cell: ${number.inside}`);
  keydown(field, 'ArrowUp');
  await wait(100);
  mine('number').arrowUp = field.value;
  if (digits(shown) !== '' && Number(digits(field.value)) !== Number(digits(shown)) + 1) fail(`ArrowUp made "${field.value}" from "${shown}"`);
  keydown(field, 'Escape');
  await until(() => !editorIn(cell(at, 'sg_first_frame')), 20);
  if (text(cell(at, 'sg_first_frame')) !== shown) fail(`Escape left First Frame reading "${text(cell(at, 'sg_first_frame'))}"`);
  if (!live) {
    press(cell(at, 'sg_first_frame'));
    const again = await until(() => editorIn(cell(at, 'sg_first_frame')));
    if (again) {
      type(again, '150');
      await wait(100);
      keydown(again, 'Enter');
      const wrote = await until(() => text(cell(at, 'sg_first_frame')) === '150', 60);
      if (!wrote) fail(`Enter left First Frame reading "${text(cell(at, 'sg_first_frame'))}"`);
      mine('number').enter = text(cell(at, 'sg_first_frame'));
    }
  }

  // In a popover the steppers stay and focus lands in the field.
  button(pane, 'Popover editor')?.click();
  await wait(250);
  press(cell(9, 'sg_first_frame'));
  const popup = await until(() =>
    [...document.querySelectorAll('[data-slot="popover-content"]')].find((el) => el.querySelector('[data-slot="number-editor"]')),
  );
  if (!popup) fail('no popover number editor opened');
  else {
    const focus = await until(() => (popup.contains(document.activeElement) ? document.activeElement : null), 20);
    mine('popover').focus = focus?.tagName;
    mine('popover').steppers = popup.querySelectorAll('[data-slot="number-editor-decrement"],[data-slot="number-editor-increment"]').length;
    if (focus?.tagName !== 'INPUT') fail(`the popover focused ${focus?.tagName ?? 'nothing'}`);
    if (mine('popover').steppers !== 2) fail(`the popover drew ${mine('popover').steppers} steppers`);
    keydown(document.activeElement, 'Escape');
    await until(() => !document.querySelector('[data-slot="popover-content"] [data-slot="number-editor"]'), 20);
  }

  // Leave the shot on the 90px editor, inline, edit on click.
  button(pane, 'Inline editor')?.click();
  await wait(200);
  const scroller = pane.querySelector('[data-slot="entity-table-scroll"]');
  scroller.scrollLeft = cell(3, 'description').offsetLeft - 40;
  press(cell(3, 'sg_first_frame'));
  await until(() => editorIn(cell(3, 'sg_first_frame')));
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
      ? `PASS click selects by default, a checkbox flips on one click and Space, Edit on click opens and commits on the next click, modified clicks select, a 90px number edits bare${live ? ' (live: nothing written)' : ''}`
      : `FAIL ${failures.join('; ')}`,
  live,
  seen,
};
