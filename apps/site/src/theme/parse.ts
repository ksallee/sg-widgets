/**
 * Reading a pasted theme: the `:root` and `.dark` pair shadcn tools export, in oklch,
 * hsl or hex, or the registry JSON tweakcn serves, with its tokens under
 * `cssVars.light` and `cssVars.dark`.
 *
 * Colour values are rewritten as oklch; every other value, and every token this site
 * does not use, is kept as written.
 */
import { MODES, emptyTheme, normaliseValue, tokenName, type Mode, type Theme, type Tokens } from './theme';

export class ThemeParseError extends Error {
  /** 1-based line of the pasted text, or null when the text as a whole is the problem. */
  readonly line: number | null;

  constructor(message: string, line: number | null = null) {
    super(line === null ? message : `Line ${line}: ${message}`);
    this.name = 'ThemeParseError';
    this.line = line;
  }
}

const DECLARATION = /^\s*(--[\w-]+)\s*:\s*([^;]+);?\s*$/;

/** The mode a selector writes, or null for one this page has no use for. */
function targetOf(selector: string): Mode | null {
  const text = selector.toLowerCase();
  if (text.includes('.dark') || text.includes("[data-theme='dark']") || text.includes('[data-theme="dark"]')) return 'dark';
  if (text.includes(':root')) return 'light';
  return null;
}

function parseCss(text: string): Theme {
  const theme = emptyTheme();
  const stack: (Mode | null)[] = [];
  let buffer = '';
  let bufferLine = 1;
  let line = 1;
  let seen = false;

  /** A `--token: value;` run, taken when the block it sits in names a mode. */
  const take = (): void => {
    const chunk = buffer.trim();
    buffer = '';
    if (chunk === '') return;
    const mode = stack.at(-1);
    if (!mode) return;
    const parts = DECLARATION.exec(chunk);
    if (!parts) throw new ThemeParseError(`Expected a token, as in "--background: oklch(1 0 0);". Read "${chunk}".`, bufferLine);
    theme[mode][parts[1]!] = normaliseValue(parts[2]!);
    seen = true;
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (char === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      const comment = text.slice(i, end === -1 ? undefined : end + 2);
      line += comment.split('\n').length - 1;
      i += comment.length - 1;
      continue;
    }
    if (char === '\n') {
      line++;
      buffer += ' ';
      continue;
    }
    if (buffer.trim() === '') bufferLine = line;

    if (char === '{') {
      const selector = buffer.trim();
      buffer = '';
      // An `@layer` or `@media` wrapper holds the blocks that matter; it names no mode itself.
      stack.push(selector.startsWith('@') ? (stack.at(-1) ?? null) : targetOf(selector));
    } else if (char === '}') {
      take();
      if (stack.length === 0) throw new ThemeParseError('A closing brace with no block open.', line);
      stack.pop();
    } else if (char === ';') {
      take();
    } else {
      buffer += char;
    }
  }

  if (stack.length > 0) throw new ThemeParseError('A block was opened and never closed.');
  if (!seen) throw new ThemeParseError('No tokens found. A theme is a `:root` block and a `.dark` block of `--token: value;` lines.');
  return theme;
}

interface RegistryTheme {
  cssVars?: Partial<Record<Mode | 'theme', Record<string, string>>>;
  light?: Record<string, string>;
  dark?: Record<string, string>;
}

function parseJson(text: string): Theme {
  let data: RegistryTheme;
  try {
    data = JSON.parse(text) as RegistryTheme;
  } catch (error) {
    const at = /position (\d+)/.exec(String(error))?.[1];
    const line = at === undefined ? null : text.slice(0, Number(at)).split('\n').length;
    throw new ThemeParseError('Not valid JSON.', line);
  }

  const theme = emptyTheme();
  for (const mode of MODES) {
    const block = data.cssVars?.[mode] ?? data[mode];
    if (!block) continue;
    const tokens: Tokens = {};
    for (const [name, value] of Object.entries(block)) tokens[tokenName(name)] = normaliseValue(String(value));
    theme[mode] = tokens;
  }
  // tweakcn keeps the radius with the typefaces under `theme`, and the rest of that block
  // is Tailwind's own scale, which a palette does not carry.
  const radius = data.cssVars?.theme?.radius;
  if (radius !== undefined && theme.light['--radius'] === undefined) theme.light['--radius'] = radius;

  if (Object.keys(theme.light).length === 0 && Object.keys(theme.dark).length === 0) {
    throw new ThemeParseError('No tokens found. A registry theme carries them under `cssVars.light` and `cssVars.dark`.');
  }
  return theme;
}

/** A pasted theme, in either shape. */
export function parseTheme(text: string): Theme {
  const trimmed = text.trim();
  if (trimmed === '') throw new ThemeParseError('Nothing to read.');
  return trimmed.startsWith('{') ? parseJson(trimmed) : parseCss(trimmed);
}
