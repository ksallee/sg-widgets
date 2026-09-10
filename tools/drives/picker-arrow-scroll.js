// Down and Up keep the highlighted row inside the list's scroll box, all the way to
// the load more row and back, and across the page it loads.
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both --drive tools/drives/picker-arrow-scroll.js

const failures = [];
const seen = {};

/** A press, the way a mouse makes one: the field opens on pointerdown. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true, cancelable: true }));
}

async function until(read, timeoutMs = 6000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(50);
  }
}

const list = () => $('[data-picker="entity-multi"] [data-slot="entity-picker-list"]');
const highlighted = () => $('[data-picker="entity-multi"] [data-highlighted]');
const rows = () => $$('[data-picker="entity-multi"] [data-slot="entity-picker-option"]');

/** Whether the highlighted row sits inside the scroller's own box, top and bottom. */
function inView() {
  const scroller = list();
  const row = highlighted();
  if (!scroller || !row) return null;
  const box = scroller.getBoundingClientRect();
  const seat = row.getBoundingClientRect();
  return seat.top >= box.top - 1 && seat.bottom <= box.bottom + 1;
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  // Five a page, so the list carries a load more row and a second page to cross.
  const box = $('[data-demo-case="more"]', pane);
  if (!box) {
    failures.push(`${framework}: no paged demo`);
    continue;
  }
  box.scrollIntoView({ block: 'center' });
  await wait(200);

  const control = $('[data-slot="entity-picker-control"]', box);
  if (!control) {
    failures.push(`${framework}: the paged demo has no control`);
    continue;
  }
  press(control);
  if (!(await until(() => rows().length > 0))) {
    failures.push(`${framework}: a press on the field did not open the list`);
    continue;
  }
  const input = $('[data-picker="entity-multi"] [data-slot="entity-picker-input"]');
  if (!input) {
    failures.push(`${framework}: the popup has no search box`);
    continue;
  }
  input.focus({ preventScroll: true });
  await wait(150);

  const scroller = list();
  const firstPage = rows().length;

  // Down to the bottom of the first page and onto the load more row.
  let outOfView = 0;
  let steps = 0;
  for (let i = 0; i < firstPage + 2; i++) {
    key(input, 'ArrowDown');
    await wait(120);
    const ok = inView();
    if (ok === false) outOfView += 1;
    if (ok !== null) steps += 1;
  }
  const onLoadMore = Boolean($('[data-picker="entity-multi"] [data-slot="entity-picker-more"][data-highlighted]'));

  // Load the next page, then keep going down through the rows it appended.
  key(input, 'Enter');
  const grew = await until(() => (rows().length > firstPage ? rows().length : null), 4000);
  await wait(200);
  const afterPageInView = inView();
  let outOfViewAfterPage = 0;
  for (let i = 0; i < 5; i++) {
    key(input, 'ArrowDown');
    await wait(120);
    if (inView() === false) outOfViewAfterPage += 1;
  }
  const scrolled = scroller ? scroller.scrollTop : 0;

  // And back up to the top.
  let outOfViewUp = 0;
  for (let i = 0; i < (grew ?? firstPage) + 4; i++) {
    key(input, 'ArrowUp');
    await wait(80);
    if (inView() === false) outOfViewUp += 1;
  }
  const backAtTop = scroller ? scroller.scrollTop : 0;

  seen[framework] = {
    firstPage,
    steps,
    outOfView,
    onLoadMore,
    afterPage: grew ?? firstPage,
    afterPageInView,
    outOfViewAfterPage,
    scrolled: Math.round(scrolled),
    backAtTop: Math.round(backAtTop),
    outOfViewUp,
  };

  if (steps === 0) failures.push(`${framework}: no row was ever highlighted`);
  if (outOfView > 0) failures.push(`${framework}: the highlight left the list on ${outOfView} of ${steps} presses down`);
  if (!grew) failures.push(`${framework}: Enter on the load more row loaded no page`);
  if (afterPageInView === false) failures.push(`${framework}: the highlight sat outside the list after a load more page`);
  if (outOfViewAfterPage > 0) {
    failures.push(`${framework}: the highlight left the list on ${outOfViewAfterPage} presses inside the new page`);
  }
  if (scrolled <= 0) failures.push(`${framework}: the list never scrolled at all`);
  if (outOfViewUp > 0) failures.push(`${framework}: the highlight left the list on ${outOfViewUp} presses up`);
  if (backAtTop !== 0) failures.push(`${framework}: the list stopped at ${Math.round(backAtTop)}px rather than the top`);

  key(input, 'Escape');
  await until(() => !$('[data-picker="entity-multi"]'), 2000);
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS the arrows keep the highlighted row inside the list, through a load more page and back to the top'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
