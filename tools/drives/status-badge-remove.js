// Read a removable status badge: the cross sits inside the pill and after the label, it
// is drawn in the badge's own foreground, a press on it takes the badge away, and the
// icon-only variant carries none.
//
//   pnpm qa --start --path /widgets/status-badge/ --framework both --drive tools/drives/status-badge-remove.js

const seen = {};
const failures = [];

/** A rect inside another, to the half pixel a subpixel layout leaves. */
function within(inner, outer) {
  return (
    inner.left >= outer.left - 0.5 &&
    inner.right <= outer.right + 0.5 &&
    inner.top >= outer.top - 0.5 &&
    inner.bottom <= outer.bottom + 0.5
  );
}

for (const framework of ['svelte', 'react']) {
  const pane = $(`[data-pane="${framework}"]`);
  if (!pane) {
    failures.push(`${framework}: no pane`);
    continue;
  }
  const box = $('[data-demo="removable"]', pane);
  if (!box) {
    failures.push(`${framework}: no removable demo`);
    continue;
  }
  box.scrollIntoView({ block: 'center' });
  await wait(150);

  const badges = $$('[data-slot="status-badge"]', box);
  const labelled = badges.filter((b) => b.dataset.statusCode !== 'rev');
  const iconOnly = badges.find((b) => b.dataset.statusCode === 'rev');
  const crosses = labelled.map((b) => $('[data-slot="status-badge-remove"]', b));

  if (labelled.length !== 3) failures.push(`${framework}: ${labelled.length} removable badges, wanted 3`);
  if (crosses.some((c) => !c)) failures.push(`${framework}: a removable badge has no cross`);
  if (!iconOnly) failures.push(`${framework}: no icon-only badge`);
  else if ($('[data-slot="status-badge-remove"]', iconOnly)) {
    failures.push(`${framework}: the icon-only badge carries a cross`);
  }

  const first = labelled[0];
  const cross = crosses[0];
  if (!first || !cross) {
    seen[framework] = { badges: badges.length };
    continue;
  }

  const pill = first.getBoundingClientRect();
  const crossBox = cross.getBoundingClientRect();
  // The glyph and the label share one span; the cross follows it.
  const content = first.firstElementChild.getBoundingClientRect();
  const inside = within(crossBox, pill);
  const afterLabel = crossBox.left >= content.right - 0.5;
  const pillInk = getComputedStyle(first).color;
  const crossInk = getComputedStyle(cross).color;
  // The cross inherits the foreground the colour derives, so the two read the same.
  const sameInk = crossInk === pillInk;

  if (!inside) failures.push(`${framework}: the cross is outside the pill`);
  if (!afterLabel) failures.push(`${framework}: the cross is not after the label`);
  if (!sameInk) failures.push(`${framework}: the cross is ${crossInk}, the badge ${pillInk}`);

  const code = first.dataset.statusCode;
  const before = $$('[data-slot="status-badge"]', box).length;
  cross.click();
  await wait(300);
  const after = $$('[data-slot="status-badge"]', box).length;
  const gone = !$$('[data-slot="status-badge"]', box).some((b) => b.dataset.statusCode === code);

  if (after !== before - 1) failures.push(`${framework}: ${before} badges became ${after}, wanted one fewer`);
  if (!gone) failures.push(`${framework}: ${code} is still there after the press`);

  seen[framework] = { inside, afterLabel, pillInk, crossInk, code, before, after, gone };
}

return {
  verdict:
    failures.length === 0
      ? 'PASS the cross sits inside the pill after the label, in the badge foreground, removes on a press, and the icon-only variant carries none, in both frameworks'
      : `FAIL ${failures.join('; ')}`,
  seen,
};
