// Pick a column through the field picker, drag it above the first row with synthetic
// pointer events, move a row with Alt and an arrow key, then remove the one that was
// added, reading the live region and the count line along the way.
//
//   pnpm qa --start --path /widgets/column-picker/ --drive tools/drive/column-picker-drag.js
const ADDED = 'sg_department';
const START = ['code', 'sg_status_list', 'entity.Shot.sg_turnover_date'];

async function until(find, label) {
  for (let i = 0; i < 100; i++) {
    const found = find();
    if (found) return found;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function centre(el) {
  const box = el.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

function pointer(type, target, at) {
  target.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      composed: true,
      view: window,
      pointerId: 1,
      pointerType: 'mouse',
      isPrimary: true,
      button: 0,
      buttons: type === 'pointerup' ? 0 : 1,
      clientX: at.x,
      clientY: at.y,
    }),
  );
}

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, view: window, button: 0 }));
  }
}

function setValue(el, text) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(target, name, alt = false) {
  target.dispatchEvent(
    new KeyboardEvent('keydown', { key: name, altKey: alt, bubbles: true, cancelable: true }),
  );
}

// A popover is portalled to the body, so only one may be open while the other
// framework's pane is driven.
async function closePopovers() {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  await until(() => $$('[data-slot="popover-content"]').length === 0 || null, 'the popover to close');
}

function items() {
  return $$('[data-picker="field"] [data-slot="command-item"]');
}

async function run(framework) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) throw new Error(`no ${framework} pane`);
  await closePopovers();
  const demo = $('[data-demo="columns"]', pane);
  const rows = () => $$('[data-slot="column-picker-column"]', demo);
  const order = () => rows().map((row) => row.dataset.path);
  const said = () => $('[data-slot="column-picker-live-region"]', demo).textContent.trim();
  // The live region is rendered from the binding's state, so it lands a frame later.
  const heard = (start) => until(() => (said().startsWith(start) ? said() : null), `"${start}…"`);
  await until(() => $('[data-slot="column-picker-list"]', demo), 'the chosen list');
  const before = order();

  // The picker: search the field, take the only row, and read where focus landed.
  press($('[data-slot="field-picker-trigger"]', demo));
  const search = await until(() => $('[data-picker="field"] [data-slot="command-input"]'), 'the field picker');
  setValue(search, 'Department');
  const row = await until(() => (items().length === 1 ? items()[0] : null), 'the Department row');
  await wait(120);
  const scrolled = window.scrollY;
  press(row);
  await until(() => (order().length === before.length + 1 ? true : null), 'the appended column');
  const appended = order();
  const focused = await until(
    () => document.activeElement?.getAttribute('data-slot') ?? null,
    'focus to land',
  );
  const scroll = window.scrollY - scrolled;

  // Pointer: the row just added over the first one, six pixels to arm and then past its midpoint.
  const grip = $('[data-slot="column-picker-grip"]', rows().at(-1));
  const from = centre(grip);
  const top = centre(rows()[0]).y - 8;
  pointer('pointerdown', grip, from);
  pointer('pointermove', window, { x: from.x, y: from.y - 6 });
  const armed = await heard('Picked up ');
  pointer('pointermove', window, { x: from.x, y: top });
  const lifted = rows().at(-1).getAttribute('data-dragging');
  pointer('pointerup', window, { x: from.x, y: top });
  await until(() => (order()[0] === ADDED ? true : null), 'the dragged order');
  const dragged = order();
  const draggedSaid = await heard('Moved ');

  // Keyboard: the first row one place later.
  const handle = $('[data-slot="column-picker-grip"]', rows()[0]);
  handle.focus();
  key(handle, 'ArrowDown', true);
  await until(() => (order().join() !== dragged.join() ? true : null), 'the keyboard move');
  const moved = order();

  // Remove the one that was added, leaving the demo as it was found.
  const carrier = rows().find((r) => r.dataset.path === ADDED);
  press($('[data-slot="column-picker-remove"]', carrier));
  await until(() => (order().includes(ADDED) ? null : true), 'the removal');
  const after = order();
  const count = $('[data-slot="column-picker-count"]', demo).textContent.trim();
  await closePopovers();

  return { framework, before, appended, focused, scroll, armed, lifted, dragged, draggedSaid, moved, after, count };
}

const svelte = await run('svelte');
const react = await run('react');

function faults(r) {
  const out = [];
  if (r.before.join() !== START.join()) out.push(`${r.framework} started ${r.before.join()}`);
  if (r.appended.join() !== [...START, ADDED].join())
    out.push(`${r.framework} appended to ${r.appended.join()}`);
  if (r.focused !== 'field-picker-trigger') out.push(`${r.framework} left focus on ${r.focused}`);
  if (r.scroll !== 0) out.push(`${r.framework} scrolled ${r.scroll}px`);
  if (!r.armed.startsWith('Picked up ')) out.push(`${r.framework} armed said "${r.armed}"`);
  if (r.lifted !== 'true') out.push(`${r.framework} row was not marked dragging`);
  if (r.dragged.join() !== [ADDED, ...START].join())
    out.push(`${r.framework} dragged to ${r.dragged.join()}`);
  if (!r.draggedSaid.startsWith('Moved ') || !r.draggedSaid.endsWith(' to position 1 of 4'))
    out.push(`${r.framework} drop said "${r.draggedSaid}"`);
  if (r.moved.join() !== [START[0], ADDED, START[1], START[2]].join())
    out.push(`${r.framework} keyboard moved to ${r.moved.join()}`);
  if (r.after.join() !== START.join()) out.push(`${r.framework} ended ${r.after.join()}`);
  if (r.count !== '3 columns') out.push(`${r.framework} counted "${r.count}"`);
  return out;
}

const wrong = [...faults(svelte), ...faults(react)];
const verdict =
  wrong.length === 0
    ? `PASS ${svelte.appended.join()} then ${svelte.dragged.join()} then ${svelte.after.join()} in both`
    : `FAIL ${wrong.join('; ')}`;
return { verdict, svelte, react };
