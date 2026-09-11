// The picker contract of design rule 7, on every picker of the page it runs on, in both panes.
//
// Every control is found by the `data-slot` its picker carries:
//
//   [data-slot$="-control"]            every picker on the base: entity, entity multi, user,
//                                      user multi, project, project multi, status, status multi,
//                                      entity type, entity type multi, list, list multi, and the
//                                      department demos of the picker-control page
//   [data-slot="field-picker-trigger"] the field picker, on the Popover and the Command list
//   [data-slot="sort-trigger"]         the sort picker, on the Popover over an ordered panel
//
// The column picker holds no popup: its list layout is a field picker, found above, and its
// dual layout is two inline panes, which the state clauses cover.
//
// One line per picker page:
//
//   pnpm qa --start --path /widgets/entity-picker/            --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/entity-multi-picker/      --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/user-picker/              --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/user-multi-picker/        --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/project-picker/           --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/project-multi-picker/     --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/status-picker/            --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/status-multi-picker/      --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/entity-type-picker/       --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/entity-type-multi-picker/ --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/list-picker/              --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/list-multi-picker/        --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/field-picker/             --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/sort-picker/              --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/column-picker/            --framework both --drive tools/drives/picker-contract.js
//   pnpm qa --start --path /widgets/picker-control/           --framework both --drive tools/drives/picker-contract.js
//
// The clauses, numbered as design rule 7. Each runs on the controls whose shape it fits: the
// press and keyboard clauses once per shape a page draws, the state clauses on every control.
//
//   1 press-toggles      a press on the control opens the list, and a second closes it
//   1 typing-opens       typing opens the list again (a control that holds a caret)
//   2 caret-lands        the caret takes focus: the control's own inline, the popup's on a summary
//   3 escape-closes      Escape closes the list and leaves the query empty
//   3 escape-closed      Escape on a closed picker opens nothing and keeps the value
//   4 backspace          an empty query: the first arms the last chip and the second removes it
//                        on a multi picker, and it clears the value on a single one. An armed
//                        chip is read from the `data-armed` every picker's chip carries. A
//                        picker the caller keeps empty has nothing to press against, and the
//                        run says so rather than failing.
//   5 arrows-follow      the highlighted row stays inside the list's scroll box
//   6 pick-open          a pick keeps a multi picker open and closes a single one
//   7 outside-press      a press outside the control and the popup closes the list
//   8 clear-control      the clear control is drawn only on a filled, editable control, and
//                        a press on it empties the value
//   9 readonly           a readonly control keeps full contrast, drops the clear control and
//                        the chevron, and opens for nobody
//   10 disabled          a disabled control opens for nobody
//
// A control that is neither readonly nor disabled takes the press and keyboard clauses once per
// shape the page draws: a second demo of a shape already walked is read for its states alone.
//
// What a synthetic press and key cannot answer is left to the manual pass: whether a real mouse
// press lands where the hit test says it does, hover and focus rings, caret placement inside the
// text, and the platform's own dismissal gestures.

const failures = [];
const seen = {};
const page = location.pathname;

/** A press, the way a mouse makes one: the control toggles on pointerdown. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

function typeInto(input, text) {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true, cancelable: true }));
}

async function until(read, timeoutMs = 4000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(50);
  }
}

/** A closed popup lingers in the DOM carrying `data-closed`, so only a drawn one counts. */
function drawn(el) {
  return Boolean(el) && !el.closest('[data-closed]') && el.getClientRects().length > 0;
}

const shown = (selector, root = document) => $$(selector, root).filter(drawn);

/* ------------------------------------------------------------------ the shapes */

