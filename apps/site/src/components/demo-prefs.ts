/**
 * The view every demo on the site wears: framework, palette, radius, light/dark and
 * reduced motion.
 *
 * The palette select in Starlight's header and the toolbar on each example write these,
 * the demos read them, and `sg-demo:*` in `localStorage` carries them from page to page
 * and from tab to tab. Light and dark is the one nobody sets here: it follows Starlight's
 * own theme select through `watchTheme`. A palette swaps token values on the stage and on
 * the page around it; none of these controls changes what a widget renders.
 */

export interface Palette {
  /**
   * The `data-theme` the stage carries, the `data-sg-palette` the page carries, and the
   * key src/styles/themes.css holds.
   */
  name: string;
  label: string;
}

/**
 * Called the palette everywhere a name could be read as the light/dark theme Starlight's
 * own select switches. `default` has no block in themes.css and leaves the stage on the
 * tokens global.css sets, which is why it is also the fallback: a name from a browser
 * that stored one of the palettes this list has dropped resolves to it and lands on the
 * same tokens the page had already painted.
 */
export const palettes: Palette[] = [
  { name: 'default', label: 'Default' },
  { name: 'nova', label: 'Nova' },
  { name: 'vercel', label: 'Vercel' },
  { name: 'supabase', label: 'Supabase' },
  { name: 'claude', label: 'Claude' },
  { name: 'twitter', label: 'Twitter' },
  { name: 'catppuccin', label: 'Catppuccin' },
];

/** The palette a page wears until something says otherwise. */
export const defaultPalette = palettes[0]!.name;

/**
 * The palette a theme saved on /themes wears. It has no block in themes.css: its two
 * selectors are written from `localStorage` by src/scripts/palette-boot.js, and the
 * header select offers the name only while one is stored.
 */
export const customPalette = 'custom';

/* `default` keeps whatever `--radius` the palette sets; the rest override it. */
export const radii = [
  { name: 'default', label: 'Radius: theme' },
  { name: 'none', label: 'Radius: none' },
  { name: 'sm', label: 'Radius: sm' },
  { name: 'md', label: 'Radius: md' },
  { name: 'lg', label: 'Radius: lg' },
  { name: 'xl', label: 'Radius: xl' },
];

/**
 * Whether the two-pane stage is on offer. It is development work: a reader wants one
 * framework, and the pair needs a column wider than the page reads at. Set
 * `PUBLIC_SG_DEMO_BOTH=1` (see .env.example) to bring the Both segment, the `both`
 * value and the two panes back.
 */
export const bothPanes = import.meta.env.PUBLIC_SG_DEMO_BOTH === '1';

export const frameworks = bothPanes ? ['react', 'svelte', 'both'] : ['react', 'svelte'];

const KEYS = {
  framework: 'sg-demo:framework',
  theme: 'sg-demo:theme',
  motion: 'sg-demo:motion',
  palette: 'sg-demo:palette',
  radius: 'sg-demo:radius',
} as const;

export type Pref = keyof typeof KEYS;

const ALLOWED: Record<Pref, string[]> = {
  framework: frameworks,
  theme: ['light', 'dark'],
  motion: ['normal', 'reduced'],
  palette: [...palettes.map((palette) => palette.name), customPalette],
  radius: radii.map((radius) => radius.name),
};

const FALLBACK: Record<Pref, string> = {
  framework: bothPanes ? 'both' : 'react',
  theme: 'light',
  motion: 'normal',
  palette: defaultPalette,
  radius: 'default',
};

/** The framework a page shows until the reader picks one. */
export const defaultFramework = FALLBACK.framework;

/*
 * Values are raw strings, the spelling tools/qa.mjs writes for the initial load. Its
 * `harness.set` quotes them as JSON before a reload, so a quoted value reads as the
 * string inside.
 */
function stored(key: string): string | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(key);
  } catch {
    return null; // Private mode, blocked storage or the server build: fall back, never throw.
  }
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'string' ? parsed : raw;
  } catch {
    return raw;
  }
}

function read(pref: Pref, current: string): string {
  const value = stored(KEYS[pref]);
  return value !== null && ALLOWED[pref].includes(value) ? value : current;
}

/** The view as it stands. Read it; change it through `setPref`. */
export const prefs: Record<Pref, string> = {
  framework: read('framework', FALLBACK.framework),
  theme: read('theme', FALLBACK.theme),
  motion: read('motion', FALLBACK.motion),
  palette: read('palette', FALLBACK.palette),
  radius: read('radius', FALLBACK.radius),
};

