/**
 * The props each registry component declares, read out of its source.
 *
 * React: the `<Pascal>Props` interface. Svelte: the `Props` type the `$props()`
 * destructure is annotated with. Both are read the same way -- an object body, an
 * `extends` or `&` chain, `Omit` and `Pick` -- with the framework's own attribute
 * types (`HTMLAttributes`, `WithElementRef`) left out, since those are what a widget
 * spreads onto its root rather than what it takes. A member carries the text of its
 * type and whether it is optional; the destructure carries the value each prop falls
 * back to.
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

/** One declared prop: its name, the text of its type, and whether it is optional. */
export interface Member {
  name: string;
  type: string;
  optional: boolean;
}

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
  let quote = '';
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if (quote) {
      current += char;
      if (char === quote && text[i - 1] !== '\\') quote = '';
      continue;
    }
    if (`'"\``.includes(char)) {
      quote = char;
      current += char;
      continue;
    }
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

/** A member spilling over a line break: an open union, or a type still to come. */
function unfinished(line: string, rest: string): boolean {
  if (/[|&:,(<=]$/.test(line)) return true;
  return /^\s*[|&)]/.test(rest);
}

function memberOf(line: string): Member | null {
  // An index signature (`[key: `data-${string}`]`) is not a prop.
  if (line.trim().startsWith('[')) return null;
  const found = line.match(/(?:^|\s)(?:readonly\s+)?['"]?([A-Za-z0-9_$-]+)['"]?(\??)\s*:([\s\S]*)$/);
  if (!found) return null;
  return {
    name: found[1]!,
    optional: found[2] === '?',
    type: found[3]!.replace(/[;,]\s*$/, '').trim(),
  };
}

function members(body: string): Member[] {
  const out: Member[] = [];
  let depth = 0;
  let line = '';
  for (let i = 0; i < body.length; i++) {
    const char = body[i]!;
    if ('{(<['.includes(char)) depth++;
    if (closes(body, i)) depth--;
    if (depth === 0 && (char === ';' || char === '\n')) {
      const trimmed = line.trim();
      if (trimmed && unfinished(trimmed, body.slice(i + 1))) {
        line += ' ';
        continue;
      }
      const found = memberOf(line);
      if (found) out.push(found);
      line = '';
    } else line += char;
  }
  const last = memberOf(line);
  if (last) out.push(last);
  return out;
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

function lookUp(name: string, index: TypeIndex, path: string, seen: Set<string>): Member[] {
  if (seen.has(name)) return [];
  const def =
    index.get(`${path}#${name}`) ?? [...index.values()].find((type) => type.name === name);
  if (!def) return [];
  const next = new Set([...seen, name]);
  const out: Member[] = [];
  if (def.kind === 'interface') {
    const extended = def.heads.match(/extends([\s\S]*)$/);
    if (extended) out.push(...declares(split(extended[1]!, ',').join(' & '), index, def.path, next));
    out.push(...members(def.body));
  } else {
    out.push(...declares(def.body, index, def.path, next));
  }
  return out;
}

/** The props a type expression contributes, a narrowing type after the one it narrows. */
function declares(
  expression: string,
  index: TypeIndex,
  path: string,
  seen: Set<string> = new Set(),
): Member[] {
  const out: Member[] = [];
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
      const inner = declares(args[0]!, index, path, seen);
      if (shaped[1] === 'Omit') {
        const dropped = keysIn(args.slice(1).join(','));
        out.push(...inner.filter((member) => !dropped.has(member.name)));
      } else if (shaped[1] === 'Pick') {
        const kept = keysIn(args.slice(1).join(','));
        out.push(...inner.filter((member) => kept.has(member.name)));
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

/** The prop names a type expression contributes. */
export function names(
  expression: string,
  index: TypeIndex,
  path: string,
  seen: Set<string> = new Set(),
): string[] {
  return declares(expression, index, path, seen).map((member) => member.name);
}

/** One member per name: the last declaration wins, which is the narrowing one. */
function byName(found: Member[]): Member[] {
  const out = new Map<string, Member>();
  for (const member of found) out.set(member.name, member);
  return [...out.values()];
}

export const reactIndex = buildIndex([reactDir, coreDir]);
export const svelteIndex = buildIndex([svelteDir, coreDir]);

function pascal(item: string): string {
  return item
    .split('-')
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join('');
}

function pathOf(dir: string, item: string, extensions: string[]): string | null {
  for (const extension of extensions) {
    const path = join(dir, item + extension);
    try {
      readFileSync(path);
      return path;
    } catch {
      continue;
    }
  }
  return null;
}

/** The props the React source declares, or null when it has no such type. */
export function reactProps(item: string, type?: string): Member[] | null {
  const path = pathOf(reactDir, item, ['.tsx', '.ts']);
  if (!path) return null;
  const source = sourceOf(path);
  const wanted = type ?? `${pascal(item)}Props`;
  if (!new RegExp(`(interface|type)\\s+${wanted}\\b`).test(source)) return null;
  return byName(lookUp(wanted, reactIndex, path, new Set()));
}

/** The props the Svelte source declares, or null when it has no such type. */
export function svelteProps(item: string, type?: string): Member[] | null {
  const path = pathOf(svelteDir, item, ['.svelte', '.svelte.ts', '.ts']);
  if (!path) return null;
  const source = sourceOf(path);
  if (type) {
    if (!new RegExp(`(interface|type)\\s+${type}\\b`).test(source)) return null;
    return byName(lookUp(type, svelteIndex, path, new Set()));
  }
  const found = source.match(/type Props\s*=/);
  if (!found) return null;
  return byName(declares(toSemicolon(source, found.index! + found[0].length), svelteIndex, path));
}

/** Svelte hands a child a getter or a mirror; what it takes is still the inner type. */
function unwrap(type: string): string {
  let text = type.trim();
  let wrapping = false;
  for (;;) {
    const wrapped = text.match(/^Mirror<([\s\S]+)>$/) ?? text.match(/^\(\s*\)\s*=>\s*([\s\S]+)$/);
    if (!wrapped) break;
    text = wrapped[1]!.trim();
    wrapping = true;
  }
  return wrapping ? text.replace(/\|\s*undefined\s*$/, '').trim() : text;
}

/** The name an import gives a type of its own, so a page may name the type itself. */
const aliases: Map<string, string> = new Map(
  [reactDir, svelteDir].flatMap((dir) =>
    walk(dir)
      .filter((path) => /\.(ts|tsx|svelte)$/.test(path))
      .flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/import[^;]*?\{([^}]*)\}/g)])
      .flatMap((found) => [...found[1]!.matchAll(/([A-Za-z0-9_]+)\s+as\s+([A-Za-z0-9_]+)/g)])
      .map((found) => [found[2]!, found[1]!] as [string, string]),
  ),
);

/** The keys of an object type, whether or not the page writes their types. */
function keysOf(body: string): string[] {
  return split(split(body, ';').join(','), ',')
    .map((part) => part.trim().match(/^([A-Za-z0-9_$]+)(\??)/))
    .filter((found): found is RegExpMatchArray => found !== null)
    .map((found) => found[1]! + found[2]!);
}

function union(parts: string[]): string {
  return [...new Set(parts.map((part) => part.trim()).filter(Boolean))].sort().join(' | ');
}

/** `(a: string, b: number) => void` and `(row) => void` differ in nothing a table says. */
function arity(list: string): number {
  return split(list, ',').filter((parameter) => parameter.trim()).length;
}

/** What a handler is called with: the types of its parameters, in order. */
export function payloadOf(type: string, index: TypeIndex): string[] | null {
  const fn = bare(type.replace(/`/g, '').replace(/\s+/g, ' ')).match(
    /^\(([\s\S]*)\)\s*=>\s*[\s\S]+$/,
  );
  if (!fn) return null;
  return split(fn[1]!, ',')
    .map((parameter) => parameter.trim())
    .filter(Boolean)
    .map((parameter) => shapeOf(parameter.replace(/^[A-Za-z0-9_$]+\??\s*:/, ''), index));
}

function expand(name: string, index: TypeIndex, seen: Set<string>): string | null {
  if (seen.has(name)) return null;
  const def = [...index.values()].find((type) => type.name === name && type.kind === 'type');
  return def ? def.body : null;
}

function bare(text: string): string {
  if (!text.startsWith('(')) return text;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')' && --depth === 0) return i === text.length - 1 ? bare(text.slice(1, -1).trim()) : text;
  }
  return text;
}

/**
 * A type as a props table writes it: an alias expanded, an object down to its keys, a
 * parameter list down to how many it takes, a Svelte getter unwrapped, a union in one
 * order.
 */
export function shapeOf(type: string, index: TypeIndex, seen: Set<string> = new Set()): string {
  const text = bare(unwrap(type.replace(/`/g, '').replace(/\s+/g, ' ').replace(/React\./g, '')));
  const parts = split(text, '|').map((part) => part.trim()).filter(Boolean);
  if (parts.length > 1) {
    return union(parts.flatMap((part) => split(shapeOf(part, index, seen), '|')));
  }
  const fn = text.match(/^\(([\s\S]*)\)\s*=>\s*([\s\S]+)$/);
  if (fn) return `(${arity(fn[1]!)}) => ${shapeOf(fn[2]!, index, seen)}`;
  const object = text.match(/^\{([\s\S]*)\}(\[\])?$/);
  if (object) return `{ ${keysOf(object[1]!).sort().join(', ')} }${object[2] ?? ''}`;
  const excluded = text.match(/^Exclude<([\s\S]+)>$/);
  if (excluded) {
    const args = split(excluded[1]!, ',').map((arg) => shapeOf(arg, index, seen));
    const dropped = new Set(split(args.slice(1).join(' | '), '|').map((part) => part.trim()));
    return union(split(args[0]!, '|').filter((part) => !dropped.has(part.trim())));
  }
  const generic = text.match(/^([A-Za-z0-9_.]+)<([\s\S]+)>$/);
  if (generic) {
    const args = split(generic[2]!, ',').map((arg) => shapeOf(arg, index, seen));
    return `${generic[1]}<${args.join(', ')}>`;
  }
  const array = text.match(/^([A-Za-z0-9_]+)\[\]$/);
  if (array) return `${aliases.get(array[1]!) ?? array[1]!}[]`;
  const named = text.match(/^([A-Za-z0-9_]+)$/);
  if (named) {
    const name = aliases.get(named[1]!) ?? named[1]!;
    const body = expand(name, index, seen);
    if (body) return shapeOf(body, index, new Set([...seen, name]));
    return name;
  }
  return text;
}

