/**
 * List source.
 *
 * An entity source over rows the host holds rather than one read of one entity type: rows built
 * from more than one type, rows with no record behind them, or cells the host owns beside the
 * site's. Every row is there at once, so nothing pages and a sort orders the list in memory. A
 * write goes to the host's `update` or `updateMany`, which decide where each field lands and answer
 * the row as it reads afterwards; without either the rows are read only.
 */
import type { EntityRow } from './client.js';
import { writeEach, type RowUpdate, type RowWriteResult } from './bulk-edit.js';
import {
  cellValue,
  rowKey,
  toWireGroup,
  type EntitySource,
  type EntitySourceState,
  type SortSpec,
  type SourceFilters,
  type SourceMode,
} from './collection.js';
import type { EntityRef } from './filter.js';

export interface ListSourceOptions {
  /** The type the column choice is kept under. The rows may be of any type. */
  entityType: string;
  rows?: readonly EntityRow[];
  sort?: SortSpec[];
  /** Write one row and answer it as it reads afterwards. A throw is a refusal. */
  update?: (update: RowUpdate) => Promise<EntityRow>;
  /** Write several rows and answer one result per update, in order. Without it `update` runs per row. */
  updateMany?: (updates: RowUpdate[]) => Promise<RowWriteResult[]>;
}

export interface ListSource extends EntitySource {
  /** Replace the rows. The sort in force orders them. */
  setRows(rows: readonly EntityRow[]): void;
}

/** The text or number a cell sorts on: an entity by its name, a list of them by their names. */
function sortKeyOf(value: unknown): string | number | null {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((item) => String(sortKeyOf(item) ?? '')).join(', ') || null;
  if (typeof value === 'object') {
    const named = value as { name?: unknown; code?: unknown; id?: unknown };
    const label = named.name ?? named.code;
    return typeof label === 'string' ? label : typeof named.id === 'number' ? named.id : null;
  }
  return String(value);
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Two cells in sort order. An empty cell goes last whichever way the sort runs. */
export function compareCells(a: unknown, b: unknown, descending = false): number {
  const x = sortKeyOf(a);
  const y = sortKeyOf(b);
  if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
  const order = typeof x === 'number' && typeof y === 'number' ? x - y : collator.compare(String(x), String(y));
  return descending ? -order : order;
}

/** The rows in the order the sort keys give, ties kept in the host's order. */
export function sortRows(rows: readonly EntityRow[], sort: readonly SortSpec[]): EntityRow[] {
  const keys = sort.filter((key) => key.path);
  if (keys.length === 0) return [...rows];
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => {
      for (const key of keys) {
        const order = compareCells(cellValue(a.row, key.path), cellValue(b.row, key.path), key.descending);
        if (order !== 0) return order;
      }
      return a.index - b.index;
    })
    .map((entry) => entry.row);
}

export function createListSource(options: ListSourceOptions): ListSource {
  let held: EntityRow[] = [...(options.rows ?? [])];
  let fields: string[] = ['id'];
  let state: EntitySourceState = {
    rows: [],
    status: 'ready',
    error: null,
    hasMore: false,
    total: 0,
    filters: null,
    sort: [...(options.sort ?? [])],
    mode: 'infinite',
    page: 1,
    pageSize: 1,
  };
  const listeners = new Set<() => void>();

  function publish(next: Partial<EntitySourceState> = {}): void {
    const sort = next.sort ?? state.sort;
    const rows = sortRows(held, sort);
    state = { ...state, ...next, rows, total: rows.length, pageSize: Math.max(1, rows.length) };
    for (const listener of listeners) listener();
  }

  /** Put written rows in place of the ones they replace, keeping the host's order. */
  function swap(fresh: readonly EntityRow[]): void {
    if (fresh.length === 0) return;
    const byKey = new Map(fresh.map((row) => [rowKey(row), row]));
    held = held.map((row) => byKey.get(rowKey(row)) ?? row);
    publish();
  }

  function refused(): Promise<never> {
    return Promise.reject(new Error('These rows are read only.'));
  }

  publish();

  const source: ListSource = {
    entityType: options.entityType,
    get fields(): readonly string[] {
      return fields;
    },
    get rows(): EntityRow[] {
      return state.rows;
    },
    get status() {
      return state.status;
    },
    get error() {
      return state.error;
    },
    get hasMore() {
      return false;
    },
    get filters() {
      return state.filters;
    },
    get sort(): SortSpec[] {
      return state.sort;
    },
    get mode(): SourceMode {
      return state.mode;
    },
    get page() {
      return 1;
    },
    get pageSize() {
      return state.pageSize;
    },
    get total() {
      return state.total;
    },

    setRows(rows: readonly EntityRow[]): void {
      held = [...rows];
      publish();
    },
    load: () => Promise.resolve(),
    loadMore: () => Promise.resolve(),
    refresh: () => Promise.resolve(),
    addFields(paths: readonly string[]): Promise<void> {
      fields = [...new Set([...fields, ...paths.filter(Boolean)])];
      return Promise.resolve();
    },
    /** Held for the two-way prop and never applied: the host hands over the rows it wants shown. */
    setFilters(filters: SourceFilters): Promise<void> {
      publish({ filters: toWireGroup(filters) });
      return Promise.resolve();
    },
    setSort(sort: SortSpec[]): Promise<void> {
      publish({ sort: [...sort] });
      return Promise.resolve();
    },
    setPage: () => Promise.resolve(),
    setMode(mode: SourceMode): Promise<void> {
      if (mode !== state.mode) publish({ mode });
      return Promise.resolve();
    },
    setPageSize: () => Promise.resolve(),
    count: () => Promise.resolve(held.length),

    async updateRow(ref: EntityRef, patch: Record<string, unknown>): Promise<EntityRow> {
      if (options.update) {
        const fresh = await options.update({ ref, patch });
        swap([fresh]);
        return fresh;
      }
      if (!options.updateMany) return refused();
      const [result] = await options.updateMany([{ ref, patch }]);
      if (!result) throw new Error('The write answered nothing.');
      if (!result.ok) throw new Error(result.message);
      swap([result.row]);
      return result.row;
    },

    async updateRows(updates: RowUpdate[]): Promise<RowWriteResult[]> {
      const write = options.update;
      const results = options.updateMany
        ? await options.updateMany(updates)
        : write
          ? await writeEach(updates, write)
          : updates.map((update) => ({ ref: update.ref, ok: false as const, message: 'These rows are read only.' }));
      swap(results.flatMap((result) => (result.ok ? [result.row] : [])));
      return results;
    },

    rereadRows: () => Promise.resolve(),
    snapshot: () => state,
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return source;
}
