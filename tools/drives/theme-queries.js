// A pasted theme shows on the queries and collections widgets: its shadow on every
// bordered trigger, its type and its letter spacing on every part, and no shadow on the
// bodies, which is what tweakcn's own table and card show.
//
//   PUBLIC_SG_DEMO_BOTH=1 pnpm qa --start --path /widgets/filter-bar/ --framework both \
//     --drive tools/drives/theme-queries.js
//   ... and the same on /widgets/entity-table/ and /widgets/entity-grid/.
//
// Bubblegum and Vercel (tweakcn) go in as the theme the Themes page saves, under the
// shape apps/site/src/theme/custom.ts holds. Bubblegum's shadow is a 3px pink offset
// with no blur and its sans is Poppins, so a part that carries none of the theme shows
// at once; Vercel's is the plain 0 1px 2px wash, which is what the shipped palettes
// already read as, so it is the check that nothing moved where no theme asked it to.

const BUBBLEGUM_LIGHT = {
  '--background': "oklch(0.9399 0.0203 345.6985)",
  '--foreground': "oklch(0.4712 0 0)",
  '--card': "oklch(0.9498 0.0500 86.8891)",
  '--card-foreground': "oklch(0.4712 0 0)",
  '--popover': "oklch(1.0000 0 0)",
  '--popover-foreground': "oklch(0.4712 0 0)",
  '--primary': "oklch(0.6209 0.1801 348.1385)",
  '--primary-foreground': "oklch(1.0000 0 0)",
  '--secondary': "oklch(0.8095 0.0694 198.1863)",
  '--secondary-foreground': "oklch(0.3211 0 0)",
  '--muted': "oklch(0.8800 0.0504 212.0952)",
  '--muted-foreground': "oklch(0.5795 0 0)",
  '--accent': "oklch(0.9195 0.0801 87.6670)",
  '--accent-foreground': "oklch(0.3211 0 0)",
  '--destructive': "oklch(0.7091 0.1697 21.9551)",
  '--destructive-foreground': "oklch(1.0000 0 0)",
  '--border': "oklch(0.6209 0.1801 348.1385)",
  '--input': "oklch(0.9189 0 0)",
  '--ring': "oklch(0.7002 0.1597 350.7532)",
  '--chart-1': "oklch(0.7002 0.1597 350.7532)",
  '--chart-2': "oklch(0.8189 0.0799 212.0892)",
  '--chart-3': "oklch(0.9195 0.0801 87.6670)",
  '--chart-4': "oklch(0.7998 0.1110 348.1791)",
  '--chart-5': "oklch(0.6197 0.1899 353.9091)",
  '--radius': "0.4rem",
  '--sidebar': "oklch(0.9140 0.0424 343.0913)",
  '--sidebar-foreground': "oklch(0.3211 0 0)",
  '--sidebar-primary': "oklch(0.6559 0.2118 354.3084)",
  '--sidebar-primary-foreground': "oklch(1.0000 0 0)",
  '--sidebar-accent': "oklch(0.8228 0.1095 346.0184)",
  '--sidebar-accent-foreground': "oklch(0.3211 0 0)",
  '--sidebar-border': "oklch(0.9464 0.0327 307.1745)",
  '--sidebar-ring': "oklch(0.6559 0.2118 354.3084)",
  '--font-sans': "Poppins, sans-serif",
  '--font-serif': "Lora, serif",
  '--font-mono': "Fira Code, monospace",
  '--shadow-color': "hsl(325.78 58.18% 56.86% / 0.5)",
  '--shadow-opacity': "1.0",
  '--shadow-blur': "0px",
  '--shadow-spread': "0px",
  '--shadow-offset-x': "3px",
  '--shadow-offset-y': "3px",
  '--letter-spacing': "0em",
  '--spacing': "0.25rem",
  '--shadow-2xs': "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 0.50)",
  '--shadow-xs': "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 0.50)",
  '--shadow-sm': "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 1px 2px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)",
  '--shadow': "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 1px 2px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)",
  '--shadow-md': "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 2px 4px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)",
  '--shadow-lg': "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 4px 6px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)",
  '--shadow-xl': "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 8px 10px -1px hsl(325.7800 58.1800% 56.8600% / 1.00)",
  '--shadow-2xl': "3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 2.50)",
  '--tracking-normal': "0em",
};

