/**
 * Entity source.
 *
 * The headless half of every collection widget: one object that holds a page of
 * rows, the filter and the sort behind them, and the calls that move them. It
 * has no framework in it. A Svelte widget wraps it in `$state`, a React one in
 * `useSyncExternalStore`, and neither reimplements paging, ordering or the
 * read-after-write rule.
 *
 * Paging stops on an empty page, never on a missing `links.next`, which the API
 * emits forever (006_pagination). Ordering is the server's: with no sort rows
 * come back id ascending and id ascending is the implicit tiebreak, and a sort
 * on a field that cannot be sorted is a silent 200 no-op, so a widget verifies a
 * sort path against the schema before offering it (026_result_order).
 */
import type { EntityRow, SearchResult, SgClient } from './client.js';
import { isSortable } from './filter-ux.js';
import { isNumericType } from './field-types.js';
import type { EntityRef, FilterNode, WireGroup } from './filter.js';
import { toApi3Hash } from './filter.js';
import type { SchemaService } from './schema-service.js';
import type { FieldSchema } from './schema.js';

/** One sort key. Serialised as `path` or `-path` (026_result_order). */
export interface SortSpec {
  path: string;
  descending: boolean;
}

/** A filter as the caller holds it: the editor's tree, the wire group, or nothing. */
export type SourceFilters = FilterNode | WireGroup | null;

export type SourceStatus = 'idle' | 'loading' | 'loadingMore' | 'ready' | 'error';

export interface EntitySourceOptions {
  client: SgClient;
  entityType: string;
  /** Paths to read, plain or dotted. `id` is always read. */
  fields: string[];
  filters?: SourceFilters;
  sort?: SortSpec[];
  /** Rows per request. Default 50. */
  pageSize?: number;
}

/** Everything a view renders. A new object on every change, so identity is the signal. */
export interface EntitySourceState {
  rows: EntityRow[];
  status: SourceStatus;
  error: Error | null;
  /** True when another page exists. */
  hasMore: boolean;
  /** The total the last `count()` answered, or null when none has been asked for. */
  count: number | null;
  filters: WireGroup | null;
  sort: SortSpec[];
}

export interface EntitySource {
  readonly entityType: string;
  readonly fields: readonly string[];
  readonly rows: EntityRow[];
  readonly status: SourceStatus;
  readonly error: Error | null;
  readonly hasMore: boolean;
  readonly filters: WireGroup | null;
  readonly sort: SortSpec[];
  /** Read the first page, discarding anything already loaded. */
  load(): Promise<void>;
  /** Append the next page. A no-op while another read is in flight or when there is no more. */
  loadMore(): Promise<void>;
  /** Read every page already shown again, keeping the row count. */
  refresh(): Promise<void>;
  setFilters(filters: SourceFilters): Promise<void>;
  setSort(sort: SortSpec[]): Promise<void>;
  /** Total rows the filter matches, through `_summarize` (020_summarize). Null when the site did not answer the key. */
  count(): Promise<number | null>;
  /** Write the named fields of one row and put the re-read row back in place. */
  updateRow(ref: EntityRef, patch: Record<string, unknown>): Promise<EntityRow>;
  /** The current state object, stable between changes. */
  snapshot(): EntitySourceState;
  subscribe(listener: () => void): () => void;
}

/** `Type:id`, the key a list keys rows on. */
export function rowKey(row: EntityRow | EntityRef): string {
  return `${row.type}:${row.id}`;
}

/**
 * The value at a path on a row. A dotted path comes back flat under its literal
 * key in `attributes`; a plain entity field comes back under `relationships`
 * (003_query, endpoints/post_entity_type_search).
 */
export function cellValue(row: EntityRow, path: string): unknown {
  if (path === 'id') return row.id;
  if (path === 'type') return row.type;
  if (path in row.attributes) return row.attributes[path];
  const link = row.relationships[path];
  return link ? link.data : null;
}

