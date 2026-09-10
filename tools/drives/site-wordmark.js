// The wordmark in the header: the accessible name, the mark's two tiles and the two
// words on the tokens they read, the favicon on the SVG, and the mark centred on the
// capitals beside it.
//
// Run once per palette and theme, on any docs page, with a viewport cropped to the header:
//
//   pnpm qa --start --path /widgets/entity-multi-picker/ --viewport 1200x140 \
//     --palette claude --dark --drive tools/drives/site-wordmark.js --shot shots/wordmark-ship-claude-dark.png
//
// The palette is whatever the run was dressed with, read back off `:root`, so the same
// file covers every palette.

const until = async (fn, ms = 8000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await wait(50);
  }
  return false;
};

/*
 * A computed colour as [r, g, b, a], resolved through a canvas rather than parsed, so a
 * value written in `oklch()` or `color-mix()` compares the way the screen draws it.
 */
const probe = document.createElement('canvas');
probe.width = 1;
probe.height = 1;
const paint = probe.getContext('2d', { willReadFrequently: true });
paint.globalCompositeOperation = 'copy';
function rgba(value) {
  paint.fillStyle = '#000000';
  paint.fillStyle = value;
  paint.fillRect(0, 0, 1, 1);
  const d = paint.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}
const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) <= (i === 3 ? 0.01 : 1));
const show = (c) => `rgb(${c[0]} ${c[1]} ${c[2]})`;

/** What a token or an expression resolves to on the page, drawn as a background. */
function resolve(expression, color) {
  const el = document.createElement('span');
  el.style.color = color ?? 'inherit';
  el.style.backgroundColor = expression;
  document.body.append(el);
  const value = rgba(getComputedStyle(el).backgroundColor);
  el.remove();
  return value;
}

const palette = document.documentElement.dataset.sgPalette;
const theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';

// The palette lands on `:root` when the header's script runs.
if (!(await until(() => document.documentElement.dataset.sgPalette === palette && $('header.header a.site-title')))) {
  return { verdict: `FAIL the header has no site title link on ${palette}` };
}
await document.fonts.ready;

const link = $('header.header a.site-title');
const svg = link.querySelector('svg');
const back = link.querySelector('svg .accent');
const front = link.querySelector('svg .quiet');
const head = link.querySelector('.head');
const tail = link.querySelector('.tail');
const icon = $('link[rel="shortcut icon"]') ?? $('link[rel~="icon"]');

const out = { palette, theme, fails: [] };
const fails = out.fails;

// The accessible name is the title text: the mark is hidden from the tree, no label overrides it.
out.name = link.textContent.replace(/\s+/g, ' ').trim();
out.documentTitle = document.title;
if (out.name !== 'SG Widgets') fails.push(`the title link reads "${out.name}", wanted "SG Widgets"`);
if (link.hasAttribute('aria-label')) fails.push('the title link carries an aria-label over its text');
if (!svg) fails.push('no mark in the title');
else if (svg.getAttribute('aria-hidden') !== 'true') fails.push('the mark is not hidden from the accessibility tree');
if (!document.title.endsWith('SG Widgets')) fails.push(`the document title is "${document.title}"`);

// The tiles on their tokens. The front tile's fill is the ink at 30% over the header's
// ground, resolved through the same expression the mark uses.
if (back && front) {
  const primary = resolve('var(--primary)');
  const backFill = rgba(getComputedStyle(back).fill);
  out.backTile = show(backFill);
  out.primary = show(primary);
  if (!same(backFill, primary)) fails.push(`the back tile is ${out.backTile}, --primary is ${out.primary}`);

  const ground = getComputedStyle(svg).getPropertyValue('--ground').trim();
  const quiet = resolve(`color-mix(in oklab, var(--foreground) 30%, ${ground})`);
  const frontFill = rgba(getComputedStyle(front).fill);
  out.frontTile = show(frontFill);
  out.quietInk = show(quiet);
  if (!same(frontFill, quiet)) fails.push(`the front tile is ${out.frontTile}, the quiet ink is ${out.quietInk}`);

  const gap = rgba(getComputedStyle(front).stroke);
  const nav = resolve('var(--sl-color-bg-nav)');
  out.gap = show(gap);
  if (!same(gap, nav)) fails.push(`the gap is ${out.gap}, the header ground is ${show(nav)}`);
  if (same(backFill, frontFill)) fails.push('the two tiles are the same colour');
}

