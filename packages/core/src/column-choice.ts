/**
 * A user's choice of table columns, kept per browser.
 *
 * The choice is the ordered list of paths; the host's own columns are the defaults
 * it stands in for. Storage is the widget's business: these read and write the
 * string it keeps, and lay a stored choice over the columns already resolved.
 */
import type { CollectionColumn } from './collection.js';
import { resolveColumns } from './collection.js';
import type { SchemaService } from './schema-service.js';

const PREFIX = 'sg-widgets:columns:';

/** Where a choice is kept: the caller's key, or one per entity type. */
export function columnsStorageKey(entityType: string, key?: string | null): string {
  return key ? key : `${PREFIX}${entityType}`;
}

/** A stored choice as paths. Null for nothing, an empty list, or anything that is not a list of paths. */
export function parseColumnChoice(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!Array.isArray(value) || !value.every((entry) => typeof entry === 'string')) return null;
  const paths = [...new Set((value as string[]).map((entry) => entry.trim()).filter(Boolean))];
  return paths.length > 0 ? paths : null;
}

/** The string a choice is kept as. */
export function serializeColumnChoice(paths: readonly string[]): string {
  return JSON.stringify(paths);
}

/** The paths of a column list, in order. */
export function columnPaths(columns: readonly CollectionColumn[]): string[] {
  return columns.map((column) => column.path);
}

/** True when two path lists name the same columns in the same order. */
export function sameColumnPaths(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((path, at) => path === b[at]);
}

/** The paths a source with `fields` does not read yet. */
export function unreadPaths(fields: readonly string[], paths: readonly string[]): string[] {
  const read = new Set(fields);
  return paths.filter((path) => !read.has(path));
}

/** The known columns in the order `paths` names them. A path none of them carries is dropped. */
export function arrangeColumns(paths: readonly string[], known: readonly CollectionColumn[]): CollectionColumn[] {
  const byPath = new Map<string, CollectionColumn>();
  for (const column of known) if (!byPath.has(column.path)) byPath.set(column.path, column);
  return paths.flatMap((path) => {
    const column = byPath.get(path);
    return column ? [column] : [];
  });
}

/**
 * A choice as columns: the ones already resolved are kept as they are, the rest are
 * resolved from the schema, and a path the type does not have is skipped, so a
 * choice kept before a field was removed still opens.
 */
export async function resolveColumnChoice(
  schema: SchemaService,
  entityType: string,
  paths: readonly string[],
  known: readonly CollectionColumn[],
): Promise<CollectionColumn[]> {
  const have = new Set(known.map((column) => column.path));
  const missing = paths.filter((path) => !have.has(path));
  const resolved = await Promise.all(
    missing.map((path) =>
      resolveColumns(schema, entityType, [path]).then(
        (columns) => columns,
        () => [] as CollectionColumn[],
      ),
    ),
  );
  return arrangeColumns(paths, [...known, ...resolved.flat()]);
}
