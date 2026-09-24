/**
 * Client adapter.
 *
 * Widgets talk to a `SgClient` and nothing else. Browser code rarely calls the
 * Flow PT REST API directly (credentials, CORS), so most apps implement this
 * against their own proxy. `RestClient` is the reference implementation against
 * the REST API itself, for tests, tools and apps that can hold a token.
 */
import { pluralPath } from './entity-path.js';
import type { TextSearchFilter, WireCondition, WireGroup } from './filter.js';
import { toFilterArray } from './filter.js';
import type { FieldSchema, RawFieldSchema, RawFieldsResponse } from './schema.js';
import { normalizeField, normalizeFields, undeclaredField } from './schema.js';
import type { StatusRecord } from './status.js';
import type { EntityRef } from './filter.js';

export interface SearchOptions {
  filters?: WireGroup | null;
  fields?: string[];
  sort?: string;
  page?: { size?: number; number?: number };
}

/** One row of a `_search` response, kept in the API's shape. */
export interface EntityRow {
  type: string;
  id: number;
  attributes: Record<string, unknown>;
  relationships: Record<string, { data: EntityRef | EntityRef[] | null }>;
}

/** What `read` asks for. */
export interface ReadOptions {
  /** The fields to return. Dotted paths are allowed. */
  fields?: string[];
  /** Read a retired row, which answers 404 otherwise; a live row then answers 404 (get_entity_type_id, 103_batch_delete_revive). */
  retired?: boolean;
}

export interface SearchResult {
  data: EntityRow[];
  /** True when another page exists. Computed from data length, not `links.next`, which is emitted on empty pages too (probe 006). */
  hasMore: boolean;
}

/**
 * Row of `_text_search`, which is flattened and not the `_search` shape. There is
 * no `fields` parameter: every row is name, links and status whatever the type, so
 * a caller that needs a thumbnail or a project re-reads with `search`
 * (post_entity_text_search).
 */
export interface TextSearchRow {
  type: string;
  id: number;
  name: string;
  /** The linked row's type and name, `['', '']` when it links to nothing. Two bare strings, not a reference. */
  links: [string, string];
  /** Status code, never a label. */
  status: string | null;
}

/**
 * What a navigation node stands for. `entity` carries a `{type, id}`, `entity_type`
 * a bare schema name; other kinds are passed through as the site sends them.
 */
export interface HierarchyRef {
  kind: string;
  value: EntityRef | string | null;
}

/** One level of the navigation tree the web interface draws (post_hierarchy_expand). */
export interface HierarchyNode {
  label: string;
  ref: HierarchyRef;
  /** The path to pass back to `hierarchyExpand` to open this node. */
  path: string;
  parentPath: string | null;
  /** False when expanding this node would return nothing. */
  hasChildren: boolean;
  /** One level only: a child's own children come from its own call. */
  children: HierarchyNode[];
}

/** Where one row sits in the navigation tree, as `POST /hierarchy/_search` answers it. */
export interface HierarchyPath {
  /** The row's own display name. */
  label: string;
  /** The same breadcrumb rendered for a person. The project is not in it. */
  pathLabel: string;
  /** One path per level, root first; the last entry is the row itself. */
  incrementalPath: string[];
  ref: EntityRef;
  projectId: number | null;
}

/** The row a node stands for, or null when it stands for a type or nothing. */
export function hierarchyEntity(ref: HierarchyRef | null | undefined): EntityRef | null {
  if (!ref || ref.kind !== 'entity' || ref.value === null || typeof ref.value !== 'object') return null;
  return ref.value;
}

/**
 * The aggregates `_summarize` offers. The endpoint prints the whole set in the 400 it
 * answers a bogus one (020_summarize).
 */
export type SummaryType =
  | 'record_count' | 'count' | 'sum' | 'maximum' | 'minimum' | 'average' | 'earliest' | 'latest'
  | 'percentage' | 'status_percentage' | 'status_percentage_as_float' | 'status_list' | 'checked' | 'unchecked';

export interface SummaryField {
  field: string;
  type: SummaryType;
}

export interface SummaryGrouping {
  field: string;
  /** Default `exact`, one group per distinct value. */
  type?: string;
  direction?: 'asc' | 'desc';
}

export interface SummarizeOptions {
  filters?: WireGroup | null;
  /** Default `[{field: 'id', type: 'count'}]`. One type per field per call: the last entry wins (020_summarize). */
  summaryFields?: SummaryField[];
  grouping?: SummaryGrouping[];
}

export interface SummaryGroup {
  /** The server's render of the value, for display. Not unique. */
  groupName: string;
  /** What the grouping was computed on. Key on this (020_summarize). */
  groupValue: unknown;
  summaries: Record<string, number>;
}

export interface SummarizeResult {
  /** Keyed by field name. A field that cannot be summarized answers 200 with the key absent. */
  summaries: Record<string, number>;
  groups: SummaryGroup[];
}

export interface EntityTypeInfo {
  name: string;
  displayName: string;
}

