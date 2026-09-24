// The column picker on the entity-table page: the Columns button opens it over the table's own
// columns; adding a field the source does not read draws it with values, removing and reordering
// move the headers, the choice is kept in localStorage and a fresh copy of the page opens on it,
// and Reset columns puts the defaults back and forgets the choice.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework both --drive tools/drives/entity-table-columns.js

const KEY = 'sg-widgets:columns:Version';
const ADDED = 'frame_count';
const failures = [];
const seen = {};

async function until(read, tries = 80) {
  for (let i = 0; i < tries; i += 1) {
    const value = read();
    if (value) return value;
    await wait(100);
  }
  return read();
}

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    const Ctor = type.startsWith('pointer') ? PointerEvent : MouseEvent;
    el.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
}

function setValue(el, text) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function closePopovers() {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => document.querySelectorAll('[data-picker="columns"]').length === 0, 20);
}

const headsOf = (root) =>
  [...root.querySelectorAll('[data-slot="entity-table"] thead th[data-column]')]
    .map((th) => th.dataset.column)
    .filter((id) => id !== '__select');

async function drive(pane, framework) {
  const fail = (what) => failures.push(`${framework}: ${what}`);
  const heads = () => headsOf(pane);
  const stored = () => localStorage.getItem(KEY);
  localStorage.removeItem(KEY);
  if (!(await until(() => heads().length > 2))) return fail('the table drew no headers');
  const defaults = heads();

  const trigger = pane.querySelector('[data-slot="entity-table-columns"]');
  if (!trigger) return fail('no Columns button in the toolbar');
  const popup = async () => {
    await closePopovers();
    trigger.click();
    let found = await until(() => document.querySelector('[data-picker="columns"]'), 15);
    if (!found) {
      press(trigger);
      found = await until(() => document.querySelector('[data-picker="columns"]'), 15);
    }
    return found;
  };
  let box = await popup();
  if (!box) return fail('the Columns button opened nothing');
  const listed = () => [...box.querySelectorAll('[data-slot="column-picker-column"]')].map((row) => row.dataset.path);
  if (listed().join() !== defaults.join()) fail(`the picker lists ${listed().join()}, the table shows ${defaults.join()}`);

  // Add a field the source does not read yet: it lands last, with values.
  press(box.querySelector('[data-slot="field-picker-trigger"]'));
  const search = await until(() => document.querySelector('[data-picker="field"] [data-slot="command-input"]'));
  if (!search) return fail('the field picker did not open');
  setValue(search, 'Frame Count');
  // The list answers the search after a pause; the row is pressed once the list is the answer.
  const items = () => [...document.querySelectorAll('[data-picker="field"] [data-slot="command-item"]')];
  const answered = await until(() => items().length > 0 && items().every((item) => item.textContent.includes('Frame')));
  if (!answered) return fail(`the field picker answered ${items().length} rows for Frame Count`);
  await wait(150);
  const option = items().find((item) => item.textContent.includes('Frame Count'));
  if (!option) return fail('the field picker offered no Frame Count');
  press(option);
  if (!(await until(() => heads().at(-1) === ADDED))) fail(`adding ${ADDED} left the headers ${heads().join()}`);
  const valued = await until(() =>
    [...pane.querySelectorAll(`td[data-column="${ADDED}"]`)].some((td) => /\d/.test(td.textContent)),
  );
  if (!valued) fail(`the ${ADDED} cells drew no value`);

  // Remove one and move the first one down.
  box = document.querySelector('[data-picker="columns"]') ?? (await popup());
  const row = (path) => [...box.querySelectorAll('[data-slot="column-picker-column"]')].find((r) => r.dataset.path === path);
  press(row('description').querySelector('[data-slot="column-picker-remove"]'));
  if (!(await until(() => !heads().includes('description')))) fail('removing description left it on the table');
  const grip = row(defaults[0]).querySelector('[data-slot="column-picker-grip"]');
  grip.focus();
  grip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true, cancelable: true }));
  if (!(await until(() => heads()[1] === defaults[0]))) fail(`Alt+ArrowDown left the headers ${heads().join()}`);
  const chosen = heads();
  const kept = await until(() => (stored() === JSON.stringify(chosen) ? stored() : null), 20);
  if (!kept) fail(`localStorage holds ${stored()}, the table shows ${JSON.stringify(chosen)}`);
  await closePopovers();

  // A fresh copy of the page opens on the kept choice.
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:900px;opacity:0;pointer-events:none';
  frame.src = location.href;
  document.body.append(frame);
  const reopened = await until(() => {
    const doc = frame.contentDocument;
    const other = doc && [...doc.querySelectorAll('[data-sg-demo] [data-pane]')].find((p) => p.dataset.pane === framework);
    const shown = other ? headsOf(other) : [];
    return shown.join() === chosen.join() ? shown : null;
  }, 200);
  const reopenedAs = reopened ?? headsOf(frame.contentDocument?.querySelector(`[data-sg-demo] [data-pane="${framework}"]`) ?? document.createElement('div'));
  frame.remove();
  if (!reopened) fail(`a fresh page opened on ${reopenedAs.join()}, expected ${chosen.join()}`);

  // Reset puts the defaults back and forgets the choice.
  box = await popup();
  const reset = box?.querySelector('[data-slot="entity-table-columns-reset"]');
  if (!reset) fail('no Reset columns after a change');
  else {
    press(reset);
    if (!(await until(() => heads().join() === defaults.join()))) fail(`Reset left ${heads().join()}`);
    if (stored() !== null) fail(`Reset left ${stored()} in localStorage`);
  }
  await closePopovers();
  seen[framework] = { defaults, chosen, reopened: reopened !== null };
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-sg-demo] [data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  await drive(pane, framework);
}
localStorage.removeItem(KEY);

if (Object.keys(seen).length === 0 && failures.length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS the Columns button adds a field with values, removes, reorders, keeps the choice, a fresh page opens on it, and Reset puts the defaults back'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