/** Sort keys as the API's `sort` body value: comma separated, `-` per key (026_result_order). */
export function serializeSort(sort: readonly SortSpec[]): string | undefined {
  const keys = sort.filter((k) => k.path).map((k) => (k.descending ? `-${k.path}` : k.path));
  return keys.length > 0 ? keys.join(',') : undefined;
}

function toWire(filters: SourceFilters): WireGroup | null {
  if (!filters) return null;
  if ('kind' in filters) return toApi3Hash(filters);
  return filters;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function createEntitySource(options: EntitySourceOptions): EntitySource {
  const { client, entityType } = options;
  const pageSize = options.pageSize ?? 50;
  // `id` is what a row is keyed and re-read on, so it is never left out of a projection.
  const fields = [...new Set(['id', ...options.fields])];

  let state: EntitySourceState = {
    rows: [],
    status: 'idle',
    error: null,
    hasMore: false,
    count: null,
    filters: toWire(options.filters ?? null),
    sort: [...(options.sort ?? [])],
  };
  const listeners = new Set<() => void>();
  // Every read carries the generation it started in; a later filter or sort discards it.
  let generation = 0;
  let inFlight: Promise<void> | null = null;

  function set(next: Partial<EntitySourceState>): void {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  function page(number: number): Promise<SearchResult> {
    const sort = serializeSort(state.sort);
    return client.search(entityType, {
      filters: state.filters,
      fields,
      // An empty `sort` is 400 `sort must be filled`, so the key is omitted rather
      // than sent blank (026_result_order).
      ...(sort === undefined ? {} : { sort }),
      page: { size: pageSize, number },
    });
  }

  async function read(pages: number, status: 'loading' | 'loadingMore', keep: EntityRow[]): Promise<void> {
    const mine = ++generation;
    set({ status, error: null });
    try {
      const rows = [...keep];
      let more = false;
      for (let n = 0; n < pages; n += 1) {
        const result = await page(Math.floor(rows.length / pageSize) + 1);
        if (mine !== generation) return;
        rows.push(...result.data);
        more = result.hasMore;
        // A short page is the end of the set: `links.next` is emitted forever (006_pagination).
        if (!more) break;
      }
      set({ rows, hasMore: more, status: 'ready' });
    } catch (error) {
      if (mine !== generation) return;
      set({ status: 'error', error: asError(error) });
    }
  }

  function run(task: () => Promise<void>): Promise<void> {
    const promise = task().finally(() => {
      if (inFlight === promise) inFlight = null;
    });
    inFlight = promise;
    return promise;
  }

  const source: EntitySource = {
    entityType,
    fields,
    get rows(): EntityRow[] {
      return state.rows;
    },
    get status(): SourceStatus {
      return state.status;
    },
    get error(): Error | null {
      return state.error;
    },
    get hasMore(): boolean {
      return state.hasMore;
    },
    get filters(): WireGroup | null {
      return state.filters;
    },
    get sort(): SortSpec[] {
      return state.sort;
    },

    load(): Promise<void> {
      // A new read invalidates the count: the filter it was taken under may have moved.
      set({ count: null });
      return run(() => read(1, 'loading', []));
    },

    loadMore(): Promise<void> {
      if (inFlight || !state.hasMore || state.status === 'error') return Promise.resolve();
      return run(() => read(1, 'loadingMore', state.rows));
    },

    refresh(): Promise<void> {
      const pages = Math.max(1, Math.ceil(state.rows.length / pageSize));
      set({ count: null });
      return run(() => read(pages, 'loading', []));
    },

    setFilters(filters: SourceFilters): Promise<void> {
      set({ filters: toWire(filters) });
      return source.load();
    },

    setSort(sort: SortSpec[]): Promise<void> {
      set({ sort: [...sort] });
      return source.load();
    },

    async count(): Promise<number | null> {
      // A field that cannot be summarized answers 200 with its key absent, so the key is
      // tested rather than assumed (020_summarize).
      const summary = await client.summarize(entityType, {
        filters: state.filters,
        summaryFields: [{ field: 'id', type: 'count' }],
      });
      const total = summary.summaries['id'];
      const value = typeof total === 'number' ? total : null;
      set({ count: value });
      return value;
    },

    async updateRow(ref: EntityRef, patch: Record<string, unknown>): Promise<EntityRow> {
      await client.update(ref.type, ref.id, patch);
      // The write answers the whole record but never resolves a dotted path, so the row
      // is read again with the source's own projection (024_read_after_write). The re-read
      // ignores the source's filter: a change that moves the row out of it still has to
      // come back so the view can show what was written.
      const reread = await client.search(ref.type, {
        filters: { logical_operator: 'and', conditions: [['id', 'is', ref.id]] },
        fields,
        page: { size: 1, number: 1 },
      });
      const fresh = reread.data[0];
      if (!fresh) throw new Error(`${ref.type} ${ref.id} could not be read back after the write.`);
      const key = rowKey(ref);
      set({ rows: state.rows.map((row) => (rowKey(row) === key ? fresh : row)) });
      return fresh;
    },

    snapshot(): EntitySourceState {
      return state;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };

  return source;
}

/* -------------------------------------------------------------------------- */
/* columns                                                                    */
/* -------------------------------------------------------------------------- */

/** A column as a caller writes it: a path, and anything the schema should not decide. */
export interface ColumnSpec {
  /** Plain or dotted path, e.g. `entity.Shot.code`. */
  path: string;
  header?: string;
  dataType?: string;
  /** Starting width in pixels. */
  width?: number;
  editable?: boolean;
  align?: 'left' | 'right';
  field?: FieldSchema | null;
  /** Override the sortability the data type implies. */
  sortable?: boolean;
}

/** A column with every question answered, which is what a collection widget takes. */
export interface CollectionColumn {
  path: string;
  header: string;
  dataType: string;
  width?: number;
  /** True when a cell may open an editor. A projection is never writable. */
  editable: boolean;
  align: 'left' | 'right';
  /** False for a type the server sorts as a silent no-op or a 400 (026_result_order). */
  sortable: boolean;
  /** The schema of the field the path lands on, for a status label out of `display_values`. */
  field: FieldSchema | null;
}

/**
 * Fill in headers, data types and editability from the schema.
 *
 * The header of a dotted path is the display name of the field it lands on. A
 * projection is never writable: a write names one field of one row
 * (put_entity_type_id), so only a plain path can open an editor.
 */
export async function resolveColumns(
  schema: SchemaService,
  entityType: string,
  columns: ReadonlyArray<string | ColumnSpec>,
): Promise<CollectionColumn[]> {
  return Promise.all(
    columns.map(async (entry) => {
      const spec: ColumnSpec = typeof entry === 'string' ? { path: entry } : entry;
      const segments = await schema.resolvePath(entityType, spec.path);
      const last = segments[segments.length - 1];
      const field = spec.field ?? last?.field ?? null;
      const dataType = spec.dataType ?? last?.dataType ?? 'text';
      const column: CollectionColumn = {
        path: spec.path,
        header: spec.header ?? last?.displayName ?? spec.path,
        dataType,
        editable: spec.editable ?? (segments.length === 1 && (field?.editable ?? false)),
        align: spec.align ?? (isNumericType(dataType) ? 'right' : 'left'),
        sortable: spec.sortable ?? isSortable(dataType),
        field,
      };
      if (spec.width !== undefined) column.width = spec.width;
      return column;
    }),
  );
}

/**
 * Contiguous runs of rows sharing a value at `path`.
 *
 * Grouping a paged read is only honest over an order the server produced, so a
 * caller sorts on the same path and this walks the runs. A group whose rows
 * continue on the next page grows when that page arrives.
 */
export interface RowGroup {
  /** The raw value the run shares. */
  value: unknown;
  rows: EntityRow[];
}

export function groupRows(rows: readonly EntityRow[], path: string): RowGroup[] {
  const groups: RowGroup[] = [];
  let key: string | null = null;
  for (const row of rows) {
    const value = cellValue(row, path);
    const next = JSON.stringify(value ?? null);
    const last = groups[groups.length - 1];
    if (last && next === key) last.rows.push(row);
    else groups.push({ value, rows: [row] });
    key = next;
  }
  return groups;
}
