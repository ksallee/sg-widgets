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
 *
 * With nothing typed, or less than `minQueryLength`, the same search runs without the
 * name condition, sorted `-updated_at`, so an open picker lists the rows most recently
 * worked on rather than nothing. The caller's pre-filter, project scope and exclusions
 * still apply.
 */
import type { EntityRow, SearchResult, SgClient } from './client.js';
import type { EntityRef, FilterGroup, FilterNode, WireGroup } from './filter.js';
import { condition, fromWire, group, isEmptyFilter, toApi3Hash } from './filter.js';
import type { FieldSpec } from './row.js';
import { pathOf } from './row.js';
import type { SchemaService } from './schema-service.js';
import { createSchemaService } from './schema-service.js';
import { DISPLAY_NAME_FIELDS, displayNameOf } from './schema.js';
import type { MatchRun } from './search.js';
import { matchRuns, searchWords } from './search.js';

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

/** The words of a query. The name the pickers were written against; `searchWords` is the function. */
export const queryTokens = searchWords;

/** One field a query is matched against, and how. */
export interface SearchField {
  path: string;
  /** Default `contains`. `starts_with` keeps a shared tail, such as an email domain, out of the match. */
  operator?: 'contains' | 'starts_with' | 'ends_with' | 'is';
}

/** A field name, or a field name with the operator it is matched with. */
export type SearchFieldSpec = string | SearchField;

function asSearchField(spec: SearchFieldSpec): SearchField {
  return typeof spec === 'string' ? { path: spec } : spec;
}

/**
 * The filter a typed query becomes: every word must match, each anywhere in the
 * field, and a word may sit in any one of `fields`. So "pub an" finds
 * "Published Anna" and a login search finds a person by either half of a name.
 *
 * An empty query, or no fields, gives an empty group, which matches every row:
 * `"conditions": []` is 200 and unscoped (030_complex_filters). `contains` and
 * `starts_with` both work on text fields and through dotted paths, so a field may
 * be `entity.Shot.code` (017_filter_operators).
 */
export function nameSearchFilter(query: string, fields: readonly SearchFieldSpec[]): FilterGroup {
  const tokens = searchWords(query);
  const usable = fields.map(asSearchField).filter((f) => f.path.length > 0);
  if (tokens.length === 0 || usable.length === 0) return group('and');
  const perField = usable.map((field) =>
    group('and', tokens.map((token) => condition(field.path, field.operator ?? 'contains', token))),
  );
  return perField.length === 1 ? (perField[0] as FilterGroup) : group('or', perField);
}

/**
 * The extra fields a person search matches, for the query as typed.
 *
 * The email is always searched, because it is what a person is known by on a site,
 * but only on its local part until the query holds an `@`: every address shares one
 * domain, so `contains` on "le" matches `example.studio` and with it the whole site.
 * A login never holds whitespace, so it is dropped once the query does. The
 * display-name chain is searched either way.
 */
export function userSearchFields(query: string): SearchFieldSpec[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) return [];
  const fields: SearchFieldSpec[] = [{ path: 'email', operator: trimmed.includes('@') ? 'contains' : 'starts_with' }];
  if (!/\s/.test(trimmed)) fields.push('login');
  return fields;
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
/* people and projects                                                        */
/* -------------------------------------------------------------------------- */

/** What a caller narrows a person search with. */
export interface UserPickerOptions {
  /** Search script accounts alongside people. */
  includeApiUsers?: boolean;
  /** Offer people whose status is `dis`. */
  includeInactive?: boolean;
}

/** Login and email are searched and shown, so they have to be read (entity_types/HumanUser). */
export const USER_PICKER_FIELDS = ['login', 'email', 'sg_status_list'];

/** People and script accounts, in that order. */
export function userPickerTypes(includeApiUsers: boolean): string[] {
  return includeApiUsers ? ['HumanUser', 'ApiUser'] : ['HumanUser'];
}

