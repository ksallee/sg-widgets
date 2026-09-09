// Drag the first chosen column past the second with synthetic pointer events, then
// move the last one up from the keyboard, reading the live region after each.
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

function key(target, name) {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
}

async function run(framework) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) throw new Error(`no ${framework} pane`);
  const demo = $('[data-demo="columns"]', pane);
  const list = await until(() => $('[data-slot="column-picker-list"]', demo), 'the chosen list');
  const rows = () => $$('[data-slot="column-picker-column"]', list);
  const order = () => rows().map((row) => row.dataset.path);
  const said = () => $('[data-slot="column-picker-live-region"]', demo).textContent.trim();
  // The live region is rendered from the binding's state, so it lands a frame later.
  const heard = (start) => until(() => (said().startsWith(start) ? said() : null), `"${start}…"`);
  const before = order();

  // Pointer: the first row over the second, four pixels to arm and then past the midpoint.
  const grip = $('[data-slot="column-picker-grip"]', rows()[0]);
  const from = centre(grip);
  pointer('pointerdown', grip, from);
  pointer('pointermove', window, { x: from.x, y: from.y + 5 });
  const armed = await heard('Picked up ');
  pointer('pointermove', window, { x: from.x, y: from.y + 60 });
  const lifted = rows()[0].getAttribute('data-dragging');
  pointer('pointerup', window, { x: from.x, y: from.y + 60 });
  await until(() => order().join() !== before.join() || null, 'the dragged order');
  const dragged = order();
  const draggedSaid = await heard('Moved ');

  // Keyboard: the last row one place up.
  const last = rows().at(-1);
  const handle = $('[data-slot="column-picker-grip"]', last);
  handle.focus();
  key(handle, ' ');
  const pickedUp = await heard('Picked up ');
  key(handle, 'ArrowUp');
  await until(() => order().join() !== dragged.join() || null, 'the keyboard move');
  const moved = order();
  const movedSaid = await heard('Moved ');
  key(handle, ' ');
  const dropped = await heard('Dropped ');

  return { framework, before, armed, lifted, dragged, draggedSaid, pickedUp, moved, movedSaid, dropped };
}

const svelte = await run('svelte');
const react = await run('react');

function faults(r) {
  const out = [];
  const start = ['code', 'sg_status_list', 'entity.Shot.sg_turnover_date'];
  if (r.before.join() !== start.join()) out.push(`${r.framework} started ${r.before.join()}`);
  if (!r.armed.startsWith('Picked up ')) out.push(`${r.framework} armed said "${r.armed}"`);
  if (r.lifted !== 'true') out.push(`${r.framework} row was not marked dragging`);
  if (r.dragged.join() !== ['sg_status_list', 'code', 'entity.Shot.sg_turnover_date'].join())
    out.push(`${r.framework} dragged to ${r.dragged.join()}`);
  if (!r.draggedSaid.startsWith('Moved ') || !r.draggedSaid.endsWith(' to position 2 of 3'))
    out.push(`${r.framework} drop said "${r.draggedSaid}"`);
  if (!r.pickedUp.endsWith('position 3 of 3')) out.push(`${r.framework} pickup said "${r.pickedUp}"`);
  if (r.moved.join() !== ['sg_status_list', 'entity.Shot.sg_turnover_date', 'code'].join())
    out.push(`${r.framework} keyboard moved to ${r.moved.join()}`);
  if (!r.movedSaid.endsWith(' to position 2 of 3')) out.push(`${r.framework} move said "${r.movedSaid}"`);
  if (!r.dropped.startsWith('Dropped ')) out.push(`${r.framework} drop said "${r.dropped}"`);
  return out;
}

const wrong = [...faults(svelte), ...faults(react)];
const verdict = wrong.length === 0 ? `PASS ${svelte.dragged.join()} then ${svelte.moved.join()} in both` : `FAIL ${wrong.join('; ')}`;
return { verdict, svelte, react };