/**
 * Who wrote a thread row. A Reply's hash carries a fourth key, `image`, a
 * presigned avatar re-signed on every read; the `created_by` hash on a Note and
 * an Attachment has none (get_entity_notes_id_thread_contents).
 */
export interface ThreadAuthor extends EntityRef {
  image?: string | null;
}

/** One row of a note thread, flat and not the `_search` shape. */
export interface ThreadRow {
  /** `Note`, `Attachment` or `Reply`. */
  type: string;
  id: number;
  createdAt: string | null;
  /** The body. An Attachment row has none. */
  content: string | null;
  author: ThreadAuthor | null;
  /** The row as it arrived, including whatever `entityFields` widened it by. */
  fields: Record<string, unknown>;
}

/**
 * Which rows the event log answers. `meta` holds what changed and takes neither a
 * filter nor a sort, so the cut is made on these and `meta` is read off the row
 * (025_event_log).
 */
export interface EventLogOptions {
  projectId?: number;
  /**
   * The row the events are about. It is null on an event whose target has been
   * deleted, so a deleted row's history is reachable by `eventType` and dates alone.
   */
  entity?: EntityRef;
  /** One event type or several, e.g. `Shotgun_Shot_Change`. */
  eventType?: string | string[];
  /** The field that changed. Site-wide on its own, so pair it with `entity` or `eventType`. */
  attributeName?: string;
  /** Keep events after this `date_time`, as `created_at greater_than`. */
  since?: string;
  /** Keep events before this `date_time`, as `created_at less_than`. */
  until?: string;
  page?: { size?: number; number?: number };
}

/**
 * The cut the event log takes, as the `and` group `_search` wants. Nothing here
 * touches `meta`: it takes no filter (025_event_log).
 */
export function eventLogFilters(options: EventLogOptions = {}): WireGroup {
  const conditions: WireCondition[] = [];
  if (options.projectId !== undefined) conditions.push(['project', 'is', { type: 'Project', id: options.projectId }]);
  if (options.entity) conditions.push(['entity', 'is', { type: options.entity.type, id: options.entity.id }]);
  if (options.eventType !== undefined) {
    conditions.push(Array.isArray(options.eventType) ? ['event_type', 'in', options.eventType] : ['event_type', 'is', options.eventType]);
  }
  if (options.attributeName !== undefined) conditions.push(['attribute_name', 'is', options.attributeName]);
  if (options.since !== undefined) conditions.push(['created_at', 'greater_than', options.since]);
  if (options.until !== undefined) conditions.push(['created_at', 'less_than', options.until]);
  return { logical_operator: 'and', conditions };
}

/**
 * What an event is read with. `audit_trail` is never returned even when it is
 * named, so it is not asked for (025_event_log).
 */
export const EVENT_LOG_FIELDS = ['event_type', 'attribute_name', 'description', 'created_at', 'meta', 'entity', 'project', 'user'] as const;

/** One event, `meta` decoded, with the two values an attribute change carries lifted out. */
export interface EventLogEntry {
  id: number;
  eventType: string | null;
  attributeName: string | null;
  /** The rendered English sentence the server writes. */
  description: string | null;
  createdAt: string | null;
  /** Null once the row the event is about is deleted; `meta` still names it. */
  entity: EntityRef | null;
  project: EntityRef | null;
  user: EntityRef | null;
  /** The whole decoded `meta`. Its keys follow `meta.type`. */
  meta: Record<string, unknown> | null;
  /** `meta.old_value`, present on an `attribute_change` and nowhere else. */
  oldValue: unknown;
  /** `meta.new_value`, present on an `attribute_change` and nowhere else. */
  newValue: unknown;
}

export interface EventLogResult {
  data: EventLogEntry[];
  /** True when another page exists. Read from the row count, as on `search` (probe 006). */
  hasMore: boolean;
}

/** Bytes to put on a row, and where they land. */
export interface UploadFile {
  /** The name the bytes are stored under. Its extension decides the upload type. */
  filename: string;
  /** The bytes themselves. From a browser `File`, `new Uint8Array(await file.arrayBuffer())`. */
  data: Uint8Array;
  /**
   * The field in the path, which picks the kind: `image` is a Thumbnail, another
   * field an Attachment on that field, and no field at all a generic Attachment on
   * `attachment_links` (recipes/001).
   */
  field?: string;
}

/** What the handshake answered. The Attachment it made is visible only on the parent row. */
export interface UploadResult {
  /** `Thumbnail` on `image`, `Attachment` on any other form. Nothing in the request names it. */
  uploadType: string;
  /** The whole `upload_info` the ticket carried and the third call sent back. */
  uploadInfo: Record<string, unknown>;
  /** The storage's `ETag`, when it exposes one; the `PUT` status is the receipt (put_links_upload). */
  etag: string | null;
}

/** The two cuts `following` takes. Both are made server-side. */
export interface FollowingOptions {
  /** One type to keep. The schema name and the snake_case plural both work. */
  entity?: string;
  projectId?: number;
}

