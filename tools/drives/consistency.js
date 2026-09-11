// Measure every widget on /qa/composition/ against docs/design-rules.md rules 2, 3, 5 and 6.
//
//   pnpm qa --start --path /qa/composition/ --framework both --drive tools/drives/consistency.js
//
// One deviation is `{ widget, framework, part, property, expected, actual }`. The two
// frameworks are then compared value by value, so a widget that is wrong in the same way
// twice still reads as one deviation per framework and none across them.
//
// Four readings, where the rules leave room. Each takes what most widgets already do.
//
//   Control radius is `--radius` (`rounded-lg`), the step every shadcn primitive and
//   twelve of the twenty-two widget controls wear, rather than the `rounded-md` of the
//   picker chrome. Rows and the icon buttons inside a control take 0.6, chips and badges
//   0.8, surfaces the full step.
//
//   A control whose value is plain text has a leading inset of 8/12/12, the reading inset
//   rule 3 pins and sixteen of the controls already draw; the shadcn `px-2.5` is the
//   minority. A control that holds a chip or a badge insets it to the room above and
//   below that value instead, which is rule 3's own wording, so the drive measures that
//   room rather than naming a number. It allows 2px either way: the registry sets 5 at sm
//   and md, off the 4/6 scale, so a chip reads level with the trailing controls.
//
//   A row's gap is 8: its leading slot is a thumbnail or an avatar, an item beside the
//   label rather than a glyph inside it. A glyph inside a chip, a badge or a control
//   keeps 6.
//
//   A list of rows has no gap and its rows no minimum height, rule 2's own wording. A
//   list is read off the DOM: a box whose visible children carry one `data-slot`, stack
//   down the page, fill its width and are wider than they are tall. A section stack names
//   its parts differently, a chip row runs across and a card is not wide, so none of the
//   three is measured as a list.

const LADDER = { sm: 32, md: 36, lg: 40 };
const INSET = { sm: 8, md: 12, lg: 12 };
const GLYPH_GAP = 6;
const ITEM_GAP = 8;
const SECTION_GAP = 12;
const FIELD_GAP = 16;
const ROW_PAD = { x: 8, y: 6 };
const CELL_PAD = { x: 12, y: 8 };
const POPUP_PAD = [12, 16];
const STATE_PAD = { popover: 24, table: 40 };
const BODY = { size: 14, line: 20 };
const META = { size: 12, line: 16 };

/** The bordered box a reader clicks, per widget. A widget with none is not measured. */
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
  'field-picker': '[data-slot="field-picker-trigger"]',
  'context-selector': '[data-slot="context-selector-trigger"]',
  'filter-bar': '[data-slot="filter-pill"]',
  'sort-picker': '[data-slot="sort-trigger"]',
  'global-search': '[data-slot="input-group"]',
  'entity-tree': '[data-slot="entity-tree-search"]',
  'text-editor': '[data-slot="input"]',
  'number-editor': '[data-slot="number-editor-field"] [data-slot="input"]',
  'date-editor': '[data-slot="date-editor-trigger"]',
  'date-time-editor': '[data-slot="date-time-editor-trigger"]',
  'list-picker': '[data-slot="list-picker-control"]',
  'color-editor': '[data-slot="input"]',
  'url-editor': '[data-slot="url-editor-url"]',
};

/** A row in a list: the inset and the gap of rule 2, the row radius of rule 1. */
const ROW =
  '[data-slot="entity-tree-item-label"],[data-slot="command-item"],[data-slot$="-option"],[data-slot="grouped-list-row"],[data-slot="picker-row"]';
/** A chip or a badge: a glyph beside its text, one step under the control. The bare
 *  glyph variant of the status badge is a leading mark, not a chip. */
const CHIP = '[data-slot="entity-chip"],[data-slot="status-badge"]:not([data-variant="glyph"])';
/** A picker's own text chip, where it draws one instead of an entity chip. */
const TEXT_CHIP = '[data-slot$="-chip"]';
/** The icon buttons a control reserves its trailing inset for. */
const ICON_BUTTON = '[data-slot$="-clear"],[data-slot$="-remove"]';
/** Sub-labels, codes and counts: rule 6's second size. */
const META_TEXT =
  '[data-slot$="-sub-label"],[data-slot$="-code"],[data-slot$="-zone"],[data-slot$="-overflow"],[data-slot$="-count"]';

const px = (value) => Math.round(parseFloat(value) * 100) / 100;