/** What every clause needs to reach one picker: its parts, and the shape that picks its clauses. */
function describe(el) {
  const slot = el.dataset.slot;
  if (slot === 'field-picker-trigger') {
    return {
      el,
      slot: 'field-picker',
      inline: false,
      multiple: false,
      list: true,
      popup: '[data-picker="field"]',
      row: '[data-slot="command-item"]',
      caret: 'input[data-slot="command-input"]',
      clear: '[data-slot="field-picker-clear"]',
      chevron: null,
      scroller: '[data-slot="command-list"]',
    };
  }
  if (slot === 'sort-trigger') {
    // A panel rather than a list: the keys it holds are ordered, not searched.
    return {
      el,
      slot: 'sort-picker',
      inline: false,
      multiple: true,
      list: false,
      popup: '[data-picker="sort"]',
      row: null,
      caret: null,
      clear: null,
      chevron: null,
      scroller: null,
    };
  }
  const name = slot.replace(/-control$/, '');
  return {
    el,
    slot: name,
    inline: Boolean($(`input[data-slot="${name}-input"]`, el)),
    multiple: el.getAttribute('data-multiple') === 'true',
    list: true,
    popup: `[data-slot="${name}-content"]`,
    row: `[data-slot="${name}-option"]`,
    caret: `input[data-slot="${name}-input"]`,
    clear: `[data-slot="${name}-clear"]`,
    chevron: `[data-slot="${name}-trigger"]`,
    scroller: `[data-slot="${name}-list"]`,
  };
}

/** The demo a control sits in, so a failure names something a reader can find. */
function where(el) {
  const box = el.closest('[data-demo], [data-demo-case]');
  return box ? (box.dataset.demo ?? box.dataset.demoCase) : 'page';
}

const readonlyOf = (el) => el.hasAttribute('data-readonly');
const disabledOf = (el) =>
  el.getAttribute('aria-disabled') === 'true' || el.disabled === true || Boolean(el.closest('[aria-disabled="true"]'));
/** Every picker marks an empty control the same way. */
const filled = (el) => !el.hasAttribute('data-empty');
/** What the control reads, so a clause can say whether a key changed it. */
const valueOf = (el) => `${filled(el) ? 1 : 0}|${$$('[data-chip]', el).length}|${el.textContent.trim()}`;

/* ------------------------------------------------------------------ the picker */

/** The widget's own box: the control, the trailing controls and whatever else it draws. */
const boxOf = (shape) => shape.el.closest(`[data-slot="${shape.slot}"]`) ?? shape.el.parentElement ?? document;

const popupOf = (shape) => shown(shape.popup)[0] ?? null;
const rowsOf = (shape) => {
  const popup = popupOf(shape);
  if (!popup || !shape.row) return [];
  return shown(shape.row, popup).filter((row) => !row.matches(`[data-slot="${shape.slot}-more"]`));
};
const caretOf = (shape) => {
  if (!shape.caret) return null;
  const root = shape.inline ? shape.el : popupOf(shape);
  return root ? $(shape.caret, root) : null;
};
/** The keyboard cursor: `data-highlighted` on both comboboxes, `aria-selected` on a Command list. */
const highlightedOf = (shape) => {
  const popup = popupOf(shape);
  if (!popup) return null;
  return $('[data-highlighted]', popup) ?? $('[data-slot="command-item"][aria-selected="true"]', popup);
};

async function open(shape) {
  if (popupOf(shape)) return true;
  press(shape.el);
  return Boolean(await until(() => popupOf(shape)));
}

async function close(shape) {
  if (!popupOf(shape)) return true;
  const caret = caretOf(shape);
  key(caret ?? shape.el, 'Escape');
  if (await until(() => !popupOf(shape), 1500)) return true;
  press(document.body);
  return Boolean(await until(() => !popupOf(shape), 1500));
}

/** Nothing of the last picker left open over the next one. */
async function settle() {
  press(document.body);
  await until(() => shown('[data-picker]').length === 0, 1500);
  await wait(100);
}

/* ------------------------------------------------------------------ the clauses */

async function pressToggles(shape, note) {
  press(shape.el);
  const opened = Boolean(await until(() => popupOf(shape)));
  if (!opened) {
    note('press-toggles', 'a press on the control opened no list');
    return false;
  }
  // The caret lands on open: the control's own inline, the popup's search box on a summary.
  if (shape.caret) {
    const landed = await until(() => {
      const active = document.activeElement;
      return active && active.matches(shape.caret) ? active : null;
    }, 1500);
    if (!landed) note('caret-lands', `the caret did not take focus (${document.activeElement?.dataset?.slot ?? document.activeElement?.tagName})`);
    else if (shape.inline && !shape.el.contains(landed)) note('caret-lands', 'the inline caret is outside the control');
    else if (!shape.inline && !popupOf(shape)?.contains(landed)) note('caret-lands', 'the summary caret is outside the popup');
  }
  press(shape.el);
  if (!(await until(() => !popupOf(shape), 2000))) {
    note('press-toggles', 'a second press did not close the list');
    await close(shape);
    return false;
  }
  return true;
}

