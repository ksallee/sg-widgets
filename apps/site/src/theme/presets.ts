/**
 * The themes the site already ships, read out of the stylesheets that hold them, so the
 * Themes page starts from the same values the palette select puts on a page.
 */
import globalSource from '../styles/global.css?raw';
import themesSource from '../styles/themes.css?raw';
import { parseTheme } from './parse';
import { defaultPalette } from '../components/demo-prefs';
import type { Theme } from './theme';

const blockOf = (source: string, selector: RegExp): string => {
  const match = selector.exec(source);
  if (!match) throw new Error(`No block for ${selector} in the site stylesheets.`);
  return match[0];
};

/** One of the palettes in the header select, as a theme. */
export function presetTheme(name: string): Theme {
  if (name === defaultPalette) {
    // The default palette has no block of its own: it is the token set global.css writes.
    return parseTheme(
      [
        blockOf(globalSource, /^:root,\s*\n\[data-stage\]\s*\{[\s\S]*?\n\}/m),
        blockOf(globalSource, /^:root\[data-theme='dark'\],\s*\n\[data-stage\]\.dark\s*\{[\s\S]*?\n\}/m),
      ].join('\n\n'),
    );
  }
  return parseTheme(
    [
      blockOf(themesSource, new RegExp(`^\\.sg-demo\\[data-theme='${name}'\\],[\\s\\S]*?\\n\\}`, 'm')),
      blockOf(themesSource, new RegExp(`^\\.sg-demo\\[data-theme='${name}'\\]\\.dark,[\\s\\S]*?\\n\\}`, 'm')),
    ].join('\n\n'),
  );
}
