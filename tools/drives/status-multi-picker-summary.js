// Read the closed control of the summary demos: every badge under `chips`, plain
// icons with no remove control under `badge="icon"`, whole badges and a matching "+n"
// under `ellipsis`, "5 selected" under `count`, and the cut `max={1}` makes.
//
//   pnpm qa --start --path /widgets/status-multi-picker/ --framework both --drive tools/drives/status-multi-picker-summary.js

const seen = {};
const failures = [];

function value(pane, demo) {
  const box = $(`[data-demo="${demo}"]`, pane);
  if (!box) throw new Error(`no ${demo}`);
  return $('[data-slot="status-multi-picker-value"]', box);
}

/** Badges the control actually shows. The ones past the fit stay in the DOM, hidden. */
function badgeCount(el) {
  return $$('[data-slot="status-multi-picker-chip"]:not([hidden]) [data-slot="status-badge"]', el).length;
}

function hiddenCount(el) {
  return $$('[data-slot="status-multi-picker-chip"][hidden]', el).length;
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
  const ellipsis = { badges: badgeCount(ellipsisEl), hidden: hiddenCount(ellipsisEl), overflow: overflow(ellipsisEl) };
  const iconsEl = value(pane, 'badge-icon-5');
  const icons = { badges: badgeCount(iconsEl), removes: $$('[data-slot="status-multi-picker-remove"]', iconsEl).length };
  // The two frameworks put different whitespace between badges, so the labels are read one by one.
  const names = $$('[data-slot="status-badge"]', value(pane, 'badge-text-2')).map((b) => b.textContent.trim());
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
  if (chips5.badges !== 5 || chips5.overflow !== '') {
    failures.push(`${framework}: chips drew ${chips5.badges} badges and "${chips5.overflow}", wanted 5 and nothing`);
  }
  if (ellipsis.badges + ellipsis.hidden !== 5) {
    failures.push(`${framework}: ellipsis holds ${ellipsis.badges + ellipsis.hidden} badges, wanted 5`);
  }
  if (ellipsis.badges === 0) failures.push(`${framework}: ellipsis drew no badge at all`);
  if (ellipsis.overflow !== (ellipsis.hidden > 0 ? `+${ellipsis.hidden}` : '')) {
    failures.push(`${framework}: ellipsis read "${ellipsis.overflow}" for ${ellipsis.hidden} hidden`);
  }
  if (icons.badges !== 5) failures.push(`${framework}: ${icons.badges} icon badges for five selected, wanted 5`);
  if (icons.removes !== 0) failures.push(`${framework}: icons still carry ${icons.removes} remove controls`);
  if (names.join('|') !== 'In Progress|Approved') failures.push(`${framework}: text badges read "${names.join('|')}"`);
  if (count !== '5 selected') failures.push(`${framework}: count read "${count}", wanted "5 selected"`);
  if (capped.badges !== 1 || capped.overflow !== '+1') {
    failures.push(`${framework}: max={1} drew ${capped.badges} badges and "${capped.overflow}"`);
  }
  if (height !== 36) failures.push(`${framework}: the control is ${height}px tall, wanted 36`);
}

// Put the summary demos in the viewport, so the screenshot shows what changed.
$('[data-demo="badge-icon-5"]')?.scrollIntoView({ block: 'center' });
await wait(150);

return {
  verdict:
    failures.length === 0
      ? 'PASS chips draw every badge, icon badges carry no remove, ellipsis fits whole badges and count reads "5 selected", in both frameworks'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
