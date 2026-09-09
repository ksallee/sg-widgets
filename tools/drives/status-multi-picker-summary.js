// Read the closed control of the summary demos: badges for `chips`, three badges and
// a "+2" for `ellipsis`, "5 selected" for `count`, and the cut `max={1}` makes.
//
//   pnpm qa --start --path /widgets/status-multi-picker/ --framework both --drive tools/drives/status-multi-picker-summary.js

const seen = {};
const failures = [];

function value(pane, demo) {
  const box = $(`[data-demo="${demo}"]`, pane);
  if (!box) throw new Error(`no ${demo}`);
  return $('[data-slot="status-multi-picker-value"]', box);
}

function badgeCount(el) {
  return $$('[data-slot="status-multi-picker-badges"] [data-slot="status-badge"]', el).length;
}

function overflow(el) {
  return $('[data-slot="status-multi-picker-overflow"]', el)?.textContent.trim() ?? '';
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) {
    failures.push(`${framework}: no pane`);
    continue;
  }

  const chips2 = badgeCount(value(pane, 'summary-chips-2'));
  const chips5El = value(pane, 'summary-chips-5');
  const chips5 = { badges: badgeCount(chips5El), overflow: overflow(chips5El) };
  const ellipsisEl = value(pane, 'summary-ellipsis-5');
  const ellipsis = { badges: badgeCount(ellipsisEl), overflow: overflow(ellipsisEl) };
  const icons = badgeCount(value(pane, 'summary-icons-5'));
  const names = value(pane, 'summary-names-2').textContent.trim();
  const count = value(pane, 'summary-count-5').textContent.trim();
  const cappedEl = value(pane, 'max-one');
  const capped = { badges: badgeCount(cappedEl), overflow: overflow(cappedEl) };
  // `ellipsis` never wraps, so it is never taller than the control's own step.
  const height = Math.round(
    $('[data-demo="summary-ellipsis-5"] [data-slot="status-multi-picker-control"]', pane).getBoundingClientRect()
      .height,
  );

  seen[framework] = { chips2, chips5, ellipsis, icons, names, count, capped, height };

  if (chips2 !== 2) failures.push(`${framework}: ${chips2} badges for two selected, wanted 2`);
  if (chips5.badges !== 3 || chips5.overflow !== '+2') {
    failures.push(`${framework}: chips drew ${chips5.badges} badges and "${chips5.overflow}"`);
  }
  if (ellipsis.badges !== 3) failures.push(`${framework}: ellipsis drew ${ellipsis.badges} badges, wanted 3`);
  if (ellipsis.overflow !== '+2') failures.push(`${framework}: ellipsis read "${ellipsis.overflow}", wanted "+2"`);
  if (icons !== 5) failures.push(`${framework}: ${icons} icon badges for five selected, wanted 5`);
  if (names !== 'In Progress, Approved') failures.push(`${framework}: names read "${names}"`);
  if (count !== '5 selected') failures.push(`${framework}: count read "${count}", wanted "5 selected"`);
  if (capped.badges !== 1 || capped.overflow !== '+1') {
    failures.push(`${framework}: max={1} drew ${capped.badges} badges and "${capped.overflow}"`);
  }
  if (height !== 36) failures.push(`${framework}: the control is ${height}px tall, wanted 36`);
}

// Put the summary demos in the viewport, so the screenshot shows what changed.
$('[data-demo="summary-icons-2"]')?.scrollIntoView({ block: 'center' });
await wait(150);

return {
  verdict:
    failures.length === 0
      ? 'PASS chips draw one badge each, ellipsis reads "+2" and count reads "5 selected", in both frameworks'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
