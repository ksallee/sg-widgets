// A pasted theme shows on the Foundations and Display widgets: its shadow where the part
// stands in for an input, none where the part is a badge, a picture or a card, and its
// type and letter spacing everywhere.
//
//   pnpm qa --start --path /widgets/color-editor/ --framework both \
//     --drive tools/drives/theme-widgets.js
//
// Bubblegum and Vercel (tweakcn) go in as the theme the Themes page saves, under the shape
// apps/site/src/theme/custom.ts holds, so the page and the stage wear each as the custom
// palette. Bubblegum's shadow is a 3px offset with no blur, which nothing but a theme
// puts on a control; Vercel's is the 1px wash Tailwind's own `shadow-xs` is, which is what
// a palette naming no shadow of its own reads as. The drive runs on any widget page and
// asserts the parts that page draws; `mapped parts drawn` says how many it found, and a
// page whose widget is text alone finds none.
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
  '--radius': "0.4rem",
  '--font-sans': "Poppins, sans-serif",
  '--font-serif': "Lora, serif",
  '--font-mono': "Fira Code, monospace",
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
  '--font-sans': "Poppins, sans-serif",
  '--font-serif': "Lora, serif",
  '--font-mono': "Fira Code, monospace",
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
  '--radius': "0.5rem",
  '--font-sans': "Geist, sans-serif",
  '--font-serif': "Georgia, serif",
  '--font-mono': "Geist Mono, monospace",
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
  '--font-sans': "Geist, sans-serif",
  '--font-serif': "Georgia, serif",
  '--font-mono': "Geist Mono, monospace",
  '--shadow-2xs': "0px 1px 2px 0px hsl(0 0% 0% / 0.09)",
  '--shadow-xs': "0px 1px 2px 0px hsl(0 0% 0% / 0.09)",
  '--shadow-sm': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18)",
  '--shadow': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 1px 2px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-md': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 2px 4px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-lg': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 4px 6px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-xl': "0px 1px 2px 0px hsl(0 0% 0% / 0.18), 0px 8px 10px -1px hsl(0 0% 0% / 0.18)",
  '--shadow-2xl': "0px 1px 2px 0px hsl(0 0% 0% / 0.45)",
};

const THEMES = {
  Bubblegum: {
    light: BUBBLEGUM_LIGHT,
    dark: BUBBLEGUM_DARK,
    fonts:
      'https://fonts.googleapis.com/css2?family=Fira+Code&display=swap ' +
      'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&display=swap ' +
      'https://fonts.googleapis.com/css2?family=Lora&display=swap ' +
      'https://fonts.googleapis.com/css2?family=Lora:wght@400;500;600;700&display=swap ' +
      'https://fonts.googleapis.com/css2?family=Poppins&display=swap ' +
      'https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap',
    // The offset a field wears, which nothing but a theme puts on a control.
    field: '3px 3px 0px',
    families: ['Poppins', 'Fira Code'],
    tracking: 'normal',
  },
  Vercel: {
    light: VERCEL_LIGHT,
    dark: VERCEL_DARK,
    // Geist is self-hosted and Georgia is the machine's, so the mono face is the one asked for.
    fonts:
      'https://fonts.googleapis.com/css2?family=Geist+Mono&display=swap ' +
      'https://fonts.googleapis.com/css2?family=Geist+Mono:wght@400;500;600;700&display=swap',
    field: '0px 1px 2px',
    families: ['Geist', 'Geist Mono', 'Georgia'],
    tracking: 'normal',
  },
};

/**
 * The parts this sweep maps, and what each wears. A `field` is an input, so it takes the
 * theme's `shadow-xs`. A `flat` part takes none: a badge or a chip laid on a surface, a
 * picture, and the card tile, which the rendered reference paints flat. A painted badge's
 * hairline ring is not a shadow of the theme's and is allowed. A page draws some of them;
 * whatever it draws is read.
 */