// The two words on their tokens, with the weight split.
if (head && tail) {
  const fg = resolve('var(--foreground)');
  const muted = resolve('var(--muted-foreground)');
  const headStyle = getComputedStyle(head);
  const tailStyle = getComputedStyle(tail);
  /** The first family of a stack, unquoted -- what the text is actually drawn in. */
  const first = (stack) => stack.split(',')[0].trim().replace(/^["']|["']$/g, '');
  out.head = { text: head.textContent, color: show(rgba(headStyle.color)), weight: headStyle.fontWeight, size: headStyle.fontSize, family: first(headStyle.fontFamily) };
  out.tail = { text: tail.textContent, color: show(rgba(tailStyle.color)), weight: tailStyle.fontWeight };
  if (!same(rgba(headStyle.color), fg)) fails.push(`"${head.textContent}" is ${out.head.color}, --foreground is ${show(fg)}`);
  if (!same(rgba(tailStyle.color), muted)) fails.push(`"${tail.textContent}" is ${out.tail.color}, --muted-foreground is ${show(muted)}`);
  if (headStyle.fontWeight !== '500') fails.push(`"${head.textContent}" is weight ${headStyle.fontWeight}, wanted 500`);
  if (tailStyle.fontWeight !== '400') fails.push(`"${tail.textContent}" is weight ${tailStyle.fontWeight}, wanted 400`);
  const sans = first(getComputedStyle(document.documentElement).getPropertyValue('--sl-font'));
  if (out.head.family !== sans) fails.push(`the type is on ${out.head.family}, the site's sans is ${sans}`);
} else {
  fails.push('the title is not split into a head and a tail');
}

// The mark against the capitals: the stack's centre against the centre of the cap height,
// measured from the baseline the head word sits on.
if (svg && head) {
  const marker = document.createElement('span');
  marker.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
  head.append(marker);
  const baseline = marker.getBoundingClientRect().bottom;
  marker.remove();
  const style = getComputedStyle(head);
  const ruler = document.createElement('canvas').getContext('2d');
  ruler.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  const cap = ruler.measureText('H').actualBoundingBoxAscent;
  const box = svg.getBoundingClientRect();
  // The tiles run from 2 to 38 of 40, so the stack is 90% of the box, centred in it.
  const stack = box.height * 0.9;
  const tile = box.height * (23 / 40);
  out.optics = {
    markBox: Number(box.height.toFixed(2)),
    stack: Number(stack.toFixed(2)),
    tile: Number(tile.toFixed(2)),
    capHeight: Number(cap.toFixed(2)),
    stackCentre: Number((box.top + box.height / 2).toFixed(2)),
    capCentre: Number((baseline - cap / 2).toFixed(2)),
  };
  out.optics.offset = Number((out.optics.stackCentre - out.optics.capCentre).toFixed(2));
  if (Math.abs(out.optics.offset) > 1.5) fails.push(`the mark sits ${out.optics.offset}px off the capitals' centre`);
}

// The favicon is the SVG.
out.favicon = icon ? { href: icon.getAttribute('href'), type: icon.getAttribute('type') } : null;
if (!icon) fails.push('no favicon link in the head');
else if (!icon.getAttribute('href').endsWith('/favicon.svg')) fails.push(`the favicon is ${icon.getAttribute('href')}`);
else if (icon.getAttribute('type') !== 'image/svg+xml') fails.push(`the favicon is typed ${icon.getAttribute('type')}`);

out.headerHeight = $('header.header').getBoundingClientRect().height;
out.titleSize = getComputedStyle(link).fontSize;

out.verdict = fails.length
  ? `FAIL ${palette} ${theme}: ${fails.join('; ')}`
  : `PASS ${palette} ${theme}: "${out.name}" at ${out.titleSize}, back tile on --primary, front tile on the quiet ink, words on --foreground 500 and --muted-foreground 400, favicon ${out.favicon.href}, mark ${out.optics.offset}px off the capitals' centre`;
return out;