/**
 * One write of a batch, in the shape `POST /entity/_batch` takes. `entity` is the
 * schema name, never the URL slug, and the id key is `record_id` (recipes/002).
 */
export type BatchRequest =
  | { request_type: 'create'; entity: string; data: Record<string, unknown> }
  | { request_type: 'update'; entity: string; record_id: number; data: Record<string, unknown> }
  | { request_type: 'delete'; entity: string; record_id: number };

/**
 * One row of a batch answer. A create or an update carries its record under `data`;
 * a delete row is flat, and its `uuid` is generated per request (recipes/002).
 */
export type BatchResult =
  | { request_type: 'create'; data: EntityRow }
  | { request_type: 'update'; data: EntityRow }
  | { request_type: 'delete'; type: string; id: number; uuid: string; did_delete: boolean };

/** A row of the `_batch` answer before it is paired with its request. */
export type RawBatchRow = { data: EntityRow } | { request_type: 'delete'; type: string; id: number; uuid: string; did_delete: boolean };

/**
 * Pair each row of a batch answer with the request at its position. Rows come back
 * one per request in request order, so position is the key: two creates can share a
 * `code` (recipes/002).
 */
export function batchResults(requests: readonly BatchRequest[], rows: readonly RawBatchRow[]): BatchResult[] {
  return rows.map((row, i) => {
    const kind = requests[i]?.request_type;
    if (kind === 'delete' || !('data' in row)) {
      const flat = row as Extract<RawBatchRow, { request_type: 'delete' }>;
      return { request_type: 'delete', type: flat.type, id: flat.id, uuid: flat.uuid, did_delete: flat.did_delete };
    }
    return { request_type: kind === 'update' ? 'update' : 'create', data: row.data };
  });
}