/** The radius ladder of the page, from the token the stage carries. */
function radiusSteps() {
  const root = $('[data-stage]') ?? document.documentElement;
  const raw = getComputedStyle(root).getPropertyValue('--radius').trim();
  const rem = px(getComputedStyle(document.documentElement).fontSize);
  const base = raw.endsWith('rem') ? parseFloat(raw) * rem : parseFloat(raw);
  return { row: base * 0.6, chip: base * 0.8, control: base, surface: base };
}

/** A control hands its inset and its gap to its first child when it draws neither. */
function leading(box) {
  const style = getComputedStyle(box);
  const own = px(style.paddingLeft);
  if (own > 0) return own;
  const drawn = [...box.children].filter((el) => el.getBoundingClientRect().width > 0);
  if (drawn.length === 0) return own;
  const first = drawn.reduce((a, b) =>
    a.getBoundingClientRect().left <= b.getBoundingClientRect().left ? a : b,
  );
  return px(getComputedStyle(first).paddingLeft);
}

/** The chip or badge a control draws its value as, if it draws one. */
function chipValue(box) {
  const chip = box.querySelector(`${CHIP},${TEXT_CHIP}`);
  return chip && chip.getBoundingClientRect().height > 0 ? chip : null;
}

/** True when the element renders text itself rather than handing it to a child. */
function writesText(box) {
  if (box.tagName === 'INPUT' || box.tagName === 'TEXTAREA') return true;
  return [...box.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim());
}

/** Every list of rows under `root`, by the shape of its children rather than by name. */
function rowLists(root) {
  const lists = [];
  for (const box of [root, ...$$('*', root)]) {
    const kids = [...box.children].filter((el) => el.getBoundingClientRect().height > 0);
    if (kids.length < 2) continue;
    const slot = kids[0].dataset.slot;
    if (!slot || kids.some((el) => el.dataset.slot !== slot)) continue;
    const s = getComputedStyle(box);
    const width = box.getBoundingClientRect().width - px(s.paddingLeft) - px(s.paddingRight);
    const rows = kids.every((el, i) => {
      const r = el.getBoundingClientRect();
      if (r.width < width * 0.95 || r.width < r.height * 2) return false;
      return i === 0 || r.top >= kids[i - 1].getBoundingClientRect().bottom - 1;
    });
    if (rows) lists.push({ box, slot, row: kids[0] });
  }
  return lists;
}

function inlineGap(box) {
  const style = getComputedStyle(box);
  return style.columnGap === 'normal' ? null : px(style.columnGap);
}

const deviations = [];
const seen = [];

function check(widget, framework, part, property, expected, actual, tolerance = 0.51) {
  seen.push({ widget, framework, part, property, expected, actual });
  const ok = Array.isArray(expected)
    ? expected.some((one) => Math.abs(one - actual) <= tolerance)
    : Math.abs(expected - actual) <= tolerance;
  if (!ok) deviations.push({ widget, framework, part, property, expected, actual });
}

/** Rows, chips, meta text and radius, wherever they appear under `root`. */
function measureParts(widget, framework, root, R, scope) {
  const rows = $$(ROW, root).filter((el) => el.getBoundingClientRect().height > 0);
  if (rows[0]) {
    const s = getComputedStyle(rows[0]);
    check(widget, framework, `${scope}row`, 'padding-x', ROW_PAD.x, px(s.paddingLeft));
    check(widget, framework, `${scope}row`, 'padding-y', ROW_PAD.y, px(s.paddingTop));
    check(widget, framework, `${scope}row`, 'gap', ITEM_GAP, inlineGap(rows[0]) ?? ITEM_GAP);
    check(widget, framework, `${scope}row`, 'radius', R.row, px(s.borderTopLeftRadius));
    check(widget, framework, `${scope}row`, 'font-size', BODY.size, px(s.fontSize));
  }

  const drawn = (selector) => $$(selector, root).find((el) => el.getBoundingClientRect().height > 0);
  const chip = drawn(CHIP) ?? drawn(TEXT_CHIP);
  if (chip) {
    const s = getComputedStyle(chip);
    check(widget, framework, `${scope}chip`, 'gap', GLYPH_GAP, inlineGap(chip) ?? GLYPH_GAP);
    check(widget, framework, `${scope}chip`, 'radius', R.chip, px(s.borderTopLeftRadius));
  }

  const meta = $$(META_TEXT, root).find((el) => el.textContent?.trim());
  if (meta) {
    const s = getComputedStyle(meta);
    check(widget, framework, `${scope}meta`, 'font-size', META.size, px(s.fontSize));
    check(widget, framework, `${scope}meta`, 'line-height', META.line, px(s.lineHeight));
  }

  const button = $$(ICON_BUTTON, root).find((el) => el.getBoundingClientRect().height > 0);
  if (button) {
    check(widget, framework, `${scope}icon-button`, 'radius', R.row, px(getComputedStyle(button).borderTopLeftRadius));
  }

  for (const { box, slot, row } of rowLists(root)) {
    const gap = getComputedStyle(box).rowGap;
    check(widget, framework, `${scope}list ${slot}`, 'row-gap', 0, gap === 'normal' ? 0 : px(gap));
    const min = getComputedStyle(row).minHeight;
    check(widget, framework, `${scope}list ${slot}`, 'row-min-height', 0, min === 'auto' ? 0 : px(min));
  }

  const line = $$('[data-slot$="state-line"],[data-slot$="-empty"],[data-slot$="-error"]', root).find(
    (el) => el.getBoundingClientRect().height > 0,
  );
  if (line) {
    const inTable = Boolean(line.closest('table'));
    const want = inTable ? STATE_PAD.table : STATE_PAD.popover;
    check(widget, framework, `${scope}state-line`, 'padding-y', want, px(getComputedStyle(line).paddingTop));
  }
}

