/**
 * Reading a pasted theme and writing it back out.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parseOklch } from '../src/theme/color';
import { ThemeParseError, parseTheme } from '../src/theme/parse';
import { shadcnCss, slugify, themesCss } from '../src/theme/serialise';
import { withStatus } from '../src/theme/adjust';

const registry = readFileSync(fileURLToPath(new URL('./fixtures/tweakcn-vercel.json', import.meta.url)), 'utf8');

const CSS = `:root {
  --background: oklch(0.99 0 0);
  --foreground: #1a1a1a;
  --primary: 240 5.9% 10%;
  --destructive: hsl(0 84.2% 60.2%);
  --destructive-foreground: oklch(1 0 0);
  --radius: 0.5rem;
  --font-sans: Geist, sans-serif;
}

.dark {
  --background: oklch(0.145 0 0);
  --foreground: oklch(0.985 0 0);
  --primary: #fafafa;
  --destructive: oklch(0.704 0.191 22.216);
  --destructive-foreground: oklch(0.145 0 0);
}`;

describe('a pasted theme', () => {
  it('reads the pair shadcn exports, in each spelling of a colour', () => {
    const theme = parseTheme(CSS);
    expect(theme.light['--background']).toBe('oklch(0.99 0 0)');
    // Hex and hsl arrive as oklch; the bare triple is the spelling shadcn's older exports use.
    expect(parseOklch(theme.light['--foreground']!)?.l).toBeCloseTo(0.2178, 3);
    expect(parseOklch(theme.light['--primary']!)?.l).toBeCloseTo(0.21, 2);
    expect(parseOklch(theme.light['--destructive']!)?.h).toBeCloseTo(25.33, 1);
    expect(parseOklch(theme.dark['--primary']!)?.l).toBeCloseTo(0.985, 2);
  });

  it('keeps a token this site has no use for', () => {
    expect(parseTheme(CSS).light['--font-sans']).toBe('Geist, sans-serif');
  });

  it('reads the registry JSON tweakcn serves', () => {
    const theme = parseTheme(registry);
    expect(theme.light['--background']).toBe('oklch(0.99 0 0)');
    expect(theme.dark['--destructive']).toBe('oklch(0.69 0.2 23.91)');
    expect(theme.light['--radius']).toBe('0.5rem');
    expect(theme.light['--shadow-opacity']).toBe('0.18');
  });

  it('says which line it could not read', () => {
    const broken = ':root {\n  --background: oklch(1 0 0);\n  --foreground oklch(0 0 0);\n}';
    expect(() => parseTheme(broken)).toThrow(ThemeParseError);
    try {
      parseTheme(broken);
    } catch (error) {
      expect((error as ThemeParseError).line).toBe(3);
      expect((error as Error).message).toContain('Line 3');
    }
  });

  it('says so when there is no theme in the text', () => {
    expect(() => parseTheme('body { color: red; }')).toThrow(/No tokens found/);
    expect(() => parseTheme('{ "name": "x" }')).toThrow(/No tokens found/);
    expect(() => parseTheme('{ "cssVars": }')).toThrow(/Not valid JSON/);
  });
});

describe('a theme written back out', () => {
  const theme = withStatus(parseTheme(CSS));

  it('carries the status roles in the shadcn pair', () => {
    const css = shadcnCss(theme);
    expect(css).toMatch(/^:root \{/);
    expect(css).toContain('\n.dark {');
    for (const role of ['success', 'warning', 'info']) {
      expect(css).toContain(`--${role}:`);
      expect(css).toContain(`--${role}-foreground:`);
    }
  });

  it('reads back as the theme it was written from', () => {
    expect(parseTheme(shadcnCss(theme))).toEqual(theme);
  });

  it('carries both selectors themes.css needs, under the slug', () => {
    const css = themesCss(theme, 'ocean');
    expect(css).toContain(".sg-demo[data-theme='ocean'],\n:root[data-sg-palette='ocean'] {");
    expect(css).toContain(".sg-demo[data-theme='ocean'].dark,\n:root[data-sg-palette='ocean'][data-theme='dark'] {");
    // The radius override at the foot of themes.css outranks the light block alone.
    expect(css.split('.dark,')[1]).not.toContain('--radius:');
  });

  it('makes a slug of what the user typed', () => {
    expect(slugify('Ocean Blue')).toBe('ocean-blue');
    expect(slugify('  my theme!  ')).toBe('my-theme');
  });
});
