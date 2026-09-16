// One ladder: a widget and a shadcn primitive beside it stand at the same height.
//
//   pnpm qa --start --path /qa/composition/ --framework both --drive tools/drives/control-ladder.js
//   pnpm qa --start --path /widgets/filter-editor/ --framework both --drive tools/drives/control-ladder.js
//
// The registry's controls are read at whatever step their cell declares and the shadcn
// primitives beside them at theirs. A host mixing the two gets one set of heights only if
// every reading lands on a step of the ladder, and a primitive at its own default size
// stands where a widget at `md` stands. A filter editor cell is read control by control:
// the field picker, the operator select, every value editor and the buttons of a row all
// stand on the row's step.

const LADDER = { sm: 28, md: 32, lg: 36 };

/** One control per widget, the outer box a caller sizes. */
const CONTROL = {
  'entity-picker': '[data-slot="entity-picker-control"]',
  'entity-multi-picker': '[data-slot="entity-picker-control"]',
  'user-picker': '[data-slot="entity-picker-control"]',
  'user-multi-picker': '[data-slot="entity-picker-control"]',
  'project-picker': '[data-slot="entity-picker-control"]',
  'status-picker': '[data-slot="status-picker-control"]',
  'status-multi-picker': '[data-slot="status-multi-picker-control"]',
  'entity-type-picker': '[data-slot="entity-type-picker-control"]',
  'entity-type-multi-picker': '[data-slot="entity-type-picker-control"]',
  'list-picker': '[data-slot="list-picker-control"]',
  'list-multi-picker': '[data-slot="list-multi-picker-control"]',
  'field-picker': '[data-slot="field-picker-trigger"]',
  'context-selector': '[data-slot="context-selector-trigger"]',
  'filter-bar': '[data-slot="filter-pill"]',
  'sort-picker': '[data-slot="sort-trigger"]',
  'entity-tree': '[data-slot="entity-tree-search"]',
  'text-editor': '[data-slot="input"]',
  'date-editor': '[data-slot="date-editor-trigger"]',
  'date-time-editor': '[data-slot="date-time-editor-trigger"]',
  'url-editor': '[data-slot="url-editor-url"]',
  'filter-dialog': '[data-slot="filter-launch"]',
};

/** Widgets read control by control: every match in the cell stands on its step. */
const EVERY = {
  'filter-editor': [
    '[data-slot="filter-row"] [data-slot="field-picker-trigger"]',
    '[data-slot="filter-operator"]',
    '[data-slot="filter-value"] [data-slot$="-picker-control"]',
    '[data-slot="filter-value"] [data-slot="input"]',
    '[data-slot="filter-value"] [data-slot="date-editor-trigger"]',
    '[data-slot="filter-value"] [data-slot="date-time-editor-trigger"]',
    '[data-slot="filter-logic"] [data-slot="toggle-group-item"]',
    '[data-slot="filter-foot"] [data-slot="button"]',
  ].join(','),
};

/** The shadcn primitives a host installs beside them. */
const PRIMITIVE = '[data-slot="button"],[data-slot="input"],[data-slot="select-trigger"],[data-slot="input-group"]';

const pane = (name) => document.querySelector(`[data-pane="${name}"]`);
const drawn = ['svelte', 'react'].filter((name) => pane(name)?.getBoundingClientRect().height > 0);
const tall = (el) => Math.round(el.getBoundingClientRect().height);
const seen = (el) => el.getBoundingClientRect().height > 0;

if (drawn.length === 0) return { verdict: 'FAIL no framework pane was drawn' };
await wait(6000);

const notes = [];
const off = [];

for (const framework of drawn) {
  let read = 0;
  for (const cell of pane(framework).querySelectorAll('[data-qa-widget]')) {
    const name = cell.dataset.qaWidget;
    const size = cell.dataset.qaSize ?? 'md';
    const controls = EVERY[name]
      ? [...cell.querySelectorAll(EVERY[name])]
      : CONTROL[name]
        ? [cell.querySelector(CONTROL[name])].filter(Boolean)
        : [];
    for (const control of controls.filter(seen)) {
      read += 1;
      const height = tall(control);
      if (height !== LADDER[size]) {
        off.push(`${framework} ${name} ${control.dataset.slot} at ${size} is ${height}, wanted ${LADDER[size]}`);
      }
    }
  }
  notes.push(`${framework}: ${read} widget controls on the ladder`);
  // The composition page draws the whole set; a widget page draws its own rows.
  const wanted = location.pathname.includes('/qa/composition') ? 15 : 3;
  if (read < wanted) off.push(`${framework} found only ${read} widget controls to read, wanted ${wanted}`);

  // Every primitive, measured against the ladder as a whole.
  const heights = new Map();
  for (const control of [...pane(framework).querySelectorAll(PRIMITIVE)].filter(seen)) {
    // A block-shaped input group grows with its content and is not a control on the ladder.
    if (tall(control) > LADDER.lg) continue;
    const height = tall(control);
    heights.set(height, (heights.get(height) ?? 0) + 1);
    if (!Object.values(LADDER).includes(height)) {
      off.push(`${framework} ${control.dataset.slot} stands at ${height}, off the ladder`);
    }
  }
  const spread = [...heights.entries()].sort((a, b) => a[0] - b[0]).map(([h, n]) => `${n}×${h}`);
  notes.push(`${framework}: primitives at ${spread.join(', ')}`);
  if ((heights.get(LADDER.md) ?? 0) === 0) {
    off.push(`${framework} drew no primitive at ${LADDER.md}, the step a widget at md takes`);
  }
}

if (off.length > 0) return { verdict: `FAIL ${off.length} controls off the ladder: ${off.join('; ')}`, notes };

return {
  verdict: `PASS every control stands on ${LADDER.sm}, ${LADDER.md} or ${LADDER.lg}, widget and shadcn primitive alike`,
  notes,
};