/** The value every named constant holds, for a default the source writes as one. */
export const constants: Map<string, string> = new Map(
  [coreDir, reactDir, svelteDir]
    .flatMap((dir) => walk(dir).filter((path) => /\.(ts|tsx|svelte)$/.test(path)))
    .flatMap((path) => [
      ...sourceOf(path).matchAll(
        /\bconst ([A-Za-z_][A-Za-z0-9_]*)(?:\s*:[^=]+)?\s*=\s*('[^']*'|"[^"]*"|\[\s*\]|\{\s*\}|\d+|true|false|null)\s*;/g,
      ),
    ])
    .map((found) => {
      const held = found[2]!.trim();
      const value = held.startsWith("'") || held.startsWith('"') ? held : held.replace(/\s+/g, '');
      return [found[1]!, value.replace(/^"|"$/g, "'")] as [string, string];
    }),
);

/** The first `=` of an assignment; `=>` and `==` are not one. */
function assignment(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const char = text[i]!;
    if ('{(<['.includes(char)) depth++;
    if (closes(text, i)) depth--;
    if (char !== '=' || depth !== 0) continue;
    if (text[i + 1] === '=' || text[i + 1] === '>') continue;
    if ('=!<>'.includes(text[i - 1] ?? '')) continue;
    return i;
  }
  return -1;
}

