// Read the focus ring's contrast against the surface beside it, on /qa/composition/.
//
//   pnpm qa --path /qa/composition/ --framework both --drive tools/drives/focus-ring-contrast.js
//   pnpm qa --path /qa/composition/ --framework both --drive tools/drives/focus-ring-contrast.js --dark
//
// One row per control kind per framework: the ring the shadcn classes paint, the colour
// behind it, and the WCAG ratio between the two. The ratio is reported and never asserted
// on: the verdict is PASS when every ring could be read, and the rows are the data.
//
// The caret is put on a text field first, which always takes `:focus-visible`, and moved
// from there, since focus that moves off a control wearing the ring keeps it. Each row
// says whether the control matched `:focus-visible` when it was read.
//
// The ring is a box-shadow wherever a shadcn class paints it: the offset shadow first, in
// the surface colour, then the ring itself, with the wider spread. An outline is read
// where a control draws one instead. The colour behind it is every fill up the tree laid
// over the first opaque one, since a chip's own fill is a wash; a translucent ring is laid
// over that in turn, and the ratio is between the two. A ring with an offset also names
// the offset's own colour.
//
// A control is read where the caret lands on it. A tick that only draws a row's state
// takes no focus, so the candidates are tried in turn and the first that takes it is read.

/** The controls read, by the widget cell that holds them. */
const CONTROLS = [
  {
    kind: 'picker control',
    cell: 'entity-picker',
    find: (cell) => $$('[data-slot="entity-picker-control"] input', cell),
  },
  {
    kind: 'input',
    cell: 'text-editor',
    find: (cell) => $$('[data-slot="input"]', cell),
  },
  {
    kind: 'button',
    cell: 'column-picker',
    find: (cell) => $$('[data-slot="popover-trigger"],[data-slot="button"]', cell),
  },
  {
    kind: "chip's cross",
    cell: 'entity-multi-picker',
    find: (cell) => $$('[data-slot="entity-chip-remove"]', cell),
  },
  {
    kind: 'checkbox',
    // The table's selection column, where the tick is the control. A picker row's own tick
    // is decorative and takes no focus.
    cell: 'entity-table',
    find: (cell) => $$('[data-slot="checkbox"]', cell),
  },
];

const paint = document.createElement('canvas').getContext('2d', { willReadFrequently: true });

/** Any CSS colour, as sRGB bytes and an alpha. */
function rgba(value) {
  paint.clearRect(0, 0, 1, 1);
  paint.fillStyle = '#000000';
  paint.fillStyle = value;
  paint.clearRect(0, 0, 1, 1);
  paint.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = paint.getImageData(0, 0, 1, 1).data;
  return { r, g, b, a: a / 255 };
}

const hex = ({ r, g, b, a }) =>
  `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}${a < 1 ? ` @${Math.round(a * 100)}%` : ''}`;

/** A colour laid over the one under it. */
function over(top, under) {
  return {
    r: Math.round(top.r * top.a + under.r * (1 - top.a)),
    g: Math.round(top.g * top.a + under.g * (1 - top.a)),
    b: Math.round(top.b * top.a + under.b * (1 - top.a)),
    a: 1,
  };
}

function luminance({ r, g, b }) {
  const channel = (n) => {
    const c = n / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 100) / 100;
}

/** The shadows of a `box-shadow`, split on the commas between them. */
function shadows(value) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < value.length; i++) {
    const ch = value[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(value.slice(start, i).trim());
      start = i + 1;
    }
  }
  parts.push(value.slice(start).trim());
  return parts.filter(Boolean);
}

/** The spread of one shadow: its last length, which is what a ring's width lands in. */
function spread(shadow) {
  const lengths = shadow.match(/-?\d*\.?\d+px/g) ?? [];
  return lengths.length ? parseFloat(lengths[lengths.length - 1]) : 0;
}

/** The colour of one shadow: the part that is not a length. */
function shadowColour(shadow) {
  const colour = shadow.replace(/-?\d*\.?\d+px/g, '').replace(/\binset\b/g, '').trim();
  return colour || 'currentColor';
}

