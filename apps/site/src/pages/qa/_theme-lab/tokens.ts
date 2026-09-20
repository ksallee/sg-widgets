/**
 * The model behind the theme lab: the two colour-token blocks of src/styles/global.css,
 * read as written, edited in oklch, and rendered back as the same two blocks.
 *
 * Nothing here writes a file.
 */
import source from '../../../styles/global.css?raw';
import { contrast, formatOklch, over, parseOklch, toSrgb, type Oklch, type Rgb } from '../../../theme/color';

export { contrast, formatOklch, over, parseOklch, toSrgb };
export type { Oklch, Rgb };

export type Mode = 'light' | 'dark';
export const MODES: readonly Mode[] = ['light', 'dark'];

export interface Token {
  name: string;
  /** The value exactly as global.css writes it. */
  source: string;
  /** Null when the value is not an oklch colour, as `--radius` is not. */
  color: Oklch | null;
}

export interface Block {
  mode: Mode;
  /** The selector as written, line break included. */
  selector: string;
  lines: string[];
  tokens: Token[];
}

/** One mode's base: the hue every follower takes and the chroma its greys take. */
export interface Base {
  h: number;
  /** The hue global.css gives the light `--background`; it decides who follows by default. */
  fileH: number;
  c: number;
  /** The chroma global.css gives this mode's `--background`; tinted neutrals scale against it. */
  fileC: number;
  /** Below this chroma a token counts as a neutral. */
  limit: number;
  /** Off leaves the mode exactly as written. */
  apply: boolean;
}

export interface Edit {
  follow?: boolean;
  l?: number;
  c?: number;
  h?: number;
  a?: number;
}

export interface Resolved {
  token: Token;
  /** What the follow box shows, whether or not the mode's tint is on. */
  followChecked: boolean;
  lockC: boolean;
  lockH: boolean;
  color: Oklch;
  changed: boolean;
  /** The value to write: the source text when nothing changed. */
  value: string;
}

const BLOCK: Record<Mode, RegExp> = {
  light: /^(:root,\s*\n\[data-stage\])\s*\{\n([\s\S]*?)\n\}/m,
  dark: /^(:root\[data-theme='dark'\],\s*\n\[data-stage\]\.dark)\s*\{\n([\s\S]*?)\n\}/m,
};

const LINE = /^(\s*)(--[a-z0-9-]+)(:\s*)([^;]*?)(\s*;.*)$/;

/** Status, focus and chart colours keep their own hue unless a row is ticked. */
const OWN_HUE = /^--(?:(?:destructive|success|warning|info)(?:-foreground)?|(?:sidebar-)?ring|chart-\d+)$/;

export const GROUPS: readonly (readonly [string, readonly string[]])[] = [
  ['Surfaces', ['--background', '--foreground', '--card', '--card-foreground', '--popover', '--popover-foreground']],
  [
    'Intent',
    ['--primary', '--primary-foreground', '--secondary', '--secondary-foreground', '--muted', '--muted-foreground', '--accent', '--accent-foreground'],
  ],
  ['Lines and focus', ['--border', '--input', '--ring']],
  [
    'Status',
    ['--destructive', '--destructive-foreground', '--success', '--success-foreground', '--warning', '--warning-foreground', '--info', '--info-foreground'],
  ],
  ['Charts', ['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']],
  [
    'Sidebar',
    ['--sidebar', '--sidebar-foreground', '--sidebar-primary', '--sidebar-primary-foreground', '--sidebar-accent', '--sidebar-accent-foreground', '--sidebar-border', '--sidebar-ring'],
  ],
];

/**
 * The surfaces each token is read against. A `-foreground` token is text and wants 4.5:1;
 * `--ring` is a focus mark and wants 3:1 on the page, the rule `tools/drives/palette-contrast.js`
 * asserts; a line and a selected row are read and not held to a number.
 */
export const CONTRAST: Readonly<Record<string, readonly string[]>> = {
  '--foreground': ['--background', '--card'],
  '--card-foreground': ['--card'],
  '--popover-foreground': ['--popover'],
  '--primary-foreground': ['--primary'],
  '--secondary-foreground': ['--secondary'],
  '--muted-foreground': ['--muted', '--background'],
  '--accent-foreground': ['--accent'],
  '--destructive-foreground': ['--destructive'],
  '--success-foreground': ['--success'],
  '--warning-foreground': ['--warning'],
  '--info-foreground': ['--info'],
  '--sidebar-foreground': ['--sidebar'],
  '--sidebar-primary-foreground': ['--sidebar-primary'],
  '--sidebar-accent-foreground': ['--sidebar-accent'],
  '--border': ['--background'],
  '--input': ['--background'],
  '--ring': ['--background'],
  '--accent': ['--background'],
};

export const TEXT_RATIO = 4.5;
export const RING_RATIO = 3;

