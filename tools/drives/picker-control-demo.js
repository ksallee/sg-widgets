// The two controls of the picker-control page: a press opens the list, a press on a
// row lands the value in the control, and a press on the control closes the list again.
//
//   pnpm qa --start --path /widgets/picker-control/ --framework both --drive tools/drives/picker-control-demo.js

const failures = [];
const seen = {};

/** A press, the way a mouse makes one: the field opens on pointerdown. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
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

async function drive(pane, framework, name, slot, picker) {
  const box = $(`[data-demo-case="${name}"]`, pane);
  const control = box && $(`[data-slot="${slot}-control"]`, box);
  if (!control) {
    failures.push(`${framework}/${name}: no control to press`);
    return null;
  }
  control.scrollIntoView({ block: 'center' });
  await wait(150);

  const popup = () => $(`[data-picker="${picker}"]`);
  const chips = () => $$(`[data-slot="${slot}-chip"]`, box).map((chip) => chip.textContent.trim());
  const before = chips();

  press(control);
  if (!(await until(popup))) {
    failures.push(`${framework}/${name}: a press on the control did not open the list`);
    return null;
  }

  const rows = await until(() => {
    const found = $$(`[data-picker="${picker}"] [data-slot="${slot}-option"]`);
    return found.length > 0 ? found : null;
  });
  if (!rows) {
    failures.push(`${framework}/${name}: the list drew no row`);
    return null;
  }
  const wanted = rows[0].textContent.trim();

  press(rows[0]);
  const landed = await until(() => {
    const now = chips();
    return now.length === before.length + 1 && now.includes(wanted) ? now : null;
  });
  if (!landed) {
    failures.push(`${framework}/${name}: "${wanted}" did not land in the control (${chips().join(', ') || 'nothing'})`);
  }

  // A press on the control closes the list. A single picker closes on the pick, so
  // there the same press opens it first and the next one closes it. The pick's own
  // close settles before the popup is read, or the press lands mid-close.
  await wait(500);
  const held = Boolean(popup());
  if (!held) {
    press(control);
    if (!(await until(popup))) failures.push(`${framework}/${name}: the control did not reopen the list`);
  }
  press(control);
  const closed = await until(() => !popup(), 3000);
  if (!closed) failures.push(`${framework}/${name}: a press on the control did not close the list`);

  return { rows: rows.length, picked: wanted, chips: landed ?? chips(), heldOpen: held, closed: Boolean(closed) };
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  seen[framework] = {
    inline: await drive(pane, framework, 'inline', 'department-picker', 'department'),
    summary: await drive(pane, framework, 'summary', 'department-multi-picker', 'department-multi'),
  };
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

$('[data-demo-case="inline"]')?.scrollIntoView({ block: 'center' });
await wait(200);

return {
  verdict:
    failures.length === 0
      ? 'PASS both controls open on a press, take the row pressed, and close on the next press'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