async function typingOpens(shape, note) {
  const caret = caretOf(shape);
  if (!caret) return;
  caret.focus({ preventScroll: true });
  typeInto(caret, 'a');
  const opened = Boolean(await until(() => popupOf(shape), 2500));
  if (!opened) note('typing-opens', 'typing opened no list');
  typeInto(caret, '');
  await close(shape);
}

async function escapeCloses(shape, note) {
  if (!(await open(shape))) {
    note('escape-closes', 'the list would not open');
    return;
  }
  const caret = caretOf(shape);
  if (caret && !caret.readOnly) {
    caret.focus({ preventScroll: true });
    typeInto(caret, 'a');
    await wait(150);
  }
  key(caret ?? shape.el, 'Escape');
  if (!(await until(() => !popupOf(shape), 2000))) {
    note('escape-closes', 'Escape did not close the list');
    await close(shape);
    return;
  }
  // The query lives in the popup on a summary control, so it is read on the way back in.
  if (!caret || caret.readOnly) return;
  if (!(await open(shape))) {
    note('escape-closes', 'the list would not reopen');
    return;
  }
  const back = caretOf(shape);
  const held = back ? back.value : '';
  if (held !== '') note('escape-closes', `the query still reads "${held}" after Escape`);
  if (back) typeInto(back, '');
  await close(shape);
}

async function escapeClosed(shape, note) {
  await close(shape);
  const before = valueOf(shape.el);
  key(shape.el, 'Escape');
  const caret = shape.inline ? caretOf(shape) : null;
  if (caret) key(caret, 'Escape');
  await wait(250);
  if (popupOf(shape)) {
    note('escape-closed', 'Escape on a closed picker opened the list');
    await close(shape);
  }
  const after = valueOf(shape.el);
  if (after !== before) note('escape-closed', `Escape on a closed picker changed the value (${before} to ${after})`);
}

async function arrowsFollow(shape, note) {
  if (!shape.list) return;
  if (!(await open(shape))) {
    note('arrows-follow', 'the list would not open');
    return;
  }
  const caret = caretOf(shape);
  if (caret) caret.focus({ preventScroll: true });
  const rows = await until(() => (rowsOf(shape).length > 0 ? rowsOf(shape) : null), 8000);
  if (!rows) {
    note('arrows-follow', 'the list drew no row');
    await close(shape);
    return;
  }
  const box = () => {
    const popup = popupOf(shape);
    return popup ? ($(shape.scroller, popup) ?? popup) : null;
  };
  /** Whether the highlighted row sits inside the scroller's own box, top and bottom. */
  const inView = () => {
    const scroller = box();
    const row = highlightedOf(shape);
    if (!scroller || !row) return null;
    const seat = row.getBoundingClientRect();
    const frame = scroller.getBoundingClientRect();
    return seat.top >= frame.top - 1 && seat.bottom <= frame.bottom + 1;
  };
  let out = 0;
  let steps = 0;
  const target = caret ?? popupOf(shape) ?? shape.el;
  for (let i = 0; i < Math.min(rows.length + 1, 14); i++) {
    key(target, 'ArrowDown');
    await wait(90);
    const ok = inView();
    if (ok !== null) steps += 1;
    if (ok === false) out += 1;
  }
  for (let i = 0; i < Math.min(rows.length + 1, 14); i++) {
    key(target, 'ArrowUp');
    await wait(70);
    if (inView() === false) out += 1;
  }
  if (steps === 0) note('arrows-follow', 'no row was ever highlighted');
  else if (out > 0) note('arrows-follow', `the highlight left the list on ${out} presses`);
  await close(shape);
}