const PARTS = [
  { name: 'the input', selector: '[data-slot="input"]', wears: 'field' },
  { name: 'the textarea', selector: '[data-slot="textarea"]', wears: 'field' },
  { name: 'the switch', selector: '[data-slot="switch"]', wears: 'field' },
  { name: "the url editor's link", selector: '[data-slot="url-editor-url"]', wears: 'field' },
  { name: "the url editor's name", selector: '[data-slot="url-editor-name"]', wears: 'field' },
  { name: "the colour editor's swatch", selector: '[data-slot="color-editor-swatch"]', wears: 'field' },
  { name: "the date editor's trigger", selector: '[data-slot="date-editor-trigger"]', wears: 'field' },
  { name: "the date-time editor's trigger", selector: '[data-slot="date-time-editor-trigger"]', wears: 'field' },
  { name: "the entity card's tile", selector: '[data-slot="entity-card"][data-variant="tile"]', wears: 'flat' },
  { name: 'the status badge', selector: '[data-slot="status-badge"]', wears: 'flat' },
  { name: 'the entity chip', selector: '[data-slot="entity-chip"]', wears: 'flat' },
  { name: 'the thumbnail', selector: '[data-slot="thumbnail"]', wears: 'flat' },
  { name: 'the avatar', selector: '[data-slot="user-avatar"] > span', wears: 'flat' },
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
  localStorage.setItem('sg-theme:custom', JSON.stringify({ label: name, css, fonts: theme.fonts, theme }));
  let tag = document.getElementById('sg-custom-palette');
  if (!tag) {
    tag = document.createElement('style');
    tag.id = 'sg-custom-palette';
    document.head.append(tag);
  }
  tag.textContent = css;
  // One stylesheet link per request, the way apps/site/src/theme/live.ts holds them.
  const hrefs = theme.fonts.split(/\s+/).filter((one) => one.length > 0);
  for (const [index, href] of hrefs.entries()) {
    const id = index === 0 ? 'sg-theme-fonts' : `sg-theme-fonts-${index}`;
    let link = document.getElementById(id);
    if (!link) {
      link = document.createElement('link');
      link.id = id;
      link.rel = 'stylesheet';
      document.head.append(link);
    }
    if (link.getAttribute('href') !== href) link.href = href;
  }
  harness.set({ palette: 'custom' });
  await until(() => document.documentElement.dataset.sgPalette === 'custom', 5000);
  await document.fonts.ready;
  await wait(600);
}

const style = (el) => el.ownerDocument.defaultView.getComputedStyle(el);
const shown = (list) => [...list].filter((el) => el.offsetParent !== null);

/** The stage of every pane on show; both are read under `--framework both`. */
const stages = () => shown(document.querySelectorAll('[data-stage]'));

/**
 * Every element of a kind on show, over every stage. A page carries a stage per demo and
 * a pane per framework, and a part is not on all of them; what matters is that every one
 * drawn wears what its kind wears.
 */
const everyOne = (selector) => stages().flatMap((stage) => shown(stage.querySelectorAll(selector)));

function check(where, what, ok, seen) {
  notes[`${where}: ${what}`] = seen;
  if (!ok) failures.push(`${where}: ${what} reads ${seen}`);
}

/** Read every part this page draws, and say how many were found. */
function readParts(name) {
  const theme = THEMES[name];
  let found = 0;
  for (const part of PARTS) {
    // A disabled control is dimmed and a readonly one drops its affordances, so the first
    // three of a kind are read rather than all of them.
    const drawn = everyOne(part.selector).slice(0, 3);
    if (drawn.length === 0) continue;
    found += drawn.length;
    for (const [index, el] of drawn.entries()) {
      const where = `${name} ${part.name} ${index}`;
      const computed = style(el);
      const shadow = computed.boxShadow;
      if (part.wears === 'flat') {
        // A painted badge carries `ring-1` as an inset hairline; what may not be there is
        // the theme's own offset.
        check(where, 'no shadow of its own', !shadow.includes(theme.field), shadow);
      } else {
        check(where, "the theme's shadow", shadow.includes(theme.field), shadow);
      }
      const family = computed.fontFamily.split(',')[0].replace(/^["']|["']$/g, '');
      check(where, "the theme's family", theme.families.includes(family), family);
      check(where, "the theme's letter spacing", computed.letterSpacing === theme.tracking, computed.letterSpacing);
    }
  }
  return found;
}

for (const name of ['Bubblegum', 'Vercel']) {
  await wear(name);
  if (document.documentElement.dataset.sgPalette !== 'custom') {
    return { verdict: `FAIL the page never wore ${name}` };
  }
  if (stages().length === 0) return { verdict: 'FAIL no stage is on show' };
  await until(() => everyOne(PARTS.map((part) => part.selector).join(',')).length > 0, 15000);
  // A page whose widget draws text alone, or a control whose box is a picker's, maps no
  // part; that is said rather than failed, so the drive runs on every page of the sweep.
  const found = readParts(name);
  notes[`${name}: mapped parts drawn`] = found;
  for (const [index, stage] of stages().entries()) {
    const computed = style(stage);
    const where = `${name} stage ${index}`;
    const family = computed.fontFamily.split(',')[0].replace(/^["']|["']$/g, '');
    check(where, "the theme's family", THEMES[name].families.includes(family), family);
    check(where, "the theme's letter spacing", computed.letterSpacing === THEMES[name].tracking, computed.letterSpacing);
  }
}

return {
  verdict: failures.length === 0 ? 'PASS the theme shows on the widgets' : `FAIL ${failures.join('; ')}`,
  notes,
};
