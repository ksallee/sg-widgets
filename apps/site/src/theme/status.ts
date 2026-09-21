/**
 * The three status roles a shadcn theme does not carry, derived from the one it does.
 *
 * A role is the palette's own `--destructive` with its hue turned to green, amber or
 * blue: the same lightness, the same chroma, capped only by what the new hue holds at
 * that lightness. So the three sit on the step the theme put its destructive on and
 * read in the theme's own voice, whether that is a pastel or an ink.
 *
 * Contrast is information, not a constraint: `meetAA` walks a role away from the ink it
 * is read on until it clears 4.5:1, and that walk is what the presets in
 * src/styles/themes.css were written with.
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
 * The share of the hue's sRGB maximum a status colour takes. It keeps the colour off the
 * edge of the gamut, where a browser's own mapping would move it.
 */
const CHROMA_SHARE = 0.9165;

/** Lightness moves in this step, so a walked role lands on a round value rather than the exact threshold. */
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

/** The hue at this lightness, at the chroma it holds, never above the ceiling. */
const at = (l: number, hue: number, ceiling: number): Oklch => ({
  l,
  c: Math.min(ceiling, CHROMA_SHARE * maxChroma(l, hue)),
  h: hue,
  a: 1,
});

/** The destructive a role is turned from: the theme's own, or the fallback when it is an ink. */
const sourceOf = (destructive: Oklch, mode: Mode): Oklch => (destructive.c < INK ? FALLBACK[mode] : destructive);

/** One status colour, from the destructive of the same mode. */
export function deriveRole(role: StatusRole, destructive: Oklch, mode: Mode = 'light'): Oklch {
  const from = sourceOf(destructive, mode);
  return at(clampL(from.l), STATUS_HUES[role], from.c);
}

/**
 * The colour walked away from the ink it is read on, in steps of lightness, until it
 * clears AA. Its hue holds; its chroma follows what the hue allows, never above the
 * ceiling, which is the colour's own unless a wider one is named.
 */
export function meetAA(color: Oklch, foreground: Oklch, ceiling: number = color.c): Oklch {
  // Away from the foreground: a light ink wants a darker colour under it, a dark ink a lighter one.
  const direction = foreground.l > color.l ? -1 : 1;
  let walked = color;
  for (let step = 1; step <= 200 && ratio(walked, foreground) < AA; step++) {
    const l = clampL(color.l + direction * step * STEP);
    if (l === walked.l) break;
    walked = at(l, color.h, ceiling);
  }
  return walked;
}

/** A role derived and then walked to AA on the foreground it is read on. */
export function roleMeetingAA(role: StatusRole, destructive: Oklch, foreground: Oklch, mode: Mode = 'light'): Oklch {
  return meetAA(deriveRole(role, destructive, mode), foreground, sourceOf(destructive, mode).c);
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
    const color = deriveRole(role, destructive, mode);
    out[role] = { color, foreground, ratio: ratio(color, foreground), aa: ratio(color, foreground) >= AA };
  }
  return out;
}
