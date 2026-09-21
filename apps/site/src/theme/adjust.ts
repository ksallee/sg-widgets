/**
 * The short editor's four moves: the primary colour, the hue and the tint of the
 * neutrals, the radius, and the three status roles.
 *
 * Every move is held apart from the theme it was pasted from and applied to it afresh,
 * so a slider dragged twice lands where it would have landed once.
 */
import { formatOklch, parseColor, ratio, type Oklch } from './color';
import { deriveStatus, STATUS_ROLES, type StatusRole } from './status';
import { MODES, cloneTheme, colorOf, type Mode, type Theme, type Tokens } from './theme';

/** Above this chroma a token carries a colour of its own and no tint touches it. */
const NEUTRAL = 0.05;

/** Status, focus and chart colours keep their own hue. */
const OWN_HUE = /^--(?:(?:destructive|success|warning|info)(?:-foreground)?|(?:sidebar-)?ring|chart-\d+|primary(?:-foreground)?)$/;

export interface Adjustments {
  /** The hue every neutral takes, or null for the one the theme was pasted with. */
  hue: number | null;
  /** The chroma the background takes; the other neutrals keep their share of it. */
  tint: number | null;
  radius: string | null;
  primary: Partial<Record<Mode, string>>;
  status: Partial<Record<Mode, Partial<Record<StatusRole, string>>>>;
}

export const noAdjustments = (): Adjustments => ({ hue: null, tint: null, radius: null, primary: {}, status: {} });

/** The hue the theme's light background carries; a grey background has none, so 0. */
export function backgroundHue(theme: Theme): number {
  const background = colorOf(theme.light, '--background');
  return background && background.c > 0 ? background.h : 0;
}

export function backgroundTint(theme: Theme, mode: Mode): number {
  return colorOf(theme[mode], '--background')?.c ?? 0;
}

export function radiusOf(theme: Theme): string {
  return theme.light['--radius'] ?? '0.625rem';
}

/** A neutral takes the base chroma; a token with a share of it keeps that share. */
function tinted(color: Oklch, hue: number, tint: number, fileTint: number): Oklch {
  // Black and white read the same at any tint, so a tint there only adds noise.
  if (color.l <= 0.005 || color.l >= 0.995) return color;
  const c = fileTint === 0 ? tint : color.c * (tint / fileTint);
  return { ...color, c, h: c > 0 ? hue : color.h };
}

function retint(tokens: Tokens, hue: number, tint: number, fileTint: number): Tokens {
  const out: Tokens = {};
  for (const [name, value] of Object.entries(tokens)) {
    const color = parseColor(value);
    if (!color || color.c >= NEUTRAL || OWN_HUE.test(name)) {
      out[name] = value;
      continue;
    }
    out[name] = formatOklch(tinted(color, hue, tint, fileTint));
  }
  return out;
}

/** The ink a colour carries: whichever of the mode's two ends reads better on it. */
function inkFor(tokens: Tokens, color: Oklch): string | null {
  const light = colorOf(tokens, '--background');
  const dark = colorOf(tokens, '--foreground');
  if (!light || !dark) return null;
  return formatOklch(ratio(color, light) >= ratio(color, dark) ? light : dark);
}

/** The theme with the three status roles written in, derived where the paste had none. */
export function withStatus(theme: Theme): Theme {
  const out = cloneTheme(theme);
  for (const mode of MODES) {
    const status = deriveStatus(out[mode], mode);
    if (!status) continue;
    // The three sit under the destructive they come from, as themes.css writes them.
    const anchor = out[mode]['--destructive-foreground'] === undefined ? '--destructive' : '--destructive-foreground';
    const tokens: Tokens = {};
    for (const [name, value] of Object.entries(out[mode])) {
      tokens[name] = value;
      if (name !== anchor) continue;
      for (const role of STATUS_ROLES) {
        tokens[`--${role}`] ??= formatOklch(status[role].color);
        tokens[`--${role}-foreground`] ??= formatOklch(status[role].foreground);
      }
    }
    out[mode] = tokens;
  }
  return out;
}

/** The pasted theme with the editor's moves on it. */
export function adjust(base: Theme, edits: Adjustments): Theme {
  const theme = withStatus(base);
  const hue = edits.hue ?? backgroundHue(base);
  for (const mode of MODES) {
    if (edits.hue !== null || edits.tint !== null) {
      theme[mode] = retint(theme[mode], hue, edits.tint ?? backgroundTint(base, mode), backgroundTint(base, mode));
    }
    const primary = edits.primary[mode] ? parseColor(edits.primary[mode]!) : null;
    if (primary) {
      theme[mode] = { ...theme[mode], '--primary': formatOklch(primary) };
      const ink = inkFor(theme[mode], primary);
      if (ink) theme[mode]['--primary-foreground'] = ink;
    }
    for (const [role, value] of Object.entries(edits.status[mode] ?? {})) {
      const color = parseColor(value);
      if (color) theme[mode] = { ...theme[mode], [`--${role}`]: formatOklch(color) };
    }
  }
  if (edits.radius !== null) theme.light['--radius'] = edits.radius;
  return theme;
}
