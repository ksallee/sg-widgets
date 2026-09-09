/**
 * Client adapter.
 *
 * Widgets talk to a `SgClient` and nothing else. Browser code rarely calls the
 * Flow PT REST API directly (credentials, CORS), so most apps implement this
 * against their own proxy. `RestClient` is the reference implementation against
 * the REST API itself, for tests, tools and apps that can hold a token.
 */
import type { TextSearchFilter, WireCondition, WireGroup } from './filter.js';
import { toFilterArray } from './filter.js';
import type { FieldSchema, RawFieldSchema, RawFieldsResponse } from './schema.js';
import { normalizeField, normalizeFields } from './schema.js';
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
    children: (raw.children ?? []).map((child) => normalizeHierarchyNode(child, childPath(own, child))),
  };
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

function pluralPath(entityType: string): string {
  // The REST API addresses types by a lowercased, underscored plural: HumanUser -> human_users, Status -> statuses.
  const snake = entityType.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
  if (snake.endsWith('s')) return `${snake}es`;
  if (snake.endsWith('y') && !/[aeiou]y$/.test(snake)) return `${snake.slice(0, -1)}ies`;
  return `${snake}s`;
}

export class RestClient implements SgClient {
  private readonly base: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: RestClientOptions) {
    this.base = options.siteUrl.replace(/\/+$/, '') + '/api/v1';
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
    return normalizeFields(res);
  }

  async fieldWithProject(entityType: string, field: string, projectId: number): Promise<FieldSchema> {
    const res = await this.request<{ data: RawFieldSchema }>('GET', `/schema/${entityType}/fields/${field}`, undefined, {
      project_id: projectId,
    });
    return normalizeField(field, res.data);
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

  async textSearch(
    text: string,
    entityTypes: Record<string, TextSearchFilter>,
    page?: { size?: number; number?: number },
  ): Promise<TextSearchRow[]> {
    // `entity_types` keys a filter by the type it applies to, and its shape follows the
    // Content-Type: under `api3_hash` each value is a `{logical_operator, conditions}` group,
    // an empty group for no filter; an array there is `Query is not an Hash` (measured on
    // the probed site 2026-09-09; post_entity_text_search records the array form under
    // `api3_array`).
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

export { pluralPath };