const BUBBLEGUM_DARK = {
  '--background': "oklch(0.2497 0.0305 234.1628)",
  '--foreground': "oklch(0.9306 0.0197 349.0785)",
  '--card': "oklch(0.2902 0.0299 233.5352)",
  '--card-foreground': "oklch(0.9306 0.0197 349.0785)",
  '--popover': "oklch(0.2902 0.0299 233.5352)",
  '--popover-foreground': "oklch(0.9306 0.0197 349.0785)",
  '--primary': "oklch(0.9195 0.0801 87.6670)",
  '--primary-foreground': "oklch(0.2497 0.0305 234.1628)",
  '--secondary': "oklch(0.7794 0.0803 4.1330)",
  '--secondary-foreground': "oklch(0.2497 0.0305 234.1628)",
  '--muted': "oklch(0.2713 0.0086 255.5780)",
  '--muted-foreground': "oklch(0.7794 0.0803 4.1330)",
  '--accent': "oklch(0.6699 0.0988 356.9762)",
  '--accent-foreground': "oklch(0.9306 0.0197 349.0785)",
  '--destructive': "oklch(0.6702 0.1806 350.3599)",
  '--destructive-foreground': "oklch(0.2497 0.0305 234.1628)",
  '--border': "oklch(0.3907 0.0399 242.2181)",
  '--input': "oklch(0.3093 0.0305 232.0027)",
  '--ring': "oklch(0.6998 0.0896 201.8672)",
  '--chart-1': "oklch(0.6998 0.0896 201.8672)",
  '--chart-2': "oklch(0.7794 0.0803 4.1330)",
  '--chart-3': "oklch(0.6699 0.0988 356.9762)",
  '--chart-4': "oklch(0.4408 0.0702 217.0848)",
  '--chart-5': "oklch(0.2713 0.0086 255.5780)",
  '--sidebar': "oklch(0.2303 0.0270 235.9743)",
  '--sidebar-foreground': "oklch(0.9670 0.0029 264.5419)",
  '--sidebar-primary': "oklch(0.6559 0.2118 354.3084)",
  '--sidebar-primary-foreground': "oklch(1.0000 0 0)",
  '--sidebar-accent': "oklch(0.8228 0.1095 346.0184)",
  '--sidebar-accent-foreground': "oklch(0.2781 0.0296 256.8480)",
  '--sidebar-border': "oklch(0.3729 0.0306 259.7328)",
  '--sidebar-ring': "oklch(0.6559 0.2118 354.3084)",
  '--font-sans': "Poppins, sans-serif",
  '--font-serif': "Lora, serif",
  '--font-mono': "Fira Code, monospace",
  '--shadow-color': "#324859",
  '--shadow-opacity': "1.0",
  '--shadow-blur': "0px",
  '--shadow-spread': "0px",
  '--shadow-offset-x': "3px",
  '--shadow-offset-y': "3px",
  '--letter-spacing': "0em",
  '--spacing': "0.25rem",
  '--shadow-2xs': "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 0.50)",
  '--shadow-xs': "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 0.50)",
  '--shadow-sm': "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 1px 2px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)",
  '--shadow': "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 1px 2px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)",
  '--shadow-md': "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 2px 4px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)",
  '--shadow-lg': "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 4px 6px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)",
  '--shadow-xl': "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 8px 10px -1px hsl(206.1538 28.0576% 27.2549% / 1.00)",
  '--shadow-2xl': "3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 2.50)",
};

