// A pasted theme shows on a picker: its shadow on the control and on the open popup,
// its family and its letter spacing on both.
//
//   PUBLIC_SG_DEMO_BOTH=1 pnpm qa --start --path /widgets/entity-picker/ --framework both \
//     --drive tools/drives/theme-pickers.js
//
// The themes are tweakcn's own, read from its registry, so nothing here is a copy that
// can go stale: https://tweakcn.com/r/themes/<name>.json serves `cssVars.theme`,
// `cssVars.light` and `cssVars.dark`, which is what apps/site/src/theme/parse.ts makes a
// `Theme` of. The drive stores it under `sg-theme:custom` the way a save on /themes does
// and wears it as the custom palette.
//
// Bubblegum is the theme with a shadow nothing else draws: a 3px offset with no blur, in
// pink. Vercel is the quiet one, a 1px black wash, and stands for "nothing moved on a
// palette that names an ordinary shadow".
const pause = (ms) => new Promise((r) => setTimeout(r, ms));

/** A press, the way a mouse makes one: the control opens on pointerdown. */
const press = (el) => {
  for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup']) {
    el.dispatchEvent(new PointerEvent(type, { bubbles: true, cancelable: true, button: 0, pointerType: 'mouse' }));
  }
  el.click();
};

const style = (el) => el.ownerDocument.defaultView.getComputedStyle(el);
const shown = (list) => [...list].filter((el) => el.offsetParent !== null);
const stages = () => shown(document.querySelectorAll('[data-stage]'));

/** The families the site serves itself, which a theme naming one need not fetch. */
const SELF_HOSTED = ['geist', 'montserrat', 'open sans', 'outfit'];
const GENERIC = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui']);

/** The family a stack is drawn with, or null when nothing has to be fetched for it. */
function familyOf(stack) {
  const family = (stack.split(',')[0] ?? '').trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ');
  if (!/^[a-z\d][a-z\d -]*$/i.test(family)) return null;
  const lower = family.toLowerCase();
  if (GENERIC.has(lower) || SELF_HOSTED.includes(lower.replace(/ variable$/, ''))) return null;
  return family;
}

const body = (tokens) =>
  Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');

/** tweakcn's registry item, as the two token blocks the Themes page saves. */
async function fetchTheme(name) {
  const item = await (await fetch(`https://tweakcn.com/r/themes/${name}.json`)).json();
  const vars = item.cssVars ?? {};
  const named = (block) => Object.fromEntries(Object.entries(block ?? {}).map(([k, v]) => [`--${k}`, v]));
  // The `theme` block holds the type, the radius and the spacing, which belong to both modes.
  const shared = named(vars.theme);
  return { light: { ...shared, ...named(vars.light) }, dark: { ...shared, ...named(vars.dark) } };
}

/** Wear a theme the way a save on /themes does, and wait for its type to arrive. */
async function wear(name) {
  const theme = await fetchTheme(name);
  const { '--radius': _radius, ...dark } = theme.dark;
  const css = [
    `.sg-demo[data-theme='custom'],\n:root[data-sg-palette='custom'] {\n${body(theme.light)}\n}`,
    `.sg-demo[data-theme='custom'].dark,\n:root[data-sg-palette='custom'][data-theme='dark'] {\n${body(dark)}\n}`,
  ].join('\n\n');
  const families = [];
  for (const token of ['--font-sans', '--font-serif', '--font-mono']) {
    for (const mode of [theme.light, theme.dark]) {
      const family = mode[token] === undefined ? null : familyOf(mode[token]);
      if (family && !families.includes(family)) families.push(family);
    }
  }
  const fonts =
    families.length === 0
      ? null
      : `https://fonts.googleapis.com/css2?${[...families]
          .sort()
          .map((one) => `family=${one.replace(/ /g, '+')}:wght@400;500;600;700`)
          .join('&')}&display=swap`;
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
  // The request has to land before the shot: a face still downloading leaves the stage
  // in the fallback, which is not what the theme names.
  if (fonts && link.getAttribute('href') !== fonts) {
    const arrived = new Promise((resolve) => {
      link.addEventListener('load', resolve, { once: true });
      link.addEventListener('error', resolve, { once: true });
    });
    link.href = fonts;
    await Promise.race([arrived, pause(8000)]);
  }
  harness.set({ palette: 'custom' });
  for (let t = 0; t < 100 && document.documentElement.dataset.sgPalette !== 'custom'; t++) await pause(50);
  // `fonts.ready` settles once the faces the page uses are in; the families a theme
  // names are asked for by name as well, since nothing has drawn in them yet.
  for (const family of families) {
    await document.fonts.load(`16px "${family}"`).catch(() => {});
    await document.fonts.load(`600 16px "${family}"`).catch(() => {});
  }
  await document.fonts.ready;
  await pause(400);
  return theme;
}

/** The first control on show, and the popup it opens. */
async function openOne() {
  const control = stages()
    .flatMap((stage) => shown(stage.querySelectorAll('[data-slot$="-control"]')))
    .find((el) => el.getAttribute('data-slot') !== 'picker-control');
  if (!control) return { control: null, popup: null };
  press(control);
  for (let t = 0; t < 60 && !document.querySelector('[data-slot$="-content"]'); t++) await pause(50);
  await pause(300);
  return { control, popup: document.querySelector('[data-slot$="-content"]') };
}

async function closeOne(control) {
  for (const el of [document.activeElement, control]) {
    el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  }
  for (let t = 0; t < 60 && document.querySelector('[data-slot$="-content"]'); t++) await pause(50);
  await pause(200);
}

const failures = [];
const notes = {};

function check(where, what, ok, seen) {
  notes[`${where}: ${what}`] = seen;
  if (!ok) failures.push(`${where}: ${what} reads ${seen}`);
}

/** The three things a theme puts on a surface, read off the computed values. */
function readPart(where, el, want) {
  const seen = style(el);
  check(where, 'the shadow', seen.boxShadow.includes(want.shadow), seen.boxShadow);
  check(where, 'the family', seen.fontFamily.startsWith(want.family), seen.fontFamily);
  check(where, 'the letter spacing', seen.letterSpacing === want.tracking, seen.letterSpacing);
}

/** A theme, worn, with the control open, read on the control and on the popup. */
async function wearAndRead(name, want) {
  await wear(name);
  if (document.documentElement.dataset.sgPalette !== 'custom') {
    failures.push(`${name}: the page never wore the pasted theme`);
    return;
  }
  const { control, popup } = await openOne();
  if (!control) {
    failures.push(`${name}: no picker control on show`);
    return;
  }
  readPart(`${name} the control`, control, want);
  if (!popup) failures.push(`${name}: the control opened no popup`);
  else readPart(`${name} the popup`, popup, want);
  await closeOne(control);
}

if (stages().length === 0) return { verdict: 'FAIL no stage is on show' };
for (let t = 0; t < 100 && stages().flatMap((s) => shown(s.querySelectorAll('[data-slot$="-control"]'))).length === 0; t++) {
  await pause(50);
}

// Bubblegum: a 3px pink offset with no blur, Poppins, and `0em`, which reports as `normal`.
await wearAndRead('bubblegum', { shadow: '3px 3px 0px', family: 'Poppins', tracking: 'normal' });
// Vercel: the ordinary 1px wash, Geist, no spacing of its own. Nothing moved here.
await wearAndRead('vercel', { shadow: '0px 1px 2px', family: 'Geist', tracking: 'normal' });

return {
  verdict: failures.length === 0 ? 'PASS the theme shows on the control and on the popup' : `FAIL ${failures.join('; ')}`,
  notes,
};
