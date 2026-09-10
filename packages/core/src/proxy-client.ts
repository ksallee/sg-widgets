/**
 * Proxy client.
 *
 * An `SgClient` that talks to the host app's own HTTP endpoints instead of the
 * Flow PT REST API, which browser code cannot reach directly: the site token
 * belongs on the server and the API sends no CORS headers.
 *
 * The protocol is one POST per method under `basePath`, a JSON object in and
 * `{"data": ...}` or `{"error": {status, message, body}}` out. The server side
 * is `createProxyHandler`.
 *
 * ```ts
 * const client = new ProxyClient({ basePath: '/sg', headers: { 'x-csrf': token } });
 * const shots = await client.search('Shot', { fields: ['code'] });
 * ```
 */
import type {
  EntityRow,
  EntityTypeInfo,
  HierarchyNode,
  HierarchyPath,
  SummarizeOptions,
  SummarizeResult,
  SearchOptions,
  SearchResult,
  SgClient,
  TextSearchRow,
} from './client.js';
import { SgApiError } from './client.js';
import type { EntityRef, TextSearchFilter } from './filter.js';
import type { ProxyError, ProxyMethod } from './proxy-handler.js';
import type { FieldSchema } from './schema.js';
import type { StatusRecord } from './status.js';

export interface ProxyClientOptions {
  /** Where the endpoints live, e.g. `/sg` or `https://app.example.com/api/sg`. */
  basePath: string;
  fetch?: typeof fetch;
  /** Extra request headers. Called per request, so a caller can rotate a CSRF or auth header. */
  headers?: Record<string, string> | (() => Record<string, string> | Promise<Record<string, string>>);
}

function isProxyError(value: unknown): value is ProxyError {
  if (value === null || typeof value !== 'object') return false;
  const e = value as ProxyError;
  return typeof e.status === 'number' && typeof e.message === 'string';
}

export class ProxyClient implements SgClient {
  private readonly base: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: ProxyClientOptions) {
    this.base = options.basePath.replace(/\/+$/, '');
    // Bound: the default `fetch` called as a method of this object is an Illegal invocation in a browser.
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async post<T>(method: ProxyMethod, body: Record<string, unknown>): Promise<T> {
    const supplied = typeof this.options.headers === 'function' ? await this.options.headers() : (this.options.headers ?? {});
    const res = await this.fetchFn(`${this.base}/${method}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...supplied },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      // Anything between the browser and the handler may answer HTML.
      throw new SgApiError(res.status, text, `Proxy returned a non-JSON body for '${method}'`);
    }
    const envelope = payload as { data?: unknown; error?: unknown } | null;
    if (envelope && isProxyError(envelope.error)) {
      throw new SgApiError(envelope.error.status, envelope.error.body ?? null, envelope.error.message);
    }
    if (!res.ok) throw new SgApiError(res.status, payload, `Proxy error ${res.status} for '${method}'`);
    return (envelope?.data ?? null) as T;
  }

  entityTypes(): Promise<EntityTypeInfo[]> {
    return this.post('entityTypes', {});
  }

  fields(entityType: string, projectId?: number): Promise<Record<string, FieldSchema>> {
    return this.post('fields', { entityType, projectId: projectId ?? null });
  }

  fieldWithProject(entityType: string, field: string, projectId: number): Promise<FieldSchema> {
    return this.post('fieldWithProject', { entityType, field, projectId });
  }

  search(entityType: string, options: SearchOptions): Promise<SearchResult> {
    return this.post('search', { entityType, options });
  }

  textSearch(
    text: string,
    entityTypes: Record<string, TextSearchFilter>,
    page?: { size?: number; number?: number },
  ): Promise<TextSearchRow[]> {
    return this.post('textSearch', { text, entityTypes, page: page ?? null });
  }

  statuses(): Promise<StatusRecord[]> {
    return this.post('statuses', {});
  }

  update(entityType: string, id: number, patch: Record<string, unknown>): Promise<EntityRow> {
    return this.post('update', { entityType, id, patch });
  }

  hierarchySearch(rootPath: string, entity: EntityRef): Promise<HierarchyPath[]> {
    return this.post('hierarchySearch', { rootPath, entity });
  }

  hierarchyExpand(path: string): Promise<HierarchyNode> {
    return this.post('hierarchyExpand', { path });
  }

  summarize(entityType: string, options: SummarizeOptions = {}): Promise<SummarizeResult> {
    return this.post('summarize', { entityType, options });
  }
}
