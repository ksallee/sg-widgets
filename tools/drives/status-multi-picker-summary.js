// Read the closed trigger of the summary demos: badges for `both` with two selected,
// a count for five, and the collapse `max={1}` forces.
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

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) {
    failures.push(`${framework}: no pane`);
    continue;
  }

  const badges = badgeCount(value(pane, 'summary-both-2'));
  const five = value(pane, 'summary-both-5').textContent.trim();
  const icons = badgeCount(value(pane, 'summary-icons-5'));
  const names = value(pane, 'summary-names-2').textContent.trim();
  const count = value(pane, 'summary-count-2').textContent.trim();
  const capped = value(pane, 'max-one').textContent.trim();
  const height = Math.round(
    $('[data-demo="summary-both-2"] [data-slot="status-multi-picker-trigger"]', pane).getBoundingClientRect()
      .height,
  );

  seen[framework] = { badges, five, icons, names, count, capped, height };

  if (badges !== 2) failures.push(`${framework}: ${badges} badges for two selected, wanted 2`);
  if (five !== '5 statuses') failures.push(`${framework}: five selected read "${five}", wanted "5 statuses"`);
  if (icons !== 5) failures.push(`${framework}: ${icons} icon badges for five selected, wanted 5`);
  if (names !== 'In Progress, Approved') failures.push(`${framework}: names read "${names}"`);
  if (count !== '2 statuses') failures.push(`${framework}: count read "${count}", wanted "2 statuses"`);
  if (capped !== '2 statuses') failures.push(`${framework}: max={1} read "${capped}", wanted "2 statuses"`);
  if (height !== 36) failures.push(`${framework}: the trigger is ${height}px tall, wanted 36`);
}

// Put the summary demos in the viewport, so the screenshot shows what changed.
$('[data-demo="summary-icons-2"]')?.scrollIntoView({ block: 'center' });
await wait(150);

return {
  verdict:
    failures.length === 0
      ? 'PASS two selected show two badges, five read "5 statuses", in both frameworks'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