// A row lands as soon as its island mounts; a name a picker resolves lands later, and a
// chip only then takes its width. Read once the page has settled.
await wait(6000);

const R = radiusSteps();

for (const pane of $$('[data-pane]')) {
  const framework = pane.dataset.pane;

  // The page's own stacks: the scale a caller is asked to follow.
  const form = $('[data-qa-widget="text-editor"]', pane)?.parentElement;
  if (form) check('page', framework, 'form', 'field-gap', FIELD_GAP, px(getComputedStyle(form).rowGap));
  const toolbar = $('[data-qa-region="toolbar"]', pane);
  if (toolbar) check('page', framework, 'toolbar', 'item-gap', ITEM_GAP, px(getComputedStyle(toolbar).columnGap));

  for (const cell of $$('[data-qa-widget]', pane)) {
    const widget = cell.dataset.qaWidget;
    const size = cell.dataset.qaSize ?? 'md';
    const selector = CONTROL[widget];
    const box = selector ? cell.querySelector(selector) : null;

    if (box) {
      const s = getComputedStyle(box);
      check(widget, framework, `control ${size}`, 'height', LADDER[size], Math.round(box.getBoundingClientRect().height));
      // A filled control that holds a chip insets it to the room above and below it. An
      // empty one, and a control whose value is text, keep the reading inset.
      const value = box.hasAttribute('data-empty') ? null : chipValue(box);
      if (value) {
        const room = value.getBoundingClientRect().top - box.getBoundingClientRect().top - px(s.borderTopWidth);
        check(widget, framework, `control ${size}`, 'leading-inset', Math.round(room), leading(box), 2.01);
      } else {
        check(widget, framework, `control ${size}`, 'leading-inset', INSET[size], leading(box));
      }
      // A control that declares no gap has nothing to space: a bare input, or a box whose
      // leading glyph carries its own inset.
      const gap = inlineGap(box);
      if (gap !== null) check(widget, framework, `control ${size}`, 'gap', GLYPH_GAP, gap);
      check(widget, framework, `control ${size}`, 'radius', R.control, px(s.borderTopLeftRadius));
      // A box whose children all carry their own size draws no text of its own.
      if (writesText(box)) {
        check(widget, framework, `control ${size}`, 'font-size', BODY.size, px(s.fontSize));
        check(widget, framework, `control ${size}`, 'line-height', BODY.line, px(s.lineHeight));
      }
    }

    if (size === 'md') measureParts(widget, framework, cell, R, '');

    // The table draws cells, not rows: rule 2 gives them their own inset.
    const tableCell = $$('[data-slot="table-cell"]', cell).find((el) => el.getBoundingClientRect().height > 0);
    if (tableCell) {
      const s = getComputedStyle(tableCell);
      check(widget, framework, 'table cell', 'padding-x', CELL_PAD.x, px(s.paddingLeft));
      check(widget, framework, 'table cell', 'padding-y', CELL_PAD.y, px(s.paddingTop));
      check(widget, framework, 'table cell', 'font-size', BODY.size, px(s.fontSize));
    }

    // The footer of a collection: the parent owns the gap, the controls keep the ladder.
    const footer = $(`[data-slot$="-footer"]`, cell);
    if (footer) {
      check(widget, framework, 'footer', 'gap', ITEM_GAP, px(getComputedStyle(footer).columnGap));
      for (const control of $$('[data-slot="select-trigger"],[data-slot="input"],[data-slot="button"]', footer)) {
        check(widget, framework, `footer ${control.dataset.slot}`, 'height', LADDER.sm, Math.round(control.getBoundingClientRect().height));
      }
    }

    // A card is a surface: rule 2 gives it the same inset as a popover.
    const card = $('[data-slot="entity-card-body"]', cell);
    if (card) {
      check(widget, framework, 'card', 'padding', POPUP_PAD, px(getComputedStyle(card).paddingTop));
      const surface = card.closest('[data-slot="entity-card"]');
      if (surface) {
        check(widget, framework, 'card', 'radius', R.surface, px(getComputedStyle(surface).borderTopLeftRadius));
      }
    }
  }
}

