/**
 * The valid values of a `list` or `status_list` field, as an editor holds them.
 *
 * A list's values are bare strings and their order is the order of the drop-down. A
 * write is compared to them byte for byte: a different case and a trailing space are
 * both refused (field_types/list). So a value is trimmed where it is defined, a blank
 * one is dropped, and two values that differ by case stay two values.
 */
import type { StatusOption, StatusRecord } from './status.js';

export interface ListValueOptions {
  /** Keep the first of a repeated value and drop the rest. Off: a repeat is kept. */
  unique?: boolean;
}

/** The values trimmed, the blank ones dropped, in the order given. */
export function normalizeListValues(values: readonly string[], options: ListValueOptions = {}): string[] {
  const kept: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const value = raw.trim();
    if (value === '') continue;
    if (options.unique && seen.has(value)) continue;
    seen.add(value);
    kept.push(value);
  }
  return kept;
}

/** One value per line of a typed or pasted text. */
export function splitListValues(text: string, options: ListValueOptions = {}): string[] {
  return normalizeListValues(text.split(/\r\n|\r|\n/), options);
}

/**
 * The list with the value at `index` rewritten as `text`. A blank text removes it, a
 * text of several lines puts each line in its place, and the index past the end appends.
 */
export function replaceListValue(
  values: readonly string[],
  index: number,
  text: string,
  options: ListValueOptions = {},
): string[] {
  if (index < 0 || index > values.length) return [...values];
  const next = [...values];
  next.splice(index, 1, ...splitListValues(text));
  return normalizeListValues(next, options);
}

/** The list with every line of `text` appended. */
export function addListValues(values: readonly string[], text: string, options: ListValueOptions = {}): string[] {
  return replaceListValue(values, values.length, text, options);
}

/** The list with the value at `from` moved to `to`. A place outside the list leaves it alone. */
export function moveListValue(values: readonly string[], from: number, to: number): string[] {
  const next = [...values];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as string);
  return next;
}

/** One row of the editor: a value, and a key that outlives an edit and a move. */
export interface ListRow {
  key: string;
  value: string;
}

/**
 * The rows for `values`, keeping the keys of `rows` wherever a row is still there.
 *
 * Values may repeat, so a value cannot be its row's key. A row is matched where it
 * stands, then by its value wherever it went, then by its place when its value was
 * edited; what is left is new and takes a key no row holds. Unchanged values answer
 * the rows as given.
 */
export function syncListRows(rows: readonly ListRow[], values: readonly string[]): ListRow[] {
  if (rows.length === values.length && rows.every((row, index) => row.value === values[index])) {
    return rows as ListRow[];
  }
  const keys: Array<string | undefined> = values.map(() => undefined);
  const used = new Set<number>();
  const take = (at: number, from: number): void => {
    keys[at] = (rows[from] as ListRow).key;
    used.add(from);
  };

  values.forEach((value, at) => {
    if (rows[at]?.value === value) take(at, at);
  });
  values.forEach((value, at) => {
    if (keys[at] !== undefined) return;
    const from = rows.findIndex((row, index) => !used.has(index) && row.value === value);
    if (from >= 0) take(at, from);
  });
  values.forEach((_, at) => {
    if (keys[at] === undefined && at < rows.length && !used.has(at)) take(at, at);
  });

  let minted = rows.reduce((most, row) => Math.max(most, Number(row.key.slice(1)) || 0), 0);
  return values.map((value, at) => ({ key: keys[at] ?? `r${++minted}`, value }));
}

/** Every status of the site as an option: its code, and its name as the label. */
export function statusTableOptions(records: readonly StatusRecord[]): StatusOption[] {
  const seen = new Set<string>();
  const options: StatusOption[] = [];
  for (const record of records) {
    if (record.code === '' || seen.has(record.code)) continue;
    seen.add(record.code);
    options.push({ code: record.code, label: record.name || record.code });
  }
  return options;
}
