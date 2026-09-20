/**
 * Writing a theme back out: the `:root` and `.dark` pair a host's stylesheet takes, the
 * two-selector block src/styles/themes.css takes, and the rule that dresses the preview
 * stages while the theme is being edited.
 */
import type { Theme, Tokens } from './theme';

const body = (tokens: Tokens): string =>
  Object.entries(tokens)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');

export const rule = (selector: string, tokens: Tokens): string => `${selector} {\n${body(tokens)}\n}`;

/** The pair shadcn writes, for a host's own stylesheet. */
export function shadcnCss(theme: Theme): string {
  return [rule(':root', theme.light), rule('.dark', theme.dark)].join('\n\n');
}

/** A slug themes.css and the `data-theme` attribute can carry. */
export const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/**
 * The block themes.css holds: one rule for the demo stage, one for the page around it,
 * written once for both. The radius sits in the light rule alone, which is what the
 * radius override at the foot of that file expects.
 */
export function themesCss(theme: Theme, slug: string): string {
  const { '--radius': _radius, ...dark } = theme.dark;
  return [
    rule(`.sg-demo[data-theme='${slug}'],\n:root[data-sg-palette='${slug}']`, theme.light),
    rule(`.sg-demo[data-theme='${slug}'].dark,\n:root[data-sg-palette='${slug}'][data-theme='dark']`, dark),
  ].join('\n\n');
}

/**
 * The theme on the two preview stages, each pinned to its own mode. The doubled
 * attribute outranks the palette block the stage would otherwise wear.
 */
export function previewCss(theme: Theme): string {
  return [
    rule(`[data-theme-lock='light'] [data-stage][data-stage]`, theme.light),
    rule(`[data-theme-lock='dark'] [data-stage][data-stage]`, theme.dark),
  ].join('\n\n');
}
