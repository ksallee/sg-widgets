// A pasted theme shows on the primitives: its shadow on a button and an input, its
// letter spacing on the page and on the stage, its family on the stage.
//
//   pnpm qa --start --path /widgets/entity-table/ --framework both \
//     --drive tools/drives/theme-classes.js
//
// Bubblegum and Notebook (tweakcn) go in as the theme the Themes page saves, under the
// shape apps/site/src/theme/custom.ts holds, so the page and the stage wear each as the
// custom palette. Bubblegum's shadow is a 3px pink offset with no blur and its sans is
// Poppins; Notebook's spacing is 0.5px, which is what a theme's tracking moves. The
// two are read one after the other on one load.
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

const NOTEBOOK_LIGHT = {
  '--background': "oklch(0.9821 0 0)",
  '--foreground': "oklch(0.3485 0 0)",
  '--card': "oklch(1.0000 0 0)",
  '--card-foreground': "oklch(0.3485 0 0)",
  '--popover': "oklch(1.0000 0 0)",
  '--popover-foreground': "oklch(0.3485 0 0)",
  '--primary': "oklch(0.4891 0 0)",
  '--primary-foreground': "oklch(0.9551 0 0)",
  '--secondary': "oklch(0.9006 0 0)",
  '--secondary-foreground': "oklch(0.3485 0 0)",
  '--muted': "oklch(0.9158 0 0)",
  '--muted-foreground': "oklch(0.4313 0 0)",
  '--accent': "oklch(0.9354 0.0456 94.8549)",
  '--accent-foreground': "oklch(0.4015 0.0436 37.9587)",
  '--destructive': "oklch(0.6627 0.0978 20.0041)",
  '--destructive-foreground': "oklch(1.0000 0 0)",
  '--border': "oklch(0.5538 0.0025 17.2320)",
  '--input': "oklch(1.0000 0 0)",
  '--ring': "oklch(0.7058 0 0)",
  '--chart-1': "oklch(0.3211 0 0)",
  '--chart-2': "oklch(0.4495 0 0)",
  '--chart-3': "oklch(0.5693 0 0)",
  '--chart-4': "oklch(0.6830 0 0)",
  '--chart-5': "oklch(0.7921 0 0)",
  '--radius': "0.625rem",
  '--sidebar': "oklch(0.9551 0 0)",
  '--sidebar-foreground': "oklch(0.3485 0 0)",
  '--sidebar-primary': "oklch(0.4891 0 0)",
  '--sidebar-primary-foreground': "oklch(0.9551 0 0)",
  '--sidebar-accent': "oklch(0.9354 0.0456 94.8549)",
  '--sidebar-accent-foreground': "oklch(0.4015 0.0436 37.9587)",
  '--sidebar-border': "oklch(0.8078 0 0)",
  '--sidebar-ring': "oklch(0.7058 0 0)",
  '--font-sans': "Architects Daughter, sans-serif",
  '--font-serif': "\"Times New Roman\", Times, serif",
  '--font-mono': "\"Courier New\", Courier, monospace",
  '--shadow-color': "#000000",
  '--shadow-opacity': "0.03",
  '--shadow-blur': "5px",
  '--shadow-spread': "0px",
  '--shadow-offset-x': "1px",
  '--shadow-offset-y': "4px",
  '--letter-spacing': "0.5px",
  '--spacing': "0.25rem",
  '--shadow-2xs': "1px 4px 5px 0px hsl(0 0% 0% / 0.01)",
  '--shadow-xs': "1px 4px 5px 0px hsl(0 0% 0% / 0.01)",
  '--shadow-sm': "1px 4px 5px 0px hsl(0 0% 0% / 0.03), 1px 1px 2px -1px hsl(0 0% 0% / 0.03)",
  '--shadow': "1px 4px 5px 0px hsl(0 0% 0% / 0.03), 1px 1px 2px -1px hsl(0 0% 0% / 0.03)",
  '--shadow-md': "1px 4px 5px 0px hsl(0 0% 0% / 0.03), 1px 2px 4px -1px hsl(0 0% 0% / 0.03)",
  '--shadow-lg': "1px 4px 5px 0px hsl(0 0% 0% / 0.03), 1px 4px 6px -1px hsl(0 0% 0% / 0.03)",
  '--shadow-xl': "1px 4px 5px 0px hsl(0 0% 0% / 0.03), 1px 8px 10px -1px hsl(0 0% 0% / 0.03)",
  '--shadow-2xl': "1px 4px 5px 0px hsl(0 0% 0% / 0.07)",
  '--tracking-normal': "0.5px",
};

