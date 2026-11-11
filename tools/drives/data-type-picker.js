// The data type picker offers the set it was given, labels and marks each row, emits the API
// name, and draws a type outside the set, or one it does not know, read-only.
//
//   pnpm qa --start --path /widgets/data-type-picker/ --framework both --drive tools/drives/data-type-picker.js

const failures = [];
const seen = {};

const SET = 13;

async function until(read, ms = 4000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

/** A press, the way a mouse makes one: the control toggles on pointerdown. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

/** A closed popup stays in the DOM carrying `data-closed`, so only live rows count. */
const live = () =>
  $$('[data-slot="data-type-picker-option"]').filter(
    (row) => !row.closest('[data-closed]') && row.getClientRects().length > 0,
  );

/** Bits UI settles a row on pointerup, Base UI on click: the second only if the first missed. */
async function choose(row, landed) {
  row.click();
  if (await until(landed, 1500)) return true;
  row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  row.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
  return Boolean(await until(landed, 1500));
}

const chipOf = (box) => $('[data-slot="data-type-picker-chip"]', box);
const emitted = (box) => $('p', box)?.textContent.trim() ?? '';

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  const note = {};
  const fail = (what) => failures.push(`${framework}: ${what}`);

  /* ------------------------------------------------- the set, and a pick */

  const set = await until(() => $('[data-demo="set"]', pane), 15000);
  if (!set) {
    fail('no demo');
    continue;
  }
  const control = $('[data-slot="data-type-picker-control"]', set);
  control.scrollIntoView({ block: 'center' });
  await wait(100);
  press(control);
  const rows = await until(() => (live().length > 0 ? live() : null));
  if (!rows) {
    fail('one press did not open the list');
    continue;
  }
  note.offered = rows.map((row) => row.dataset.option);
  if (rows.length !== SET) fail(`${rows.length} rows, wanted the ${SET} it was given`);
  if (note.offered[0] !== 'text' || note.offered[SET - 1] !== 'url') fail('the rows are not in the order given');

  const dateTime = rows.find((row) => row.dataset.option === 'date_time');
  note.row = dateTime?.textContent.replace(/\s+/g, ' ').trim();
  if (!dateTime) fail('no date_time row');
  else {
    if (!note.row.includes('Date and time')) fail(`the date_time row reads "${note.row}"`);
    if (!note.row.includes('date_time')) fail('the date_time row does not show its API name');
    if (!$('svg', dateTime)) fail('the date_time row has no glyph');
    await choose(dateTime, () => (chipOf(set)?.dataset.type === 'date_time' ? true : null));
  }
  await wait(300);
  note.picked = { chip: chipOf(set)?.textContent.trim(), emitted: emitted(set), open: live().length };
  if (note.picked.chip !== 'Date and time') fail(`the control reads "${note.picked.chip}" after the pick`);
  if (note.picked.emitted !== '"date_time"') fail(`the pick emitted ${note.picked.emitted}`);
  if (note.picked.open > 0) fail('the list stayed open after the pick');
  if (!$('svg', chipOf(set))) fail('the chip has no glyph');

  /* ------------------------------------------------- the arrow, on the chevron */

  // The chevron is where Tab lands on a closed picker, so the arrow opens the list from it.
  const chevron = $('[data-slot="data-type-picker-trigger"]', set);
  chevron.focus({ preventScroll: true });
  chevron.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }));
  note.arrowOpens = Boolean(await until(() => (live().length > 0 ? true : null), 1500));
  if (!note.arrowOpens) fail('ArrowDown on the chevron opened no list');
  document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  if (!(await until(() => (live().length === 0 ? true : null), 1500))) fail('Escape left the list open');

  /* ------------------------------------------------------ the caller's labels */

  const worded = $('[data-demo="labels"]', pane);
  note.worded = chipOf(worded)?.textContent.trim();
  if (note.worded !== 'File or link') fail(`the caller's label reads "${note.worded}"`);

  /* ------------------------------------------------------------- read-only */

  for (const [demo, type, label] of [
    ['outside', 'calculated', 'Calculated'],
    ['unknown', 'sg_future_type', 'sg_future_type'],
  ]) {
    const box = $(`[data-demo="${demo}"]`, pane);
    const chip = chipOf(box);
    const read = { chip: chip?.textContent.trim(), type: chip?.dataset.type, glyph: Boolean(chip && $('svg', chip)) };
    note[demo] = read;
    if (read.chip !== label) fail(`${demo}: the control reads "${read.chip}", not ${label}`);
    if (read.type !== type) fail(`${demo}: the chip carries ${read.type}`);
    if (!read.glyph) fail(`${demo}: no glyph`);
    press($('[data-slot="data-type-picker-control"]', box));
    await wait(300);
    if (live().length > 0) fail(`${demo}: a read-only picker opened`);
    if ($('[data-slot="data-type-picker-clear"]', box)) fail(`${demo}: a read-only picker offers a clear`);
  }

  /* -------------------------------------------------------------- disabled */

  press($('[data-demo="disabled"] [data-slot="data-type-picker-control"]', pane));
  await wait(300);
  if (live().length > 0) fail('the disabled picker opened');

  seen[framework] = note;
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS the picker offers the set it was given, emits the API name, and draws any type read-only'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