/** Bits UI settles a row on pointerup, Base UI on click: the second only if the first missed. */
async function choose(row, landed) {
  row.click();
  if (await until(landed, 1500)) return true;
  row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  row.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
  return Boolean(await until(landed, 1500));
}

/** A row the list does not already hold, so a press adds rather than takes away. */
async function offered(shape) {
  const rows = await until(() => (rowsOf(shape).length > 0 ? rowsOf(shape) : null), 8000);
  if (!rows) return null;
  const free = rows.filter(
    (row) =>
      !row.hasAttribute('data-traversable') &&
      !row.hasAttribute('data-selected') &&
      row.getAttribute('aria-selected') !== 'true' &&
      row.getAttribute('data-checked') !== 'true',
  );
  return (free[0] ?? rows.find((row) => !row.hasAttribute('data-traversable'))) ?? null;
}

async function pickOpen(shape, note) {
  if (!shape.list) return;
  if (!(await open(shape))) {
    note('pick-open', 'the list would not open');
    return;
  }
  const row = await offered(shape);
  if (!row) {
    note('pick-open', 'the list drew no row to take');
    await close(shape);
    return;
  }
  const before = valueOf(shape.el);
  if (shape.multiple) {
    // A tick: the value grows and the popup stays open for the next row.
    const took = await choose(row, () => valueOf(shape.el) !== before);
    if (!took) note('pick-open', 'a press on a row changed nothing in the control');
    else if (!popupOf(shape)) note('pick-open', 'a pick closed a multi picker');
  } else {
    // A commit: the popup closes, whatever the caller then does with the value.
    const closed = await choose(row, () => !popupOf(shape));
    if (!closed) note('pick-open', 'a pick left a single picker open');
  }
  await close(shape);
}

/** Backspace needs something to take, so a picker the page left empty is filled first. */
async function fill(shape) {
  if (filled(shape.el)) return true;
  if (!shape.list) return false;
  if (!(await open(shape))) return false;
  const row = await offered(shape);
  if (row) await choose(row, () => filled(shape.el));
  await close(shape);
  return filled(shape.el);
}

async function backspace(shape, note) {
  if (!shape.caret) return 'no caret';
  // A caller that keeps its picker empty, the column picker's field picker among them,
  // leaves this clause nothing to press against.
  if (!(await fill(shape))) return 'nothing to take';
  if (!(await open(shape))) {
    note('backspace', 'the list would not open');
    return 'would not open';
  }
  const caret = caretOf(shape);
  if (!caret) {
    note('backspace', 'the picker holds no caret to press Backspace in');
    await close(shape);
    return 'no caret';
  }
  caret.focus({ preventScroll: true });
  if (!caret.readOnly) typeInto(caret, '');
  await wait(120);
  const chips = () => $$('[data-chip]', shape.el).length;
  const armed = () => $$('[data-chip][data-armed="true"]', shape.el).length;
  const before = { chips: chips(), value: valueOf(shape.el) };

  key(caret, 'Backspace');
  await wait(300);
  if (shape.multiple) {
    if (armed() !== 1) note('backspace', `the first Backspace armed ${armed()} chips, wanted 1`);
    if (chips() !== before.chips) note('backspace', `the first Backspace already removed a chip (${chips()} of ${before.chips} left)`);
    key(caret, 'Backspace');
    const gone = await until(() => chips() === before.chips - 1, 2000);
    if (!gone) note('backspace', 'the second Backspace removed no chip');
    else if (armed() > 0) note('backspace', 'a chip stayed armed after the removal');
  } else {
    const cleared = await until(() => !filled(shape.el), 2000);
    if (!cleared) note('backspace', `one Backspace left the value as it was (${before.value})`);
  }
  await close(shape);
  return 'ran';
}

async function outsidePress(shape, note) {
  if (!(await open(shape))) {
    note('outside-press', 'the list would not open');
    return;
  }
  press(document.body);
  if (!(await until(() => !popupOf(shape), 2000))) {
    note('outside-press', 'a press outside left the list open');
    await close(shape);
  }
}