export interface SgClient {
  /** Enabled entity types on the site with their display names. */
  entityTypes(): Promise<EntityTypeInfo[]>;
  /** All fields of a type. Pass `projectId` to get `hiddenValues` on status and list fields. */
  fields(entityType: string, projectId?: number): Promise<Record<string, FieldSchema>>;
  /**
   * One field at project scope, 1.2KB against 48KB for the whole type (probe 002).
   * Only `hiddenValues` differs from the site-scope read (probe 009).
   */
  fieldWithProject(entityType: string, field: string, projectId: number): Promise<FieldSchema>;
  search(entityType: string, options: SearchOptions): Promise<SearchResult>;
  /**
   * One row by id, in the `_search` row shape.
   *
   * A row that is not there rejects 404 code 104, and a retired row answers the same
   * 404 unless read with `retired`: only that second read tells the two apart
   * (get_entity_type_id). A batch create with no `project` answers an id this read
   * never reaches (recipes/002).
   */
  read(entityType: string, id: number, options?: ReadOptions): Promise<EntityRow>;
  /**
   * Free-text search across several types at once. Every word must match, each as
   * a case-insensitive substring of the row's name or of the linked row's name
   * (probe 053). Page size is 1 to 25 and 25 is also the default; there is no
   * `links`, so page until the answer is empty.
   */
  textSearch(
    text: string,
    entityTypes: Record<string, TextSearchFilter>,
    page?: { size?: number; number?: number },
  ): Promise<TextSearchRow[]>;
  /** Status entities with colour and icon. */
  statuses(): Promise<StatusRecord[]>;
  /**
   * Change the named fields of one row and answer the whole record.
   *
   * A key left out of `patch` is unchanged, not cleared, and an empty patch is a
   * no-op (put_entity_type_id). The answer never resolves a dotted path, so a
   * caller that shows one re-reads the row (024_read_after_write).
   */
  update(entityType: string, id: number, patch: Record<string, unknown>): Promise<EntityRow>;
  /**
   * One level of the site's navigation tree. `path` is `/Project/<id>` at the root
   * and a child's own `path` below it (post_hierarchy_expand).
   */
  hierarchyExpand(path: string): Promise<HierarchyNode>;
  /**
   * Where a row sits in the navigation tree, under `rootPath` (`/Project/<id>`).
   * The search criteria takes the literal key `entity` and nothing else: any other
   * key answers `search_criteria size must be 1`, which counts the keys it
   * recognises rather than the ones sent (post_hierarchy_search).
   */
  hierarchySearch(rootPath: string, entity: EntityRef): Promise<HierarchyPath[]>;
  /**
   * Aggregate rows without paging them. One `grouping` returns a field's distinct
   * values and their counts (020_summarize).
   */
  summarize(entityType: string, options?: SummarizeOptions): Promise<SummarizeResult>;
  /**
   * Create one row and answer it.
   *
   * `project` is the create contract on a project-scoped type and the schema's
   * `mandatory` flags are not it: the identity field is flagged mandatory, is
   * optional, and is generated by the server when it is left out (012_create_version).
   * An entity link is a `{type, id}` hash; a bare id 400s. Nothing is unique on any
   * type measured, so two creates of the same body make two rows: key on `id`.
   */
  create(entityType: string, body: Record<string, unknown>): Promise<EntityRow>;
  /**
   * Put a file on a row, in the three calls the API takes.
   *
   * A ticket, a `PUT` of the bytes to presigned storage, and a completing `POST`.
   * The 201 the third answers proves the handshake and not that bytes exist:
   * skipping the second is undetectable, and the row it leaves reads the same
   * (039_upload_silent_failures). A media field is not readable straight after: it
   * returns a placeholder under `/images/status/transient/` until the transcode
   * lands (recipes/001).
   */
  upload(entityType: string, id: number, file: UploadFile): Promise<UploadResult>;
  /**
   * A Note, its Attachments and its Replies as one list in time order.
   *
   * It replaces a `_search` on each of the three types and orders them together.
   * `entityFields` widens a row type, one entry per type; it is accepted and
   * changes nothing for Reply, whose extra fields need a `_search` on replies
   * (get_entity_notes_id_thread_contents).
   */
  threadContents(noteId: number, entityFields?: Record<string, string[]>): Promise<ThreadRow[]>;
  /**
   * What changed, newest first.
   *
   * This is the change log, not the activity stream: a status change written over
   * the API was on no stream 430s later (067_notes_in_the_stream). Rows are sorted
   * `-id`; `id` and `created_at` are the two orders the type answers, and ids at the
   * head are sparse and fill in later, so a cursor on `max(id)` drops events: re-scan
   * behind the head or drive the feed from `created_at` and deduplicate on `id`
   * (025_event_log).
   */
  eventLog(options?: EventLogOptions): Promise<EventLogResult>;
  /**
   * Everything one person follows, in one unpaged body.
   *
   * Each row is a type and an id: neither the record's name nor the date the
   * follow started is returned, so a display list costs a `_search` on the ids.
   * The user must be a HumanUser; a script cannot ask what it follows
   * (get_entity_human_users_id_following).
   */
  following(userId: number, options?: FollowingOptions): Promise<EntityRef[]>;
  /**
   * Retire one row. It is not erased: it reads 404 and comes back with `revive`.
   * A second delete is 404 (delete_entity_type_id). Deleting a row changes others:
   * a Shot retires its Versions (probe 060), and a Task retires its dependencies and
   * nulls `Version.sg_task` and `PublishedFile.task` without saying so
   * (089_task_delete_side_effects).
   */
  delete(entityType: string, id: number): Promise<void>;
  /**
   * Bring a retired row back with the values it had, and answer whether it was
   * retired: `false` means it was already live (post_entity_type_id). A revived Task
   * gets its links back and its chain rescheduled (089_task_delete_side_effects).
   */
  revive(entityType: string, id: number): Promise<boolean>;
  /**
   * Apply creates, updates and deletes in one atomic call, one result per request in
   * request order.
   *
   * One failing request rolls back every other one and rejects with its status and
   * title. A request cannot point at a row another request of the same batch creates:
   * send one batch per level. A create inside a batch skips the `project` check a
   * single create makes and answers the id of a row no read reaches (report 001), so
   * validate the payload first. A read timeout says nothing about what landed; keep a
   * batch to about 200 requests and make it re-runnable (recipes/002).
   */
  batch(requests: BatchRequest[]): Promise<BatchResult[]>;
}

/** The node shape `/hierarchy/_expand` answers, before normalising. */
export interface RawHierarchyNode {
  label?: string;
  ref?: { kind?: string; value?: unknown };
  path?: string;
  parent_path?: string | null;
  has_children?: boolean;
  children?: RawHierarchyNode[];
}

/**
 * Normalise one node and the level below it.
 *
 * The sample response gives a child a `label`, a `ref` and `has_children` but not
 * always a `path`, so a child without one is addressed by appending its ref to the
 * parent's path (post_hierarchy_expand).
 */
export function normalizeHierarchyNode(raw: RawHierarchyNode, path: string): HierarchyNode {
  const ref: HierarchyRef = { kind: String(raw.ref?.kind ?? 'empty'), value: (raw.ref?.value as EntityRef | string | null) ?? null };
  const own = raw.path ?? path;
  return {
    label: String(raw.label ?? ''),
    ref,
    path: own,
    parentPath: raw.parent_path ?? null,
    hasChildren: raw.has_children ?? false,
    children: uniqueByPath((raw.children ?? []).map((child) => normalizeHierarchyNode(child, childPath(own, child)))),
  };
}

/**
 * Children keyed by path, first occurrence kept. `_expand` repeats the "no <field>"
 * bucket (`.../Sequence/__none__`) once after every group on a grouped level, and the
 * repeats are the same node (post_hierarchy_expand, 064_hierarchy_expand_buckets).
 */
function uniqueByPath(nodes: HierarchyNode[]): HierarchyNode[] {
  const seen = new Set<string>();
  return nodes.filter((node) => (seen.has(node.path) ? false : (seen.add(node.path), true)));
}

