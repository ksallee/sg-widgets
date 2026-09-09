// Drive the multi picker on the Combobox primitives: rows for a query with the
// matched words in bold, a selection that stays pinned when the query changes, and
// the three summary modes on the closed control.
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both --drive tools/drives/entity-multi-picker-combobox.js

const failures = [];
const seen = {};

/** A press, the way a mouse makes one: the field opens on pointerdown. */
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

async function until(read, timeoutMs = 8000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(100);
  }
}

const popup = () => $('[data-picker="entity-multi"]');
const rows = () => $$('[data-picker="entity-multi"] [data-slot="entity-picker-option"]');
const keyOf = (row) => `${row.dataset.entityType}:${row.dataset.entityId}`;

function summaryOf(pane, mode) {
  const box = $(`[data-demo-summary="${mode}"]`, pane);
  if (!box) return null;
  return {
    chips: $$('[data-slot="entity-chip"]', box).length,
    overflow: $('[data-slot="entity-picker-overflow"]', box)?.textContent.trim() ?? '',
    count: $('[data-slot="entity-picker-count"]', box)?.textContent.trim() ?? '',
  };
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  const input = $('[data-demo-case="multi"] [data-slot="entity-picker-input"]', pane);
  if (!input) {
    failures.push(`${framework}: the control has no query input`);
    continue;
  }
  input.scrollIntoView({ block: 'center' });
  press(input);
  if (!(await until(popup))) {
    failures.push(`${framework}: a press on the field did not open the list`);
    continue;
  }

  typeInto(input, 'sh010');
  const matched = await until(() => {
    const found = rows();
    return found.length > 0 && found.every((row) => row.textContent.includes('sh010')) ? found : null;
  });
  if (!matched) {
    failures.push(`${framework}: "sh010" matched no row`);
    continue;
  }
  const bold = matched.filter((row) =>
    [...row.querySelectorAll('[data-slot="entity-picker-label"] .font-semibold')].some(
      (run) => run.textContent.toLowerCase() === 'sh010',
    ),
  ).length;
  if (bold !== matched.length) {
    failures.push(`${framework}: ${bold} of ${matched.length} rows bold the matched word`);
  }

  // Tick the highlighted row from the keyboard. The popup stays open, and a chip
  // lands in the control.
  key(input, 'ArrowDown');
  await wait(100);
  key(input, 'Enter');
  const ticked = await until(() => rows().find((row) => row.dataset.selectedEntity === 'true'));
  const chip = $('[data-demo-case="multi"] [data-slot="entity-picker-value"] [data-slot="entity-chip"]', pane);
  if (!ticked) failures.push(`${framework}: Enter ticked no row`);
  if (!chip) failures.push(`${framework}: ticking a row put no chip in the control`);
  if (!popup()) failures.push(`${framework}: the popup closed on a tick`);
  const pinnedKey = ticked ? keyOf(ticked) : '';

  // A query that cannot match it: the ticked row stays on the list, so it can be unticked.
  typeInto(input, 'sh020');
  const second = await until(() => {
    const found = rows();
    const others = found.filter((row) => keyOf(row) !== pinnedKey);
    return others.length > 0 && others.every((row) => row.textContent.includes('sh020')) ? found : null;
  });
  const stillThere = (second ?? []).some((row) => keyOf(row) === pinnedKey);
  if (!second) failures.push(`${framework}: "sh020" matched no row`);
  else if (!stillThere) failures.push(`${framework}: ${pinnedKey} left the list when the query changed`);

  key(input, 'Escape');
  await until(() => !popup());

  const chips = summaryOf(pane, 'chips');
  const ellipsis = summaryOf(pane, 'ellipsis');
  const count = summaryOf(pane, 'count');
  const capped = summaryOf(pane, 'max');
  seen[framework] = { bold, rows: matched.length, pinned: stillThere, chips, ellipsis, count, capped };

  if (chips?.chips !== 5) failures.push(`${framework}: chips drew ${chips?.chips} of 5`);
  if (ellipsis?.chips !== 3) failures.push(`${framework}: ellipsis drew ${ellipsis?.chips} of 3 chips`);
  if (ellipsis?.overflow !== '+2') failures.push(`${framework}: ellipsis read "${ellipsis?.overflow}", wanted "+2"`);
  if (count?.count !== '5 selected') failures.push(`${framework}: count read "${count?.count}"`);
  if (capped?.chips !== 2 || capped?.overflow !== '+3') {
    failures.push(`${framework}: max={2} drew ${capped?.chips} chips and "${capped?.overflow}"`);
  }
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

// Leave the summary section in view, so the screenshot shows the three modes.
$('[data-demo-case="summary"]')?.scrollIntoView({ block: 'center' });
await wait(300);

return {
  verdict:
    failures.length === 0
      ? 'PASS rows bold the matched word, a ticked row stays pinned through a new query, and ellipsis reads "+2"'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
