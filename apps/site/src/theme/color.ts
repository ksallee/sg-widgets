/**
 * Colour for the theme tools: oklch, the other spellings a shadcn theme is written in,
 * the sRGB conversion and the contrast ratio the roles are held to.
 *
 * The theme lab (src/pages/qa/_theme-lab) and the Themes page share this file.
 */

export type Rgb = [number, number, number];

export interface Oklch {
  l: number;
  c: number;
  h: number;
  a: number;
}

const OKLCH = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)(%?)\s+([\d.]+)(?:deg)?\s*(?:\/\s*([\d.]+)(%?))?\s*\)$/i;

/** `hsl(210 40% 96%)`, `hsl(210, 40%, 96%)`, `hsla(...)` and the bare triple shadcn's older exports write. */
const HSL =
  /^(?:hsla?\(\s*)?(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%\s*(?:[/,]\s*([\d.]+)(%?)\s*)?\)?$/i;

const HEX = /^#(?:([\da-f]{3,4})|([\da-f]{6})|([\da-f]{8}))$/i;

export function parseOklch(text: string): Oklch | null {
  const match = OKLCH.exec(text.trim());
  if (!match) return null;
  const [, l, lPct, c, cPct, h, a, aPct] = match;
  const color: Oklch = {
    l: Number(l) / (lPct ? 100 : 1),
    c: cPct ? (Number(c) / 100) * 0.4 : Number(c),
    h: Number(h),
    a: a === undefined ? 1 : Number(a) / (aPct ? 100 : 1),
  };
  return Object.values(color).every(Number.isFinite) ? color : null;
}

function parseHsl(text: string): Oklch | null {
  const trimmedText = text.trim();
  // A bare triple is only a colour when it carries both percentages; `0 0 0` is not one.
  if (!/^hsla?\(/i.test(trimmedText) && !/%/.test(trimmedText)) return null;
  const match = HSL.exec(trimmedText);
  if (!match) return null;
  const [, h, s, l, a, aPct] = match;
  const hue = Number(h) / 360;
  const sat = Number(s) / 100;
  const light = Number(l) / 100;
  const alpha = a === undefined ? 1 : Number(a) / (aPct ? 100 : 1);
  if (![hue, sat, light, alpha].every(Number.isFinite)) return null;
  const k = (n: number) => (n + hue * 12) % 12;
  const chroma = sat * Math.min(light, 1 - light);
  const channel = (n: number) => light - chroma * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return { ...fromSrgb([channel(0), channel(8), channel(4)]), a: alpha };
}

function parseHex(text: string): Oklch | null {
  const match = HEX.exec(text.trim());
  if (!match) return null;
  const digits = match[1] ?? match[2] ?? match[3]!;
  const wide = digits.length <= 4;
  const pair = (i: number) =>
    wide ? Number.parseInt(digits[i]!.repeat(2), 16) / 255 : Number.parseInt(digits.slice(i * 2, i * 2 + 2), 16) / 255;
  const alpha = digits.length === 4 || digits.length === 8 ? pair(3) : 1;
  return { ...fromSrgb([pair(0), pair(1), pair(2)]), a: alpha };
}

/** A colour in any spelling a shadcn theme carries: oklch, hsl, a bare hsl triple or hex. */
export function parseColor(text: string): Oklch | null {
  return parseOklch(text) ?? parseHex(text) ?? parseHsl(text);
}

const trimmed = (n: number, digits: number) => String(Number(n.toFixed(digits)));

export function formatOklch({ l, c, h, a }: Oklch): string {
  const alpha = a < 1 ? ` / ${trimmed(a, 3)}` : '';
  return `oklch(${trimmed(l, 4)} ${trimmed(c, 4)} ${trimmed(h, 4)}${alpha})`;
}

export function toSrgb({ l, c, h }: Oklch): { rgb: Rgb; inGamut: boolean } {
  const angle = (h * Math.PI) / 180;
  const a = c * Math.cos(angle);
  const b = c * Math.sin(angle);
  const lms = [
    (l + 0.3963377774 * a + 0.2158037573 * b) ** 3,
    (l - 0.1055613458 * a - 0.0638541728 * b) ** 3,
    (l - 0.0894841775 * a - 1.291485548 * b) ** 3,
  ] as const;
  const linear: Rgb = [
    4.0767416621 * lms[0] - 3.3077115913 * lms[1] + 0.2309699292 * lms[2],
    -1.2684380046 * lms[0] + 2.6097574011 * lms[1] - 0.3413193965 * lms[2],
    -0.0041960863 * lms[0] - 0.7034186147 * lms[1] + 1.707614701 * lms[2],
  ];
  const inGamut = linear.every((v) => v > -0.001 && v < 1.001);
  const rgb = linear.map((v) => {
    const x = Math.min(1, Math.max(0, v));
    return x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055;
  }) as Rgb;
  return { rgb, inGamut };
}

const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);

export function fromSrgb(rgb: Rgb): Oklch {
  const [r, g, b] = rgb.map(toLinear) as Rgb;
  const lms = [
    (0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b) ** (1 / 3),
    (0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b) ** (1 / 3),
    (0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b) ** (1 / 3),
  ] as const;
  const l = 0.2104542553 * lms[0] + 0.793617785 * lms[1] - 0.0040720468 * lms[2];
  const a = 1.9779984951 * lms[0] - 2.428592205 * lms[1] + 0.4505937099 * lms[2];
  const bb = 0.0259040371 * lms[0] + 0.7827717662 * lms[1] - 0.808675766 * lms[2];
  const c = Math.sqrt(a * a + bb * bb);
  const h = c < 1e-6 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l, c, h, a: 1 };
}

const luminance = ([r, g, b]: Rgb) => 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);

export function over(top: Rgb, alpha: number, under: Rgb): Rgb {
  return [0, 1, 2].map((i) => alpha * top[i]! + (1 - alpha) * under[i]!) as Rgb;
}

export function contrast(one: Rgb, two: Rgb): number {
  const [light, dark] = [luminance(one), luminance(two)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

/** The contrast of two colours, the lighter over the darker, in sRGB. */
export const ratio = (one: Oklch, two: Oklch): number => contrast(toSrgb(one).rgb, toSrgb(two).rgb);

/** The colour as a hex triple, which is what a colour input takes. */
export function toHex(color: Oklch): string {
  const channel = (v: number) =>
    Math.round(Math.min(1, Math.max(0, v)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toSrgb(color).rgb.map(channel).join('')}`;
}

/** The largest chroma this lightness and hue hold inside sRGB. */
export function maxChroma(l: number, h: number): number {
  let low = 0;
  let high = 0.4;
  for (let i = 0; i < 40; i++) {
    const mid = (low + high) / 2;
    if (toSrgb({ l, c: mid, h, a: 1 }).inGamut) low = mid;
    else high = mid;
  }
  return low;
}
