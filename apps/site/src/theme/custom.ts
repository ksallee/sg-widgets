/**
 * The theme a visitor saves on /themes: one entry in `localStorage`, worn by every page
 * as the `custom` palette.
 *
 * The stored value carries the block themes.css would hold, so src/scripts/palette-boot.js
 * has only to write it into a style tag before the first paint, and the header select has
 * only to offer the name.
 */
import { customPalette, setPref } from '../components/demo-prefs';
import { applyStyle } from './live';
import { themesCss } from './serialise';
import type { Theme } from './theme';

export const CUSTOM_KEY = 'sg-theme:custom';
/** The id of the style tag holding the saved theme, on every page. */
export const CUSTOM_STYLE = 'sg-custom-palette';

export interface CustomTheme {
  /** What the header select calls it. */
  label: string;
  /** The two-selector block, already written for the `custom` palette. */
  css: string;
  theme: Theme;
}

export function readCustom(): CustomTheme | null {
  let raw: string | null;
  try {
    raw = localStorage.getItem(CUSTOM_KEY);
  } catch {
    return null; // Blocked storage: the site wears a shipped palette.
  }
  if (!raw) return null;
  try {
    const stored = JSON.parse(raw) as Partial<CustomTheme>;
    if (typeof stored.css !== 'string' || !stored.theme) return null;
    return { label: typeof stored.label === 'string' ? stored.label : 'Custom', css: stored.css, theme: stored.theme };
  } catch {
    return null;
  }
}

/** Keep the theme, put it on the page, and wear it. */
export function saveCustom(theme: Theme, label: string): CustomTheme {
  const custom: CustomTheme = { label, css: themesCss(theme, customPalette), theme };
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(custom));
  } catch {
    // Blocked storage: the theme still shows on this page, until it is left.
  }
  applyStyle(CUSTOM_STYLE, custom.css);
  setPref('palette', customPalette);
  return custom;
}

export function clearCustom(): void {
  try {
    localStorage.removeItem(CUSTOM_KEY);
  } catch {
    // Nothing was stored.
  }
  applyStyle(CUSTOM_STYLE, '');
  setPref('palette', 'default');
}