function childPath(parentPath: string, child: RawHierarchyNode): string {
  if (typeof child.path === 'string') return child.path;
  const value = child.ref?.value;
  if (child.ref?.kind === 'entity_type' && typeof value === 'string') return `${parentPath}/${value}`;
  if (child.ref?.kind === 'entity' && value !== null && typeof value === 'object') {
    return `${parentPath}/id/${(value as EntityRef).id}`;
  }
  return parentPath;
}

export interface RestClientOptions {
  /** Site root, e.g. `https://studio.shotgrid.autodesk.com`. */
  siteUrl: string;
  /** Returns a bearer token. Called per request so callers can refresh. */
  token: () => Promise<string> | string;
  fetch?: typeof fetch;
}

export class SgApiError extends Error {
  constructor(public status: number, public body: unknown, message?: string) {
    super(message ?? `Flow PT API error ${status}`);
    this.name = 'SgApiError';
  }
}

const API3_HASH = 'application/vnd+shotgun.api3_hash+json';

function toHashGroup(filter: TextSearchFilter): WireGroup {
  if (!filter) return { logical_operator: 'and', conditions: [] };
  if (Array.isArray(filter)) return { logical_operator: 'and', conditions: filter };
  return filter;
}

export class RestClient implements SgClient {
  private readonly base: string;
  private readonly siteRoot: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: RestClientOptions) {
    this.siteRoot = options.siteUrl.replace(/\/+$/, '');
    this.base = this.siteRoot + '/api/v1';
    // Bound: the default `fetch` called as a method of this object is an Illegal invocation in a browser.
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string | number | undefined>,
    contentType: string = API3_HASH,
  ): Promise<T> {
    const url = new URL(this.base + path);
    for (const [k, v] of Object.entries(params ?? {})) if (v !== undefined) url.searchParams.set(k, String(v));
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${await this.options.token()}`,
    };
    if (body !== undefined) headers['Content-Type'] = contentType;
    const init: RequestInit = { method, headers };
    if (body !== undefined) init.body = JSON.stringify(body);
    const res = await this.fetchFn(url, init);
    const text = await res.text();
    const json = text ? JSON.parse(text) : null;
    if (!res.ok) {
      const title = json?.errors?.[0]?.title;
      throw new SgApiError(res.status, json, title);
    }
    return json as T;
  }

  async entityTypes(): Promise<EntityTypeInfo[]> {
    const res = await this.request<{ data: Record<string, { name: { value: string } }> }>('GET', '/schema');
    return Object.entries(res.data).map(([name, v]) => ({ name, displayName: v.name.value }));
  }

  async fields(entityType: string, projectId?: number): Promise<Record<string, FieldSchema>> {
    const res = await this.request<RawFieldsResponse>('GET', `/schema/${entityType}/fields`, undefined, { project_id: projectId });
    return normalizeFields(res, entityType);
  }

  async fieldWithProject(entityType: string, field: string, projectId: number): Promise<FieldSchema> {
    const res = await this.request<{ data: RawFieldSchema | null }>('GET', `/schema/${entityType}/fields/${field}`, undefined, {
      project_id: projectId,
    });
    if (res.data) return normalizeField(field, res.data);
    // A field the site answers on the row but leaves out of its schema reads
    // `data: null` at 200; a name that is nothing at all is a 404 (068_note_read_state).
    const known = undeclaredField(entityType, field);
    if (known) return known;
    throw new SgApiError(200, res, `Field '${entityType}.${field}' is not in the schema.`);
  }

  async search(entityType: string, options: SearchOptions): Promise<SearchResult> {
    const size = options.page?.size ?? 50;
    const body: Record<string, unknown> = {
      // `filters: []` matches every row on the site; an empty `and` group is the safe spelling.
      filters: options.filters ?? { logical_operator: 'and', conditions: [] },
      page: { size, number: options.page?.number ?? 1 },
    };
    if (options.fields) body['fields'] = options.fields.join(',');
    if (options.sort) body['sort'] = options.sort;
    const res = await this.request<{ data: EntityRow[] }>('POST', `/entity/${pluralPath(entityType)}/_search`, body);
    return { data: res.data, hasMore: res.data.length === size };
  }

  async read(entityType: string, id: number, options: ReadOptions = {}): Promise<EntityRow> {
    const params: Record<string, string | undefined> = {
      fields: options.fields?.join(','),
      'options[return_only]': options.retired ? 'retired' : undefined,
    };
    const res = await this.request<{ data: EntityRow }>('GET', `/entity/${pluralPath(entityType)}/${id}`, undefined, params);
    return res.data;
  }

  async textSearch(
    text: string,
    entityTypes: Record<string, TextSearchFilter>,
    page?: { size?: number; number?: number },
  ): Promise<TextSearchRow[]> {
    // `entity_types` keys a filter by the type it applies to, and its shape follows the
    // Content-Type: under `api3_hash` each value is a `{logical_operator, conditions}` group,
    // an empty group for no filter; an array there is `Query is not an Hash`
    // (post_entity_text_search).
    const types: Record<string, WireGroup> = {};
    for (const [t, f] of Object.entries(entityTypes)) types[t] = toHashGroup(f);
    // 25 is the cap and the default, and the message is off by one: 26 answers
    // `size must be less than 25` while 25 answers 25 rows (probe 053).
    const body = { text, entity_types: types, page: { size: Math.min(page?.size ?? 25, 25), number: page?.number ?? 1 } };
    const res = await this.request<{ data: TextSearchWire[] }>('POST', '/entity/_text_search', body);
    return res.data.map(toTextSearchRow);
  }

  async update(entityType: string, id: number, patch: Record<string, unknown>): Promise<EntityRow> {
    // A write takes plain JSON; the vendor types are a `_search` requirement (probe 004). There is
    // no PATCH, and this PUT is already partial: it does not replace the record with the body
    // (put_entity_type_id). `?fields` is accepted and ignored, so nothing is asked for here.
    const res = await this.request<{ data: EntityRow }>('PUT', `/entity/${pluralPath(entityType)}/${id}`, patch, undefined, 'application/json');
    return res.data;
  }

  async create(entityType: string, body: Record<string, unknown>): Promise<EntityRow> {
    // A write takes plain JSON, as `update` does; the vendor types are a `_search`
    // requirement (probe 004).
    const res = await this.request<{ data: EntityRow }>('POST', `/entity/${pluralPath(entityType)}`, body, undefined, 'application/json');
    return res.data;
  }

  async delete(entityType: string, id: number): Promise<void> {
    // 204 with a zero-byte body (delete_entity_type_id).
    await this.request<null>('DELETE', `/entity/${pluralPath(entityType)}/${id}`);
  }

  async revive(entityType: string, id: number): Promise<boolean> {
    // `revive` is required and must be truthy; a body is discarded, so none is sent (post_entity_type_id).
    const res = await this.request<{ meta?: { did_revive?: boolean } }>('POST', `/entity/${pluralPath(entityType)}/${id}`, undefined, { revive: 1 });
    return res.meta?.did_revive === true;
  }

  async batch(requests: BatchRequest[]): Promise<BatchResult[]> {
    // The list goes under `requests`, and the body is plain JSON: the vendor array type is 415 (recipes/002).
    const res = await this.request<{ data: RawBatchRow[] }>('POST', '/entity/_batch', { requests }, undefined, 'application/json');
    return batchResults(requests, res.data);
  }

  async upload(entityType: string, id: number, file: UploadFile): Promise<UploadResult> {
    const field = file.field === undefined ? '' : `/${file.field}`;
    // Step one: the ticket. `filename` is required and its absence is 400 `filename is missing`.
    const ticket = await this.request<UploadTicket>('GET', `/entity/${pluralPath(entityType)}/${id}${field}/_upload`, undefined, {
      filename: file.filename,
    });
    // Step two goes to storage and not to Flow PT. The signature covers the request, so
    // no Authorization header is sent (put_links_upload).
    const stored = await this.fetchFn(ticket.links.upload, { method: 'PUT', body: file.data as BodyInit });
    if (!stored.ok) throw new SgApiError(stored.status, await stored.text(), 'The presigned upload refused the bytes');
    // Step three. `complete_upload` is resolved against the site root: it already carries
    // `/api/v1`, and prefixing it again is a 404 with a null source. `upload_data` is
    // required even when it is empty, and the 201 answers a single space, so this reply
    // is never parsed (post_links_complete_upload).
    const completed = await this.fetchFn(new URL(ticket.links.complete_upload, this.siteRoot).toString(), {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${await this.options.token()}`,
        // The complete call takes plain JSON; the vendor type 415s here (probe 014).
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ upload_info: ticket.data, upload_data: {} }),
    });
    if (!completed.ok) {
      const text = await completed.text();
      let parsed: unknown = text;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      const title = (parsed as { errors?: Array<{ title?: string }> } | null)?.errors?.[0]?.title;
      throw new SgApiError(completed.status, parsed, title);
    }
    return {
      uploadType: String(ticket.data['upload_type'] ?? ''),
      uploadInfo: ticket.data,
      etag: stored.headers.get('ETag')?.replace(/"/g, '') ?? null,
    };
  }

  async summarize(entityType: string, options: SummarizeOptions = {}): Promise<SummarizeResult> {
    const body: Record<string, unknown> = {
      filters: options.filters ?? { logical_operator: 'and', conditions: [] },
      summary_fields: options.summaryFields ?? [{ field: 'id', type: 'count' }],
    };
    if (options.grouping) {
      body['grouping'] = options.grouping.map((g) => ({ field: g.field, type: g.type ?? 'exact', direction: g.direction ?? 'asc' }));
    }
    // The same vendor content type `_search` requires; `application/json` is 415 (020_summarize).
    const res = await this.request<SummarizeEnvelope>('POST', `/entity/${pluralPath(entityType)}/_summarize`, body);
    return normalizeSummarize(res);
  }

  async threadContents(noteId: number, entityFields?: Record<string, string[]>): Promise<ThreadRow[]> {
    // One query parameter per row type, `entity_fields[Note]=subject,sg_status_list`. The
    // Reply entry is accepted and changes nothing (get_entity_notes_id_thread_contents).
    const params: Record<string, string> = {};
    for (const [type, names] of Object.entries(entityFields ?? {})) params[`entity_fields[${type}]`] = names.join(',');
    const res = await this.request<{ data: ThreadWire[] }>('GET', `/entity/notes/${noteId}/thread_contents`, undefined, params);
    return res.data.map(toThreadRow);
  }

  async eventLog(options: EventLogOptions = {}): Promise<EventLogResult> {
    const size = options.page?.size ?? 50;
    const body = {
      filters: eventLogFilters(options),
      fields: EVENT_LOG_FIELDS.join(','),
      // The only order the type answers: a sort on anything else falls back to ascending `id`
      // at 200, so an ignored sort cannot be told from a satisfied one (025_event_log).
      sort: '-id',
      page: { size, number: options.page?.number ?? 1 },
    };
    const res = await this.request<{ data: EntityRow[] }>('POST', '/entity/event_log_entries/_search', body);
    return { data: res.data.map(normalizeEventLogEntry), hasMore: res.data.length === size };
  }

  async following(userId: number, options: FollowingOptions = {}): Promise<EntityRef[]> {
    // Unpaged, and it takes no `fields` and no `sort`: `entity` and `project_id` are the whole
    // vocabulary, and each row is an id, a type and a link (get_entity_human_users_id_following).
    const res = await this.request<{ data: Array<{ id: number; type: string }> }>(
      'GET',
      `/entity/human_users/${userId}/following`,
      undefined,
      { entity: options.entity, project_id: options.projectId },
    );
    return res.data.map((row) => ({ type: String(row.type), id: Number(row.id) }));
  }

  async hierarchyExpand(path: string): Promise<HierarchyNode> {
    // `/hierarchy/*` is the one POST family that refuses the vendor content types and
    // demands plain JSON. `seed_entity_field` is documented and ignored, so it is not
    // sent (post_hierarchy_expand).
    const res = await this.request<{ data: RawHierarchyNode }>('POST', '/hierarchy/_expand', { path }, undefined, 'application/json');
    return normalizeHierarchyNode(res.data, path);
  }

  async hierarchySearch(rootPath: string, entity: EntityRef): Promise<HierarchyPath[]> {
    // The criteria takes the literal key `entity`; every other key answers the same
    // misleading `search_criteria size must be 1` (post_hierarchy_search).
    const body = { root_path: rootPath, search_criteria: { entity: { type: entity.type, id: entity.id } } };
    const res = await this.request<{ data: HierarchyPathWire[] }>('POST', '/hierarchy/_search', body, undefined, 'application/json');
    return res.data.map(toHierarchyPath);
  }

  async statuses(): Promise<StatusRecord[]> {
    const res = await this.request<{ data: EntityRow[] }>('GET', '/entity/statuses', undefined, {
      fields: 'code,name,bg_color,icon',
      'page[size]': 500,
    });
    const iconIds = new Set<number>();
    for (const row of res.data) {
      const icon = row.relationships['icon']?.data as EntityRef | null | undefined;
      if (icon) iconIds.add(icon.id);
    }
    const icons = new Map<number, EntityRow>();
    if (iconIds.size > 0) {
      const iconRes = await this.request<{ data: EntityRow[] }>('POST', '/entity/icons/_search', {
        filters: { logical_operator: 'and', conditions: [['id', 'in', [...iconIds]]] },
        // `url` is empty unless `image_data` is asked for beside it (010_status_icons).
        fields: 'display_type,image_map_key,url,html,image_data',
        page: { size: 500, number: 1 },
      });
      for (const i of iconRes.data) icons.set(i.id, i);
    }
    return res.data.map((row) => {
      const iconRef = row.relationships['icon']?.data as EntityRef | null | undefined;
      const icon = iconRef ? icons.get(iconRef.id) : undefined;
      return {
        id: row.id,
        code: String(row.attributes['code'] ?? ''),
        name: String(row.attributes['name'] ?? ''),
        bgColor: (row.attributes['bg_color'] as string | null | undefined) ?? null,
        icon: icon ? toStatusIcon(icon.attributes) : null,
      };
    });
  }
}