const VERCEL_LIGHT = {
  '--background': "oklch(0.9900 0 0)",
  '--foreground': "oklch(0 0 0)",
  '--card': "oklch(1 0 0)",
  '--card-foreground': "oklch(0 0 0)",
  '--popover': "oklch(0.9900 0 0)",
  '--popover-foreground': "oklch(0 0 0)",
  '--primary': "oklch(0 0 0)",
  '--primary-foreground': "oklch(1 0 0)",
  '--secondary': "oklch(0.9400 0 0)",
  '--secondary-foreground': "oklch(0 0 0)",
  '--muted': "oklch(0.9700 0 0)",
  '--muted-foreground': "oklch(0.4400 0 0)",
  '--accent': "oklch(0.9400 0 0)",
  '--accent-foreground': "oklch(0 0 0)",
  '--destructive': "oklch(0.6300 0.1900 23.0300)",
  '--destructive-foreground': "oklch(1 0 0)",
  '--border': "oklch(0.9200 0 0)",
  '--input': "oklch(0.9400 0 0)",
  '--ring': "oklch(0 0 0)",
  '--chart-1': "oklch(0.8100 0.1700 75.3500)",
  '--chart-2': "oklch(0.5500 0.2200 264.5300)",
  '--chart-3': "oklch(0.7200 0 0)",
  '--chart-4': "oklch(0.9200 0 0)",
  '--chart-5': "oklch(0.5600 0 0)",
  '--radius': "0.5rem",
  '--sidebar': "oklch(0.9900 0 0)",
  '--sidebar-foreground': "oklch(0 0 0)",
  '--sidebar-primary': "oklch(0 0 0)",
  '--sidebar-primary-foreground': "oklch(1 0 0)",
  '--sidebar-accent': "oklch(0.9400 0 0)",
  '--sidebar-accent-foreground': "oklch(0 0 0)",
  '--sidebar-border': "oklch(0.9400 0 0)",
  '--sidebar-ring': "oklch(0 0 0)",
  '--font-sans': "Geist, sans-serif",
  '--font-serif': "Georgia, serif",
  '--font-mono': "Geist Mono, monospace",
  '--shadow-color': "hsl(0 0% 0%)",
  '--shadow-opacity': "0.18",
  '--shadow-blur': "2px",
  '--shadow-spread': "0px",
  '--shadow-offset-x': "0px",
  '--shadow-offset-y': "1px",
  '--letter-spacing': "0em",
  '--spacing': "0.25rem",
  '--shadow-2xs': "0px 1px 2px 0px hsl(0 0% 0% / 0.09)",
  '--shadow-xs': "0px 1px 2px 0px hsl(0 0% 0% / 0.09)",
  '--shadow-sm': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18)",
  '--shadow': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-md': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 2px 4px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-lg': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 4px 6px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-xl': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 8px 10px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-2xl': "0px 1px 2px 0px hsl(0 0% 0% / 0.45)",
  '--tracking-normal': "0em",
};

