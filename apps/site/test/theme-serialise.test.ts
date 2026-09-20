/**
 * The rule that dresses the preview stage while a theme is being edited.
 */
import { describe, expect, it } from 'vitest';
import { previewCss } from '../src/theme/serialise';
import type { Theme } from '../src/theme/theme';

const theme: Theme = {
  light: { '--background': 'oklch(1 0 0)', '--radius': '0.4rem' },
  dark: { '--background': 'oklch(0.25 0.03 234)' },
};

/** The selector of each rule in a block, in file order. */
const selectors = (css: string): string[] => [...css.matchAll(/^(.+) \{$/gm)].map((match) => match[1]!);

describe('the preview rule', () => {
  it('dresses the stage by the mode the stage is in, as a shipped palette does', () => {
    expect(selectors(previewCss(theme))).toEqual([
      '[data-stage][data-stage][data-stage]',
      '[data-stage][data-stage][data-stage].dark',
    ]);
  });

  it('pins no stage to a mode of its own', () => {
    expect(previewCss(theme)).not.toContain('data-theme-lock');
  });

  it('carries each mode its own tokens', () => {
    const [light, dark] = previewCss(theme).split('\n\n');
    expect(light).toContain('--background: oklch(1 0 0);');
    expect(light).toContain('--radius: 0.4rem;');
    expect(dark).toContain('--background: oklch(0.25 0.03 234);');
    expect(dark).not.toContain('--radius');
  });
});
