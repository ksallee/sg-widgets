// The Themes page: a pasted theme derives its status roles, saves, and every page wears it.
//
//   pnpm qa --start --path /themes/ --drive tools/drives/themes-page.js
//
// The paste is a shadcn pair in three spellings. The three status roles come from its
// destructive, each clearing AA on the foreground it is read on. Saving puts the theme in
// `localStorage` as the custom palette; a widget page opened in a frame wears it.

const notes = [];
const th = (name) => document.querySelector(`[data-th="${name}"]`);

/** A React field takes a value through its own setter, or the island never sees it. */
function type(element, value) {
  const setter = Object.getOwnPropertyDescriptor(element.constructor.prototype, 'value').set;
  setter.call(element, value);
  element.dispatchEvent(new Event('input', { bubbles: true }));
}

const PASTED = `:root {
  --background: #ffffff;
  --foreground: oklch(0.2 0 0);
  --card: #ffffff;
  --card-foreground: oklch(0.2 0 0);
  --popover: #ffffff;
  --popover-foreground: oklch(0.2 0 0);
  --primary: oklch(0.55 0.22 275);
  --primary-foreground: oklch(1 0 0);
  --secondary: 240 5% 96%;
  --secondary-foreground: oklch(0.2 0 0);
  --muted: 240 5% 96%;
  --muted-foreground: oklch(0.5 0 0);
  --accent: 240 5% 96%;
  --accent-foreground: oklch(0.2 0 0);
  --destructive: oklch(0.577 0.245 27.325);
  --destructive-foreground: oklch(1 0 0);
  --border: oklch(0.92 0 0);
  --input: oklch(0.92 0 0);
  --ring: oklch(0.55 0.22 275);
  --radius: 0.75rem;
}

.dark {
  --background: oklch(0.15 0 0);
  --foreground: oklch(0.98 0 0);
  --card: oklch(0.2 0 0);
  --card-foreground: oklch(0.98 0 0);
  --popover: oklch(0.2 0 0);
  --popover-foreground: oklch(0.98 0 0);
  --primary: oklch(0.72 0.16 275);
  --primary-foreground: oklch(0.15 0 0);
  --secondary: oklch(0.27 0 0);
  --secondary-foreground: oklch(0.98 0 0);
  --muted: oklch(0.27 0 0);
  --muted-foreground: oklch(0.71 0 0);
  --accent: oklch(0.27 0 0);
  --accent-foreground: oklch(0.98 0 0);
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.15 0 0);
  --border: oklch(0.27 0 0);
  --input: oklch(0.27 0 0);
  --ring: oklch(0.72 0.16 275);
}`;

for (let i = 0; i < 80 && !th('editor'); i += 1) await wait(100);
if (!th('editor')) return { verdict: 'FAIL the editor island never mounted' };

type(th('paste'), PASTED);
th('use').click();
await wait(300);

if (th('error')) return { verdict: `FAIL the paste was refused: ${th('error').textContent}`, notes };

// The three roles, on the hues themes.css gives them, each clearing AA on its foreground.
const HUES = { success: 145, warning: 75, info: 240 };
for (const [role, hue] of Object.entries(HUES)) {
  const value = th(`status-${role}-value`)?.textContent ?? '';
  const read = th(`status-${role}-ratio`)?.textContent ?? '';
  notes.push(`${role}: ${value} ${read}`);
  const parts = /^oklch\(([\d.]+) ([\d.]+) ([\d.]+)\)$/.exec(value.trim());
  if (!parts) return { verdict: `FAIL ${role} is not an oklch colour: ${value}`, notes };
  if (Number(parts[3]) !== hue) return { verdict: `FAIL ${role} sits on hue ${parts[3]}, expected ${hue}`, notes };
  if (Number(parts[2]) < 0.05) return { verdict: `FAIL ${role} has no chroma: ${value}`, notes };
  if (!/\dAA$|\d:1 AA$/.test(read.trim())) return { verdict: `FAIL ${role} reads ${read}`, notes };
}

// The pasted primary is on the light stage and the dark stage carries the dark one.
const stage = (mode) => document.querySelector(`[data-theme-lock="${mode}"] [data-stage]`);
const primary = (mode) => getComputedStyle(stage(mode)).getPropertyValue('--primary').trim();
notes.push(`stages: light ${primary('light')}, dark ${primary('dark')}`);
if (!primary('light').includes('275')) return { verdict: `FAIL the light stage reads --primary ${primary('light')}`, notes };
if (primary('light') === primary('dark')) return { verdict: 'FAIL both stages read the same --primary', notes };
if (!stage('dark').classList.contains('dark')) return { verdict: 'FAIL the dark stage is not dark', notes };

// Save, and the page wears it as the custom palette.
type(th('name'), 'QA theme');
await wait(100);
th('save').click();
await wait(300);

const stored = JSON.parse(localStorage.getItem('sg-theme:custom') ?? 'null');
if (!stored) return { verdict: 'FAIL nothing was saved', notes };
if (!stored.css.includes("[data-sg-palette='custom']")) return { verdict: 'FAIL the saved block carries no page selector', notes };
if (document.documentElement.dataset.sgPalette !== 'custom') {
  return { verdict: `FAIL the page wears ${document.documentElement.dataset.sgPalette}`, notes };
}
notes.push(`saved as ${stored.label}`);

// A widget page, opened fresh, wears the same theme.
const frame = document.createElement('iframe');
frame.style.cssText = 'position:fixed;left:-9999px;width:1200px;height:800px';
frame.src = '/widgets/status-badge/';
document.body.append(frame);
await new Promise((done) => frame.addEventListener('load', done, { once: true }));
await wait(600);

const root = frame.contentDocument.documentElement;
const wears = getComputedStyle(root).getPropertyValue('--primary').trim();
const option = [...frame.contentDocument.querySelectorAll('.sg-palette option')].map((o) => o.value);
notes.push(`widget page: palette ${root.dataset.sgPalette}, --primary ${wears}, options ${option.join(' ')}`);
frame.remove();

if (root.dataset.sgPalette !== 'custom') return { verdict: `FAIL the widget page wears ${root.dataset.sgPalette}`, notes };
if (!wears.includes('275')) return { verdict: `FAIL the widget page reads --primary ${wears}`, notes };
if (!option.includes('custom')) return { verdict: 'FAIL the header select does not offer the saved theme', notes };

return { verdict: 'PASS the pasted theme derives its status roles, saves, and dresses a widget page', notes };
