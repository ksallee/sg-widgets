/**
 * Collection state.
 *
 * The framework-neutral half of the collections' controlled props: how a row is
 * keyed, which rows are disabled, where a keyboard cursor lands over them, and
 * whether a `sort` or `filters` prop still says what the source says. A Svelte
 * widget binds these to `$state`, a React one to `useState` behind an
 * uncontrolled fallback, and neither writes its own comparison.
 *
 * A two-way prop and a store that owns the same value need one rule to stop them
 * writing to each other forever: a change is pushed only when the two no longer
 * say the same thing, which is what the `same*` predicates answer.
 */
import type { EntityRow } from './client.js';
import type { SortSpec, SourceFilters } from './collection.js';
import { rowKey, toWireGroup } from './collection.js';
import type { EntityRef } from './filter.js';
import type { SortKey } from './filter-ux.js';

/** How a collection keys a row. Without one, `Type:id`. */
export type RowIdFn = (row: EntityRow) => string;

/** True for a row the keyboard skips and the selection refuses. */
export type RowDisabledFn = (row: EntityRow) => boolean;

/** A row's id: the caller's, or `Type:id`. */
export function rowIdOf(row: EntityRow, getRowId?: RowIdFn | null): string {
  return getRowId ? getRowId(row) : rowKey(row);
}

/** True when the caller says the row is disabled. */
export function rowIsDisabled(row: EntityRow, isRowDisabled?: RowDisabledFn | null): boolean {
  return isRowDisabled ? isRowDisabled(row) === true : false;
}

/**
 * Where a cursor lands moving `step` from `from`, skipping disabled entries.
 *
 * The walk stops at the ends rather than wrapping, and answers `from` when every
 * entry that way is disabled, so a key press on the last enabled row does nothing.
 */
export function nextEnabledIndex(
  count: number,
  from: number,
  step: number,
  disabled: (index: number) => boolean,
): number {
  if (count <= 0 || step === 0) return -1;
  for (let at = from + step; at >= 0 && at < count; at += step) {
    if (!disabled(at)) return at;
  }
  return from >= 0 && from < count ? from : -1;
}

/** The first enabled entry at or after `from`, walking `step`. -1 when there is none. */
export function firstEnabledIndex(count: number, from: number, step: number, disabled: (index: number) => boolean): number {
  for (let at = Math.max(0, Math.min(from, count - 1)); at >= 0 && at < count; at += step || 1) {
    if (!disabled(at)) return at;
  }
  return -1;
}

/** The ids the rows of `refs` are keyed under. A ref no loaded row stands for is dropped. */
export function idsForRefs(
  rows: readonly EntityRow[],
  refs: readonly EntityRef[],
  getRowId?: RowIdFn | null,
): string[] {
  const byRef = new Map(rows.map((row) => [rowKey(row), rowIdOf(row, getRowId)]));
  const ids: string[] = [];
  for (const ref of refs) {
    const id = byRef.get(rowKey(ref));
    if (id !== undefined && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

/** The rows the ids stand for, in row order. */
export function refsForIds(
  rows: readonly EntityRow[],
  ids: readonly string[],
  getRowId?: RowIdFn | null,
): EntityRef[] {
  const wanted = new Set(ids);
  return rows.filter((row) => wanted.has(rowIdOf(row, getRowId))).map((row) => ({ type: row.type, id: row.id }));
}

/** `ids` with `id` added or removed. `on` forces the direction. */
export function toggleId(ids: readonly string[], id: string, on?: boolean): string[] {
  const held = ids.includes(id);
  const wanted = on ?? !held;
  if (wanted === held) return [...ids];
  return wanted ? [...ids, id] : ids.filter((entry) => entry !== id);
}

/** True when two id lists hold the same ids, whatever their order. */
export function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const held = new Set(a);
  return b.every((id) => held.has(id));
}

/** True when two selections name the same rows, whatever their order. */
export function sameRefs(a: readonly EntityRef[], b: readonly EntityRef[]): boolean {
  return sameIds(a.map(rowKey), b.map(rowKey));
}

/** True when two sort lists name the same keys in the same order. */
export function sameSort(a: readonly SortSpec[], b: readonly SortSpec[]): boolean {
  return a.length === b.length && a.every((key, at) => key.path === b[at]?.path && key.descending === b[at]?.descending);
}

/**
 * True when two filters reach the server as the same group.
 *
 * The editor's tree and the wire hash are two spellings of one filter, so a `filters`
 * prop holding the tree and a source holding the hash agree, and neither overwrites
 * the other.
 */
export function sameFilters(a: SourceFilters, b: SourceFilters): boolean {
  return JSON.stringify(toWireGroup(a)) === JSON.stringify(toWireGroup(b));
}

/** A sort picker's keys as a source's sort. */
export function toSortSpecs(keys: readonly SortKey[]): SortSpec[] {
  return keys.filter((key) => key.field).map((key) => ({ path: key.field, descending: key.direction === 'desc' }));
}

/** A source's sort as a sort picker's keys. */
export function toSortKeys(sort: readonly SortSpec[]): SortKey[] {
  return sort.filter((key) => key.path).map((key) => ({ field: key.path, direction: key.descending ? 'desc' : 'asc' }));
}
