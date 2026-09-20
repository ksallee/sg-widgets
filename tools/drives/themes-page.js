// The Themes page: one preview column at the docs width, switched by the bar's toggle,
// wearing a pasted theme that keeps its character, meets AA on request, and carries its
// own type and shadows.
//
//   pnpm qa --start --path /themes/ --drive tools/drives/themes-page.js
//
// The paste is tweakcn's Bubblegum, as its Code button exports it. Its three status roles
// come out at the destructive's own lightness and chroma; the Meet AA button walks them
// until they clear 4.5:1. The page fetches the typefaces the theme names, the stage wears
// the theme's shadow, and saving dresses a widget page in the same type.

const notes = [];
const th = (name) => document.querySelector(`[data-th="${name}"]`);
const stages = () => [...document.querySelectorAll('[data-stage]')];
const stage = () => stages()[0];
const tokenOn = (element, name) => getComputedStyle(element).getPropertyValue(name).trim();

/** A React field takes a value through its own setter, or the island never sees it. */
function type(element, value) {
  const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value').set;
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

/** The oklch triple a role's readout carries. */
function roleColor(role) {
  const text = (th(`status-${role}-value`)?.textContent ?? '').trim();
  const parts = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(text);
  return parts ? { text, l: Number(parts[1]), c: Number(parts[2]), h: Number(parts[3]) } : null;
}

/** The contrast the readout beside a role states. */
const roleRatio = (role) => Number(/^([\d.]+):1/.exec((th(`status-${role}-ratio`)?.textContent ?? '').trim())?.[1] ?? NaN);

const PASTED = `:root {
  --background: oklch(0.9399 0.0203 345.6985);
  --foreground: oklch(0.4712 0 0);
  --card: oklch(0.9498 0.0500 86.8891);
  --card-foreground: oklch(0.4712 0 0);
  --popover: oklch(1.0000 0 0);
  --popover-foreground: oklch(0.4712 0 0);
  --primary: oklch(0.6209 0.1801 348.1385);
  --primary-foreground: oklch(1.0000 0 0);
  --secondary: oklch(0.8095 0.0694 198.1863);
  --secondary-foreground: oklch(0.3211 0 0);
  --muted: oklch(0.8800 0.0504 212.0952);
  --muted-foreground: oklch(0.5795 0 0);
  --accent: oklch(0.9195 0.0801 87.6670);
  --accent-foreground: oklch(0.3211 0 0);
  --destructive: oklch(0.7091 0.1697 21.9551);
  --destructive-foreground: oklch(1.0000 0 0);
  --border: oklch(0.6209 0.1801 348.1385);
  --input: oklch(0.9189 0 0);
  --ring: oklch(0.7002 0.1597 350.7532);
  --chart-1: oklch(0.7002 0.1597 350.7532);
  --chart-2: oklch(0.8189 0.0799 212.0892);
  --chart-3: oklch(0.9195 0.0801 87.6670);
  --chart-4: oklch(0.7998 0.1110 348.1791);
  --chart-5: oklch(0.6197 0.1899 353.9091);
  --radius: 0.4rem;
  --sidebar: oklch(0.9140 0.0424 343.0913);
  --sidebar-foreground: oklch(0.3211 0 0);
  --sidebar-primary: oklch(0.6559 0.2118 354.3084);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8228 0.1095 346.0184);
  --sidebar-accent-foreground: oklch(0.3211 0 0);
  --sidebar-border: oklch(0.9464 0.0327 307.1745);
  --sidebar-ring: oklch(0.6559 0.2118 354.3084);
  --font-sans: Poppins, sans-serif;
  --font-serif: Lora, serif;
  --font-mono: Fira Code, monospace;
  --shadow-color: hsl(325.78 58.18% 56.86% / 0.5);
  --shadow-opacity: 1.0;
  --shadow-blur: 0px;
  --shadow-spread: 0px;
  --shadow-offset-x: 3px;
  --shadow-offset-y: 3px;
  --spacing: 0.25rem;
  --shadow-2xs: 3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 0.50);
  --shadow-xs: 3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 0.50);
  --shadow-sm: 3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 1px 2px -1px hsl(325.7800 58.1800% 56.8600% / 1.00);
  --shadow: 3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 1px 2px -1px hsl(325.7800 58.1800% 56.8600% / 1.00);
  --shadow-md: 3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 2px 4px -1px hsl(325.7800 58.1800% 56.8600% / 1.00);
  --shadow-lg: 3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 4px 6px -1px hsl(325.7800 58.1800% 56.8600% / 1.00);
  --shadow-xl: 3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 1.00), 3px 8px 10px -1px hsl(325.7800 58.1800% 56.8600% / 1.00);
  --shadow-2xl: 3px 3px 0px 0px hsl(325.7800 58.1800% 56.8600% / 2.50);
  --tracking-normal: 0em;
  --tracking-normal: 0em;
}

.dark {
  --background: oklch(0.2497 0.0305 234.1628);
  --foreground: oklch(0.9306 0.0197 349.0785);
  --card: oklch(0.2902 0.0299 233.5352);
  --card-foreground: oklch(0.9306 0.0197 349.0785);
  --popover: oklch(0.2902 0.0299 233.5352);
  --popover-foreground: oklch(0.9306 0.0197 349.0785);
  --primary: oklch(0.9195 0.0801 87.6670);
  --primary-foreground: oklch(0.2497 0.0305 234.1628);
  --secondary: oklch(0.7794 0.0803 4.1330);
  --secondary-foreground: oklch(0.2497 0.0305 234.1628);
  --muted: oklch(0.2713 0.0086 255.5780);
  --muted-foreground: oklch(0.7794 0.0803 4.1330);
  --accent: oklch(0.6699 0.0988 356.9762);
  --accent-foreground: oklch(0.9306 0.0197 349.0785);
  --destructive: oklch(0.6702 0.1806 350.3599);
  --destructive-foreground: oklch(0.2497 0.0305 234.1628);
  --border: oklch(0.3907 0.0399 242.2181);
  --input: oklch(0.3093 0.0305 232.0027);
  --ring: oklch(0.6998 0.0896 201.8672);
  --chart-1: oklch(0.6998 0.0896 201.8672);
  --chart-2: oklch(0.7794 0.0803 4.1330);
  --chart-3: oklch(0.6699 0.0988 356.9762);
  --chart-4: oklch(0.4408 0.0702 217.0848);
  --chart-5: oklch(0.2713 0.0086 255.5780);
  --radius: 0.4rem;
  --sidebar: oklch(0.2303 0.0270 235.9743);
  --sidebar-foreground: oklch(0.9670 0.0029 264.5419);
  --sidebar-primary: oklch(0.6559 0.2118 354.3084);
  --sidebar-primary-foreground: oklch(1.0000 0 0);
  --sidebar-accent: oklch(0.8228 0.1095 346.0184);
  --sidebar-accent-foreground: oklch(0.2781 0.0296 256.8480);
  --sidebar-border: oklch(0.3729 0.0306 259.7328);
  --sidebar-ring: oklch(0.6559 0.2118 354.3084);
  --font-sans: Poppins, sans-serif;
  --font-serif: Lora, serif;
  --font-mono: Fira Code, monospace;
  --shadow-color: #324859;
  --shadow-opacity: 1.0;
  --shadow-blur: 0px;
  --shadow-spread: 0px;
  --shadow-offset-x: 3px;
  --shadow-offset-y: 3px;
  --spacing: 0.25rem;
  --shadow-2xs: 3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 0.50);
  --shadow-xs: 3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 0.50);
  --shadow-sm: 3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 1px 2px -1px hsl(206.1538 28.0576% 27.2549% / 1.00);
  --shadow: 3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 1px 2px -1px hsl(206.1538 28.0576% 27.2549% / 1.00);
  --shadow-md: 3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 2px 4px -1px hsl(206.1538 28.0576% 27.2549% / 1.00);
  --shadow-lg: 3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 4px 6px -1px hsl(206.1538 28.0576% 27.2549% / 1.00);
  --shadow-xl: 3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 1.00), 3px 8px 10px -1px hsl(206.1538 28.0576% 27.2549% / 1.00);
  --shadow-2xl: 3px 3px 0px 0px hsl(206.1538 28.0576% 27.2549% / 2.50);
  --tracking-normal: 0em;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --font-sans: var(--font-sans);
  --font-mono: var(--font-mono);
  --font-serif: var(--font-serif);
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --shadow-2xs: var(--shadow-2xs);
  --shadow-xs: var(--shadow-xs);
  --shadow-sm: var(--shadow-sm);
  --shadow: var(--shadow);
  --shadow-md: var(--shadow-md);
  --shadow-lg: var(--shadow-lg);
  --shadow-xl: var(--shadow-xl);
  --shadow-2xl: var(--shadow-2xl);
  --tracking-tighter: calc(var(--tracking-normal) - 0.05em);
  --tracking-tight: calc(var(--tracking-normal) - 0.025em);
  --tracking-normal: var(--tracking-normal);
  --tracking-wide: calc(var(--tracking-normal) + 0.025em);
  --tracking-wider: calc(var(--tracking-normal) + 0.05em);
  --tracking-widest: calc(var(--tracking-normal) + 0.1em);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background text-foreground;
    letter-spacing: var(--tracking-normal);
  }
}`;

// Bubblegum's light destructive, which the three roles are turned from.
const DESTRUCTIVE = { l: 0.7091, c: 0.1697 };
const HUES = { success: 145, warning: 75, info: 240 };
const AA = 4.5;

// Bubblegum's dark background, which the toggle has to bring up.
const DARK_BACKGROUND = 'oklch(0.2497 0.0305 234.1628)';
// The docs column, `--sl-content-width` in src/styles/global.css.
const DOCS_WIDTH = 800;

for (let i = 0; i < 80 && !th('editor'); i += 1) await wait(100);
if (!th('editor')) return { verdict: 'FAIL the editor island never mounted' };

// One preview column, no wider than a demo stands on its widget page.
const column = document.querySelector('.th-column');
if (!column) return { verdict: 'FAIL the page has no preview column', notes };
const columnWidth = column.getBoundingClientRect().width;
notes.push(`preview column: ${columnWidth}px, ${stages().length} stages`);
if (columnWidth > DOCS_WIDTH) return { verdict: `FAIL the preview column is ${columnWidth}px wide`, notes };
if (document.querySelector('[data-theme-lock]')) return { verdict: 'FAIL a stage is still pinned to a mode', notes };
if (document.documentElement.scrollWidth > window.innerWidth + 1) {
  return { verdict: `FAIL the page scrolls sideways: ${document.documentElement.scrollWidth}px`, notes };
}

// The shipped default, before the paste: the value Tailwind's own scale gives `shadow-sm`,
// on the first widget on a stage wearing that class. The demos read the mock, so wait for
// one to arrive.
const shadowSm = () =>
  [...document.querySelectorAll('[data-stage] [class*="shadow-"]')].find((el) =>
    /(^|\s)shadow-sm(\s|$)/.test(el.getAttribute('class') ?? ''),
  );
for (let i = 0; i < 120 && !shadowSm(); i += 1) await wait(100);
if (!shadowSm()) return { verdict: 'FAIL no widget on a stage carries a shadow', notes };
const shipped = getComputedStyle(shadowSm()).boxShadow;
notes.push(`default shadow-sm: ${shipped}`);
if (!/rgba\(0, 0, 0, 0\.1\) 0px 1px 3px 0px/.test(shipped)) {
  return { verdict: `FAIL the default palette's shadow-sm reads ${shipped}`, notes };
}

type(th('paste'), PASTED);
th('use').click();
await wait(300);

if (th('error')) return { verdict: `FAIL the paste was refused: ${th('error').textContent}`, notes };

// Each role sits on the destructive's own step: its lightness, its chroma as far as the
// hue holds it, and no walk towards AA.
for (const [role, hue] of Object.entries(HUES)) {
  const color = roleColor(role);
  const reads = roleRatio(role);
  notes.push(`${role}: ${color?.text} at ${reads}:1`);
  if (!color) return { verdict: `FAIL ${role} is not an oklch colour`, notes };
  if (color.h !== hue) return { verdict: `FAIL ${role} sits on hue ${color.h}, expected ${hue}`, notes };
  if (color.l !== DESTRUCTIVE.l) return { verdict: `FAIL ${role} sits at lightness ${color.l}, expected ${DESTRUCTIVE.l}`, notes };
  if (color.c > DESTRUCTIVE.c) return { verdict: `FAIL ${role} takes chroma ${color.c}, above the destructive's ${DESTRUCTIVE.c}`, notes };
  if (color.c < 0.05) return { verdict: `FAIL ${role} has no chroma: ${color.text}`, notes };
  if (reads >= AA) return { verdict: `FAIL ${role} was walked to AA on the paste: ${reads}:1`, notes };
}
if (roleColor('success').c !== DESTRUCTIVE.c) {
  return { verdict: `FAIL success takes chroma ${roleColor('success').c}, not the destructive's ${DESTRUCTIVE.c}`, notes };
}

// Meet AA walks the three roles of the mode on show, and only then.
th('meet-aa').click();
await wait(300);
for (const [role, hue] of Object.entries(HUES)) {
  const color = roleColor(role);
  const reads = roleRatio(role);
  notes.push(`${role} after Meet AA: ${color?.text} at ${reads}:1`);
  if (!color || color.h !== hue) return { verdict: `FAIL ${role} left its hue behind: ${color?.text}`, notes };
  if (!(reads >= AA)) return { verdict: `FAIL ${role} still reads ${reads}:1`, notes };
}

// The theme's type, fetched from Google Fonts and worn by the stage.
const link = document.getElementById('sg-theme-fonts');
notes.push(`font request: ${link?.href ?? 'none'}`);
if (!link || !/fonts\.googleapis\.com\/css2\?.*family=Poppins/.test(link.href)) {
  return { verdict: 'FAIL the page asked for no Poppins', notes };
}
await document.fonts.ready;
await document.fonts.load('16px Poppins');
const family = getComputedStyle(stage()).fontFamily;
notes.push(`stage font-family: ${family}, Poppins loaded: ${document.fonts.check('16px Poppins')}`);
if (!document.fonts.check('16px Poppins')) return { verdict: 'FAIL Poppins never loaded', notes };
if (!/Poppins/.test(family)) return { verdict: `FAIL the stage reads ${family}`, notes };

// The theme's shadow, on the widget that carried the default one.
const shadow = shadowSm() ? getComputedStyle(shadowSm()).boxShadow : '';
notes.push(`pasted shadow-sm: ${shadow}`);
if (shadow === shipped) return { verdict: 'FAIL the stage kept the default shadow', notes };
if (!/3px 3px 0px 0px/.test(shadow)) return { verdict: `FAIL the stage reads box-shadow ${shadow}`, notes };

// The bar's toggle takes every stage to dark, and the theme's dark tokens come with it.
const lightBackground = tokenOn(stage(), '--background');
notes.push(`light stage --background: ${lightBackground}`);
document.querySelector('[data-theme-toggle]').click();
await wait(300);
const darkBackground = tokenOn(stage(), '--background');
notes.push(`dark stage --background: ${darkBackground}, editing ${th('mode')?.textContent?.trim()}`);
if (!stages().every((one) => one.classList.contains('dark'))) {
  return { verdict: 'FAIL the toggle left a stage in light', notes };
}
if (darkBackground !== DARK_BACKGROUND) {
  return { verdict: `FAIL the dark stage reads --background ${darkBackground}`, notes };
}
// The editor adjusts the mode on show: one switch, not two.
if (th('mode')?.textContent?.trim() !== 'Dark tokens') {
  return { verdict: `FAIL the editor is still on ${th('mode')?.textContent?.trim()}`, notes };
}
document.querySelector('[data-theme-toggle]').click();
await wait(300);
if (tokenOn(stage(), '--background') !== lightBackground) {
  return { verdict: `FAIL the stage did not come back to light: ${tokenOn(stage(), '--background')}`, notes };
}

// Save, and the theme is the custom palette, type and all.
type(th('name'), 'QA theme');
await wait(100);
th('save').click();
await wait(300);

const stored = JSON.parse(localStorage.getItem('sg-theme:custom') ?? 'null');
if (!stored) return { verdict: 'FAIL nothing was saved', notes };
if (!stored.css.includes("[data-sg-palette='custom']")) return { verdict: 'FAIL the saved block carries no page selector', notes };
if (!/family=Poppins/.test(stored.fonts ?? '')) return { verdict: `FAIL the saved theme carries no type: ${stored.fonts}`, notes };
if (!/--shadow-sm:/.test(stored.css)) return { verdict: 'FAIL the saved block carries no shadow tokens', notes };
// The roles the Meet AA walk left behind are the ones that were saved.
for (const role of Object.keys(HUES)) {
  if (!stored.css.includes(`--${role}: ${roleColor(role).text};`)) {
    return { verdict: `FAIL the saved block does not carry ${role} as ${roleColor(role).text}`, notes };
  }
}
notes.push(`saved as ${stored.label}`);

// A widget page, opened fresh, wears the theme and its type.
const frame = document.createElement('iframe');
frame.style.cssText = 'position:fixed;left:-9999px;width:1200px;height:800px';
frame.src = '/widgets/status-badge/';
document.body.append(frame);
await new Promise((done) => frame.addEventListener('load', done, { once: true }));
await wait(600);

const inner = frame.contentDocument;
const root = inner.documentElement;
const wears = getComputedStyle(root).getPropertyValue('--primary').trim();
await inner.fonts.ready;
await inner.fonts.load('16px Poppins');
const innerFamily = getComputedStyle(inner.body).fontFamily;
const option = [...inner.querySelectorAll('.sg-palette option')].map((o) => o.value);
notes.push(`widget page: palette ${root.dataset.sgPalette}, --primary ${wears}, font ${innerFamily}`);
frame.remove();

if (root.dataset.sgPalette !== 'custom') return { verdict: `FAIL the widget page wears ${root.dataset.sgPalette}`, notes };
// Whichever mode the page is in, the primary is the theme's own for that mode.
if (!/348\.1385|87\.667/.test(wears)) return { verdict: `FAIL the widget page reads --primary ${wears}`, notes };
if (!option.includes('custom')) return { verdict: 'FAIL the header select does not offer the saved theme', notes };
if (!/Poppins/.test(innerFamily)) return { verdict: `FAIL the widget page reads ${innerFamily}`, notes };

return {
  verdict:
    'PASS one preview column at the docs width, switched by the bar, wearing a pasted theme that keeps its character, meets AA on request, and carries its type and shadows',
  notes,
};
