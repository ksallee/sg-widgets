// The one anatomy, driven: the row holds a button and nothing else, the popover it opens
// holds the typed day and the time, and Enter inside it commits both to the button.
//
//   pnpm qa --start --path /widgets/date-time-editor/ --framework both --drive tools/drives/date-time-editor-popover.js
//
// The demo reads its wall-clock time in America/Los_Angeles, so 07:08 on 6 May is 14:08 UTC
// whatever zone the run itself is in.
const TYPED_DATE = '2026-05-06';
const TYPED_TIME = '07:08';
const WANT_LABEL = '2026-05-06 07:08';
const WANT_VALUE = '"2026-05-06T14:08:00Z"';

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

function key(el, name) {
  el.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
}

async function until(find, label) {
  for (let i = 0; i < 100; i++) {
    const found = find();
    if (found) return found;
    await wait(50);
  }
  throw new Error(`timed out waiting for ${label}`);
}

/** The surfaces that are open now. Base UI keeps a closed popover mounted. */
function openSurfaces() {
  return $$('[data-slot="popover-content"]').filter(
    (el) => !el.hasAttribute('data-closed') && el.getAttribute('data-state') !== 'closed' && el.checkVisibility(),
  );
}

function within(selector) {
  return openSurfaces().flatMap((surface) => $$(selector, surface));
}

const seen = {};
const failures = [];

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) {
    failures.push(`${framework}: no pane`);
    continue;
  }

  const row = $('[data-demo-row="md"]', pane);
  const trigger = $('[data-slot="date-time-editor-trigger"]', row);
  if (!trigger) {
    failures.push(`${framework}: no picker button`);
    continue;
  }
  const inRow = $$('input, textarea', row).length;

  press(trigger);
  const dateInput = await until(() => within('[data-slot="date-time-editor-date"]')[0], `${framework}: the popover`);
  const timeInput = within('[data-slot="date-time-editor-time"]')[0];
  const focused = document.activeElement === dateInput;
  // The three parts, top to bottom: the typed day, the calendar's month grid, the time.
  const parts = `${within('input').length} inputs, ${within('table').length} grid`;

  dateInput.focus();
  setValue(dateInput, TYPED_DATE);
  await wait(80);
  timeInput.focus();
  setValue(timeInput, TYPED_TIME);
  await wait(80);
  key(timeInput, 'Enter');
  await wait(250);

  const label = $('[data-slot="date-time-editor-trigger"]', row).textContent.trim();
  const title = $('[data-slot="date-time-editor-trigger"]', row).getAttribute('title');
  const emitted = $('[data-demo-value="set"]', pane).textContent.trim();
  const stillOpen = openSurfaces().length;
  seen[framework] = { inRow, focused, parts, label, title, emitted, stillOpen };

  if (inRow !== 0) failures.push(`${framework}: ${inRow} controls beside the button`);
  if (!focused) failures.push(`${framework}: the popover did not focus the typed day`);
  if (parts !== '2 inputs, 1 grid') failures.push(`${framework}: the popover holds ${parts}`);
  if (label !== WANT_LABEL) failures.push(`${framework}: the button reads "${label}", wanted "${WANT_LABEL}"`);
  if (title !== JSON.parse(WANT_VALUE)) failures.push(`${framework}: the title reads "${title}"`);
  if (emitted !== WANT_VALUE) failures.push(`${framework}: emitted ${emitted}, wanted ${WANT_VALUE}`);
  if (stillOpen !== 0) failures.push(`${framework}: Enter left the popover open`);
}

return {
  verdict:
    failures.length === 0
      ? `PASS the picker button reads ${WANT_LABEL} and emits ${WANT_VALUE} in both frameworks`
      : `FAIL ${failures.join('; ')}`,
  seen,
};