const NOTEBOOK_DARK = {
  '--background': "oklch(0.2891 0 0)",
  '--foreground': "oklch(0.8945 0 0)",
  '--card': "oklch(0.3211 0 0)",
  '--card-foreground': "oklch(0.8945 0 0)",
  '--popover': "oklch(0.3211 0 0)",
  '--popover-foreground': "oklch(0.8945 0 0)",
  '--primary': "oklch(0.7572 0 0)",
  '--primary-foreground': "oklch(0.2891 0 0)",
  '--secondary': "oklch(0.4676 0 0)",
  '--secondary-foreground': "oklch(0.8078 0 0)",
  '--muted': "oklch(0.3904 0 0)",
  '--muted-foreground': "oklch(0.7058 0 0)",
  '--accent': "oklch(0.9067 0 0)",
  '--accent-foreground': "oklch(0.3211 0 0)",
  '--destructive': "oklch(0.7915 0.0491 18.2410)",
  '--destructive-foreground': "oklch(0.2891 0 0)",
  '--border': "oklch(0.4276 0 0)",
  '--input': "oklch(0.3211 0 0)",
  '--ring': "oklch(0.8078 0 0)",
  '--chart-1': "oklch(0.9521 0 0)",
  '--chart-2': "oklch(0.8576 0 0)",
  '--chart-3': "oklch(0.7572 0 0)",
  '--chart-4': "oklch(0.6534 0 0)",
  '--chart-5': "oklch(0.5452 0 0)",
  '--sidebar': "oklch(0.2478 0 0)",
  '--sidebar-foreground': "oklch(0.8945 0 0)",
  '--sidebar-primary': "oklch(0.7572 0 0)",
  '--sidebar-primary-foreground': "oklch(0.2478 0 0)",
  '--sidebar-accent': "oklch(0.9067 0 0)",
  '--sidebar-accent-foreground': "oklch(0.3211 0 0)",
  '--sidebar-border': "oklch(0.4276 0 0)",
  '--sidebar-ring': "oklch(0.8078 0 0)",
  '--font-sans': "Architects Daughter, sans-serif",
  '--font-serif': "Georgia, serif",
  '--font-mono': "\"Fira Code\", \"Courier New\", monospace",
  '--shadow-color': "#000000",
  '--shadow-opacity': "0.03",
  '--shadow-blur': "5px",
  '--shadow-spread': "0px",
  '--shadow-offset-x': "1px",
  '--shadow-offset-y': "4px",
  '--letter-spacing': "0.5px",
  '--spacing': "0.25rem",
  '--shadow-2xs': "1px 4px 5px 0px hsl(0 0% 0% / 0.01)",
  '--shadow-xs': "1px 4px 5px 0px hsl(0 0% 0% / 0.01)",
  '--shadow-sm': "1px 4px 5px 0px hsl(0 0% 0% / 0.03), 1px 1px 2px -1px hsl(0 0% 0% / 0.03)",
  '--shadow': "1px 4px 5px 0px hsl(0 0% 0% / 0.03), 1px 1px 2px -1px hsl(0 0% 0% / 0.03)",
  '--shadow-md': "1px 4px 5px 0px hsl(0 0% 0% / 0.03), 1px 2px 4px -1px hsl(0 0% 0% / 0.03)",
  '--shadow-lg': "1px 4px 5px 0px hsl(0 0% 0% / 0.03), 1px 4px 6px -1px hsl(0 0% 0% / 0.03)",
  '--shadow-xl': "1px 4px 5px 0px hsl(0 0% 0% / 0.03), 1px 8px 10px -1px hsl(0 0% 0% / 0.03)",
  '--shadow-2xl': "1px 4px 5px 0px hsl(0 0% 0% / 0.07)",
};