/**
 * The active condition, unless inactive people are wanted. `sg_status_list` on
 * HumanUser is two codes, `act` and `dis`, and `act` is the default
 * (entity_types/HumanUser). ApiUser has no status field, so a picker drops the
 * condition on that type rather than sending a filter that would 400.
 */
export function userPickerFilters(
  includeInactive: boolean,
  extra: FilterGroup | WireGroup | null | undefined,
): FilterGroup {
  return mergeFilters(asFilterGroup(extra), includeInactive ? null : condition('sg_status_list', 'is', 'act'));
}

/** `API user` for a script account, the email for a person, nothing without one. */
export function userPickerSubLabel(row: PickerRow): string {
  if (row.type === 'ApiUser') return 'API user';
  const email = row.values['email'];
  return typeof email === 'string' ? email : '';
}

/** The caller's own search fields, on top of the ones a person is searched by. */
export function userPickerSearchFields(
  extra: SearchFieldSpec[] | ((query: string) => SearchFieldSpec[]),
): (query: string) => SearchFieldSpec[] {
  return (query: string) => [...userSearchFields(query), ...(typeof extra === 'function' ? extra(query) : extra)];
}

/** What a caller narrows a project search with. */
export interface ProjectPickerOptions {
  /** Offer projects whose `archived` checkbox is set. */
  includeArchived?: boolean;
}

/** Project's status field is `sg_status`, a plain list, not `sg_status_list`. */
export const PROJECT_PICKER_FIELDS = ['sg_status', 'archived'];

/**
 * Archived projects are hidden unless asked for. `sg_status` is not a liveness
 * filter and is null on most projects; `archived`, `is_template` and `is_demo`
 * are the discriminators (018_project_listing).
 */
export function projectPickerFilters(
  includeArchived: boolean,
  extra: FilterGroup | WireGroup | null | undefined,
): FilterGroup {
  return mergeFilters(asFilterGroup(extra), includeArchived ? null : condition('archived', 'is', false));
}

/**
 * Clause 8 of the picker contract: the clear control follows `clearable`, and a
 * mandatory field never offers one. A field whose schema the widget has not read is
 * not mandatory as far as it knows, so the caller's answer stands.
 */
export function clearableForField(
  clearable: boolean | undefined,
  field: { mandatory?: boolean } | null | undefined,
): boolean {
  if (field?.mandatory === true) return false;
  return clearable ?? true;
}

/* -------------------------------------------------------------------------- */
/* highlighting                                                               */
/* -------------------------------------------------------------------------- */

/** A stretch of a label, matched or not. The shape `matchRuns` answers. */
export type HighlightRun = MatchRun;

/**
 * Split a label into matched and unmatched runs for the current query, the one
 * splitting `matchRuns` does. Kept as the name the pickers were written against.
 */
export const highlightRuns = matchRuns;

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
/* the closed control's summary                                               */
/* -------------------------------------------------------------------------- */

/** What a multi picker's control shows for the selection. */
export type PickerSummary = 'chips' | 'ellipsis' | 'count';

/** Chips `ellipsis` draws before the rest becomes `+n`, when nothing has measured the row. */
export const ELLIPSIS_CHIPS = 3;

/** How many chips a row shows, and how many it hides behind `+n`. */
export interface ChipFit {
  visible: number;
  hidden: number;
}

/** A measured chip row: each chip's width, the room it has, and the room held back. */
export interface ChipRow {
  /** Chip widths in order, each carrying the gap that follows it. */
  widths: readonly number[];
  /** The room the chips may occupy. */
  available: number;
  /** Room held back for the `+n` pill, spent only when something is hidden. */
  reserve: number;
}

/**
 * How many whole chips fit `available`, taken greedily from the first.
 *
 * A chip is never cut: one that does not fit whole is hidden, and so is every chip
 * after it. `reserve` is the room the `+n` pill needs, so it is subtracted only
 * once the row overflows and the pill is drawn. Each width carries its own trailing
 * gap, so `k` chips cost the sum of the first `k` widths whatever follows them.
 */