const VERCEL_DARK = {
  '--background': "oklch(0 0 0)",
  '--foreground': "oklch(1 0 0)",
  '--card': "oklch(0.1400 0 0)",
  '--card-foreground': "oklch(1 0 0)",
  '--popover': "oklch(0.1800 0 0)",
  '--popover-foreground': "oklch(1 0 0)",
  '--primary': "oklch(1 0 0)",
  '--primary-foreground': "oklch(0 0 0)",
  '--secondary': "oklch(0.2500 0 0)",
  '--secondary-foreground': "oklch(1 0 0)",
  '--muted': "oklch(0.2300 0 0)",
  '--muted-foreground': "oklch(0.7200 0 0)",
  '--accent': "oklch(0.3200 0 0)",
  '--accent-foreground': "oklch(1 0 0)",
  '--destructive': "oklch(0.6900 0.2000 23.9100)",
  '--destructive-foreground': "oklch(0 0 0)",
  '--border': "oklch(0.2600 0 0)",
  '--input': "oklch(0.3200 0 0)",
  '--ring': "oklch(0.7200 0 0)",
  '--chart-1': "oklch(0.8100 0.1700 75.3500)",
  '--chart-2': "oklch(0.5800 0.2100 260.8400)",
  '--chart-3': "oklch(0.5600 0 0)",
  '--chart-4': "oklch(0.4400 0 0)",
  '--chart-5': "oklch(0.9200 0 0)",
  '--sidebar': "oklch(0.1800 0 0)",
  '--sidebar-foreground': "oklch(1 0 0)",
  '--sidebar-primary': "oklch(1 0 0)",
  '--sidebar-primary-foreground': "oklch(0 0 0)",
  '--sidebar-accent': "oklch(0.3200 0 0)",
  '--sidebar-accent-foreground': "oklch(1 0 0)",
  '--sidebar-border': "oklch(0.3200 0 0)",
  '--sidebar-ring': "oklch(0.7200 0 0)",
  '--font-sans': "Geist, sans-serif",
  '--font-serif': "Georgia, serif",
  '--font-mono': "Geist Mono, monospace",
  '--shadow-color': "hsl(0 0% 0%)",
  '--shadow-opacity': "0.18",
  '--shadow-blur': "2px",
  '--shadow-spread': "0px",
  '--shadow-offset-x': "0px",
  '--shadow-offset-y': "1px",
  '--letter-spacing': "0em",
  '--spacing': "0.25rem",
  '--shadow-2xs': "0px 1px 2px 0px hsl(0 0% 0% / 0.09)",
  '--shadow-xs': "0px 1px 2px 0px hsl(0 0% 0% / 0.09)",
  '--shadow-sm': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18)",
  '--shadow': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-md': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 2px 4px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-lg': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 4px 6px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-xl': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 8px 10px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-2xl': "0px 1px 2px 0px hsl(0 0% 0% / 0.45)",
};

/** The Google Fonts request each theme's type needs, as apps/site/src/theme/fonts.ts writes it. */
const FONTS = {
  Bubblegum:
    'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap',
  Vercel:
    'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&family=Georgia:wght@400;500;600;700&display=swap',
};

const THEMES = {
  Bubblegum: {
    light: BUBBLEGUM_LIGHT,
    dark: BUBBLEGUM_DARK,
    // The offset the theme's own `--shadow-xs` resolves to, which nothing else draws.
    offset: '3px 3px 0px',
    family: 'Poppins',
    // `0em` is what the browser reports back as `normal`.
    tracking: 'normal',
  },
  Vercel: {
    light: VERCEL_LIGHT,
    dark: VERCEL_DARK,
    offset: '0px 1px 2px',
    // Geist is self-hosted, so the stack's first family is served already.
    family: 'Geist',
    tracking: 'normal',
  },
};

/**
 * The parts this sweep mapped, by the shadcn part each one is.
 *
 * `shadow` is a bordered trigger, which is the outline button: it carries the theme's
 * `shadow-xs`. `flat` is an inline region in the page flow — a table, a grid, a tree, a
 * grouped list, and a card tile — which carries none, since tweakcn's own table and card
 * carry none either. Both wear the theme's family and letter spacing.
 */
const PARTS = [
  { name: "the filter bar's facet pill", selector: '[data-slot="filter-pill"]', kind: 'shadow' },
  { name: "the filter dialog's launcher", selector: '[data-slot="filter-launch"]', kind: 'shadow' },
  { name: "the sort picker's trigger", selector: '[data-slot="sort-trigger"]', kind: 'shadow' },
  { name: "the demo toolbar's button", selector: '[data-stage] button[aria-pressed]', kind: 'shadow' },
  { name: "the table's body", selector: '[data-slot="entity-table-scroll"]', kind: 'flat' },
  { name: "the grid's body", selector: '[data-slot="entity-grid-scroll"]', kind: 'flat' },
  { name: 'a grid tile', selector: '[data-slot="entity-card"]', kind: 'flat' },
];

const failures = [];
const notes = {};

async function until(read, ms = 20000) {
  const end = Date.now() + ms;
  for (;;) {
    const value = read();
    if (value) return value;
    if (Date.now() > end) return null;
    await wait(50);
  }
}