interface RawSummary {
  summaries?: Record<string, number>;
  groups?: Array<{ group_name?: unknown; group_value?: unknown; summaries?: Record<string, number> }>;
}

type SummarizeEnvelope = RawSummary & { data?: RawSummary };

/** A grouped call wraps the answer in `data`; an ungrouped one does not (020_summarize). */
function normalizeSummarize(res: SummarizeEnvelope): SummarizeResult {
  const raw = res.data ?? res;
  return {
    summaries: raw.summaries ?? {},
    groups: (raw.groups ?? []).map((g) => ({
      groupName: String(g.group_name ?? ''),
      groupValue: g.group_value ?? null,
      summaries: g.summaries ?? {},
    })),
  };
}

/** `{id, type, attributes: {name, links, status}, links: {self}}`, and nothing else. */
interface TextSearchWire {
  id: number;
  type: string;
  attributes?: { name?: string | null; links?: unknown; status?: string | null };
}

function toTextSearchRow(row: TextSearchWire): TextSearchRow {
  const links = row.attributes?.links;
  const pair: [string, string] = Array.isArray(links) ? [String(links[0] ?? ''), String(links[1] ?? '')] : ['', ''];
  return {
    type: String(row.type),
    id: Number(row.id),
    name: String(row.attributes?.name ?? ''),
    links: pair,
    status: row.attributes?.status ?? null,
  };
}

