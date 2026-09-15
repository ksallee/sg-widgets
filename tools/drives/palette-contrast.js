// One palette, one theme: every text colour at AA, and the chrome on the demo's tokens.
//
// Run once per palette and theme, on a widget page that draws labels without waiting on
// the mock:
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --framework both \
//     --palette catppuccin --dark --drive tools/drives/palette-contrast.js
//
// The palette is whatever the run was dressed with, read back off `:root`, so the same
// file covers every palette.

/** AA for body text. Everything measured here is 14px or smaller, so nothing is large text. */
const AA = 4.5;

/** The tokens the chrome and a stage have to agree on for a page to read as one palette. */
const SHARED = [
  '--background',
  '--foreground',
  '--card',
  '--popover',
  '--primary',
  '--primary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--border',
  '--input',
  '--ring',
  '--radius',
  '--success',
  '--success-foreground',
  '--warning',
  '--warning-foreground',
  '--info',
  '--info-foreground',
];

const until = async (fn, ms = 8000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await wait(50);
  }
  return false;
};

/*
 * A computed colour as [r, g, b, a], 0-255 with a 0-1 alpha. A browser serialises a
 * computed colour in the space it was written in -- `oklch()`, `oklab()`, `color()` --
 * so the value is resolved through a canvas rather than parsed, which also gamut-maps it
 * the way the screen does. `copy` keeps the alpha instead of blending it into the canvas.
 * The name avoids `ctx`, which tools/qa.mjs binds around the body of a drive.
 */
const probe = document.createElement('canvas');
probe.width = 1;
probe.height = 1;
const paint = probe.getContext('2d', { willReadFrequently: true });
paint.globalCompositeOperation = 'copy';
function rgba(value) {
  if (!value) return null;
  paint.fillStyle = '#000000';
  paint.fillStyle = value;
  paint.fillRect(0, 0, 1, 1);
  const d = paint.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}

const overlay = (src, dst) => [0, 1, 2].map((i) => src[i] * src[3] + dst[i] * (1 - src[3])).concat(1);

/** What sits behind an element: the first opaque ancestor background, alphas composited on to it. */
function backdrop(el) {
  const stack = [];
  for (let node = el; node; node = node.parentElement) {
    const c = rgba(getComputedStyle(node).backgroundColor);
    if (!c || c[3] === 0) continue;
    stack.push(c);
    if (c[3] === 1) break;
  }
  stack.push([255, 255, 255, 1]); // The canvas, if nothing above it was opaque.
  return stack.reduceRight((under, over) => overlay(over, under));
}

const channel = (v) => {
  const x = v / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
};
const luminance = (c) => 0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
function contrast(el) {
  const bg = backdrop(el);
  const fg = overlay(rgba(getComputedStyle(el).color), bg);
  const a = luminance(fg);
  const b = luminance(bg);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

const palette = document.documentElement.dataset.sgPalette;
const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

// The stage takes the palette when the header's script runs, and the islands mount after.
if (!(await until(() => $('[data-stage]')?.dataset.theme === palette))) {
  return { verdict: `FAIL the stage stayed on "${$('[data-stage]')?.dataset.theme}" while the page wore ${palette}` };
}
if (!(await until(() => $$('[data-pane="svelte"] .text-sm').length > 0 && $$('[data-pane="react"] .text-sm').length > 0))) {
  return { verdict: `FAIL one of the two panes drew nothing at the body size for ${palette}` };
}
await document.fonts.ready;

// Every text the palette has to carry, on the chrome and inside a demo. A part that is
// not on this page is reported and skipped; the required list below is what must be here.
const parts = {
  content: $('.sl-markdown-content p'),
  heading: $('.sl-markdown-content h2') ?? $('h1'),
  link: $('.sl-markdown-content a[href]'),
  inlineCode: $('.sl-markdown-content code'),
  sidebar: $('#starlight__sidebar a[href]:not([aria-current="page"])'),
  sidebarCurrent: $('#starlight__sidebar a[aria-current="page"]'),
  toc: $('.right-sidebar-panel nav a'),
  searchButton: $('button[data-open-modal]'),
  paneTitle: $('[data-pane-title]'),
  svelteLabel: $('[data-pane="svelte"] .text-sm'),
  reactLabel: $('[data-pane="react"] .text-sm'),
  svelteMuted: $('[data-pane="svelte"] .text-muted-foreground'),
  reactMuted: $('[data-pane="react"] .text-muted-foreground'),
};
const REQUIRED = ['content', 'heading', 'sidebar', 'sidebarCurrent', 'toc', 'searchButton', 'paneTitle', 'svelteLabel', 'reactLabel'];

const out = { palette, theme, contrast: {}, missing: [], tokens: {} };
const fails = [];

for (const [name, el] of Object.entries(parts)) {
  if (!el) {
    out.missing.push(name);
    if (REQUIRED.includes(name)) fails.push(`${name} is not on the page`);
    continue;
  }
  const r = contrast(el);
  out.contrast[name] = Number(r.toFixed(2));
  if (r < AA) fails.push(`${name} reads ${r.toFixed(2)}:1, wanted ${AA}`);
}

// One palette, two scopes: the page's tokens and the stage's have to be the same values,
// or the chrome and the demo inside it are wearing different palettes.
const rootStyle = getComputedStyle(document.documentElement);
const stageStyle = getComputedStyle($('[data-stage]'));
for (const token of SHARED) {
  const page = rootStyle.getPropertyValue(token).trim();
  const stage = stageStyle.getPropertyValue(token).trim();
  out.tokens[token] = page;
  if (!page) fails.push(`${token} is empty on the page`);
  else if (page !== stage) fails.push(`${token} is ${page} on the page and ${stage} on the stage`);
}

// The demo frame is drawn on the page's own tokens, not the stage's copy, so it is the
// one place the two scopes have to meet.
const frame = $('[data-sg-demo]');
out.frameBorder = frame ? getComputedStyle(frame).borderTopColor : null;
if (!frame) fails.push('the demo frame is not on the page');

const weakest = Object.entries(out.contrast).sort((a, b) => a[1] - b[1])[0];
out.verdict = fails.length
  ? `FAIL ${palette} ${theme}: ${fails.join('; ')}`
  : `PASS ${palette} ${theme}: every text colour at AA, weakest ${weakest[0]} at ${weakest[1]}:1, chrome and demo on the same ${SHARED.length} tokens`;
return out;
