// The three pieces of list chrome, on the entity multi picker, in both frameworks: the
// indicator column, the live region and the edge fades.
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both --drive tools/drives/list-chrome.js
//
// The indicator column is a fixed width whether or not the row is ticked, so a label
// sits at one x. The live region carries the count a query answered and the line a
// failed read said. The fade on an edge is set only while there is more content past
// it, which is the top once the list has been scrolled and the bottom until it reaches
// the end.

const failures = [];
const seen = {};

/** A press, the way a mouse makes one: the field opens on pointerdown. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

function type(input, text) {
  const proto = Object.getPrototypeOf(input);
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter ? setter.call(input, text) : (input.value = text);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true, cancelable: true }));
  el.dispatchEvent(new KeyboardEvent('keyup', { key: name, bubbles: true, cancelable: true }));
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

const popup = () => $('[data-picker="entity-multi"]');
const list = () => $('[data-picker="entity-multi"] [data-slot="entity-picker-list"]');
const status = () => $('[data-picker="entity-multi"] [data-slot="entity-picker-status"]');
const rows = () => $$('[data-picker="entity-multi"] [data-slot="entity-picker-option"]');
const input = () => $('[data-picker="entity-multi"] [data-slot="entity-picker-input"]');

/** The pixels of content past each edge, as the fade reads them off the list. */
function fade() {
  const el = list();
  if (!el) return null;
  const style = getComputedStyle(el);
  const px = (name) => Math.round(parseFloat(style.getPropertyValue(name)) || 0);
  return {
    start: px('--scroll-area-overflow-y-start'),
    end: px('--scroll-area-overflow-y-end'),
    marked: el.hasAttribute('data-has-overflow-y'),
    scrollable: el.scrollHeight - el.clientHeight,
  };
}

/** Bits UI settles a row on pointerup, Base UI on click: the second only if the first missed. */
async function settle(row, landed) {
  row.click();
  if (await until(landed, 1500)) return true;
  row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  row.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
  return Boolean(await until(landed, 1500));
}

async function openCase(pane, name) {
  const box = $(`[data-demo-case="${name}"]`, pane);
  if (!box) return null;
  box.scrollIntoView({ block: 'center' });
  await wait(200);
  const control = $('[data-slot="entity-picker-control"]', box);
  if (!control) return null;
  press(control);
  if (!(await until(() => popup()))) return null;
  return box;
}

async function close() {
  const el = input();
  if (el) key(el, 'Escape');
  await until(() => !popup(), 2000);
  await wait(150);
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  const read = {};

  /* 1. The indicator column, on a list with a ticked row and an unticked one. */
  if (!(await openCase(pane, 'more'))) {
    failures.push(`${framework}: the paged demo would not open`);
    continue;
  }
  if (!(await until(() => (rows().length > 1 ? rows() : null)))) {
    failures.push(`${framework}: the paged demo listed nothing`);
    await close();
    continue;
  }
  const isTicked = () => rows().find((row) => row.getAttribute('data-checked') === 'true');
  await settle(rows()[0], isTicked);
  const ticked = isTicked();
  if (!ticked) {
    failures.push(`${framework}: a press on a row ticked nothing`);
  } else {
    const plain = rows().find((row) => row.getAttribute('data-checked') !== 'true');
    const labelX = (row) => {
      const label = row.querySelector('[data-slot="picker-row-text"]');
      return label ? Math.round(label.getBoundingClientRect().left - row.getBoundingClientRect().left) : null;
    };
    const columnWidth = (row) => {
      const cell = row.querySelector('[data-slot="entity-picker-check"]');
      return cell ? Math.round(cell.getBoundingClientRect().width) : null;
    };
    read.tickedLabelX = labelX(ticked);
    read.plainLabelX = plain ? labelX(plain) : null;
    read.indicatorWidth = columnWidth(ticked);
    if (read.indicatorWidth === null) failures.push(`${framework}: a row has no indicator column`);
    if (read.plainLabelX === null) failures.push(`${framework}: every row was ticked, so nothing was compared`);
    else if (read.tickedLabelX !== read.plainLabelX) {
      failures.push(
        `${framework}: the label sits at ${read.tickedLabelX} on a ticked row and ${read.plainLabelX} on an unticked one`,
      );
    }
  }

  /* 2. The live region carries the count the list answered. */
  const announced = status();
  read.status = announced ? announced.textContent.trim() : null;
  if (!announced) failures.push(`${framework}: the list has no live region`);
  else {
    if (announced.getAttribute('aria-live') !== 'polite') failures.push(`${framework}: the live region is not polite`);
    if (!/^\d+ results?$/.test(read.status)) {
      failures.push(`${framework}: the live region reads "${read.status}" rather than a count`);
    }
  }

  /* 3. The fade is set on the edge that has more content past it, and only there. */
  const more = $('[data-picker="entity-multi"] [data-slot="entity-picker-more"]');
  if (more) {
    const before = rows().length;
    await settle(more, () => (rows().length > before ? rows().length : null));
    await wait(200);
  }
  const scroller = list();
  const atTop = fade();
  read.scrollable = atTop ? atTop.scrollable : 0;
  read.atTop = atTop;
  if (!atTop) failures.push(`${framework}: no list to measure`);
  else if (atTop.scrollable <= 0) failures.push(`${framework}: the list does not overflow, so no edge was proved`);
  else {
    if (atTop.start !== 0) failures.push(`${framework}: the top fades at ${atTop.start}px with nothing above it`);
    if (atTop.end <= 0) failures.push(`${framework}: the bottom does not fade with ${atTop.scrollable}px below it`);
    if (!atTop.marked) failures.push(`${framework}: an overflowing list is not marked as one`);

    scroller.scrollTop = scroller.scrollHeight;
    await until(() => fade().start > 0, 2000);
    await wait(150);
    const atEnd = fade();
    read.atEnd = atEnd;
    if (atEnd.start <= 0) failures.push(`${framework}: the top does not fade once the list has been scrolled`);
    if (atEnd.end !== 0) failures.push(`${framework}: the bottom fades at ${atEnd.end}px with nothing below it`);
  }
  await close();

  /* 4. The live region carries what a failed read said. */
  const errorBox = $('[data-demo-case="error"]', pane);
  const arm = errorBox && $('[data-arm-failure]', errorBox);
  if (!arm) {
    failures.push(`${framework}: no demo to fail`);
  } else {
    arm.click();
    if (!(await openCase(pane, 'error'))) {
      failures.push(`${framework}: the failing demo would not open`);
    } else {
      const box = input();
      if (box) type(box, 'sh0');
      const line = await until(() => $('[data-picker="entity-multi"] [data-slot="entity-picker-error"]'));
      read.errorLine = line ? line.textContent.trim() : null;
      read.errorStatus = status() ? status().textContent.trim() : null;
      if (!line) failures.push(`${framework}: the failed read drew no error line`);
      else if (read.errorStatus !== read.errorLine) {
        failures.push(
          `${framework}: the live region reads "${read.errorStatus}" where the error line reads "${read.errorLine}"`,
        );
      }
      await close();
    }
  }

  seen[framework] = read;
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS one indicator column, one live region and a fade only where there is more to read'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
