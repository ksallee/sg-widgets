/**
 * Entity picker model.
 *
 * Everything an entity picker does that is not markup: the filter a query becomes,
 * the runs a match highlights, the row shape a picker renders, and a controller
 * owning debounce, in-flight cancellation, paging, hydration and the error surface.
 * Both UI packages drive this one controller, so the two frameworks cannot drift.
 *
 * Search is one `POST /entity/<type>/_search` per type. `_text_search` is not used:
 * it has no `fields` parameter, so every row comes back as name, links and status
 * only, and a picker needs a thumbnail and a sub-label
 * (endpoints/post_entity_text_search).
 */
import type { EntityRow, SearchResult, SgClient } from './client.js';
import type { EntityRef, FilterGroup, FilterNode, WireGroup } from './filter.js';
import { condition, fromWire, group, isEmptyFilter, toApi3Hash } from './filter.js';
import type { SchemaService } from './schema-service.js';
import { createSchemaService } from './schema-service.js';
import { DISPLAY_NAME_FIELDS, displayNameOf } from './schema.js';

/* -------------------------------------------------------------------------- */
/* rows                                                                       */
/* -------------------------------------------------------------------------- */

/** One searched row, flattened for display. */
export interface PickerRow {
  type: string;
  id: number;
  /** The label, from `labelField` or the display-name chain, never empty. */
  name: string;
  /**
   * Attributes and relationships in one map. A dotted path is a literal key with
   * dots in it, not a nested object (003_query), and a relationship is unwrapped
   * to its `data` so a caller reads `{type, id, name}` rather than an envelope.
   */
  values: Record<string, unknown>;
}

/**
 * The key a picker holds a row under, everywhere. A numeric id alone collides:
 * a Shot and an Asset on one site share ids freely, and a picker may search both.
 */
export function entityKey(ref: { type: string; id: number }): string {
  return `${ref.type}:${ref.id}`;
}

/** `Type 123`, the label a row falls back to when nothing names it. */
export function placeholderName(ref: { type: string; id: number }): string {
  return `${ref.type} ${ref.id}`;
}

/** True when a reference carries no usable name and needs a read to become a row. */
export function isBareRef(ref: EntityRef): boolean {
  return !ref.name || ref.name.length === 0 || ref.name === placeholderName(ref);
}

export function toRef(row: PickerRow): EntityRef {
  return { type: row.type, id: row.id, name: row.name };
}

/** Flatten a `_search` row. `labelField` wins over the display-name chain when set. */
export function flattenRow(row: EntityRow, labelField?: string): PickerRow {
  const values: Record<string, unknown> = { ...row.attributes };
  for (const [name, link] of Object.entries(row.relationships ?? {})) values[name] = link?.data ?? null;
  const explicit = labelField === undefined ? undefined : values[labelField];
  const name =
    typeof explicit === 'string' && explicit.length > 0
      ? explicit
      : displayNameOf(row.attributes, placeholderName(row));
  return { type: row.type, id: row.id, name, values };
}

/* -------------------------------------------------------------------------- */
/* the query filter                                                           */
/* -------------------------------------------------------------------------- */

export function queryTokens(query: string): string[] {
  return query.trim().split(/\s+/).filter(Boolean);
}

/**
 * The filter a typed query becomes: every word must match, each anywhere in the
 * field, and a word may sit in any one of `fields`. So "pub an" finds
 * "Published Anna" and a login search finds a person by either half of a name.
 *
 * An empty query, or no fields, gives an empty group, which matches every row:
 * `"conditions": []` is 200 and unscoped (030_complex_filters). `contains`
 * through a dotted path works too, so a field may be `entity.Shot.code`
 * (017_filter_operators).
 */
export function nameSearchFilter(query: string, fields: readonly string[]): FilterGroup {
  const tokens = queryTokens(query);
  const usable = fields.filter((f) => f.length > 0);
  if (tokens.length === 0 || usable.length === 0) return group('and');
  const perField = usable.map((field) => group('and', tokens.map((token) => condition(field, 'contains', token))));
  return perField.length === 1 ? (perField[0] as FilterGroup) : group('or', perField);
}