export function fitChips(widths: readonly number[], available: number, reserve: number): ChipFit {
  let total = 0;
  for (const width of widths) total += width;
  if (total <= available) return { visible: widths.length, hidden: 0 };
  const budget = Math.max(0, available - reserve);
  let used = 0;
  let visible = 0;
  for (const width of widths) {
    if (used + width > budget) break;
    used += width;
    visible += 1;
  }
  return { visible, hidden: widths.length - visible };
}

export interface SelectionSummary<T> {
  /** The items drawn as chips, in order. Empty under `count`. */
  shown: T[];
  /** Items past `shown`. Drawn as `+n` beside the chips. */
  overflow: number;
  /** Every label, comma-joined, for the control's `title`. */
  title: string;
  /** `3 selected`, which is the whole control under `count`. */
  countLabel: string;
  /** True while the chips must stay on one line rather than wrap. */
  oneLine: boolean;
}

/**
 * What a multi picker draws for its selection.
 *
 * `chips` draws every chip and wraps. `ellipsis`, the default, keeps one line: as
 * many whole chips as the measured row fits, then `+n`, with the whole list in the
 * title. `count` draws neither and reads `3 selected`. `max` bounds the chips in
 * either chip mode; `0` means every chip. An `ellipsis` row nothing has measured yet
 * falls back to three chips.
 */
