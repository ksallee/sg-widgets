/**
 * The theme the Themes page edits: one token block per mode, the tokens in the order
 * they were written, every value a string.
 *
 * A token a shadcn theme carries and this site has no use for is kept and written back
 * out, so pasting a theme in and copying it out loses nothing.
 */
import { formatOklch, parseColor, type Oklch } from './color';

export type Mode = 'light' | 'dark';
export const MODES: readonly Mode[] = ['light', 'dark'];

/** Token name (`--background`) to value, in file order. */
export type Tokens = Record<string, string>;

export interface Theme {
  light: Tokens;
  dark: Tokens;
}

export const emptyTheme = (): Theme => ({ light: {}, dark: {} });

/** The token's colour, or null when the value is not one, as `--radius` is not. */
export function colorOf(tokens: Tokens, name: string): Oklch | null {
  const value = tokens[name];
  return value === undefined ? null : parseColor(value);
}

export function setColor(tokens: Tokens, name: string, color: Oklch): Tokens {
  return { ...tokens, [name]: formatOklch(color) };
}

/** The name with the two dashes a CSS custom property carries. */
export const tokenName = (name: string): string => (name.startsWith('--') ? name : `--${name}`);

/** A colour value as oklch; anything else verbatim. */
export function normaliseValue(value: string): string {
  const color = parseColor(value);
  return color === null ? value.trim() : formatOklch(color);
}

export const cloneTheme = (theme: Theme): Theme => ({ light: { ...theme.light }, dark: { ...theme.dark } });