const body = (tokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');

/** The block themes.css would hold for this palette, which is what the Themes page stores. */
function themesCss(theme, slug) {
  return [
    `.sg-demo[data-theme='${slug}'],\n:root[data-sg-palette='${slug}'] {\n${body(theme.light)}\n}`,
    `.sg-demo[data-theme='${slug}'].dark,\n:root[data-sg-palette='${slug}'][data-theme='dark'] {\n${body(theme.dark)}\n}`,
  ].join('\n\n');
}

/** Wear a theme the way a save on /themes does, and wait for its type to arrive. */
async function wear(name) {
  const theme = THEMES[name];
  const css = themesCss(theme, 'custom');
  const fonts = FONTS[name];
  localStorage.setItem('sg-theme:custom', JSON.stringify({ label: name, css, fonts, theme }));
  let tag = document.getElementById('sg-custom-palette');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'sg-custom-palette';
    document.head.append(tag);
  }
  tag.textContent = css;
  let link = document.getElementById('sg-theme-fonts');
  if (!link) {
    link = document.createElement('link');
    link.id = 'sg-theme-fonts';
    link.rel = 'stylesheet';
    document.head.append(link);
  }
  if (link.getAttribute('href') !== fonts) link.href = fonts;
  harness.set({ palette: 'custom' });
  await until(() => document.documentElement.dataset.sgPalette === 'custom', 5000);
  await document.fonts.ready;
  await wait(500);
}

const style = (el) => el.ownerDocument.defaultView.getComputedStyle(el);
const shown = (list) => [...list].filter((el) => el.offsetParent !== null);
/** The stage of every pane on show; both are read under `--framework both`. */
const stages = () => shown(document.querySelectorAll('[data-stage]'));
/** Every element of a kind on show, over every stage. */
const everyOne = (selector) =>
  selector.startsWith('[data-stage]')
    ? shown(document.querySelectorAll(selector))
    : stages().flatMap((stage) => shown(stage.querySelectorAll(selector)));

function check(where, what, ok, seen) {
  notes[`${where}: ${what}`] = seen;
  if (!ok) failures.push(`${where}: ${what} reads ${seen}`);
}

/** Read one part under one theme: its shadow, its family and its letter spacing. */
function read(theme, part, drawn) {
  // One of each is enough: a page draws many, and they share one class string.
  const el = drawn[0];
  const where = `${theme.label} ${part.name}`;
  const seen = style(el).boxShadow;
  if (part.kind === 'shadow') {
    check(where, 'the shadow', seen.includes(theme.offset), seen);
  } else {
    check(where, 'no shadow of its own', seen === 'none' || !seen.includes(theme.offset), seen);
  }
  const family = style(el).fontFamily;
  check(where, 'the family', family.replace(/["']/g, '').startsWith(theme.family), family);
  const tracking = style(el).letterSpacing;
  check(where, 'the letter spacing', tracking === theme.tracking, tracking);
}

/** Every part of this page, under one theme. At least one has to be on it. */
async function sweep(label) {
  await wear(label);
  const theme = { ...THEMES[label], label };
  if (document.documentElement.dataset.sgPalette !== 'custom') {
    failures.push(`${label}: the page never wore the pasted theme`);
    return 0;
  }
  let found = 0;
  for (const part of PARTS) {
    const drawn = everyOne(part.selector);
    if (drawn.length === 0) continue;
    found += 1;
    read(theme, part, drawn);
  }
  return found;
}

if (stages().length === 0) return { verdict: 'FAIL no stage is on show' };
// The demos read before they draw; the widget's own body is what says they landed.
await until(
  () => everyOne('[data-slot="filter-pill"],[data-slot="entity-table-scroll"],[data-slot="entity-grid-scroll"]').length > 0,
  20000,
);

const onBubblegum = await sweep('Bubblegum');
if (onBubblegum === 0) return { verdict: 'FAIL this page draws none of the mapped parts' };
await sweep('Vercel');

return {
  verdict:
    failures.length === 0
      ? `PASS the theme shows on ${onBubblegum} mapped parts`
      : `FAIL ${failures.join('; ')}`,
  notes,
};
