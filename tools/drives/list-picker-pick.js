// One press opens a list picker, a row lands in the control, and one more press closes it.
//
//   pnpm qa --start --path /widgets/list-picker/ --framework both --drive tools/drives/list-picker-pick.js
//
// The single picker is on the page; the multi picker is opened in a same-origin iframe,
// so both are read in one run. The single one shows its value as text, the multi one as
// chips, and a disabled picker opens for nobody.

const failures = [];
const seen = {};

/** What each demo picks, and the label that must land in the control. */
const SINGLE = [
  { demo: 'values', pick: 'Type C', label: 'Type C' },
  { demo: 'labels', pick: 'Full CG', label: 'Full CG' },
  { demo: 'project', pick: 'VFX', label: 'VFX' },
  { demo: 'searchable', pick: '2D', label: 'Two D' },
];
const MULTI = [
  { demo: 'values', pick: 'Type B', held: 2 },
  { demo: 'labels', pick: 'Full CG', held: 3 },
  { demo: 'project', pick: 'VFX', held: 2 },
  { demo: 'searchable', pick: '2D', held: 1 },
];

async function until(read, ms = 4000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

/** A press, the way a mouse makes one: the control toggles on pointerdown. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

/** A closed popup stays in the DOM carrying `data-closed`, so only live rows count. */
const live = (rows) => rows.filter((row) => !row.closest('[data-closed]') && row.getClientRects().length > 0);

/** Bits UI settles a row on pointerup, Base UI on click: the second only if the first missed. */
async function choose(row, landed) {
  row.click();
  if (await until(landed, 1500)) return true;
  row.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  row.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
  return Boolean(await until(landed, 1500));
}

/** Open, pick, and close again, reporting what the control read at each step. */
async function cycle({ where, box, slot, pick, landed }) {
  const control = $(`[data-slot="${slot}-control"]`, box);
  const rows = () => live($$(`[data-slot="${slot}-option"]`, box.ownerDocument));
  if (!control) {
    failures.push(`${where}: no control`);
    return null;
  }
  control.scrollIntoView({ block: 'center' });
  await wait(100);

  press(control);
  const listed = await until(() => (rows().length > 0 ? rows() : null));
  if (!listed) {
    failures.push(`${where}: one press did not open the list`);
    return null;
  }

  const row = listed.find((one) => one.dataset.option === pick);
  if (!row) {
    failures.push(`${where}: no row for ${pick} among ${listed.length}`);
    return null;
  }
  const picked = await choose(row, landed);
  if (!picked) failures.push(`${where}: ${pick} did not land in the control`);

  // A single picker closes on the pick, so it is reopened before the closing press.
  await wait(300);
  const reopened = rows().length === 0;
  if (reopened) {
    press(control);
    if (!(await until(() => (rows().length > 0 ? rows() : null)))) {
      failures.push(`${where}: one press did not reopen the list`);
      return { picked, reopened, closed: false };
    }
  }
  press(control);
  const closed = Boolean(await until(() => rows().length === 0));
  if (!closed) failures.push(`${where}: one press did not close the list`);
  return { picked, reopened, closed };
}

/** Load a page of this site into an iframe and answer its document. */
async function frame(path) {
  const el = document.createElement('iframe');
  el.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:900px;opacity:0;z-index:-1';
  el.src = path;
  const ready = new Promise((resolve) => el.addEventListener('load', resolve, { once: true }));
  document.body.appendChild(el);
  await ready;
  return el.contentDocument;
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;
  const note = { single: {}, multi: {} };

  /* ---------------------------------------------------------------- single */

  for (const { demo, pick, label } of SINGLE) {
    const box = await until(() => $(`[data-demo="${demo}"]`, pane), 15000);
    if (!box) {
      failures.push(`${framework} list-picker ${demo}: no demo`);
      continue;
    }
    const text = () => $('[data-slot="list-picker-text"]', box)?.textContent.trim() ?? '';
    note.single[demo] = await cycle({
      where: `${framework} list-picker ${demo}`,
      box,
      slot: 'list-picker',
      pick,
      landed: () => (text() === label ? label : null),
    });
    const read = text();
    if (read !== label) failures.push(`${framework} list-picker ${demo}: the control reads "${read}", not ${label}`);
  }

  // A disabled picker opens for nobody.
  const off = $('[data-demo="disabled"] [data-slot="list-picker-control"]', pane);
  if (off) {
    press(off);
    await wait(300);
    note.single.disabled = live($$('[data-slot="list-picker-option"]')).length;
    if (note.single.disabled > 0) failures.push(`${framework}: the disabled list picker opened`);
  }

  /* ----------------------------------------------------------------- multi */

  const doc = await frame('/widgets/list-multi-picker/');
  const mPane = await until(() => $(`[data-pane="${framework}"]`, doc), 15000);
  if (!mPane) {
    failures.push(`${framework}: the list multi picker page drew no pane`);
    seen[framework] = note;
    continue;
  }

  for (const { demo, pick, held } of MULTI) {
    const box = await until(() => $(`[data-demo="${demo}"]`, mPane), 15000);
    if (!box) {
      failures.push(`${framework} list-multi-picker ${demo}: no demo`);
      continue;
    }
    const chips = () => $$('[data-slot="list-multi-picker-chip"]', box).length;
    note.multi[demo] = await cycle({
      where: `${framework} list-multi-picker ${demo}`,
      box,
      slot: 'list-multi-picker',
      pick,
      landed: () => (chips() === held ? held : null),
    });
    const drawn = chips();
    if (drawn !== held) failures.push(`${framework} list-multi-picker ${demo}: ${drawn} chips, wanted ${held}`);
  }

  seen[framework] = note;
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');

return {
  verdict:
    failures.length === 0
      ? 'PASS one press opens each list picker, a row lands as text or as a chip, and one more press closes it'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
