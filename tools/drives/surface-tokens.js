// Every surface a widget paints wears the token its role names, read on a theme whose
// card, popover and page are three different colours.
//
//   PUBLIC_SG_DEMO_BOTH=1 pnpm qa --start --path /widgets/entity-card/ --framework both \
//     --drive tools/drives/surface-tokens.js
//
// Bubblegum (tweakcn) goes in as the theme the Themes page saves, under the shape
// apps/site/src/theme/custom.ts holds, so every page wears it as the custom palette: in
// light the page is pink, a card cream and a popover white. The card page is read where it
// stands; the grid and a picker open in same-origin frames, which palette-boot dresses from
// the same stored theme.
//
// A card surface must read the card token, a floating surface the popover token, and a
// region in the page flow the background token. A badge paints nothing of its own, so it is
// read through to the surface under it.

const LIGHT = {
  '--background': 'oklch(0.9399 0.0203 345.6985)',
  '--foreground': 'oklch(0.4712 0 0)',
  '--card': 'oklch(0.9498 0.0500 86.8891)',
  '--card-foreground': 'oklch(0.4712 0 0)',
  '--popover': 'oklch(1.0000 0 0)',
  '--popover-foreground': 'oklch(0.4712 0 0)',
  '--primary': 'oklch(0.6209 0.1801 348.1385)',
  '--primary-foreground': 'oklch(1.0000 0 0)',
  '--secondary': 'oklch(0.8095 0.0694 198.1863)',
  '--secondary-foreground': 'oklch(0.3211 0 0)',
  '--muted': 'oklch(0.8800 0.0504 212.0952)',
  '--muted-foreground': 'oklch(0.5795 0 0)',
  '--accent': 'oklch(0.9195 0.0801 87.6670)',
  '--accent-foreground': 'oklch(0.3211 0 0)',
  '--destructive': 'oklch(0.7091 0.1697 21.9551)',
  '--destructive-foreground': 'oklch(1.0000 0 0)',
  '--border': 'oklch(0.6209 0.1801 348.1385)',
  '--input': 'oklch(0.9189 0 0)',
  '--ring': 'oklch(0.7002 0.1597 350.7532)',
  '--radius': '0.4rem',
};

const DARK = {
  '--background': 'oklch(0.2497 0.0305 234.1628)',
  '--foreground': 'oklch(0.9306 0.0197 349.0785)',
  '--card': 'oklch(0.2902 0.0299 233.5352)',
  '--card-foreground': 'oklch(0.9306 0.0197 349.0785)',
  '--popover': 'oklch(0.2902 0.0299 233.5352)',
  '--popover-foreground': 'oklch(0.9306 0.0197 349.0785)',
  '--primary': 'oklch(0.9195 0.0801 87.6670)',
  '--primary-foreground': 'oklch(0.2497 0.0305 234.1628)',
  '--secondary': 'oklch(0.7794 0.0803 4.1330)',
  '--secondary-foreground': 'oklch(0.2497 0.0305 234.1628)',
  '--muted': 'oklch(0.2713 0.0086 255.5780)',
  '--muted-foreground': 'oklch(0.7794 0.0803 4.1330)',
  '--accent': 'oklch(0.6699 0.0988 356.9762)',
  '--accent-foreground': 'oklch(0.9306 0.0197 349.0785)',
  '--destructive': 'oklch(0.6702 0.1806 350.3599)',
  '--destructive-foreground': 'oklch(0.2497 0.0305 234.1628)',
  '--border': 'oklch(0.3907 0.0399 242.2181)',
  '--input': 'oklch(0.3093 0.0305 232.0027)',
  '--ring': 'oklch(0.6998 0.0896 201.8672)',
};

const failures = [];
const notes = {};

const body = (tokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');

/** The block themes.css would hold for this palette, which is what the Themes page stores. */
function themesCss(slug) {
  const dark = { ...DARK };
  delete dark['--radius'];
  return [
    `.sg-demo[data-theme='${slug}'],\n:root[data-sg-palette='${slug}'] {\n${body(LIGHT)}\n}`,
    `.sg-demo[data-theme='${slug}'].dark,\n:root[data-sg-palette='${slug}'][data-theme='dark'] {\n${body(dark)}\n}`,
  ].join('\n\n');
}

async function until(read, ms = 15000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

function pointer(el) {
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerType: 'mouse' }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerType: 'mouse' }));
}

