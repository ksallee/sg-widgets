// One voice per palette: the chrome and the demos on the same family, at the same size.
//
// Run once per palette, on a widget page that draws labels without waiting on the mock:
//
//   pnpm qa --start --path /widgets/entity-chip/ --framework both \
//     --palette catppuccin --drive tools/drives/chrome-font.js
//
// The palette is whatever the run was dressed with, read back off `:root`, so the same
// file covers all ten.

/** The family each palette's `--font-sans` starts with; the five without a block keep Geist. */
const FAMILY = {
  default: 'Geist Variable',
  stone: 'Geist Variable',
  zinc: 'Geist Variable',
  mauve: 'Geist Variable',
  mist: 'Geist Variable',
  vercel: 'Geist Variable',
  supabase: 'Outfit Variable',
  claude: 'ui-sans-serif',
  twitter: 'Open Sans Variable',
  catppuccin: 'Montserrat Variable',
};

/* A generic keyword is the browser's own face: there is no file to wait for. */
const GENERIC = ['ui-sans-serif', 'system-ui', 'sans-serif', 'serif', 'monospace'];

const until = async (fn, ms = 8000) => {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (fn()) return true;
    await wait(50);
  }
  return false;
};

/** The first family of a stack, unquoted -- what the text is actually drawn in. */
const first = (stack) => (stack || '').split(',')[0].trim().replace(/^["']|["']$/g, '');

const familyOf = (el) => (el ? first(getComputedStyle(el).fontFamily) : null);
const sizeOf = (el) => (el ? getComputedStyle(el).fontSize : null);

const palette = document.documentElement.dataset.sgPalette;
const want = FAMILY[palette];
if (!want) return { verdict: `FAIL the page carries palette "${palette}", which has no expected family` };

// The stage takes the palette when the header's script runs, and the islands mount after.
if (!(await until(() => $('[data-stage]')?.dataset.theme === palette))) {
  return { verdict: `FAIL the stage stayed on "${$('[data-stage]')?.dataset.theme}" while the page wore ${palette}` };
}
if (!(await until(() => $$('[data-pane="svelte"] [data-slot="entity-chip"].text-sm').length > 0 && $$('[data-pane="react"] [data-slot="entity-chip"].text-sm').length > 0))) {
  return { verdict: `FAIL no chip at the body size in one of the two panes for ${palette}` };
}
await document.fonts.ready;

const parts = {
  header: $('header.header'),
  sidebar: $('#starlight__sidebar a[aria-current="page"]') ?? $('#starlight__sidebar a[href]'),
  toc: $('.right-sidebar-panel nav a'),
  content: $('.sl-markdown-content p'),
  svelteLabel: $('[data-pane="svelte"] [data-slot="entity-chip"].text-sm'),
  reactLabel: $('[data-pane="react"] [data-slot="entity-chip"].text-sm'),
};

const out = { palette, want, families: {}, sizes: {} };
for (const [name, el] of Object.entries(parts)) {
  out.families[name] = familyOf(el);
  out.sizes[name] = sizeOf(el);
}
out.slFont = first(getComputedStyle(document.documentElement).getPropertyValue('--sl-font'));
out.generic = GENERIC.includes(want);
out.loaded = out.generic ? null : document.fonts.check(`1rem "${want}"`);

// The two surfaces that name a font of their own: the search dialog, and the code block,
// whose chrome is the page's sans and whose code stays on the mono stack. Pagefind's own
// `--pagefind-ui-font` only exists where the index does, which is a production build.
const code = $('.expressive-code');
const pagefind = $('#starlight__search');
out.families.searchButton = familyOf($('button[data-open-modal]'));
out.sizes.searchButton = sizeOf($('button[data-open-modal]'));
out.families.searchDialog = familyOf($('site-search dialog'));
out.pagefindFont = pagefind ? first(getComputedStyle(pagefind).getPropertyValue('--pagefind-ui-font')) : null;
out.codeUiFont = code ? first(getComputedStyle(code).getPropertyValue('--ec-uiFontFml')) : null;
out.codeFont = code ? familyOf(code.querySelector('pre code')) : null;
out.codeSize = code ? sizeOf(code.querySelector('pre code')) : null;

const fails = [];
for (const [name, family] of Object.entries(out.families)) {
  if (family === null) fails.push(`${name} is not on the page`);
  else if (family !== want) fails.push(`${name} draws in ${family}, wanted ${want}`);
}
if (out.slFont !== want) fails.push(`--sl-font resolves to ${out.slFont}, wanted ${want}`);
if (out.loaded === false) fails.push(`${want} is named but not loaded`);
if (out.sizes.sidebar !== out.sizes.svelteLabel) {
  fails.push(`a sidebar entry is ${out.sizes.sidebar}, a Svelte label ${out.sizes.svelteLabel}`);
}
if (out.sizes.sidebar !== out.sizes.reactLabel) {
  fails.push(`a sidebar entry is ${out.sizes.sidebar}, a React label ${out.sizes.reactLabel}`);
}
if (out.sizes.content !== '14px') fails.push(`the content body is ${out.sizes.content}, wanted 14px`);
if (out.sizes.toc !== '12px') fails.push(`a table of contents entry is ${out.sizes.toc}, wanted 12px`);
if (out.sizes.searchButton !== '14px') fails.push(`the search button is ${out.sizes.searchButton}, wanted 14px`);
if (out.pagefindFont !== null && out.pagefindFont !== want) {
  fails.push(`Pagefind is on ${out.pagefindFont}, wanted ${want}`);
}
if (out.codeUiFont !== want) fails.push(`the code block's chrome is on ${out.codeUiFont}, wanted ${want}`);
if (!out.codeFont || out.codeFont === want) fails.push(`code draws in ${out.codeFont}, wanted the mono stack`);
if (out.codeSize !== '14px') fails.push(`code is ${out.codeSize}, wanted 14px`);

out.verdict = fails.length
  ? `FAIL ${palette}: ${fails.join('; ')}`
  : `PASS ${palette} on ${want}, chrome and demos, sidebar and label both ${out.sizes.sidebar}`;
return out;
