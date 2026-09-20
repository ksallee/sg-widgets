// Read the sub-label of the row-anatomy picker: a status field reads the name the
// site gives the code, never the code itself.
//
//   pnpm qa --start --path /widgets/entity-picker/ --framework both --drive tools/drives/picker-sub-label-status.js
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both --drive tools/drives/picker-sub-label-status.js

/** What the mock's Status table calls each of Version's codes. */
const DISPLAY = {
  na: 'N/A', rev: 'Pending Review', vwd: 'Viewed', apr: 'Approved', custom: 'CustomIcon',
  fin: 'Final', ip: 'In Progress', clsd: 'Closed', cmpt: 'Complete', cfrm: 'Confirmed',
  pndad: 'Pending Art Director', pndl: 'Pending Lead', pndvs: 'Pending VFX Supervisor',
  part: 'partial', pass: 'pass', pndng: 'Pending',
};
const NAMES = new Set(Object.values(DISPLAY));
/** The codes the site names differently, so one reaching a sub-label shows. */
const RAW = new Set(Object.keys(DISPLAY).filter((code) => DISPLAY[code] !== code));
const PENDING = DISPLAY.pndng;

const multi = location.pathname.includes('entity-multi-picker');
const key = multi ? 'entity-multi' : 'entity';
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
    await wait(100);
  }
}

const popup = () => $(`[data-picker="${key}"]`);
const rows = () => $$(`[data-picker="${key}"] [data-slot="entity-picker-option"]`);
const more = () => $(`[data-picker="${key}"] [data-slot="entity-picker-more"]`);
const subLabels = () =>
  rows()
    .map((row) => row.querySelector('[data-slot="picker-row-sub-label"]')?.textContent.trim() ?? '')
    .filter((text) => text.length > 0);

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane || pane.offsetParent === null) continue;

  // The single picker's anatomy case leads with a thumbnail-less field; the one that
  // carries the sub-label is the last of the case, as it is the only one on the multi.
  const control = $$('[data-demo-case="anatomy"] [data-slot="entity-picker-control"]', pane).at(-1);
  if (!control) {
    failures.push(`${framework}: the row-anatomy demo has no control`);
    continue;
  }
  control.scrollIntoView({ block: 'center' });
  press(control);
  if (!(await until(() => rows().length > 0))) {
    failures.push(`${framework}: a press on the field did not open the list`);
    continue;
  }
  await wait(300);

  // The mock deals its statuses out over the rows, so walk pages until `pndng` shows.
  let texts = subLabels();
  for (let page = 0; page < 3 && !texts.includes(PENDING); page++) {
    const load = more();
    if (!load) break;
    press(load);
    await until(() => subLabels().length > texts.length, 4000);
    await wait(300);
    texts = subLabels();
  }

  const codes = texts.filter((text) => RAW.has(text));
  const strangers = texts.filter((text) => !NAMES.has(text));
  if (texts.length === 0) failures.push(`${framework}: no row carried a sub-label`);
  if (codes.length > 0) failures.push(`${framework}: ${codes.length} sub-labels read a code, ${JSON.stringify([...new Set(codes)])}`);
  if (strangers.length > 0) failures.push(`${framework}: sub-labels no status is called, ${JSON.stringify([...new Set(strangers)])}`);
  if (!texts.includes(PENDING)) failures.push(`${framework}: no row read "${PENDING}", saw ${JSON.stringify([...new Set(texts)])}`);
  seen[framework] = { rows: texts.length, names: [...new Set(texts)].sort() };

  // The single picker closes on a pick and both close on Escape; leave the last pane open.
  if (framework === 'svelte' && $('[data-pane="react"]')?.offsetParent) {
    const input = $(`[data-picker="${key}"] [data-slot="entity-picker-input"]`) ?? control;
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    await until(() => !popup(), 2000);
    await wait(200);
  }
}

if (Object.keys(seen).length === 0) failures.push('no framework pane was on show');
await wait(300);

return {
  verdict:
    failures.length === 0
      ? `PASS every sub-label on the ${multi ? 'multi picker' : 'picker'} reads a status name, "${PENDING}" among them`
      : `FAIL ${failures.join('; ')}`,
  seen,
};
