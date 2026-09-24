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
 * emits forever (006_pagination). A read carries no total, so `pages` mode walks
 * the set with an explicit page number and asks `_summarize` for the count that
 * turns a range into "n to m of N" (020_summarize). Ordering is the server's: with no sort rows
 * come back id ascending and id ascending is the implicit tiebreak, and a sort
 * on a field that cannot be sorted is a silent 200 no-op, so a widget verifies a
 * sort path against the schema before offering it (026_result_order).
 */
import type { EntityRow, SearchResult, SgClient } from './client.js';
import type { EditorPlacement } from './edit.js';
import { isSortable } from './filter-ux.js';
import { isNumericType } from './field-types.js';
import type { EntityRef, FilterNode, WireGroup } from './filter.js';
import { toApi3Hash } from './filter.js';
import type { SchemaService } from './schema-service.js';
import { displayNameOf } from './schema.js';
import type { FieldSchema } from './schema.js';

/** One sort key. Serialised as `path` or `-path` (026_result_order). */
export interface SortSpec {
  path: string;
  descending: boolean;
}

/** A filter as the caller holds it: the editor's tree, the wire group, or nothing. */
export type SourceFilters = FilterNode | WireGroup | null;

export type SourceStatus = 'idle' | 'loading' | 'loadingMore' | 'ready' | 'error';

/** `pages` shows one page at a time; `infinite` appends page after page. */
export type SourceMode = 'pages' | 'infinite';

export interface EntitySourceOptions {
  client: SgClient;
  entityType: string;
  /** Paths to read, plain or dotted. `id` is always read. */
  fields: string[];
  filters?: SourceFilters;
  sort?: SortSpec[];
  /** Rows per request. Default 50. */
  pageSize?: number;
  /** Default `infinite`. */
  mode?: SourceMode;
  /** The page `pages` mode opens on. Default 1. */
  page?: number;
}

