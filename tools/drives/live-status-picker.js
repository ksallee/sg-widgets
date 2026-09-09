// Live mode: the options a status picker offers come from the site, not the mock.
//
//   pnpm qa --start --live --path /widgets/status-picker/ --framework both --drive tools/drives/live-status-picker.js
//
// The mock hides six of Version's sixteen codes on project 70, so it offers ten. A site
// that offers a different number is answering for itself.
const MOCK_OPTIONS = 10;
const seen = {};
const failures = [];

const source = $('[data-sg-demo]')?.dataset.source;
if (source !== 'live') return { verdict: `FAIL the toolbar is in ${source} mode, not live` };

const status = $('[data-live-status]')?.textContent.trim() ?? '';
if (!/dev token|Logged in/.test(status)) return { verdict: `FAIL live mode is not authenticated: "${status}"` };

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) {
    failures.push(`${framework}: no pane`);
    continue;
  }
  const trigger = $('[data-demo="p70"] [data-slot="select-trigger"]', pane);
  if (!trigger) {
    failures.push(`${framework}: no picker`);
    continue;
  }
  // Base UI opens on a click, Bits UI on pointerdown, and neither answers the other.
  let options = [];
  for (const gesture of ['click', 'pointer']) {
    if (gesture === 'click') trigger.click();
    else {
      trigger.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
      trigger.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
    }
    for (let i = 0; i < 12 && options.length === 0; i += 1) {
      await wait(250);
      options = $$('[role="option"]').map((o) => o.textContent.trim());
    }
    if (options.length > 0) break;
  }
  seen[framework] = { options: options.length, labels: options };
  if (options.length === 0) failures.push(`${framework}: the picker offered nothing`);
  else if (options.length === MOCK_OPTIONS) failures.push(`${framework}: ${options.length} options, the mock's own count`);
  // The next pane's picker cannot open while this one holds the focus scope.
  for (let i = 0; i < 20 && $$('[role="option"]').length > 0; i += 1) {
    (document.activeElement ?? document.body).dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    await wait(200);
  }
}

return {
  verdict: failures.length === 0 ? 'PASS both pickers read the site' : `FAIL ${failures.join('; ')}`,
  status,
  seen,
};