/** The ring an element paints, and the offset under it, if it paints one. */
function ringOf(el) {
  const style = getComputedStyle(el);
  if (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) {
    return { colour: style.outlineColor, width: parseFloat(style.outlineWidth), offset: null, drawn: 'outline' };
  }
  if (style.boxShadow === 'none') return null;
  const drawn = shadows(style.boxShadow);
  if (drawn.length === 0) return null;
  const widest = drawn.reduce((a, b) => (spread(a) >= spread(b) ? a : b));
  if (spread(widest) <= 0) return null;
  const under = drawn[drawn.indexOf(widest) - 1];
  return {
    colour: shadowColour(widest),
    width: spread(widest) - (under ? spread(under) : 0),
    offset: under ? shadowColour(under) : null,
    drawn: 'box-shadow',
  };
}

/** The ring a control wears: its own, or the one the box around it paints for it. */
function ringFor(el) {
  let box = el;
  for (let depth = 0; box && depth < 4; depth++, box = box.parentElement) {
    const ring = ringOf(box);
    if (ring) return { ring, box };
  }
  return null;
}

/** The colour behind the ring: every fill up the tree, laid over the first opaque one. */
function behind(el) {
  const fills = [];
  for (let box = el.parentElement; box; box = box.parentElement) {
    const fill = rgba(getComputedStyle(box).backgroundColor);
    if (fill.a === 0) continue;
    fills.push(fill);
    if (fill.a === 1) break;
  }
  let ground = fills.length > 0 && fills[fills.length - 1].a === 1 ? fills.pop() : rgba('#ffffff');
  for (let i = fills.length - 1; i >= 0; i--) ground = over(fills[i], ground);
  return ground;
}

await wait(6000);

const rows = [];
const missing = [];

for (const pane of $$('[data-pane]')) {
  const framework = pane.dataset.pane;
  // The caret starts on a text field, which takes `:focus-visible` on its own; every
  // control after it is focused from a control that already wears the ring.
  const seed = $('[data-qa-widget="text-editor"] [data-slot="input"]', pane);
  for (const { kind, cell, find } of CONTROLS) {
    const host = $(`[data-qa-widget="${cell}"]`, pane);
    if (!host) {
      missing.push(`${framework} ${kind}: no ${cell} cell`);
      continue;
    }
    const candidates = find(host).filter((el) => el.getBoundingClientRect().height > 0);
    if (candidates.length === 0) {
      missing.push(`${framework} ${kind}: nothing to focus in ${cell}`);
      continue;
    }
    let read = null;
    for (const target of candidates) {
      seed?.focus({ preventScroll: true });
      target.focus({ preventScroll: true });
      await wait(200);
      if (document.activeElement !== target) continue;
      const found = ringFor(target);
      if (found) read = { ...found, visible: target.matches(':focus-visible') };
      if (read) break;
    }
    if (!read) {
      missing.push(`${framework} ${kind}: no ring painted on any of ${candidates.length}`);
    } else {
      const { ring, box, visible } = read;
      const surface = behind(box);
      const ink = over(rgba(ring.colour), surface);
      const offset = ring.offset ? rgba(ring.offset) : null;
      rows.push({
        framework,
        control: kind,
        drawn: ring.drawn,
        width: ring.width,
        ring: hex(rgba(ring.colour)),
        offset: offset && offset.a > 0 ? hex(offset) : null,
        surface: hex(surface),
        ratio: contrast(ink, surface),
        meets3: contrast(ink, surface) >= 3,
        focusVisible: visible,
      });
    }
  }
}

const theme = document.documentElement.classList.contains('dark') || $('[data-stage]')?.classList.contains('dark') ? 'dark' : 'light';
const met = rows.filter((row) => row.meets3).length;
const verdict =
  missing.length === 0 && rows.length > 0
    ? `PASS ${rows.length} rings read in ${theme}: ${met} of ${rows.length} meet 3:1`
    : `FAIL ${missing.length} rings could not be read: ${missing.join('; ')}`;

return { verdict, theme, rows, missing };