/** Everything a view renders. A new object on every change, so identity is the signal. */
export interface EntitySourceState {
  rows: EntityRow[];
  status: SourceStatus;
  error: Error | null;
  /** True when another page exists. */
  hasMore: boolean;
  /** The total the last `count()` answered. Null until one is asked for, and null when the site did not answer it. */
  total: number | null;
  filters: WireGroup | null;
  sort: SortSpec[];
  mode: SourceMode;
  /** 1-based page number of the rows on screen. 1 in infinite mode. */
  page: number;
  pageSize: number;
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
  readonly mode: SourceMode;
  readonly page: number;
  readonly pageSize: number;
  readonly total: number | null;
  /** Read the first page, discarding anything already loaded, and count the set in `pages` mode. */
  load(): Promise<void>;
  /**
   * Append the next page. A no-op in `pages` mode, while another read is in flight,
   * or when there is no more. Calling it again is what retries a page that failed.
   */
  loadMore(): Promise<void>;
  /** Read every page already shown again, keeping the row count. */
  refresh(): Promise<void>;
  /**
   * Read these paths as well. The rows already shown are read again when one of them
   * is new, keeping the row count and the total; otherwise nothing is read.
   */
  addFields(paths: readonly string[]): Promise<void>;
  setFilters(filters: SourceFilters): Promise<void>;
  setSort(sort: SortSpec[]): Promise<void>;
  /** Show one page of the set. `pages` mode only. */
  setPage(page: number): Promise<void>;
  /** Walk the set a page at a time, or append page after page. Opens at the first page. */
  setMode(mode: SourceMode): Promise<void>;
  /** Change the rows per page and open at the first one. */
  setPageSize(size: number): Promise<void>;
  /** Total rows the filter matches, through `_summarize` (020_summarize). Null when the site did not answer the key. */
  count(): Promise<number | null>;
  /** Write the named fields of one row and put the re-read row back in place. */
  updateRow(ref: EntityRef, patch: Record<string, unknown>): Promise<EntityRow>;
  /**
   * Read these rows again with the source's own projection and swap them in place.
   * A row the site no longer answers (retired, or moved out of reach) leaves the list.
   * The filter is not applied, as on `updateRow`: a row that moved out of the filter
   * still comes back so the view can show what changed. Ids not on screen are ignored.
   * Neither status nor order changes, so nothing dims and nothing jumps.
   */
  rereadRows(ids: readonly number[]): Promise<void>;
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

/** A filter in the one shape a read carries, whichever spelling the caller holds. */
export function toWireGroup(filters: SourceFilters): WireGroup | null {
  if (!filters) return null;
  if ('kind' in filters) return toApi3Hash(filters);
  return filters;
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

export function createEntitySource(options: EntitySourceOptions): EntitySource {
  const { client, entityType } = options;
  // `id` is what a row is keyed and re-read on, so it is never left out of a projection.
  let fields = [...new Set(['id', ...options.fields])];

  let state: EntitySourceState = {
    rows: [],
    status: 'idle',
    error: null,
    hasMore: false,
    total: null,
    filters: toWireGroup(options.filters ?? null),
    sort: [...(options.sort ?? [])],
    mode: options.mode ?? 'infinite',
    page: Math.max(1, options.page ?? 1),
    pageSize: options.pageSize ?? 50,
  };
  const listeners = new Set<() => void>();
  // Every read carries the generation it started in; a later filter or sort discards it.
  let generation = 0;
  let inFlight: Promise<void> | null = null;
  // One count per filter, whatever it answered: a site that answers no total answers
  // none however often it is asked (020_summarize).
  let counted = false;

  function set(next: Partial<EntitySourceState>): void {
    state = { ...state, ...next };
    for (const listener of listeners) listener();
  }

  function requestPage(number: number): Promise<SearchResult> {
    const sort = serializeSort(state.sort);
    return client.search(entityType, {
      filters: state.filters,
      fields,
      // An empty `sort` is 400 `sort must be filled`, so the key is omitted rather
      // than sent blank (026_result_order).
      ...(sort === undefined ? {} : { sort }),
      page: { size: state.pageSize, number },
    });
  }

  async function read(
    pages: number,
    status: 'loading' | 'loadingMore',
    keep: EntityRow[],
    first: number,
  ): Promise<void> {
    const mine = ++generation;
    set({ status, error: null });
    try {
      const rows = [...keep];
      let more = false;
      for (let n = 0; n < pages; n += 1) {
        const result = await requestPage(first + n);
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

  /**
   * Read the page the state now names, and count the set once per filter in `pages`
   * mode: a range reads "n to m of N" only after something counted, because no total
   * is in a read (006_pagination). Rows reach subscribers as soon as they land; the
   * promise waits for the count as well.
   */
  function reread(): Promise<void> {
    const rows = run(() => read(1, 'loading', [], state.mode === 'pages' ? state.page : 1));
    if (state.mode !== 'pages' || counted) return rows;
    const total = source.count().catch(() => undefined);
    return Promise.all([rows, total]).then(() => undefined);
  }

  const source: EntitySource = {
    entityType,
    get fields(): readonly string[] {
      return fields;
    },
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

    get mode(): SourceMode {
      return state.mode;
    },
    get page(): number {
      return state.page;
    },
    get pageSize(): number {
      return state.pageSize;
    },
    get total(): number | null {
      return state.total;
    },

    load(): Promise<void> {
      // A new read invalidates the total: the filter it was taken under may have moved.
      counted = false;
      set({ total: null, page: 1 });
      return reread();
    },

    loadMore(): Promise<void> {
      // A failed page leaves its rows and its error in place, and asking again is the retry.
      if (state.mode === 'pages' || inFlight || !state.hasMore) return Promise.resolve();
      return run(() => read(1, 'loadingMore', state.rows, Math.floor(state.rows.length / state.pageSize) + 1));
    },

    refresh(): Promise<void> {
      counted = false;
      if (state.mode === 'pages') {
        set({ total: null });
        return reread();
      }
      const pages = Math.max(1, Math.ceil(state.rows.length / state.pageSize));
      set({ total: null });
      return run(() => read(pages, 'loading', [], 1));
    },

    addFields(paths: readonly string[]): Promise<void> {
      const added = paths.filter((path) => path && !fields.includes(path));
      if (added.length === 0) return Promise.resolve();
      fields = [...fields, ...new Set(added)];
      if (state.status === 'idle') return Promise.resolve();
      // The set is the same, only the projection grew, so the total stands.
      if (state.mode === 'pages') return run(() => read(1, 'loading', [], state.page));
      const pages = Math.max(1, Math.ceil(state.rows.length / state.pageSize));
      return run(() => read(pages, 'loading', [], 1));
    },

    setFilters(filters: SourceFilters): Promise<void> {
      set({ filters: toWireGroup(filters) });
      return source.load();
    },

    setSort(sort: SortSpec[]): Promise<void> {
      // An order moves the rows, not the set, so the total counted under this filter stands.
      set({ sort: [...sort], page: 1 });
      return reread();
    },

    setPage(page: number): Promise<void> {
      if (state.mode !== 'pages') return Promise.resolve();
      set({ page: Math.max(1, Math.floor(page)) });
      return reread();
    },

    setMode(mode: SourceMode): Promise<void> {
      if (state.mode === mode) return Promise.resolve();
      set({ mode, page: 1 });
      return reread();
    },

    setPageSize(size: number): Promise<void> {
      set({ pageSize: Math.max(1, Math.floor(size)), page: 1 });
      return reread();
    },

    async count(): Promise<number | null> {
      const counting = state.filters;
      // A field that cannot be summarized answers 200 with its key absent, so the key is
      // tested rather than assumed (020_summarize).
      const summary = await client.summarize(entityType, {
        filters: counting,
        summaryFields: [{ field: 'id', type: 'count' }],
      });
      const total = summary.summaries['id'];
      const value = typeof total === 'number' ? total : null;
      // Only the filter decides the total, so a count outlives the read it started beside
      // and is dropped only when the filter it counted has moved.
      if (state.filters === counting) {
        counted = true;
        set({ total: value });
      }
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

    async rereadRows(ids: readonly number[]): Promise<void> {
      const onScreen = new Set(state.rows.map((row) => row.id));
      const wanted = [...new Set(ids)].filter((id) => onScreen.has(id));
      if (wanted.length === 0) return;
      // One read for the whole list: `page[size]` reached no cap at 5000 rows
      // (endpoints/get_entity_type). It carries no filter and no sort, so a row that moved
      // out of either still comes back, as on `updateRow`.
      const result = await client.search(entityType, {
        filters: { logical_operator: 'and', conditions: [['id', 'in', wanted]] },
        fields,
        page: { size: wanted.length, number: 1 },
      });
      const fresh = new Map(result.data.map((row) => [row.id, row]));
      const asked = new Set(wanted);
      // A row the site did not answer for is gone; every other row keeps its place, and
      // nothing here touches the status, the paging or the total.
      set({
        rows: state.rows.flatMap((row) => {
          if (!asked.has(row.id)) return [row];
          const next = fresh.get(row.id);
          return next ? [next] : [];
        }),
      });
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
/* paging                                                                     */
/* -------------------------------------------------------------------------- */

/** The numbers a collection's footer draws, in either mode. */
export interface PageRange {
  mode: SourceMode;
  page: number;
  pageSize: number;
  /** 1-based index of the first row on screen. 0 when there are none. */
  from: number;
  /** 1-based index of the last row on screen. 0 when there are none. */
  to: number;
  total: number | null;
  /** Pages the total implies. Null when nothing counted the set. */
  pageCount: number | null;
  hasPrevious: boolean;
  hasNext: boolean;
  /** `1 to 25 of 320`, and `1 to 25` when nothing counted the set. */
  rangeLabel: string;
  /** `25 loaded`, and `25 of 320 loaded` once the set is counted. */
  loadedLabel: string;
}

/**
 * The footer's numbers for one state.
 *
 * A read answers no total of its own, so a range reads "of N" only once
 * `_summarize` has counted the set. In `pages` mode a next page exists because
 * that count says so, or because the page that came back was full; in
 * `infinite` mode the source has already walked the set, so its own answer
 * stands (006_pagination, 020_summarize).
 */
export function describePaging(state: EntitySourceState): PageRange {
  const { mode, page, pageSize, total, hasMore } = state;
  const loaded = state.rows.length;
  const from = loaded === 0 ? 0 : mode === 'pages' ? (page - 1) * pageSize + 1 : 1;
  const to = loaded === 0 ? 0 : from + loaded - 1;
  const pageCount = total === null ? null : Math.max(1, Math.ceil(total / pageSize));
  return {
    mode,
    page,
    pageSize,
    from,
    to,
    total,
    pageCount,
    hasPrevious: mode === 'pages' && page > 1,
    // An appending source walks the set itself, so only it knows whether a page is left.
    hasNext: mode === 'infinite' ? hasMore : pageCount === null ? hasMore : page < pageCount,
    rangeLabel: total === null ? `${from} to ${to}` : `${from} to ${to} of ${total}`,
    loadedLabel: total === null ? `${loaded} loaded` : `${loaded} of ${total} loaded`,
  };
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
  /** Override where this column's editor opens. */
  editorPlacement?: EditorPlacement;
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
  /** Where this column's editor opens. Absent leaves it to the data type. */
  editorPlacement?: EditorPlacement;
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
      if (spec.editorPlacement !== undefined) column.editorPlacement = spec.editorPlacement;
      return column;
    }),
  );
}

/**
 * A column from a bare path, for a row-anatomy prop that takes either.
 *
 * Nothing but the path is known, so the value renders as text and the column is
 * neither sortable nor editable. A caller that wants the field's own type passes
 * the resolved column from `resolveColumns` instead.
 */
export function toColumn(spec: string | CollectionColumn): CollectionColumn {
  if (typeof spec !== 'string') return spec;
  return {
    path: spec,
    header: spec,
    dataType: 'text',
    editable: false,
    align: 'left',
    sortable: false,
    field: null,
  };
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

/**
 * The value a row groups under, derived rather than read from a column.
 *
 * For a group a column cannot name: a multi-entity field no site sorts on, or a
 * value that comes from one field on one type and another on another. The order
 * the runs are walked in is the caller's, so a caller passing this sorts the
 * source itself.
 */
export type GroupKeyFn = (row: EntityRow) => unknown;

/** What the rows are grouped on: a path they are sorted by, or a key derived from each row. */
export type GroupBy = string | GroupKeyFn;

export function groupRows(rows: readonly EntityRow[], by: GroupBy): RowGroup[] {
  const valueOf: GroupKeyFn = typeof by === 'function' ? by : (row) => cellValue(row, by);
  const groups: RowGroup[] = [];
  let key: string | null = null;
  for (const row of rows) {
    const value = valueOf(row);
    const next = JSON.stringify(value ?? null);
    const last = groups[groups.length - 1];
    if (last && next === key) last.rows.push(row);
    else groups.push({ value, rows: [row] });
    key = next;
  }
  return groups;
}

/**
 * The text a group key reads as when there is no column to render it by.
 *
 * A row reads as its display name, anything else as its own text, and a key that
 * is nothing at all as the empty string.
 */
export function groupKeyText(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return displayNameOf(value as Record<string, unknown>, '');
  return String(value);
}
