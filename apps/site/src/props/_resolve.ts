/**
 * Resolves one item's rows into the table a page draws.
 *
 * A wrapper's table is its own rows first, then its base's, with an override sitting
 * where the base's row sat. An inherited row carries the address of the row it came
 * from, so a reader jumps to its origin in one press.
 */
import type { EventRow, KeyRow, PropRow, PropsFile, SlotRow } from './_types';

const modules = import.meta.glob<{ default: PropsFile }>('./*.ts', { eager: true });

/** Every item that has a props file, by name. */
export const items: Record<string, PropsFile> = Object.fromEntries(
  Object.entries(modules)
    .map(([path, module]) => [path.slice(2, -3), module.default] as const)
    .filter(([name]) => !name.startsWith('_')),
);

export type Kind = 'props' | 'events' | 'slots' | 'keyboard';

export type Row = PropRow | EventRow | SlotRow | KeyRow;

export interface Resolved<T extends Row> {
  row: T;
  /** The item that declares the row. */
  owner: string;
  /** The row's id on this page. */
  id: string;
  /** The row's address on the page of the item that declares it, when inherited. */
  href?: string;
}

const singular: Record<Kind, string> = {
  props: 'prop',
  events: 'event',
  slots: 'slot',
  keyboard: 'key',
};

export function fileOf(name: string): PropsFile {
  const file = items[name];
  if (!file) throw new Error(`No props file at apps/site/src/props/${name}.ts`);
  return file;
}

/** The page an item's rows are drawn on. */
export function pageOf(name: string): string {
  return fileOf(name).page ?? name;
}

export function pathOf(name: string): string {
  return `/widgets/${pageOf(name)}/`;
}

function keyOf(row: Row): string {
  return 'key' in row ? row.key : row.name;
}

function anchor(row: Row): string {
  return keyOf(row)
    .replace(/`/g, '')
    .split('/')[0]
    .trim()
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** An item that is not the main item of its page prefixes its ids with its own name. */
function prefixOf(name: string): string {
  return pageOf(name) === name ? '' : `${name}-`;
}

function rowsOf<T extends Row>(name: string, kind: Kind): Resolved<T>[] {
  const file = fileOf(name);
  const own = (file[kind] ?? []) as T[];
  const ownByKey = new Map(own.map((row) => [keyOf(row), row]));
  const taken = new Set<string>();
  const base = file.extends ? rowsOf<T>(file.extends.name, kind) : [];
  const omitted = new Set(file.extends?.omit ?? []);
  const basePath = file.extends ? pathOf(file.extends.name) : '';

  const inherited = base
    .filter((entry) => !omitted.has(keyOf(entry.row)))
    .map((entry) => {
      const override = ownByKey.get(keyOf(entry.row));
      if (override) {
        taken.add(keyOf(entry.row));
        return { row: override, owner: name, id: '' };
      }
      return { ...entry, href: entry.href ?? `${basePath}#${entry.id}` };
    });

  const fresh = own
    .filter((row) => !taken.has(keyOf(row)))
    .map((row) => ({ row, owner: name, id: '' }));

  const rows = [...fresh, ...inherited];
  const prefix = prefixOf(name);
  return rows.map((entry, index) => ({
    ...entry,
    id:
      kind === 'keyboard'
        ? `${prefix}key-${index + 1}`
        : `${prefix}${singular[kind]}-${anchor(entry.row)}`,
  }));
}

export function resolve<T extends Row = Row>(name: string, kind: Kind): Resolved<T>[] {
  return rowsOf<T>(name, kind);
}

/** Every name an item takes as a prop: its props, its events and its slots. */
export function declaredNames(name: string): string[] {
  const names: string[] = [];
  for (const entry of resolve<PropRow>(name, 'props')) names.push(...entry.row.name.split('/'));
  for (const entry of resolve<EventRow>(name, 'events')) names.push(entry.row.name);
  for (const entry of resolve<SlotRow>(name, 'slots')) {
    names.push(entry.row.name);
    if (entry.row.react) names.push(entry.row.react);
  }
  return names.map((n) => n.replace(/`/g, '').trim()).filter(Boolean);
}