/** Base UI opens on a click, Bits UI on pointerdown, and one answers where the other does not. */
async function press(el, listed) {
  for (const gesture of [() => el.click(), () => pointer(el)]) {
    gesture();
    const found = await until(() => listed(), 3000);
    if (found) return found;
  }
  return null;
}

/** Load a page of this site into a frame and answer its document. */
async function frame(path) {
  const el = document.createElement('iframe');
  el.style.cssText = 'position:fixed;left:0;top:0;width:1200px;height:2000px;opacity:0;z-index:-1';
  el.src = path;
  const ready = new Promise((resolve) => el.addEventListener('load', resolve, { once: true }));
  document.body.appendChild(el);
  await ready;
  return { doc: el.contentDocument, close: () => el.remove() };
}

const NOTHING = ['rgba(0, 0, 0, 0)', 'transparent'];
const paintOf = (el) => el.ownerDocument.defaultView.getComputedStyle(el).backgroundColor;
const paints = (el) => !NOTHING.includes(paintOf(el));

/**
 * What one token paints, in the element's own place in the tree: a stage carries the
 * palette on itself and a portalled popup reads it off the root, so the probe stands where
 * the surface it is measured against stands.
 */
function token(el, name) {
  const doc = el.ownerDocument;
  const probe = doc.createElement('div');
  probe.style.setProperty('background-color', `var(${name})`);
  (el.parentElement ?? doc.body).append(probe);
  const value = paintOf(probe);
  probe.remove();
  return value;
}

/** The surface an element reads on: its own paint, or the first ancestor that paints one. */
function surfaceOf(el) {
  for (let node = el; node; node = node.parentElement) {
    if (paints(node)) return paintOf(node);
  }
  return 'nothing';
}

function check(where, what, expected, actual) {
  if (expected !== actual) failures.push(`${where}: ${what} reads ${actual}, expected ${expected}`);
}

/** Every surface named on one page, per framework. */
async function readPage(doc, where, read) {
  const panes = [...doc.querySelectorAll('[data-pane]')].filter((pane) => pane.offsetParent !== null);
  if (panes.length === 0) failures.push(`${where}: no pane is on show`);
  for (const pane of panes) {
    const seen = await read(pane, `${where} ${pane.dataset.pane}`);
    notes[`${where} ${pane.dataset.pane}`] = seen;
  }
}

/* ------------------------------------------------------------------ the theme */

const css = themesCss('custom');
localStorage.setItem('sg-theme:custom', JSON.stringify({ label: 'Bubblegum', css, theme: { light: LIGHT, dark: DARK } }));
// palette-boot writes this tag before the first paint; this page is already past it.
let tag = document.getElementById('sg-custom-palette');
if (!tag) {
  tag = document.createElement('style');
  tag.id = 'sg-custom-palette';
  document.head.append(tag);
}
tag.textContent = css;
harness.set({ palette: 'custom' });
await wait(400);
if (document.documentElement.dataset.sgPalette !== 'custom') {
  return { verdict: `FAIL the page wears ${document.documentElement.dataset.sgPalette}, not the pasted theme` };
}

/* -------------------------------------------------------------- the card page */