/** Accept either the editor tree or the wire shape wherever a caller supplies a filter. */
export function asFilterGroup(filter: FilterGroup | WireGroup | null | undefined): FilterGroup | null {
  if (!filter) return null;
  if ('kind' in filter) return filter;
  return fromWire(filter);
}

/**
 * Drop every condition whose root field the type does not have, and every group
 * left empty by that. A picker across several types shares one pre-filter, and a
 * filter naming a field the type lacks is a 400 rather than a silent no-op
 * (017_filter_operators), so the condition is dropped on the types it cannot
 * apply to. Dropping widens a result set; it never narrows one wrongly.
 */
export function pruneFilterToFields(node: FilterNode, fieldNames: ReadonlySet<string>): FilterNode | null {
  if (node.kind === 'condition') {
    const root = node.path.split('.')[0] ?? '';
    return fieldNames.has(root) ? node : null;
  }
  const conditions = node.conditions
    .map((child) => pruneFilterToFields(child, fieldNames))
    .filter((child): child is FilterNode => child !== null);
  return conditions.length === 0 ? null : group(node.logicalOperator, conditions);
}

/** One `and` of the parts that are not empty. Blank parts are dropped, not sent. */
export function mergeFilters(...parts: Array<FilterNode | null | undefined>): FilterGroup {
  return group(
    'and',
    parts.filter((p): p is FilterNode => Boolean(p) && !isEmptyFilter(p as FilterNode)),
  );
}

/* -------------------------------------------------------------------------- */
/* highlighting                                                               */
/* -------------------------------------------------------------------------- */

export interface HighlightRun {
  text: string;
  /** True when this run is part of a matched word. Rendered bold, never coloured. */
  match: boolean;
}

/**
 * Split a label into matched and unmatched runs for the current query. Matching is
 * case-insensitive and per word, the same rule the search filter sends, and
 * overlapping words merge into one run. The result is text, never markup: a widget
 * renders the runs as elements and never sets HTML from a row.
 */
export function highlightRuns(label: string, query: string): HighlightRun[] {
  if (label.length === 0) return [];
  const tokens = queryTokens(query).map((t) => t.toLowerCase());
  if (tokens.length === 0) return [{ text: label, match: false }];

  const haystack = label.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const token of tokens) {
    let from = haystack.indexOf(token);
    while (from !== -1) {
      ranges.push([from, from + token.length]);
      from = haystack.indexOf(token, from + 1);
    }
  }
  if (ranges.length === 0) return [{ text: label, match: false }];

  ranges.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1]) last[1] = Math.max(last[1], range[1]);
    else merged.push([range[0], range[1]]);
  }

  const runs: HighlightRun[] = [];
  let at = 0;
  for (const [start, end] of merged) {
    if (start > at) runs.push({ text: label.slice(at, start), match: false });
    runs.push({ text: label.slice(start, end), match: true });
    at = end;
  }
  if (at < label.length) runs.push({ text: label.slice(at), match: false });
  return runs;
}

/* -------------------------------------------------------------------------- */
/* option list composition                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Search results first, then any selected row not among them. Keyboard picking
 * lands on fresh matches, and a selected row never leaves the list, so it stays
 * deselectable with an empty query.
 */