export function summariseSelection<T>(
  items: readonly T[],
  labelOf: (item: T) => string,
  options: {
    summary?: PickerSummary | undefined;
    max?: number | undefined;
    /** The measured row. `ellipsis` fits whole chips to it; the other modes ignore it. */
    fit?: ChipRow | undefined;
  } = {},
): SelectionSummary<T> {
  const summary = options.summary ?? 'ellipsis';
  const asked = options.max ?? 0;
  const fitted =
    summary === 'ellipsis' && options.fit
      ? fitChips(options.fit.widths, options.fit.available, options.fit.reserve).visible
      : null;
  const max = asked > 0 ? asked : summary === 'ellipsis' && fitted === null ? ELLIPSIS_CHIPS : 0;
  const limit = fitted === null ? max : max > 0 ? Math.min(fitted, max) : fitted;
  const shown =
    summary === 'count' ? [] : fitted === null && limit === 0 ? [...items] : items.slice(0, limit);
  return {
    shown,
    overflow: items.length - shown.length,
    title: items.map(labelOf).join(', '),
    countLabel: `${items.length} selected`,
    oneLine: summary === 'ellipsis',
  };
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
  /**
   * Extra fields the query is matched against, on top of the display-name chain.
   * A function is called with the query, so a field is searched only when the query
   * suits it, and a field may name the operator it is matched with.
   */
  searchFields?: SearchFieldSpec[] | ((query: string) => SearchFieldSpec[]) | undefined;
  /** Field shown right-aligned, rendered by its data type. Nothing is shown without it. */
  secondaryField?: FieldSpec | null | undefined;
  /** Field shown under the label. Defaults to the entity type when several are searched. */
  subLabelField?: FieldSpec | null | undefined;
  /** Field holding the thumbnail URL. `false` hides thumbnails. */
  thumbnail?: string | false | undefined;
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
  /** True while the query is shorter than the minimum, so the rows answer no query. */
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

const DEFAULT_MIN_QUERY_LENGTH = 0;
const DEFAULT_PAGE_SIZE = 20;
const DEFAULT_DEBOUNCE_MS = 250;
/** Most recently worked on first, for the list an open picker shows before anything is typed (026_result_order). */
const BROWSE_SORT = '-updated_at';

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
  /** The fields and the project path of a type. Resolved once, from the cached schema. */
  const plans = new Map<string, Promise<TypePlan>>();
  /** True once a search has run, so changed props reload only a picker already showing rows. */
  let started = false;

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

  /** True when the query carries no name condition, so the request is the plain first page. */
  function isBrowse(query: string): boolean {
    const typed = query.trim().length;
    return typed === 0 || typed < minLength();
  }

  /* fields ---------------------------------------------------------------- */

  interface TypePlan {
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
      // Project is site-wide and has no project field; a person's membership is the
      // `projects` multi_entity on the row (entity_types/HumanUser, 018_project_listing).
      const projectPath = fields['project'] ? 'project' : fields['projects'] ? 'projects' : null;
      return { projectPath, fieldNames: new Set(Object.keys(fields)) };
    })();
    plans.set(entityType, promise);
    return promise;
  }

  /** The fields this query is matched against, before the type is known. The first mention of a path wins. */
  function searchFieldsFor(query: string): SearchField[] {
    const extra = typeof opts.searchFields === 'function' ? opts.searchFields(query) : (opts.searchFields ?? []);
    const specs = [...DISPLAY_NAME_FIELDS, ...(opts.labelField ? [opts.labelField] : []), ...extra].map(asSearchField);
    const byPath = new Map<string, SearchField>();
    for (const spec of specs) if (!byPath.has(spec.path)) byPath.set(spec.path, spec);
    return [...byPath.values()];
  }

  /** The union a row needs to render, deduplicated. Unknown names are dropped at 200. */
  function requestedFields(): string[] {
    const wanted = ['id', 'type', ...DISPLAY_NAME_FIELDS];
    if (opts.labelField) wanted.push(opts.labelField);
    const secondary = pathOf(opts.secondaryField);
    if (secondary) wanted.push(secondary);
    const subLabel = pathOf(opts.subLabelField);
    if (subLabel) wanted.push(subLabel);
    if (opts.thumbnail !== false) wanted.push(opts.thumbnail ?? 'image');
    wanted.push(...(opts.fields ?? []));
    return [...new Set(wanted)];
  }

  function excludedIds(entityType: string): number[] {
    return (opts.exclude ?? []).filter((ref) => ref.type === entityType).map((ref) => ref.id);
  }

  async function filtersFor(entityType: string, query: string): Promise<WireGroup | null> {
    const plan = await planFor(entityType);
    const fields = searchFieldsFor(query).filter((field) => plan.fieldNames.has(field.path));
    const parts: FilterNode[] = [nameSearchFilter(query, fields)];
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
    // Nothing typed leaves the rows in id order, which is the oldest work on the site,
    // so the browse list is sorted instead (026_result_order).
    const sort = isBrowse(query) ? BROWSE_SORT : undefined;
    const results = await Promise.all(
      opts.entityTypes.map(async (entityType): Promise<SearchResult> => {
        const filters = await filtersFor(entityType, query);
        return client.search(entityType, { filters, fields, page: { size, number }, ...(sort ? { sort } : {}) });
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
    started = true;
    emit({ loading: true, error: null });
    void fetchPage(query, number).then(
      (result) => {
        // A response from an abandoned run is dropped, so a slow earlier query
        // can never overwrite a later one.
        if (disposed || id !== run) return;
        remember(result.rows);
        emit({
          // A browse list answers no query, so nothing in it is highlighted.
          query: isBrowse(query) ? '' : query,
          loading: false,
          error: null,
          rows: number === 1 ? result.rows : [...state.rows, ...result.rows],
          hasMore: result.hasMore,
          tooShort: query.trim().length < minLength(),
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
      // Under the minimum the name condition is dropped, but the search still runs:
      // the list an open picker shows is the first page, not nothing.
      emit({ query: isBrowse(query) ? '' : query });
      schedule(query);
    },
    loadMore(): void {
      if (!state.hasMore || state.loading) return;
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
      // A picker that has never searched stays idle: the first request is the one
      // its list asks for when it opens.
      if (started) search(state.query, 1);
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
      typeof opts.searchFields === 'function' ? 'per query' : (opts.searchFields ?? null),
      requestedFields(),
      asFilterGroup(opts.filters),
      opts.projectId ?? null,
      (opts.exclude ?? []).map(entityKey),
      opts.pageSize ?? DEFAULT_PAGE_SIZE,
      opts.minQueryLength ?? DEFAULT_MIN_QUERY_LENGTH,
    ]);
  }
}
