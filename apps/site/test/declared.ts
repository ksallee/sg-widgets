/**
 * The props each registry component declares, read out of its source.
 *
 * React: the `<Pascal>Props` interface. Svelte: the `Props` type the `$props()`
 * destructure is annotated with. Both are read the same way -- an object body, an
 * `extends` or `&` chain, `Omit` and `Pick` -- with the framework's own attribute
 * types (`HTMLAttributes`, `WithElementRef`) left out, since those are what a widget
 * spreads onto its root rather than what it takes.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../../', import.meta.url));
export const reactDir = join(root, 'packages/react/src/registry/sg/components');
export const svelteDir = join(root, 'packages/svelte/src/lib/registry/components');
const coreDir = join(root, 'packages/core/src');

/** Framework types: what a widget spreads onto its root, not what it takes. */
const IGNORED_TYPES = new Set([
  'HTMLAttributes',
  'DivProps',
  'WithElementRef',
  'SVGAttributes',
  'HTMLButtonAttributes',
  'HTMLInputAttributes',
]);

interface TypeDef {
  kind: 'interface' | 'type';
  name: string;
  path: string;
  heads: string;
  body: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path, out);
    else out.push(path);
  }
  return out;
}

function strip(text: string): string {
  return text
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
    .replace(/^[ \t]*import\b[\s\S]*?from\s*['"][^'"]*['"];?/gm, '');
}

export function sourceOf(path: string): string {
  const text = readFileSync(path, 'utf8');
  if (!path.endsWith('.svelte')) return strip(text);
  return strip([...text.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map((m) => m[1]).join('\n'));
}

/** `>` closes a generic; `=>` does not. */
function closes(text: string, index: number): boolean {
  const char = text[index];
  if (!'})>]'.includes(char)) return false;
  return !(char === '>' && text[index - 1] === '=');
}

function block(text: string, from: number): string {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}' && --depth === 0) return text.slice(from + 1, i);
  }
  return '';
}

function toSemicolon(text: string, from: number): string {
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if ('{(<['.includes(text[i]!)) depth++;
    else if (closes(text, i)) depth--;
    else if (text[i] === ';' && depth === 0) return text.slice(from, i);
  }
  return text.slice(from);
}

function split(text: string, on: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if ('{(<['.includes(char)) depth++;
    if (closes(text, i)) depth--;
    if (char === on && depth === 0) {
      parts.push(current);
      current = '';
    } else current += char;
  }
  parts.push(current);
  return parts;
}