export function withSelectedPinned(
  rows: readonly PickerRow[],
  selected: readonly EntityRef[],
  known: ReadonlyMap<string, PickerRow>,
): PickerRow[] {
  const seen = new Set(rows.map(entityKey));
  const out = [...rows];
  for (const ref of selected) {
    const key = entityKey(ref);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(known.get(key) ?? { type: ref.type, id: ref.id, name: ref.name || placeholderName(ref), values: {} });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* the controller                                                             */
/* -------------------------------------------------------------------------- */

export interface EntitySearchOptions {
  /** A cached client. Every read goes through it, so repeated queries cost one request. */
  client: SgClient;
  /** Shared schema service. One is built over the client when absent. */
  schema?: SchemaService;
  entityTypes: string[];
  /** Field holding the row label. Defaults to the display-name chain. */
  labelField?: string | undefined;
  /** Extra fields the query is matched against, on top of the display-name chain. */
  searchFields?: string[] | undefined;
  /** Field shown right-aligned. Defaults to the id. */
  secondaryField?: string | undefined;
  /** Field shown under the label. Defaults to the entity type when several are searched. */
  subLabelField?: string | undefined;
  /** Field holding the thumbnail URL. `false` hides thumbnails. */
  thumbnailField?: string | false | undefined;
  /** Extra fields to request, so a caller's own sub-label or secondary can be read. */
  fields?: string[] | undefined;
  /** Caller pre-filter, merged into every request with `and`. */
  filters?: FilterGroup | WireGroup | null | undefined;
  /** Sugar for a project condition. Skipped on a type that has no project link. */
  projectId?: number | undefined;
  /** Rows to keep out of the results. Pushed into the server filter, per type. */
  exclude?: EntityRef[] | undefined;
  minQueryLength?: number | undefined;
  pageSize?: number | undefined;
  debounceMs?: number | undefined;
  onError?: ((error: Error) => void) | undefined;
}

export interface EntitySearchState {
  /** The query the current rows answer. Highlighting reads this, not the input. */
  query: string;
  loading: boolean;
  error: Error | null;
  rows: PickerRow[];
  /** True when another page exists. From a full page, never from `links.next` (006_pagination). */
  hasMore: boolean;
  /** True while the query is shorter than the minimum, so no search has run. */
  tooShort: boolean;
}

export interface EntitySearch {
  readonly state: EntitySearchState;
  /** Rows seen or hydrated so far, by `Type:id`. */
  readonly known: ReadonlyMap<string, PickerRow>;
  subscribe(listener: (state: EntitySearchState) => void): () => void;
  /** Set the typed query. Debounced; a run already in flight is abandoned. */
  setQuery(query: string): void;
  /** Append the next page of the current query. */
  loadMore(): void;
  /** Read the rows behind bare references, one batched request per type. */
  hydrate(refs: readonly EntityRef[]): void;
  /** Remember a row so a selection can be shown before it is searched again. */
  remember(rows: readonly PickerRow[]): void;
  /** Apply changed props. Resets the results when the request would change. */
  update(options: Partial<EntitySearchOptions>): void;
  dispose(): void;
}

const DEFAULT_MIN_QUERY_LENGTH = 2;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_DEBOUNCE_MS = 250;

function asError(cause: unknown): Error {
  return cause instanceof Error ? cause : new Error(String(cause));
}

export function createEntitySearch(options: EntitySearchOptions): EntitySearch {
  let opts: EntitySearchOptions = { ...options };
  let client: SgClient = options.client;
  let schema: SchemaService = options.schema ?? createSchemaService(client);

  const known = new Map<string, PickerRow>();
  const listeners = new Set<(state: EntitySearchState) => void>();
  /** Keys already asked for, so a failed or empty hydration is not retried forever. */
  const hydrated = new Set<string>();
  /** Search fields and the project path, per type. Resolved once, from the cached schema. */
  const plans = new Map<string, Promise<TypePlan>>();

  let state: EntitySearchState = { query: '', loading: false, error: null, rows: [], hasMore: false, tooShort: true };
  let pending: ReturnType<typeof setTimeout> | undefined;
  /** Monotonic, so a slow earlier response can never overwrite a later one. */
  let run = 0;
  let page = 1;
  let disposed = false;

  function emit(next: Partial<EntitySearchState>): void {
    state = { ...state, ...next };
    for (const listener of listeners) listener(state);
  }

  function fail(error: Error): void {
    emit({ loading: false, error });
    opts.onError?.(error);
  }

  function minLength(): number {
    return opts.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH;
  }

  /* fields ---------------------------------------------------------------- */

  interface TypePlan {
    searchFields: string[];
    /** `project`, `projects`, or null when the type is not project-scoped. */
    projectPath: string | null;
    /** Every field the type has, so a pre-filter can be pruned to it. */
    fieldNames: Set<string>;
  }

  /**
   * What a type can be searched and scoped on. Unknown field names are dropped:
   * a bogus name in `fields` is a silent 200 (003_query) but the same name in a
   * filter is a 400 (017_filter_operators), so a filter may only name real fields.
   */
  async function planFor(entityType: string): Promise<TypePlan> {
    const cached = plans.get(entityType);
    if (cached) return cached;
    const promise = (async (): Promise<TypePlan> => {
      const fields = await schema.fields(entityType);
      const wanted = [...DISPLAY_NAME_FIELDS, ...(opts.labelField ? [opts.labelField] : []), ...(opts.searchFields ?? [])];
      const searchFields = [...new Set(wanted)].filter((name) => fields[name] !== undefined);
      // Project is site-wide and has no project field; a person's membership is the
      // `projects` multi_entity on the row (entity_types/HumanUser, 018_project_listing).
      const projectPath = fields['project'] ? 'project' : fields['projects'] ? 'projects' : null;
      return { searchFields, projectPath, fieldNames: new Set(Object.keys(fields)) };
    })();
    plans.set(entityType, promise);
    return promise;
  }

  /** The union a row needs to render, deduplicated. Unknown names are dropped at 200. */
  function requestedFields(): string[] {
    const wanted = ['id', 'type', ...DISPLAY_NAME_FIELDS];
    if (opts.labelField) wanted.push(opts.labelField);
    if (opts.secondaryField) wanted.push(opts.secondaryField);
    if (opts.subLabelField) wanted.push(opts.subLabelField);
    if (opts.thumbnailField !== false) wanted.push(opts.thumbnailField ?? 'image');
    wanted.push(...(opts.fields ?? []));
    return [...new Set(wanted)];
  }

  function excludedIds(entityType: string): number[] {
    return (opts.exclude ?? []).filter((ref) => ref.type === entityType).map((ref) => ref.id);
  }

  async function filtersFor(entityType: string, query: string): Promise<WireGroup | null> {
    const plan = await planFor(entityType);
    const parts: FilterNode[] = [nameSearchFilter(query, plan.searchFields)];
    const caller = asFilterGroup(opts.filters);
    const pruned = caller ? pruneFilterToFields(caller, plan.fieldNames) : null;
    if (pruned) parts.push(pruned);
    if (opts.projectId !== undefined && plan.projectPath) {
      parts.push(condition(plan.projectPath, 'is', { type: 'Project', id: opts.projectId }));
    }
    const excluded = excludedIds(entityType);
    if (excluded.length > 0) parts.push(condition('id', 'not_in', excluded));
    return toApi3Hash(mergeFilters(...parts));
  }

  /* searching -------------------------------------------------------------- */

  async function fetchPage(query: string, number: number): Promise<{ rows: PickerRow[]; hasMore: boolean }> {
    const size = opts.pageSize ?? DEFAULT_PAGE_SIZE;
    const fields = requestedFields();
    const results = await Promise.all(
      opts.entityTypes.map(async (entityType): Promise<SearchResult> => {
        const filters = await filtersFor(entityType, query);
        return client.search(entityType, { filters, fields, page: { size, number } });
      }),
    );
    const rows: PickerRow[] = [];
    let hasMore = false;
    // Types are concatenated in the order the caller gave them, so a multi-type
    // list is stable between queries rather than reordered by the server.
    for (const result of results) {
      hasMore = hasMore || result.hasMore;
      for (const row of result.data) rows.push(flattenRow(row, opts.labelField));
    }
    return { rows, hasMore };
  }

  function search(query: string, number: number): void {
    run += 1;
    const id = run;
    page = number;
    emit({ loading: true, error: null });
    void fetchPage(query, number).then(
      (result) => {
        // A response from an abandoned run is dropped, so a slow earlier query
        // can never overwrite a later one.
        if (disposed || id !== run) return;
        remember(result.rows);
        emit({
          query,
          loading: false,
          error: null,
          rows: number === 1 ? result.rows : [...state.rows, ...result.rows],
          hasMore: result.hasMore,
          tooShort: false,
        });
      },
      (cause: unknown) => {
        if (disposed || id !== run) return;
        fail(asError(cause));
      },
    );
  }

  function schedule(query: string): void {
    if (pending !== undefined) clearTimeout(pending);
    pending = setTimeout(() => {
      pending = undefined;
      search(query, 1);
    }, opts.debounceMs ?? DEFAULT_DEBOUNCE_MS);
  }

  function remember(rows: readonly PickerRow[]): void {
    for (const row of rows) known.set(entityKey(row), row);
  }

  /* hydration -------------------------------------------------------------- */

  function hydrate(refs: readonly EntityRef[]): void {
    const byType = new Map<string, number[]>();
    for (const ref of refs) {
      const key = entityKey(ref);
      if (hydrated.has(key)) continue;
      const row = known.get(key);
      if (row && !isBareRef(row)) continue;
      if (!isBareRef(ref)) {
        // A caller-supplied name is already a row: register it without a request,
        // and never let it overwrite one that was read.
        if (!known.has(key)) known.set(key, { type: ref.type, id: ref.id, name: ref.name as string, values: {} });
        hydrated.add(key);
        continue;
      }
      hydrated.add(key);
      const ids = byType.get(ref.type);
      if (ids) ids.push(ref.id);
      else byType.set(ref.type, [ref.id]);
    }
    if (byType.size === 0) return;

    const fields = requestedFields();
    for (const [entityType, ids] of byType) {
      void client
        .search(entityType, {
          filters: toApi3Hash(group('and', [condition('id', 'in', ids)])),
          fields,
          page: { size: ids.length },
        })
        .then(
          (result) => {
            if (disposed) return;
            for (const row of result.data) {
              const hydratedRow = flattenRow(row, opts.labelField);
              known.set(entityKey(hydratedRow), hydratedRow);
            }
            // Resolve-then-merge: a hydrated row is never replaced by a bare one.
            for (const id of ids) {
              const key = entityKey({ type: entityType, id });
              if (!known.has(key)) known.set(key, { type: entityType, id, name: placeholderName({ type: entityType, id }), values: {} });
            }
            emit({});
          },
          (cause: unknown) => {
            if (disposed) return;
            for (const id of ids) {
              const key = entityKey({ type: entityType, id });
              if (!known.has(key)) known.set(key, { type: entityType, id, name: placeholderName({ type: entityType, id }), values: {} });
            }
            fail(asError(cause));
          },
        );
    }
  }

  /* the public surface ----------------------------------------------------- */

  return {
    get state(): EntitySearchState {
      return state;
    },
    known,
    subscribe(listener): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setQuery(query: string): void {
      if (query.trim().length < minLength()) {
        // Below the minimum nothing is searched and the results are dropped, but
        // the selected rows are held elsewhere, so a selection never disappears.
        run += 1;
        if (pending !== undefined) clearTimeout(pending);
        pending = undefined;
        emit({ query, loading: false, error: null, rows: [], hasMore: false, tooShort: true });
        return;
      }
      emit({ query });
      schedule(query);
    },
    loadMore(): void {
      if (!state.hasMore || state.loading || state.tooShort) return;
      search(state.query, page + 1);
    },
    hydrate,
    remember,
    update(next: Partial<EntitySearchOptions>): void {
      const before = requestShape();
      opts = { ...opts, ...next };
      if (next.schema && next.schema !== schema) schema = next.schema;
      else if (next.client && next.client !== client) {
        client = next.client;
        schema = createSchemaService(client);
        plans.clear();
      }
      if (requestShape() === before) return;
      plans.clear();
      hydrated.clear();
      if (state.query.trim().length >= minLength()) search(state.query, 1);
      else emit({ rows: [], hasMore: false, tooShort: true });
    },
    dispose(): void {
      disposed = true;
      if (pending !== undefined) clearTimeout(pending);
      listeners.clear();
    },
  };

  /** Everything that changes what a request asks for, as one comparable string. */
  function requestShape(): string {
    return JSON.stringify([
      opts.entityTypes,
      opts.labelField ?? null,
      opts.searchFields ?? null,
      requestedFields(),
      asFilterGroup(opts.filters),
      opts.projectId ?? null,
      (opts.exclude ?? []).map(entityKey),
      opts.pageSize ?? DEFAULT_PAGE_SIZE,
      opts.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH,
    ]);
  }
}