/** What each name of a destructure falls back to; null when it falls back to nothing. */
function defaultsIn(body: string): Map<string, string | null> {
  const out = new Map<string, string | null>();
  for (const raw of split(body, ',')) {
    const part = raw.trim();
    if (!part || part.startsWith('...')) continue;
    const at = assignment(part);
    const head = at < 0 ? part : part.slice(0, at);
    const name = head.split(':')[0]!.trim();
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) continue;
    let value = at < 0 ? '' : part.slice(at + 1).trim();
    const bindable = value.match(/^\$bindable\(([\s\S]*)\)$/);
    if (bindable) value = bindable[1]!.trim();
    out.set(name, value && value !== 'undefined' ? value.replace(/\s+/g, ' ') : null);
  }
  return out;
}

/** The destructure carrying a type annotation, walked back from the annotation. */
function destructureOf(source: string, type: string): string | null {
  const found = source.match(new RegExp(`\\}\\s*:\\s*${type}\\b`));
  if (!found) return null;
  const close = found.index!;
  let depth = 0;
  for (let i = close; i >= 0; i--) {
    if (source[i] === '}') depth++;
    else if (source[i] === '{' && --depth === 0) return source.slice(i + 1, close);
  }
  return null;
}

/** What each React prop falls back to, or null when the source destructures none. */
export function reactDefaults(item: string, type?: string): Map<string, string | null> | null {
  const path = pathOf(reactDir, item, ['.tsx', '.ts']);
  if (!path) return null;
  const body = destructureOf(sourceOf(path), type ?? `${pascal(item)}Props`);
  return body === null ? null : defaultsIn(body);
}

function svelteBody(item: string): string | null {
  const path = join(svelteDir, `${item}.svelte`);
  let source: string;
  try {
    source = sourceOf(path);
  } catch {
    return null;
  }
  const found = source.match(/let\s*\{/);
  if (!found) return null;
  return block(source, source.indexOf('{', found.index!));
}

/** What each Svelte prop falls back to, or null when the source destructures none. */
export function svelteDefaults(item: string): Map<string, string | null> | null {
  const body = svelteBody(item);
  return body === null ? null : defaultsIn(body);
}

/** The names in a `$props()` destructure, which is what a Svelte component reads. */
export function svelteDestructure(item: string): string[] | null {
  const body = svelteBody(item);
  if (body === null) return null;
  return split(body, ',')
    .map((part) => part.trim().split(/[:=]/)[0]!.trim())
    .filter((part) => /^[A-Za-z][A-Za-z0-9_]*$/.test(part));
}