export function setPref(pref: Pref, value: string): void {
  if (!ALLOWED[pref].includes(value)) return;
  prefs[pref] = value;
  try {
    localStorage.setItem(KEYS[pref], value);
  } catch {
    /* Persisting the view is a convenience, not a requirement. */
  }
  applyPrefs();
}

export function togglePref(pref: Pref): void {
  setPref(pref, prefs[pref] === ALLOWED[pref][1] ? ALLOWED[pref][0]! : ALLOWED[pref][1]!);
}

/** Put the current view on every demo on the page, and back on the controls. */
export function applyPrefs(): void {
  // The palette and the radius also land on `:root`, where the `--sl-*` block in
  // global.css hands the tokens to Starlight, so the header, the sidebar and the
  // content follow the demos. src/scripts/palette-boot.js writes the same two before
  // the first paint. The tokens for light and dark are Starlight's own `data-theme` and
  // are left alone.
  document.documentElement.dataset.sgPalette = prefs.palette;
  document.documentElement.dataset.sgRadius = prefs.radius;
  // The install tabs pick their pane off the root, so a page opens on the stored
  // framework: src/scripts/palette-boot.js writes it before the first paint.
  document.documentElement.dataset.sgFramework = prefs.framework;
  // The dark class lands on the root as well as on each stage: a popup portals to the
  // body, and the `dark:` variant both packages define reads `.dark *`, so a row drawn
  // outside the stage would otherwise keep its light treatment.
  document.documentElement.classList.toggle('dark', prefs.theme === 'dark');

  for (const root of document.querySelectorAll<HTMLElement>('[data-sg-demo]')) {
    root.dataset.framework = prefs.framework;
    root.dataset.motion = prefs.motion;

    // Palette and radius land on the stage, never on the figure: the frame reads the
    // page's own tokens, which the root attributes above already carry. The stage's
    // palette attribute is `data-theme` because that is the hook themes.css selects on.
    const stage = root.querySelector<HTMLElement>('[data-stage]');
    if (stage) {
      stage.classList.toggle('dark', prefs.theme === 'dark');
      stage.dataset.theme = prefs.palette;
      stage.dataset.radius = prefs.radius;
    }
  }

  // Every example carries the same toolbar, so a change on one shows on all of them.
  for (const toolbar of document.querySelectorAll<HTMLElement>('[data-sg-toolbar]')) {
    for (const pick of toolbar.querySelectorAll<HTMLButtonElement>('[data-framework-pick]')) {
      pick.setAttribute('aria-pressed', String(pick.dataset.frameworkPick === prefs.framework));
    }

    const radiusPick = toolbar.querySelector<HTMLSelectElement>('[data-radius-pick]');
    if (radiusPick) radiusPick.value = prefs.radius;

    toolbar.querySelector('[data-motion-toggle]')?.setAttribute('aria-pressed', String(prefs.motion === 'reduced'));
  }

  // The install tabs write the same key, so a tab and a toolbar segment follow each other.
  for (const pick of document.querySelectorAll<HTMLElement>('[data-install-pick]')) {
    pick.setAttribute('aria-pressed', String(pick.dataset.installPick === prefs.framework));
  }

  const palettePick = document.querySelector<HTMLSelectElement>('.sg-palette select');
  if (palettePick) palettePick.value = prefs.palette;
}

let watching = false;
let following = false;

/**
 * Follow Starlight's theme select. It stamps `light` or `dark` on the root, and the
 * stage wears whichever the docs page wears, so a reviewer reads one theme at a time.
 * `sg-demo:theme` still owns the stage, so the headless driver can set it on its own.
 */
function watchTheme(): void {
  if (following) return;
  following = true;
  const follow = (): void => {
    const theme = document.documentElement.dataset.theme;
    if (theme && theme !== prefs.theme) setPref('theme', theme);
  };
  new MutationObserver(follow).observe(document.documentElement, { attributeFilter: ['data-theme'] });
  follow();
}

/**
 * Follow the keys. The headless driver (tools/qa.mjs) sets them and fires `storage`
 * instead of clicking, so a drive script reaches every control without knowing the
 * markup, and the same listener keeps two open tabs in step.
 */
export function watchPrefs(): void {
  watchTheme();
  if (watching) return;
  watching = true;
  window.addEventListener('storage', () => {
    for (const pref of Object.keys(KEYS) as Pref[]) prefs[pref] = read(pref, prefs[pref]!);
    applyPrefs();
  });
}
