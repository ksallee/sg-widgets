// Live mode: the rows an entity picker lists come from the site, not the mock.
//
//   pnpm qa --start --live --project 70 --path /widgets/entity-picker/ --framework both --drive tools/drives/live-entity-picker.js
//
// The mock's shots are all `shNNN_NNNN` on two projects. A site answering for itself
// gives its own codes, so the drive reports what it read rather than matching a shape.
const seen = {};
const failures = [];

/** A press, the way a mouse makes one: the field opens on pointerdown. */
function press(el) {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
}

async function until(read, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > deadline) return null;
    await wait(200);
  }
}

const source = $('[data-sg-demo]')?.dataset.source;
if (source !== 'live') return { verdict: `FAIL the toolbar is in ${source} mode, not live` };

const status = $('[data-live-status]')?.textContent.trim() ?? '';
if (!/dev token|Logged in/.test(status)) return { verdict: `FAIL live mode is not authenticated: "${status}"` };

const popup = () => $('[data-picker="entity"]');
const rows = () => $$('[data-picker="entity"] [data-slot="entity-picker-option"]');

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) {
    failures.push(`${framework}: no pane`);
    continue;
  }

  // The project-scoped demo, so the rows answer for the project the run names.
  const input = $('[data-demo-case="project"] [data-slot="entity-picker-input"]', pane);
  if (!input) {
    failures.push(`${framework}: no query input`);
    continue;
  }
  input.scrollIntoView({ block: 'center' });
  press(input);
  if (!(await until(popup))) {
    failures.push(`${framework}: a press on the field did not open the list`);
    continue;
  }

  const listed = await until(() => (rows().length > 0 ? rows() : null));
  const labels = (listed ?? []).map((row) => $('[data-slot="entity-picker-label"]', row)?.textContent.trim());
  const thumbs = (listed ?? []).filter((row) => $('[data-slot="entity-picker-leading"] img', row)).length;
  seen[framework] = { rows: labels.length, labels: labels.slice(0, 8), thumbs };
  if (labels.length === 0) failures.push(`${framework}: the site listed no shot`);

  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await until(() => !popup());
  await wait(200);
}

return {
  verdict: failures.length === 0 ? 'PASS both pickers list rows read from the site' : `FAIL ${failures.join('; ')}`,
  status,
  seen,
};