async function clearControl(shape, note) {
  if (!shape.clear) return;
  const clear = $(shape.clear, boxOf(shape));
  const holds = filled(shape.el);
  if (!holds) {
    if (clear && drawn(clear)) note('clear-control', 'an empty control draws a clear control');
    return;
  }
  if (!clear || !drawn(clear)) return;
  press(clear);
  if (!(await until(() => !filled(shape.el), 2000))) note('clear-control', 'a press on the clear control left the value');
}

async function readonlyDrops(shape, note) {
  const el = shape.el;
  if (Number(getComputedStyle(el).opacity) < 0.99) note('readonly', 'a readonly control is drawn at less than full contrast');
  const box = boxOf(shape);
  if (shape.clear && shown(shape.clear, box).length > 0) note('readonly', 'a readonly control keeps its clear control');
  if (shape.chevron && shown(shape.chevron, box).length > 0) note('readonly', 'a readonly control keeps its chevron');
  press(el);
  await wait(350);
  if (popupOf(shape)) {
    note('readonly', 'a readonly control opened its list');
    await close(shape);
  }
}

async function disabledInert(shape, note) {
  press(shape.el);
  await wait(350);
  if (popupOf(shape)) {
    note('disabled', 'a disabled control opened its list');
    await close(shape);
  }
}

/* ------------------------------------------------------------------ the walk */

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  // The page settles its reads before a control is pressed, so a list is not empty by timing.
  await until(() => $$('[data-slot$="-control"], [data-slot="field-picker-trigger"], [data-slot="sort-trigger"]', pane).length > 0, 15000);
  await wait(600);

  const controls = $$('[data-slot$="-control"], [data-slot="field-picker-trigger"], [data-slot="sort-trigger"]', pane)
    .filter((el) => el.getClientRects().length > 0)
    .map(describe);
  if (controls.length === 0) {
    failures.push(`${page} ${framework}: no picker control on the page`);
    continue;
  }

  const note = (shape, clause, detail) => {
    failures.push(`${page} ${shape.slot} (${where(shape.el)}) ${framework}: ${clause} — ${detail}`);
  };
  const checked = [];
  const done = new Set();

  for (const shape of controls) {
    const under = (clause, detail) => note(shape, clause, detail);
    await settle();

    if (disabledOf(shape.el)) {
      await disabledInert(shape, under);
      checked.push({ slot: shape.slot, demo: where(shape.el), ran: 'disabled' });
      continue;
    }
    if (readonlyOf(shape.el)) {
      await readonlyDrops(shape, under);
      checked.push({ slot: shape.slot, demo: where(shape.el), ran: 'readonly' });
      continue;
    }

    // An editable control carries the clear-control clause wherever it is drawn; the press
    // and keyboard clauses run once per shape the page draws, which is what a widget owns.
    const shapeKey = `${shape.slot}|${shape.multiple ? 'multi' : 'single'}|${shape.inline ? 'inline' : 'summary'}`;
    if (done.has(shapeKey)) {
      if (!filled(shape.el) && shape.clear) {
        const clear = $(shape.clear, boxOf(shape));
        if (clear && drawn(clear)) under('clear-control', 'an empty control draws a clear control');
      }
      continue;
    }
    done.add(shapeKey);

    if (await pressToggles(shape, under)) {
      await typingOpens(shape, under);
      await escapeCloses(shape, under);
      await arrowsFollow(shape, under);
      await pickOpen(shape, under);
      const took = await backspace(shape, under);
      await outsidePress(shape, under);
      await escapeClosed(shape, under);
      await clearControl(shape, under);
      checked.push({ slot: shape.slot, demo: where(shape.el), shape: shapeKey, backspace: took });
      continue;
    }
    checked.push({ slot: shape.slot, demo: where(shape.el), shape: shapeKey, backspace: 'not reached' });
  }

  await settle();
  seen[framework] = checked;
}

if (Object.keys(seen).length === 0) failures.push(`${page}: no framework pane was on show`);

return {
  verdict:
    failures.length === 0
      ? `PASS every picker on ${page} keeps the contract`
      : `FAIL ${failures.join('; ')}`,
  page,
  failures,
  seen,
};