/** The ratio a token is held to, or null for one that is only read. */
export function wantedRatio(name: string): number | null {
  if (name === '--foreground' || name.endsWith('-foreground')) return TEXT_RATIO;
  if (name === '--ring') return RING_RATIO;
  return null;
}

export function readBlocks(css: string = source): Record<Mode, Block> {
  const blocks = {} as Record<Mode, Block>;
  for (const mode of MODES) {
    const match = BLOCK[mode].exec(css);
    if (!match) {
      throw new Error(
        `The ${mode} token block of src/styles/global.css was not found. The lab reads ":root, [data-stage] {" and ":root[data-theme='dark'], [data-stage].dark {", each selector on two lines.`,
      );
    }
    const lines = match[2]!.split('\n');
    const tokens: Token[] = [];
    for (const line of lines) {
      const parts = LINE.exec(line);
      if (parts) tokens.push({ name: parts[2]!, source: parts[4]!, color: parseOklch(parts[4]!) });
    }
    blocks[mode] = { mode, selector: match[1]!, lines, tokens };
  }
  return blocks;
}

/** The block as global.css would hold it: untouched lines verbatim, comments kept. */
export function renderBlock(block: Block, values: ReadonlyMap<string, string>): string {
  const body = block.lines.map((line) => {
    const parts = LINE.exec(line);
    if (!parts) return line;
    const value = values.get(parts[2]!);
    return value === undefined ? line : `${parts[1]}${parts[2]}${parts[3]}${value}${parts[5]}`;
  });
  return `${block.selector} {\n${body.join('\n')}\n}`;
}

const REM = /^([\d.]+)rem$/;

const trimmed = (n: number, digits: number) => String(Number(n.toFixed(digits)));

/** The theme radius as global.css writes it, in rem; null when it is not a plain rem length. */
export function readRadius(blocks: Record<Mode, Block>): { source: string; rem: number } | null {
  const token = blocks.light.tokens.find((t) => t.name === '--radius');
  const match = token ? REM.exec(token.source.trim()) : null;
  return token && match ? { source: token.source, rem: Number(match[1]) } : null;
}

export const formatRem = (rem: number) => `${trimmed(rem, 4)}rem`;

export function followsByDefault(token: Token, base: Base): boolean {
  const color = token.color;
  if (!color || OWN_HUE.test(token.name)) return false;
  return color.c < base.limit || Math.abs(color.h - base.fileH) < 1;
}

/** A grey takes the base chroma; a tinted neutral keeps its share of it. */
function tint(fileC: number, base: Base): number {
  if (fileC === 0) return base.c;
  return base.fileC === 0 ? fileC : fileC * (base.c / base.fileC);
}

/** `followDefault` lets a dark token follow when its light twin does, so both modes lock the same rows. */
export function resolve(token: Token, edit: Edit | undefined, base: Base, followDefault = followsByDefault(token, base)): Resolved {
  const file = token.color!;
  const followChecked = edit?.follow ?? followDefault;
  const follow = base.apply && followChecked;
  // Pure black and pure white read the same at any tint, so a tint there only adds noise.
  const extreme = file.l <= 0.005 || file.l >= 0.995;
  const lockC = follow && file.c < base.limit && !extreme;
  const c = lockC ? tint(file.c, base) : (edit?.c ?? file.c);
  // The hue of a grey is not visible, so a follower without chroma keeps the hue it had.
  const lockH = follow && c > 0;
  const color: Oklch = {
    l: edit?.l ?? file.l,
    c,
    h: lockH ? base.h : (edit?.h ?? file.h),
    a: edit?.a ?? file.a,
  };
  const changed = formatOklch(color) !== formatOklch(file);
  return { token, followChecked, lockC, lockH, color, changed, value: changed ? formatOklch(color) : token.source };
}

/**
 * The live override. Doubled selectors outrank global.css wherever the tag sits, and the
 * light rule excludes dark so a light edit never leaks into a dark page or stage.
 */
export function overrideCss(rows: Record<Mode, Iterable<Resolved>>, radius: string | null = null): string {
  const body = (mode: Mode) =>
    [...rows[mode]]
      .filter((row) => row.changed)
      .map((row) => `  ${row.token.name}: ${row.value};`)
      .join('\n');
  return [
    `:root:root:not([data-theme='dark']),\n[data-stage][data-stage]:not(.dark) {\n${body('light')}\n}`,
    `:root:root[data-theme='dark'],\n[data-stage][data-stage].dark {\n${body('dark')}\n}`,
    // The radius holds in both modes, and a stage the demo toolbar gave its own radius keeps it.
    radius === null ? '' : `:root:root,\n[data-stage][data-stage][data-radius='default'] {\n  --radius: ${radius};\n}`,
  ].join('\n');
}
