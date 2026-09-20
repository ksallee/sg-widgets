/**
 * The three status roles a shadcn theme does not carry, derived from the one it does.
 *
 * The rule is the one src/styles/themes.css states and its presets were written with:
 * the palette's own `--destructive` turned to green, amber and blue at the chroma each
 * hue allows, read on that palette's own `--destructive-foreground`, and darkened or
 * lightened from there only as far as AA needs.
 */
import { maxChroma, parseColor, ratio, type Oklch } from './color';
import { colorOf, type Mode, type Tokens } from './theme';

export type StatusRole = 'success' | 'warning' | 'info';
export const STATUS_ROLES: readonly StatusRole[] = ['success', 'warning', 'info'];

/** Green, amber and blue: the hue each role is read as, whatever hue the destructive has. */
export const STATUS_HUES: Readonly<Record<StatusRole, number>> = { success: 145, warning: 75, info: 240 };

/** Text on a status colour is text: 4.5:1. */
export const AA = 4.5;

/**
 * The share of the hue's sRGB maximum a status colour takes. It is the share the presets
 * in themes.css sit on, and it keeps the colour off the edge of the gamut, where a
 * browser's own mapping would move it.
 */
const CHROMA_SHARE = 0.9165;

/** Lightness moves in this step, so a role lands on a round value rather than the exact threshold. */
const STEP = 0.004;

/** Below this chroma a destructive is an ink, which cannot tell three hues apart. */
const INK = 0.05;

/**
 * The destructive a mode falls back to when the theme's own is an ink: the shadcn default,
 * which is what the `nova` palette carries.
 */
const FALLBACK: Readonly<Record<Mode, Oklch>> = {
  light: { l: 0.577, c: 0.245, h: 27.325, a: 1 },
  dark: { l: 0.704, c: 0.191, h: 22.216, a: 1 },
};

const clampL = (l: number) => Math.min(0.98, Math.max(0.02, l));

/** The role at this lightness: its own hue, at the chroma the hue holds, never above the destructive's. */
function at(l: number, hue: number, destructive: Oklch): Oklch {
  return { l, c: Math.min(destructive.c, CHROMA_SHARE * maxChroma(l, hue)), h: hue, a: 1 };
}

/** One status colour, from the destructive pair of the same mode. */
export function deriveRole(role: StatusRole, destructive: Oklch, foreground: Oklch, mode: Mode = 'light'): Oklch {
  const from = destructive.c < INK ? FALLBACK[mode] : destructive;
  const hue = STATUS_HUES[role];
  // Away from the foreground: a light ink wants a darker colour under it, a dark ink a lighter one.
  const direction = foreground.l > from.l ? -1 : 1;
  let color = at(clampL(from.l), hue, from);
  for (let step = 1; step <= 200 && ratio(color, foreground) < AA; step++) {
    const l = clampL(from.l + direction * step * STEP);
    if (l === color.l) break;
    color = at(l, hue, from);
  }
  return color;
}

export interface Status {
  color: Oklch;
  foreground: Oklch;
  ratio: number;
  aa: boolean;
}

/** The three roles of one mode, each with the contrast it reads at. */
export function deriveStatus(tokens: Tokens, mode: Mode): Record<StatusRole, Status> | null {
  const destructive = colorOf(tokens, '--destructive');
  if (!destructive) return null;
  const foreground =
    colorOf(tokens, '--destructive-foreground') ??
    colorOf(tokens, '--background') ??
    parseColor(mode === 'dark' ? 'oklch(0.145 0 0)' : 'oklch(1 0 0)')!;
  const out = {} as Record<StatusRole, Status>;
  for (const role of STATUS_ROLES) {
    const color = deriveRole(role, destructive, foreground, mode);
    out[role] = { color, foreground, ratio: ratio(color, foreground), aa: ratio(color, foreground) >= AA };
  }
  return out;
}
