// A date field's operator menu is the longest one the editor offers; it has to fit the
// viewport and scroll inside it.
//
//   pnpm qa --start --path /widgets/filter-editor/ --framework both --viewport 1200x800 \
//     --drive tools/drives/filter-operator-menu-fit.js
//
// The row is scrolled low on the page before the menu opens, where the menu has the least room.
// A pane passes when the popup's rect lies inside the viewport, the list scrolls, and the last
// operator is reached by scrolling rather than by the popup growing past an edge.
const TOLERANCE = 1;
// `created_at` is a date_time in the demo tree: the comparisons, the calendar presets and the
// relative windows, which is every run the operator menu can draw.
const DATE_ROW = '4.4';

function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

async function until(read, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(50);
  }
}

async function closeMenus() {
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await until(() => $$('[data-slot="select-content"]').length === 0 || null, 3000);
  await wait(150);
}

function box(el) {
  const r = el.getBoundingClientRect();
  const round = (n) => Math.round(n * 10) / 10;
  return { top: round(r.top), bottom: round(r.bottom), height: round(r.height) };
}

/** What scrolls inside the popup: the popup itself, or the list it wraps. */
function scrollerOf(popup) {
  const nodes = [popup, ...$$('*', popup)];
  return nodes.find((n) => n.scrollHeight - n.clientHeight > 4) ?? popup;
}

const panes = () => $$('[data-sg-demo] [data-pane]').filter((p) => p.offsetParent !== null);

await until(() => (panes().length > 0 && $$('[data-slot="filter-row"]').length > 0 ? true : null), 20000);
await wait(600);

const report = [];
const failures = [];

for (const pane of panes()) {
  const framework = pane.getAttribute('data-pane');
  await closeMenus();

  const row = $(`[data-slot="filter-row"][data-path="${DATE_ROW}"]`, pane);
  if (!row) {
    failures.push(`${framework}: no row at ${DATE_ROW}`);
    continue;
  }
  const field = $('[data-slot="field-picker-label"]', row)?.textContent.trim() ?? '';
  const trigger = $('[data-slot="filter-operator"]', row);

  // Put the trigger low in the viewport: an unbounded popup runs off the edge from here.
  window.scrollBy(0, trigger.getBoundingClientRect().top - (window.innerHeight - 120));
  await wait(400);
  const triggerBox = box(trigger);

  press(trigger);
  const popup = await until(() => $('[data-slot="select-content"]'));
  if (!popup) {
    failures.push(`${framework}: the operator trigger did not open a menu`);
    continue;
  }
  await until(() => ($$('[data-slot="select-item"]', popup).length > 6 ? true : null));
  await wait(400);

  const items = $$('[data-slot="select-item"]', popup);
  const scroller = scrollerOf(popup);
  const scrolls = scroller.scrollHeight - scroller.clientHeight > 4;
  const opened = box(popup);
  const viewport = { width: window.innerWidth, height: window.innerHeight };

  // The last operator is reached by scrolling the list, not by the popup growing past the edge.
  scroller.scrollTop = scroller.scrollHeight;
  await wait(400);
  const scrolled = box(popup);
  const last = items[items.length - 1];
  const lastBox = box(last);
  const lastVisible = lastBox.top >= scrolled.top - TOLERANCE && lastBox.bottom <= scrolled.bottom + TOLERANCE;

  const seen = {
    framework,
    field,
    operators: items.length,
    lastOperator: last.textContent.trim(),
    viewport,
    trigger: triggerBox,
    popup: opened,
    popupScrolled: scrolled,
    listHeight: scroller.scrollHeight,
    overflowBelow: Math.round(Math.max(0, opened.bottom - viewport.height) * 10) / 10,
    overflowAbove: Math.round(Math.max(0, -opened.top) * 10) / 10,
    scrolls,
    lastVisible,
  };
  report.push(seen);

  if (!/date/i.test(field)) failures.push(`${framework}: row ${DATE_ROW} reads "${field}", wanted a date field`);
  if (items.length <= 6) failures.push(`${framework}: the menu drew ${items.length} operators, wanted the long list`);
  for (const [when, rect] of [['on opening', opened], ['once scrolled', scrolled]]) {
    if (rect.top < -TOLERANCE) failures.push(`${framework}: the popup runs ${-rect.top}px past the top ${when}`);
    if (rect.bottom > viewport.height + TOLERANCE) {
      failures.push(`${framework}: the popup runs ${Math.round(rect.bottom - viewport.height)}px past the bottom ${when}`);
    }
  }
  if (!scrolls) failures.push(`${framework}: the operator list does not scroll inside the popup`);
  if (!lastVisible) failures.push(`${framework}: "${last.textContent.trim()}" is not reachable by scrolling`);
}

if (report.length === 0) failures.push('no framework pane was on show');

const said = report
  .map((r) => `${r.framework} popup ${r.popup.top}..${r.popup.bottom} of ${r.viewport.height}, ${r.operators} operators, scrolls=${r.scrolls}`)
  .join('; ');

return {
  verdict: failures.length === 0 ? `PASS ${said}` : `FAIL ${failures.join('; ')}`,
  panes: report,
};
