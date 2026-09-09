/**
 * Client adapter.
 *
 * Widgets talk to a `SgClient` and nothing else. Browser code rarely calls the
 * Flow PT REST API directly (credentials, CORS), so most apps implement this
 * against their own proxy. `RestClient` is the reference implementation against
 * the REST API itself, for tests, tools and apps that can hold a token.
 */
import type { WireGroup } from './filter.js';
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

/** Row of `_text_search`, which is flattened and not the `_search` shape. */
export interface TextSearchRow {
  type: string;
  id: number;
  name: string;
  image?: string | null;
  projectId?: number | null;
  status?: string | null;
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
  /** Free-text search across several types. Every word must match. Page size is 1 to 25. */
  textSearch(text: string, entityTypes: Record<string, WireGroup | null>, page?: { size?: number; number?: number }): Promise<TextSearchRow[]>;
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
    this.fetchFn = options.fetch ?? globalThis.fetch;
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

  async textSearch(text: string, entityTypes: Record<string, WireGroup | null>, page?: { size?: number; number?: number }): Promise<TextSearchRow[]> {
    const types: Record<string, unknown> = {};
    for (const [t, f] of Object.entries(entityTypes)) types[t] = f ?? [];
    const body = { text, entity_types: types, page: { size: Math.min(page?.size ?? 25, 25), number: page?.number ?? 1 } };
    const res = await this.request<{ data: Array<Record<string, unknown>> }>('POST', '/entity/_text_search', body);
    return res.data.map((row) => ({
      type: String(row['type']),
      id: Number(row['id']),
      name: String(row['name'] ?? ''),
      image: (row['image'] as string | null | undefined) ?? null,
      projectId: (row['project_id'] as number | null | undefined) ?? null,
      status: (row['status'] as string | null | undefined) ?? null,
    }));
  }

  async update(entityType: string, id: number, patch: Record<string, unknown>): Promise<EntityRow> {
    // A write takes plain JSON; the vendor types are a `_search` requirement (probe 004). There is
    // no PATCH, and this PUT is already partial: it does not replace the record with the body
    // (put_entity_type_id). `?fields` is accepted and ignored, so nothing is asked for here.
    const res = await this.request<{ data: EntityRow }>('PUT', `/entity/${pluralPath(entityType)}/${id}`, patch, undefined, 'application/json');
    return res.data;
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
        fields: 'display_type,image_map_key,url,html',
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

function toStatusIcon(a: Record<string, unknown>): StatusRecord['icon'] {
  switch (a['display_type']) {
    case 'image_map':
      return { displayType: 'image_map', imageMapKey: String(a['image_map_key'] ?? '') };
    case 'image':
      // The data URL comes with embedded newlines that must be stripped (probe 010).
      return { displayType: 'image', dataUrl: String(a['url'] ?? '').replace(/\s+/g, '') };
    case 'html':
      return { displayType: 'html', html: String(a['html'] ?? '') };
    default:
      return null;
  }
}

export { pluralPath };
