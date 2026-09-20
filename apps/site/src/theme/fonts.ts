/**
 * The typefaces a pasted theme names, and the Google Fonts request that brings them in.
 *
 * A shadcn theme carries its type as a stack on `--font-sans`, `--font-serif` and
 * `--font-mono`. The first family of a stack is the one the theme was drawn with; the
 * rest are what the browser falls back to and are already on the machine. A family the
 * site self-hosts, and a family CSS resolves itself, are not requested.
 */
import { MODES, type Theme } from './theme';

/** The three tokens a theme names its type on. */
export const FONT_TOKENS = ['--font-sans', '--font-serif', '--font-mono'] as const;

/** The id the font request is held under, on the Themes page and on every page after a save. */
export const FONT_LINK = 'sg-theme-fonts';

/** The families global.css imports; a theme naming one is already served. */
const SELF_HOSTED = ['geist', 'montserrat', 'open sans', 'outfit'];

/** A family the browser resolves from the machine, so a request for it would find nothing. */
const GENERIC = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'cursive',
  'fantasy',
  'math',
  'emoji',
  'fangsong',
  'system-ui',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  'ui-rounded',
  '-apple-system',
  'blinkmacsystemfont',
  'inherit',
  'initial',
  'revert',
  'unset',
]);

/** A family name is letters, digits, spaces and hyphens; anything else is a stack this cannot read. */
const NAME = /^[a-z\d][a-z\d -]*$/i;

/**
 * The family a stack is drawn with: its first entry, unquoted. Null for a family the
 * site serves already and for one the browser resolves on its own.
 */
export function familyOf(stack: string): string | null {
  const first = stack.split(',')[0] ?? '';
  const family = first.trim().replace(/^['"]|['"]$/g, '').replace(/\s+/g, ' ').trim();
  if (!NAME.test(family)) return null;
  const lower = family.toLowerCase();
  if (GENERIC.has(lower)) return null;
  // The self-hosted faces are named with and without the `Variable` the fontsource package adds.
  if (SELF_HOSTED.includes(lower.replace(/ variable$/, ''))) return null;
  return family;
}

/** The families a theme names, in token order, each once. */
export function themeFamilies(theme: Theme): string[] {
  const families: string[] = [];
  for (const token of FONT_TOKENS) {
    for (const mode of MODES) {
      const value = theme[mode][token];
      const family = value === undefined ? null : familyOf(value);
      if (family && !families.includes(family)) families.push(family);
    }
  }
  return families;
}

/**
 * The weights asked for. The `400..700` range spelling is refused for a family with no
 * variable axis, and the discrete list serves a variable face as well.
 */
const WEIGHTS = '400;500;600;700';

/** The Google Fonts stylesheet for these families, or null when a theme names none. */
export function googleFontsHref(families: string[]): string | null {
  const names = [...new Set(families)].sort();
  if (names.length === 0) return null;
  const query = names.map((name) => `family=${name.replace(/ /g, '+')}:wght@${WEIGHTS}`).join('&');
  return `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

/** The request a theme's type needs, or null when it names nothing to fetch. */
export const themeFontsHref = (theme: Theme): string | null => googleFontsHref(themeFamilies(theme));