// The popups, one widget at a time. Each cell names the control that opens it.
for (const pane of $$('[data-pane]')) {
  const framework = pane.dataset.pane;
  for (const cell of $$('[data-qa-popup]', pane)) {
    const widget = cell.dataset.qaWidget;
    const opener = cell.querySelector(`[data-slot="${cell.dataset.qaPopup}"]`);
    if (!opener) {
      deviations.push({ widget, framework, part: 'popup', property: 'opener', expected: cell.dataset.qaPopup, actual: 'not found' });
      continue;
    }
    // Bits UI and Base UI open a select on the pointer sequence, not on a bare click.
    opener.focus({ preventScroll: true });
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
      opener.dispatchEvent(new PointerEvent(type, { bubbles: true, button: 0, pointerType: 'mouse' }));
    }
    opener.click();
    await wait(1200);
    // The outermost surface that appeared: a popup inside a popup is its content.
    const open = $$('[data-slot="popover-content"],[data-slot$="-content"]').filter(
      (el) => el.getBoundingClientRect().height > 0 && !pane.contains(el),
    );
    const popup = open.find((el) => !open.some((other) => other !== el && other.contains(el)));
    if (popup) {
      const s = getComputedStyle(popup);
      // A popup that holds a list draws no inset of its own: the list carries `p-1` and
      // the rows their own. A popup that holds sections is a surface, and takes `p-3`.
      const item = popup.querySelector(
        '[data-slot$="-option"],[data-slot="command-item"],[data-slot="select-item"],[role="option"]',
      );
      check(widget, framework, 'popup', 'radius', R.surface, px(s.borderTopLeftRadius));
      if (item) {
        // The list inset is 4 wherever it is declared: on the list, on the box that
        // scrolls it, or on the popup itself.
        const list = item.closest('[data-slot$="-list"],[role="listbox"]') ?? item.parentElement;
        const own = px(getComputedStyle(list).paddingTop);
        const above = list.parentElement ? px(getComputedStyle(list.parentElement).paddingTop) : 0;
        check(widget, framework, 'popup list', 'padding', 4, own || above || px(s.paddingTop));
      } else {
        check(widget, framework, 'popup', 'padding', POPUP_PAD, px(s.paddingTop));
      }
      if (!item && popup.childElementCount > 1 && s.rowGap !== 'normal') {
        check(widget, framework, 'popup', 'section-gap', SECTION_GAP, px(s.rowGap));
      }
      measureParts(widget, framework, popup, R, 'popup ');
    } else {
      deviations.push({ widget, framework, part: 'popup', property: 'open', expected: 'a popup', actual: 'none' });
    }
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    opener.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(600);
  }
}

// The two frameworks draw the same widget.
const byKey = new Map();
for (const row of seen) byKey.set(`${row.framework}|${row.widget}|${row.part}|${row.property}`, row.actual);
const across = [];
for (const [key, value] of byKey) {
  if (!key.startsWith('svelte|')) continue;
  const other = byKey.get(key.replace('svelte|', 'react|'));
  const [, widget, part, property] = key.split('|');
  if (other === undefined) {
    across.push({ widget, part, property, svelte: value, react: 'absent' });
  } else if (Math.abs(other - value) > 0.51) {
    across.push({ widget, part, property, svelte: value, react: other });
  }
}

const total = deviations.length + across.length;
const verdict =
  total === 0
    ? `PASS ${seen.length} readings over both frameworks: every height, inset, gap, row, list, popup, size and radius is on the scale, and the two frameworks agree`
    : `FAIL ${total} deviations over ${seen.length} readings: ${deviations
        .slice(0, 6)
        .map((d) => `${d.widget} ${d.framework} ${d.part} ${d.property} ${d.expected} != ${d.actual}`)
        .join('; ')}`;

/** What each widget was read on, so a widget drawing nothing is visible in the report. */
const coverage = {};
for (const row of seen) {
  if (row.framework !== 'svelte') continue;
  coverage[row.widget] = (coverage[row.widget] ?? 0) + 1;
}

return { verdict, readings: seen.length, coverage, deviations, across };
