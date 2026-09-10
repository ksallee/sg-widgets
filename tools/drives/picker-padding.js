// Measure every picker control on /qa/pickers/, empty against filled, in both frameworks.
//
//   pnpm qa --start --path /qa/pickers/ --framework both --drive tools/drives/picker-padding.js
//
// Returns one row per picker, per framework, per size, with the computed padding of the
// control, its height, and the x of the first thing drawn inside it. The verdict holds
// when every pair is tighter empty than filled, the empty control keeps the 8/9/10
// ladder, md holds its height across the two states, and the frameworks agree.

const CONTROL = [
  '[data-slot$="-control"]',
  '[data-slot="field-picker-trigger"]',
  '[data-slot="status-picker-trigger"]',
  '[data-slot="select-trigger"]',
  '[data-slot="context-selector-trigger"]',
].join(',');

const LADDER = { sm: 32, md: 36, lg: 40 };

const px = (value) => Math.round(parseFloat(value) * 100) / 100;

function measure(cell) {
  const control = cell.querySelector(CONTROL);
  if (!control) return null;
  const style = getComputedStyle(control);
  const box = control.getBoundingClientRect();
  // The first element drawn inside the control: the chip, the badge or the input.
  const inner = control.firstElementChild?.getBoundingClientRect();
  return {
    left: px(style.paddingLeft),
    right: px(style.paddingRight),
    top: px(style.paddingTop),
    bottom: px(style.paddingBottom),
    height: Math.round(box.height),
    inset: inner ? Math.round(inner.left - box.left) : null,
    marked: control.hasAttribute('data-empty'),
  };
}

// A row lands as soon as its island mounts; the name a picker resolves lands later, and
// a chip only then takes its width. Read once the page has settled.
await wait(3000);

// Both islands stay mounted, so the pane is what tells the two frameworks apart.
const rows = [];
for (const pane of $$('[data-pane]')) {
  for (const cell of $$('[data-qa-picker]', pane)) {
    const seen = measure(cell);
    if (!seen) continue;
    rows.push({
      framework: pane.dataset.pane,
      picker: cell.dataset.qaPicker,
      size: cell.dataset.qaSize,
      case: cell.dataset.qaCase,
      ...seen,
    });
  }
}

const pairs = new Map();
for (const row of rows) {
  const key = `${row.framework}|${row.picker}|${row.size}`;
  const group = pairs.get(key) ?? {};
  group[row.case] = row;
  pairs.set(key, group);
}

const failures = [];

for (const [name, pair] of pairs) {
  const { empty, filled } = pair;
  if (!empty || !filled) {
    failures.push(`${name}: only the ${empty ? 'empty' : 'filled'} state was found`);
    continue;
  }
  if (!empty.marked) failures.push(`${name}: the empty control carries no data-empty`);
  if (filled.marked) failures.push(`${name}: the filled control carries data-empty`);
  if (!(empty.left < filled.left)) {
    failures.push(`${name}: padding-left ${empty.left} empty is not under ${filled.left} filled`);
  }
  if (empty.top > filled.top) {
    failures.push(`${name}: padding-top ${empty.top} empty is over ${filled.top} filled`);
  }
  if (empty.height !== LADDER[empty.size]) {
    failures.push(`${name}: empty height ${empty.height}, not ${LADDER[empty.size]}`);
  }
  // The padding rule never moves the height: md holds exactly. At sm and lg a filled
  // control is 2px taller because a chip plus the border overruns `min-h` there, which
  // is the chip ladder, not this rule, and is the same before and after it.
  const slack = empty.size === 'md' ? 0 : 2;
  if (filled.height < empty.height || filled.height > empty.height + slack) {
    failures.push(`${name}: height moves ${empty.height} to ${filled.height} between the states`);
  }
}

// The two frameworks draw the same control.
for (const [name, pair] of pairs) {
  if (!name.startsWith('svelte|')) continue;
  const other = pairs.get(name.replace('svelte|', 'react|'));
  if (!other) {
    failures.push(`${name}: no React counterpart`);
    continue;
  }
  for (const state of ['empty', 'filled']) {
    if (!pair[state] || !other[state]) continue;
    for (const field of ['left', 'right', 'top', 'bottom', 'height']) {
      if (pair[state][field] !== other[state][field]) {
        failures.push(`${name} ${state}: ${field} is ${pair[state][field]} in Svelte, ${other[state][field]} in React`);
      }
    }
  }
}

const verdict =
  failures.length === 0
    ? `PASS ${pairs.size} picker/size pairs over both frameworks: empty is tighter than filled, the empty ladder is 8/9/10, md holds its height across the states and the frameworks agree`
    : `FAIL ${failures.length} checks over ${pairs.size} pairs: ${failures.slice(0, 10).join('; ')}`;

return { verdict, pairs: pairs.size, failures, rows };