await readPage(document, 'entity-card', async (pane, where) => {
  const tile = await until(() => pane.querySelector('[data-slot="entity-card"][data-variant="tile"]'));
  if (!tile) {
    failures.push(`${where}: no tile was drawn`);
    return null;
  }
  const card = token(pane, '--card');
  const background = token(pane, '--background');
  const popover = token(pane, '--popover');
  if (card === background) {
    failures.push(`${where}: the theme did not land, card and background are both ${card}`);
    return null;
  }

  // A tile is a card and paints one itself. A selected tile wears the accent instead.
  const tiles = [...pane.querySelectorAll('[data-slot="entity-card"][data-variant="tile"]')].filter(
    (el) => el.dataset.state !== 'selected',
  );
  for (const el of tiles) check(where, 'the tile', card, paintOf(el));

  // The card variant paints no surface: it wears the one it is framed on, a card here.
  const cards = [...pane.querySelectorAll('[data-slot="entity-card"][data-variant="card"]')];
  if (cards.length === 0) failures.push(`${where}: no card variant was drawn`);
  for (const el of cards) {
    if (paints(el)) failures.push(`${where}: the card variant paints ${paintOf(el)} of its own`);
    check(where, 'the card variant', card, surfaceOf(el));
  }

  // A badge on a card reads the card, not the page. The chrome over a tile's picture is a
  // scrim rather than a surface and is left out.
  const badges = [...pane.querySelectorAll('[data-slot="status-badge"]')].filter(
    (el) => !el.closest('[data-slot="entity-card-media"]'),
  );
  if (badges.length === 0) failures.push(`${where}: no badge was drawn to read`);
  for (const el of badges) {
    if (paints(el)) failures.push(`${where}: a badge paints ${paintOf(el)} of its own`);
    check(where, 'a badge on a card', card, surfaceOf(el));
  }
  return { card, background, popover, tiles: tiles.length, cards: cards.length, badges: badges.length };
});

/* -------------------------------------------------------------- the grid page */

const grid = await frame('/widgets/entity-grid/');
await readPage(grid.doc, 'entity-grid', async (pane, where) => {
  const tile = await until(() => pane.querySelector('[data-slot="entity-grid"] [data-variant="tile"]'));
  if (!tile) {
    failures.push(`${where}: no tile was drawn`);
    return null;
  }
  const card = token(pane, '--card');
  const background = token(pane, '--background');
  const tiles = [...pane.querySelectorAll('[data-slot="entity-grid"] [data-variant="tile"]')].filter(
    (el) => el.dataset.state !== 'selected',
  );
  for (const el of tiles) check(where, 'the grid tile', card, paintOf(el));

  // The viewport the tiles are laid out in is a region of the page, not a card.
  const scroll = pane.querySelector('[data-slot="entity-grid-scroll"]');
  if (!scroll) failures.push(`${where}: the grid has no scroll region`);
  else check(where, 'the grid viewport', background, surfaceOf(scroll));
  return { card, background, tiles: tiles.length };
});
grid.close();

/* ------------------------------------------------------------ the picker page */

const picker = await frame('/widgets/entity-picker/');
await readPage(picker.doc, 'entity-picker', async (pane, where) => {
  const control = await until(() => {
    const el = pane.querySelector('[data-slot="entity-picker-control"]');
    return el && el.getClientRects().length > 0 ? el : null;
  });
  if (!control) {
    failures.push(`${where}: no picker control was drawn`);
    return null;
  }
  const background = token(control, '--background');

  // A picker control is a region in the page flow.
  check(where, 'the picker control', background, paintOf(control));

  const live = () => {
    const popup = [...picker.doc.querySelectorAll('[data-picker="entity"]')].find(
      (el) => !el.closest('[data-closed]') && !el.dataset.closed && el.getClientRects().length > 0,
    );
    return popup ?? null;
  };
  const popup = await press(control, live);
  if (!popup) {
    failures.push(`${where}: the picker list would not open`);
    return { background };
  }
  // A popup is a floating surface, wherever it is portalled to.
  const popover = token(popup, '--popover');
  check(where, 'the picker popup', popover, paintOf(popup));

  // Anything drawn inside it reads the popover, badges included.
  const inside = [...popup.querySelectorAll('[data-slot="status-badge"]')];
  for (const el of inside) check(where, 'a badge in the popup', popover, surfaceOf(el));
  (picker.doc.activeElement ?? picker.doc.body).dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return { background, popover, badges: inside.length };
});
picker.close();

/* ------------------------------------------------------------------ the shots */

// The shot that follows this drive is of the card page: put its demo under the viewport.
document.querySelector('[data-sg-demo]')?.scrollIntoView({ block: 'start' });
await wait(300);

return failures.length > 0
  ? { verdict: `FAIL ${failures.length} surfaces wear the wrong token`, failures, notes }
  : { verdict: 'PASS every card, popover and page surface wears its own token', notes };