/** The Google Fonts request each theme's type needs, as apps/site/src/theme/fonts.ts writes it. */
const FONTS = {
  Bubblegum:
    'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=Lora:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap',
  Notebook:
    'https://fonts.googleapis.com/css2?family=Architects+Daughter:wght@400;500;600;700&display=swap',
};

const THEMES = {
  Bubblegum: { light: BUBBLEGUM_LIGHT, dark: BUBBLEGUM_DARK },
  Notebook: { light: NOTEBOOK_LIGHT, dark: NOTEBOOK_DARK },
};

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
  await wait(400);
}

const style = (el) => el.ownerDocument.defaultView.getComputedStyle(el);
const shown = (list) => [...list].filter((el) => el.offsetParent !== null);

/** The stage of every pane on show; both are read under `--framework both`. */
const stages = () => shown(document.querySelectorAll('[data-stage]'));

function check(where, what, ok, seen) {
  notes[`${where}: ${what}`] = seen;
  if (!ok) failures.push(`${where}: ${what} reads ${seen}`);
}

/**
 * Every element of a kind on show, over every stage. A page carries a stage per demo and
 * a pane per framework, and a part is not on all of them; what matters is that every one
 * drawn carries the theme's shadow, and that at least one was.
 */
const everyOne = (selector) => stages().flatMap((stage) => shown(stage.querySelectorAll(selector)));

/**
 * The shadow the theme puts on a control, read off the computed value. A palette that
 * names none leaves Tailwind's, whose colour is a plain black wash.
 */
function readShadow(name, selector, offset) {
  const drawn = everyOne(selector);
  if (drawn.length === 0) {
    failures.push(`${name}: nothing matched ${selector}`);
    return;
  }
  // A filled button paints no shadow, and an input inside a group has its taken off, so
  // the ones that carry one are what the theme is read on.
  const carrying = drawn.filter((el) => style(el).boxShadow !== 'none');
  if (carrying.length === 0) {
    failures.push(`${name}: no ${selector} carried a shadow`);
    return;
  }
  for (const [index, el] of carrying.entries()) {
    const seen = style(el).boxShadow;
    check(`${name} ${selector} ${index}`, 'the shadow', seen.includes(offset), seen);
  }
}

/* -------------------------------------------------------------- Bubblegum */

await wear('Bubblegum');
if (document.documentElement.dataset.sgPalette !== 'custom') {
  return { verdict: 'FAIL the page never wore the pasted theme' };
}
if (stages().length === 0) return { verdict: 'FAIL no stage is on show' };
await until(() => everyOne('[data-slot="input"]').length > 0, 15000);

// A 3px offset with no blur, which nothing but a theme puts on a control.
readShadow('Bubblegum', '[data-slot="button"]', '3px 3px 0px');
readShadow('Bubblegum', '[data-slot="input"]', '3px 3px 0px');
readShadow('Bubblegum', '[data-slot="select-trigger"]', '3px 3px 0px');

for (const [index, stage] of stages().entries()) {
  const where = `Bubblegum stage ${index}`;
  // The stage carries the palette on itself, so it wears the theme's own sans.
  check(where, 'the family', style(stage).fontFamily.startsWith('Poppins'), style(stage).fontFamily);
  // Bubblegum names `0em`, which the browser reports back as `normal`.
  check(where, 'the letter spacing', style(stage).letterSpacing === 'normal', style(stage).letterSpacing);
}
check('Bubblegum page', 'the letter spacing', style(document.body).letterSpacing === 'normal', style(document.body).letterSpacing);

/* --------------------------------------------------------------- Notebook */

await wear('Notebook');
readShadow('Notebook', '[data-slot="button"]', '1px 4px 5px');
readShadow('Notebook', '[data-slot="input"]', '1px 4px 5px');
for (const [index, stage] of stages().entries()) {
  check(`Notebook stage ${index}`, 'the letter spacing', style(stage).letterSpacing === '0.5px', style(stage).letterSpacing);
}
check('Notebook page', 'the letter spacing', style(document.body).letterSpacing === '0.5px', style(document.body).letterSpacing);

return {
  verdict: failures.length === 0 ? 'PASS the theme shows on the primitives' : `FAIL ${failures.join('; ')}`,
  notes,
};
