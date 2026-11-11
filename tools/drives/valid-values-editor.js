// The valid values editor adds, edits, removes and reorders the values of a list, takes a paste
// of several lines, and picks a status list's codes from the site's statuses.
//
//   pnpm qa --start --path /widgets/valid-values-editor/ --framework both --drive tools/drives/valid-values-editor.js

const failures = [];
const seen = {};

async function until(read, ms = 4000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

/** A press, the way a mouse makes one: a picker's control toggles on pointerdown. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

/** Typing, the way both frameworks hear it: the native setter, then an input event. */
function type(input, text) {
  input.focus({ preventScroll: true });
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text);
  input.dispatchEvent(new InputEvent('input', { bubbles: true }));
}

function key(el, name, more = {}) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true, ...more }));
}

function paste(input, text) {
  input.focus({ preventScroll: true });
  const data = new DataTransfer();
  data.setData('text/plain', text);
  input.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }));
}

const emitted = (box) => JSON.parse($('p', box)?.textContent ?? 'null');
const rowsOf = (box) => $$('[data-slot="valid-values-editor-row"]', box);
const inputsOf = (box) => $$('[data-slot="valid-values-editor-input"]', box);
const addOf = (box) => $('[data-slot="valid-values-editor-add-input"]', box);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  const note = {};
  const fail = (what) => failures.push(`${framework}: ${what}`);
  /** Wait for the readout, and say what it held when it never got there. */
  const expect = async (box, want, what) => {
    const got = await until(() => (same(emitted(box), want) ? true : null), 2000);
    if (!got) fail(`${what}: emitted ${JSON.stringify(emitted(box))}, wanted ${JSON.stringify(want)}`);
    return Boolean(got);
  };

  const list = await until(() => $('[data-demo="list"]', pane), 15000);
  if (!list) {
    fail('no demo');
    continue;
  }
  list.scrollIntoView({ block: 'center' });
  await wait(100);

  /* ------------------------------------------------------------------ add */

  if (rowsOf(list).length !== 4) fail(`${rowsOf(list).length} rows at the start, wanted 4`);
  type(addOf(list), '  Trailer ');
  key(addOf(list), 'Enter');
  await expect(list, ['VFX', '2D', 'Full CG', 'Look Dev', 'Trailer'], 'add');
  note.addKeepsCaret = document.activeElement === addOf(list) && addOf(list).value === '';
  if (!note.addKeepsCaret) fail('the add row lost the caret, or kept its text, after Enter');

  /* ---------------------------------------------------------------- paste */

  paste(addOf(list), 'Marketing\r\n\n  Previs \nPostvis');
  await expect(list, ['VFX', '2D', 'Full CG', 'Look Dev', 'Trailer', 'Marketing', 'Previs', 'Postvis'], 'paste in the add row');

  // The row's text is selected, so the pasted lines take its place.
  inputsOf(list)[1].focus({ preventScroll: true });
  inputsOf(list)[1].select();
  paste(inputsOf(list)[1], '\nTwo D\nThree D\n');
  await until(() => (emitted(list).length === 9 ? true : null), 2000);
  const merged = emitted(list);
  note.rowPaste = merged.slice(0, 4);
  if (!(merged.length === 9 && merged[1] === 'Two D' && merged[2] === 'Three D')) {
    fail(`a paste in a row gave ${JSON.stringify(merged)}`);
  }

  /* ----------------------------------------------------------------- edit */

  type(inputsOf(list)[0], ' Visual FX  ');
  if (emitted(list)[0] !== 'VFX') fail('a keystroke emitted');
  key(inputsOf(list)[0], 'Enter');
  await until(() => (emitted(list)[0] === 'Visual FX' ? true : null), 2000);
  if (emitted(list)[0] !== 'Visual FX') fail(`an edit emitted ${JSON.stringify(emitted(list)[0])}`);
  await wait(100);
  note.enterMovesOn = document.activeElement === inputsOf(list)[1];
  if (!note.enterMovesOn) fail('Enter in a row did not move the caret to the next row');

  type(inputsOf(list)[0], 'thrown away');
  key(inputsOf(list)[0], 'Escape');
  await wait(100);
  if (inputsOf(list)[0].value !== 'Visual FX') fail(`Escape left "${inputsOf(list)[0].value}" in the row`);

  /* --------------------------------------------------------------- reorder */

  const before = emitted(list);
  inputsOf(list)[0].focus({ preventScroll: true });
  key(inputsOf(list)[0], 'ArrowDown', { altKey: true });
  await until(() => (emitted(list)[1] === 'Visual FX' ? true : null), 2000);
  note.moved = emitted(list).slice(0, 3);
  if (!(emitted(list)[1] === 'Visual FX' && emitted(list)[0] === before[1])) {
    fail(`Alt and ArrowDown gave ${JSON.stringify(note.moved)}`);
  }
  await wait(100);
  note.moveKeepsCaret = document.activeElement === inputsOf(list)[1];
  if (!note.moveKeepsCaret) fail('the caret did not follow the moved row');
  const drawn = inputsOf(list).map((input) => input.value);
  if (!same(drawn, emitted(list))) fail(`the rows read ${JSON.stringify(drawn)} after the move`);

  /* ------------------------------------------------- carried by the keyboard */

  // A row picked up on its grip moves a place per arrow, as far as it is taken, and the
  // caret stays on the grip: the list is redrawn under it at every step.
  const carried = emitted(list)[0];
  const gripOf = () =>
    $('[data-slot="valid-values-editor-grip"]', rowsOf(list).find((row) => row.dataset.value === carried));
  gripOf().focus({ preventScroll: true });
  key(gripOf(), ' ');
  await wait(100);
  for (const [arrow, places] of [['ArrowDown', [1, 2]], ['ArrowUp', [1, 0]]]) {
    for (const place of places) {
      key(gripOf(), arrow);
      await until(() => (emitted(list)[place] === carried ? true : null), 2000);
      await wait(150);
      if (emitted(list)[place] !== carried) fail(`${arrow} while carrying: the list reads ${JSON.stringify(emitted(list))}`);
      if (document.activeElement !== gripOf()) fail(`${arrow} while carrying took the caret off the grip`);
    }
  }
  note.carriedBack = emitted(list)[0] === carried;
  key(gripOf(), ' ');
  await wait(150);
  if ($('[data-dragging]', list)) fail('a dropped row still reads as carried');
  if (document.activeElement !== gripOf()) fail('the drop took the caret off the grip');

  /* ---------------------------------------------------------------- remove */

  const count = emitted(list).length;
  type(inputsOf(list)[2], '   ');
  inputsOf(list)[2].blur();
  await until(() => (emitted(list).length === count - 1 ? true : null), 2000);
  if (emitted(list).length !== count - 1) fail('a row left blank was not dropped on blur');

  $$('[data-slot="valid-values-editor-remove"]', list)[0].click();
  await until(() => (emitted(list).length === count - 2 ? true : null), 2000);
  if (emitted(list).length !== count - 2) fail('the cross did not remove its row');
  if (rowsOf(list).length !== emitted(list).length) fail('the rows and the value disagree after a removal');
  note.left = emitted(list);

  /* ----------------------------------------------------------------- empty */

  const empty = $('[data-demo="empty"]', pane);
  const box = $('[data-slot="valid-values-editor-box"]', empty);
  note.emptyHeight = Math.round(box.getBoundingClientRect().height);
  if (note.emptyHeight !== 32) fail(`an empty editor stands ${note.emptyHeight}px high, not 32`);
  type(addOf(empty), 'First');
  addOf(empty).blur();
  await expect(empty, ['First'], 'blur in the add row');

  /* ---------------------------------------------------------------- unique */

  const unique = $('[data-demo="unique"]', pane);
  type(addOf(unique), 'Type A');
  key(addOf(unique), 'Enter');
  type(addOf(unique), 'type a');
  key(addOf(unique), 'Enter');
  await expect(unique, ['Type A', 'Type B', 'type a'], 'unique');

  /* ---------------------------------------------------------------- status */

  const status = $('[data-demo="status"]', pane);
  const control = await until(() => $('[data-slot="status-multi-picker-control"]', status), 8000);
  if (!control) fail('the status list drew no picker');
  else {
    await until(() => ($$('[data-slot="status-badge"]', status).length === 3 ? true : null), 8000);
    note.badges = $$('[data-slot="status-badge"]', status).map((badge) => badge.textContent.trim());
    if (note.badges.length !== 3) fail(`${note.badges.length} badges, wanted 3`);
    press(control);
    const live = () =>
      $$('[data-slot="status-multi-picker-option"]').filter(
        (row) => !row.closest('[data-closed]') && row.getClientRects().length > 0,
      );
    const options = await until(() => (live().length > 0 ? live() : null), 8000);
    note.offered = options?.length ?? 0;
    if (note.offered <= 3) fail(`the picker offers ${note.offered} statuses, not the site's table`);
    const free = options?.find((row) => !row.dataset.selectedStatus);
    if (free) {
      const code = free.dataset.statusCode;
      free.click();
      if (!(await until(() => (emitted(status).includes(code) ? true : null), 1500))) {
        free.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
        free.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
      }
      await until(() => (emitted(status).includes(code) ? true : null), 1500);
      note.picked = emitted(status);
      if (!(note.picked.length === 4 && note.picked[3] === code)) fail(`a pick emitted ${JSON.stringify(note.picked)}`);
    }
    document.activeElement?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await wait(200);
  }

  const codes = $('[data-demo="codes"]', pane);
  note.typedCodes = inputsOf(codes).map((input) => input.value);
  if (!same(note.typedCodes, ['wtg', 'ip', 'fin'])) fail(`a status list with no site reads ${JSON.stringify(note.typedCodes)}`);

  /* ---------------------------------------------------------------- states */

  const readonly = $('[data-demo="readonly"]', pane);
  note.readonly = {
    rows: rowsOf(readonly).map((row) => row.textContent.trim()),
    controls: $$('input, button', readonly).length,
  };
  if (!same(note.readonly.rows, ['Type A', 'Type B', 'Type C'])) fail(`readonly reads ${JSON.stringify(note.readonly.rows)}`);
  if (note.readonly.controls > 0) fail('a readonly editor keeps a control');

  const invalid = $('[data-demo="invalid"] [data-slot="valid-values-editor-box"]', pane);
  if (invalid?.dataset.invalid !== 'true') fail('an invalid editor does not say so');

  const disabled = $('[data-demo="disabled"]', pane);
  if ($$('input, button', disabled).length > 0) fail('a disabled editor keeps a control');
  if ($('[data-slot="valid-values-editor-box"]', disabled)?.getAttribute('aria-disabled') !== 'true') {
    fail('a disabled editor does not say so');
  }

  seen[framework] = note;
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS the editor adds, edits, moves and removes the values of a list, splits a paste by line, and picks a status list from the site'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