function members(body: string): string[] {
  const names: string[] = [];
  let depth = 0;
  let line = '';
  for (let i = 0; i < body.length; i++) {
    const char = body[i]!;
    if ('{(<['.includes(char)) depth++;
    if (closes(body, i)) depth--;
    if (depth === 0 && (char === ';' || char === '\n')) {
      // An index signature (`[key: `data-${string}`]`) is not a prop.
      const found = line.trim().startsWith('[')
        ? null
        : line.match(/(?:^|\s)(?:readonly\s+)?['"]?([A-Za-z0-9_$-]+)['"]?\??\s*:/);
      if (found) names.push(found[1]!);
      line = '';
    } else line += char;
  }
  return names;
}

export type TypeIndex = Map<string, TypeDef>;

export function buildIndex(dirs: string[]): TypeIndex {
  const types: TypeIndex = new Map();
  for (const dir of dirs) {
    for (const path of walk(dir)) {
      if (!/\.(ts|tsx|svelte)$/.test(path)) continue;
      const source = sourceOf(path);
      const pattern = /^[ \t]*(?:export\s+)?(interface|type)\s+([A-Za-z0-9_]+)/gm;
      let found: RegExpExecArray | null;
      while ((found = pattern.exec(source))) {
        const [whole, kind, name] = found;
        const key = `${path}#${name}`;
        if (types.has(key)) continue;
        if (kind === 'interface') {
          const open = source.indexOf('{', found.index);
          types.set(key, {
            kind: 'interface',
            name: name!,
            path,
            heads: source.slice(found.index + whole!.length, open),
            body: block(source, open),
          });
        } else {
          const equals = source.indexOf('=', found.index);
          types.set(key, {
            kind: 'type',
            name: name!,
            path,
            heads: '',
            body: toSemicolon(source, equals + 1),
          });
        }
      }
    }
  }
  return types;
}

function keysIn(text: string): Set<string> {
  return new Set([...text.matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2]!));
}

function lookUp(name: string, index: TypeIndex, path: string, seen: Set<string>): string[] {
  if (seen.has(name)) return [];
  const def =
    index.get(`${path}#${name}`) ?? [...index.values()].find((type) => type.name === name);
  if (!def) return [];
  const next = new Set([...seen, name]);
  const out: string[] = [];
  if (def.kind === 'interface') {
    const extended = def.heads.match(/extends([\s\S]*)$/);
    if (extended) out.push(...names(split(extended[1]!, ',').join(' & '), index, def.path, next));
    out.push(...members(def.body));
  } else {
    out.push(...names(def.body, index, def.path, next));
  }
  return out;
}

/** The prop names a type expression contributes. */
export function names(
  expression: string,
  index: TypeIndex,
  path: string,
  seen: Set<string> = new Set(),
): string[] {
  const out: string[] = [];
  for (const raw of split(expression, '&')) {
    const part = raw.trim();
    if (!part) continue;
    if (part.startsWith('{')) {
      out.push(...members(block(part, 0)));
      continue;
    }
    const shaped = part.match(/^(Omit|Pick|WithElementRef)<([\s\S]+)>$/);
    if (shaped) {
      const args = split(shaped[2]!, ',').map((arg) => arg.trim());
      const inner = names(args[0]!, index, path, seen);
      if (shaped[1] === 'Omit') {
        const dropped = keysIn(args[1] ?? '');
        out.push(...inner.filter((name) => !dropped.has(name)));
      } else if (shaped[1] === 'Pick') {
        const kept = keysIn(args[1] ?? '');
        out.push(...inner.filter((name) => kept.has(name)));
      } else out.push(...inner);
      continue;
    }
    const named = part.match(/^([A-Za-z0-9_.]+)(?:<[\s\S]*>)?$/);
    if (!named) continue;
    const name = named[1]!.replace(/^React\./, '');
    if (IGNORED_TYPES.has(name)) continue;
    out.push(...lookUp(name, index, path, seen));
  }
  return out;
}

export const reactIndex = buildIndex([reactDir, coreDir]);
export const svelteIndex = buildIndex([svelteDir, coreDir]);

function pascal(item: string): string {
  return item
    .split('-')
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

/** The props the React source declares, or null when it has no such type. */
export function reactProps(item: string, type?: string): string[] | null {
  for (const extension of ['.tsx', '.ts']) {
    const path = join(reactDir, item + extension);
    let source: string;
    try {
      source = sourceOf(path);
    } catch {
      continue;
    }
    const wanted = type ?? `${pascal(item)}Props`;
    if (!new RegExp(`(interface|type)\\s+${wanted}\\b`).test(source)) return null;
    return [...new Set(lookUp(wanted, reactIndex, path, new Set()))];
  }
  return null;
}

/** The props the Svelte source declares, or null when it has no such type. */
export function svelteProps(item: string, type?: string): string[] | null {
  for (const extension of ['.svelte', '.svelte.ts', '.ts']) {
    const path = join(svelteDir, item + extension);
    let source: string;
    try {
      source = sourceOf(path);
    } catch {
      continue;
    }
    if (type) {
      if (!new RegExp(`(interface|type)\\s+${type}\\b`).test(source)) return null;
      return [...new Set(lookUp(type, svelteIndex, path, new Set()))];
    }
    const found = source.match(/type Props\s*=/);
    if (!found) return null;
    return [...new Set(names(toSemicolon(source, found.index! + found[0].length), svelteIndex, path))];
  }
  return null;
}

/** The names in a `$props()` destructure, which is what a Svelte component reads. */
export function svelteDestructure(item: string): string[] | null {
  const path = join(svelteDir, `${item}.svelte`);
  let source: string;
  try {
    source = sourceOf(path);
  } catch {
    return null;
  }
  const found = source.match(/let\s*\{/);
  if (!found) return null;
  const body = block(source, source.indexOf('{', found.index!));
  return split(body, ',')
    .map((part) => part.trim().split(/[:=]/)[0]!.trim())
    .filter((part) => /^[A-Za-z][A-Za-z0-9_]*$/.test(part));
}
