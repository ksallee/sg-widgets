/**
 * The status derivation reproduces the palettes src/styles/themes.css already ships.
 *
 * Each tweakcn preset in that file carries a `--destructive` pair the preset defined and
 * three status roles derived from it. Deriving them again from the same pair has to land
 * on the same colours.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseOklch, ratio, type Oklch } from '../src/theme/color';
import { deriveRole, AA, STATUS_ROLES, type StatusRole } from '../src/theme/status';
import type { Mode } from '../src/theme/theme';

const css = readFileSync(fileURLToPath(new URL('../src/styles/themes.css', import.meta.url)), 'utf8');

/** The token values of one palette block of themes.css. */
function block(name: string, mode: Mode): Record<string, string> {
  const selector = mode === 'dark' ? `\\.sg-demo\\[data-theme='${name}'\\]\\.dark` : `\\.sg-demo\\[data-theme='${name}'\\]`;
  const match = new RegExp(`${selector},\\n[^{]*\\{([\\s\\S]*?)\\n\\}`).exec(css);
  if (!match) throw new Error(`No ${mode} block for ${name} in themes.css`);
  const tokens: Record<string, string> = {};
  for (const line of match[1]!.matchAll(/^\s*(--[\w-]+):\s*([^;]+);/gm)) tokens[line[1]!] = line[2]!.trim();
  return tokens;
}

const color = (text: string | undefined): Oklch => {
  const parsed = text === undefined ? null : parseOklch(text);
  if (!parsed) throw new Error(`Not an oklch colour: ${text}`);
  return parsed;
};

/**
 * The destructive pair the derivation ran on. It is the block's own, except where
 * themes.css says it replaced the preset's value; there the preset's is named here.
 */
const SOURCE: Partial<Record<string, Partial<Record<Mode, { destructive: string; foreground: string }>>>> = {
  // themes.css takes the shadcn dark destructive for this block; the preset's own is the ink below.
  supabase: { dark: { destructive: 'oklch(0.3123 0.0852 29.7877)', foreground: 'oklch(0.9368 0.0045 34.3092)' } },
};

const PALETTES = ['vercel', 'supabase', 'claude', 'twitter', 'catppuccin'] as const;
const MODES: readonly Mode[] = ['light', 'dark'];

/** The lightness step the derivation walks in; a role lands within one of it. */
const TOLERANCE = 0.004;

describe('the derived status roles', () => {
  for (const palette of PALETTES) {
    for (const mode of MODES) {
      it(`match the ones themes.css ships for ${palette} ${mode}`, () => {
        const tokens = block(palette, mode);
        const source = SOURCE[palette]?.[mode];
        const destructive = color(source?.destructive ?? tokens['--destructive']);
        const foreground = color(source?.foreground ?? tokens['--destructive-foreground']);

        for (const role of STATUS_ROLES) {
          const want = color(tokens[`--${role}`]);
          const got = deriveRole(role, destructive, foreground, mode);
          expect(got.h, `${role} hue`).toBe(want.h);
          expect(Math.abs(got.l - want.l), `${role} lightness ${got.l} against ${want.l}`).toBeLessThanOrEqual(TOLERANCE);
          expect(Math.abs(got.c - want.c), `${role} chroma ${got.c} against ${want.c}`).toBeLessThanOrEqual(TOLERANCE);
        }
      });

      it(`clear AA on the foreground they are read on for ${palette} ${mode}`, () => {
        const tokens = block(palette, mode);
        const source = SOURCE[palette]?.[mode];
        const destructive = color(source?.destructive ?? tokens['--destructive']);
        const foreground = color(source?.foreground ?? tokens['--destructive-foreground']);
        for (const role of STATUS_ROLES) {
          expect(ratio(deriveRole(role, destructive, foreground, mode), foreground)).toBeGreaterThanOrEqual(AA);
        }
      });
    }
  }

  it('turn an ink destructive into three colours that are told apart', () => {
    // The `claude` preset gives `--destructive` an ink, which carries no hue to turn.
    const ink = color('oklch(0.1908 0.0020 106.5859)');
    const white = color('oklch(1 0 0)');
    const roles = STATUS_ROLES.map((role: StatusRole) => deriveRole(role, ink, white, 'light'));
    for (const role of roles) {
      expect(role.c).toBeGreaterThan(0.05);
      expect(ratio(role, white)).toBeGreaterThanOrEqual(AA);
    }
  });
});