/** The ticket step one mints: the `upload_info` to send back, and the two links to call. */
interface UploadTicket {
  data: Record<string, unknown>;
  links: { upload: string; complete_upload: string };
}

/** A thread row: `type`, `id`, a timestamp, an author under one of two keys, and whatever else was asked for. */
type ThreadWire = Record<string, unknown> & { type: string; id: number };

function toThreadAuthor(value: unknown): ThreadAuthor | null {
  if (value === null || typeof value !== 'object') return null;
  const hash = value as { type?: unknown; id?: unknown; name?: unknown; image?: unknown };
  if (typeof hash.type !== 'string' || typeof hash.id !== 'number') return null;
  const author: ThreadAuthor = { type: hash.type, id: hash.id };
  if (typeof hash.name === 'string') author.name = hash.name;
  if (hash.image !== undefined) author.image = (hash.image as string | null) ?? null;
  return author;
}

/**
 * The author key follows the row type: `created_by` on a Note and an Attachment,
 * `user` on a Reply (get_entity_notes_id_thread_contents). A Note widened with
 * `user` still names its author under `created_by`.
 */
function toThreadRow(row: ThreadWire): ThreadRow {
  const author = toThreadAuthor(row.type === 'Reply' ? row['user'] : row['created_by']);
  return {
    type: String(row.type),
    id: Number(row.id),
    createdAt: (row['created_at'] as string | null | undefined) ?? null,
    content: (row['content'] as string | null | undefined) ?? null,
    author,
    fields: row,
  };
}

