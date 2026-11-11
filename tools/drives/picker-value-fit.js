// A filled control keeps its value inside its own box, at the width the page gives it and in a
// control squeezed to the width of a narrow table cell. Rule 2 of the design rules: a widget
// never grows past its container.
//
// Every filled control of the page is read, in both panes: the chip, badge or text it holds
// must end before the room the control reserves for its clear and open controls.
//
//   pnpm qa --start --path /widgets/data-type-picker/   --framework both --drive tools/drives/picker-value-fit.js
//   pnpm qa --start --path /widgets/status-picker/      --framework both --drive tools/drives/picker-value-fit.js
//   pnpm qa --start --path /widgets/entity-type-picker/ --framework both --drive tools/drives/picker-value-fit.js

const failures = [];
const seen = {};

/** The width of a demo cell in the two-pane stage, where a long label does not fit. */
const NARROW = 106;

const shown = (el) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';

/** Where an element's drawn box ends: its own right edge, cut by every clipping box up to the control. */
function drawnRight(el, control) {
  let right = el.getBoundingClientRect().right;
  for (let box = el.parentElement; box && box !== control; box = box.parentElement) {
    if (getComputedStyle(box).overflowX !== 'visible') right = Math.min(right, box.getBoundingClientRect().right);
  }
  return right;
}

/** How far the control's value is drawn past the room the control leaves it, in pixels. */
function overrun(control) {
  const value = control.querySelector('[data-slot$="-value"]');
  if (!value) return null;
  const box = control.getBoundingClientRect();
  const limit = box.right - parseFloat(getComputedStyle(control).paddingRight);
  let right = drawnRight(value, control);
  for (const part of value.querySelectorAll('*')) if (shown(part)) right = Math.max(right, drawnRight(part, control));
  return Math.round((right - limit) * 10) / 10;
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  const controls = $$('[data-slot$="-control"]', pane).filter((control) => shown(control) && control.querySelector('[data-slot$="-value"]'));
  const note = { controls: controls.length, natural: [], narrow: [] };

  for (const control of controls) {
    const name = `${control.dataset.slot} "${control.textContent.trim()}"`;
    const natural = overrun(control);
    if (natural > 0.5) {
      note.natural.push({ name, width: Math.round(control.getBoundingClientRect().width), overrun: natural });
      failures.push(`${framework}: ${name} runs ${natural}px past its control at the page's width`);
    }
  }

  for (const control of controls) control.parentElement.style.cssText += `;width:${NARROW}px;flex:none`;
  await wait(400);
  for (const control of controls) {
    const name = `${control.dataset.slot} "${control.textContent.trim()}"`;
    const narrow = overrun(control);
    if (narrow > 0.5) {
      note.narrow.push({ name, overrun: narrow });
      failures.push(`${framework}: ${name} runs ${narrow}px past a ${NARROW}px control`);
    }
  }
  if (controls.length === 0) failures.push(`${framework}: no filled control on the page`);
  seen[framework] = note;
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS every filled control keeps its value inside its box, at the page width and squeezed'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