function entityRefOf(value: unknown): EntityRef | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const ref = value as EntityRef;
  return typeof ref.name === 'string' ? { type: ref.type, id: ref.id, name: ref.name } : { type: ref.type, id: ref.id };
}

/** One `_search` row of `EventLogEntry`, with `meta` decoded as the API returns it. */
export function normalizeEventLogEntry(row: EntityRow): EventLogEntry {
  const a = row.attributes;
  const meta = (a['meta'] ?? null) as Record<string, unknown> | null;
  return {
    id: row.id,
    eventType: (a['event_type'] as string | null | undefined) ?? null,
    attributeName: (a['attribute_name'] as string | null | undefined) ?? null,
    description: (a['description'] as string | null | undefined) ?? null,
    createdAt: (a['created_at'] as string | null | undefined) ?? null,
    entity: entityRefOf(row.relationships['entity']?.data),
    project: entityRefOf(row.relationships['project']?.data),
    user: entityRefOf(row.relationships['user']?.data),
    meta,
    oldValue: meta?.['old_value'] ?? null,
    newValue: meta?.['new_value'] ?? null,
  };
}

/** `ref` is the flat `{id, type}` here, not the `{kind, value}` of `_expand`. */
interface HierarchyPathWire {
  label?: string;
  path_label?: string;
  incremental_path?: string[];
  ref: { type: string; id: number };
  project_id?: number | null;
}

function toHierarchyPath(row: HierarchyPathWire): HierarchyPath {
  return {
    label: String(row.label ?? ''),
    pathLabel: String(row.path_label ?? ''),
    incrementalPath: row.incremental_path ?? [],
    ref: { type: row.ref.type, id: row.ref.id },
    projectId: row.project_id ?? null,
  };
}

function toStatusIcon(a: Record<string, unknown>): StatusRecord['icon'] {
  switch (a['display_type']) {
    case 'image_map':
      return { displayType: 'image_map', imageMapKey: String(a['image_map_key'] ?? '') };
    case 'image': {
      // The data URL comes with embedded newlines that must be stripped; `image_data` holds the
      // same bytes and is what a narrowed projection still fills (010_status_icons).
      const url = String(a['url'] ?? '').replace(/\s+/g, '');
      const data = String(a['image_data'] ?? '').replace(/\s+/g, '');
      const dataUrl = url || (data ? `data:image/png;base64,${data}` : '');
      return dataUrl ? { displayType: 'image', dataUrl } : null;
    }
    case 'html':
      return { displayType: 'html', html: String(a['html'] ?? '') };
    default:
      return null;
  }
}
