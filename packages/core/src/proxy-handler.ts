/**
 * Proxy handler.
 *
 * The server half of `ProxyClient`. It takes a method name and a decoded JSON
 * body and answers a status and a JSON-serialisable body, so any HTTP layer
 * wraps it without this package knowing about that layer.
 *
 * A Node server:
 *
 * ```ts
 * const handle = createProxyHandler(new RestClient({ siteUrl, token }));
 * createServer(async (req, res) => {
 *   const method = req.url!.slice('/sg/'.length);
 *   const chunks: Buffer[] = [];
 *   for await (const chunk of req) chunks.push(chunk as Buffer);
 *   const out = await handle(method, JSON.parse(Buffer.concat(chunks).toString() || '{}'));
 *   res.writeHead(out.status, { 'content-type': 'application/json' });
 *   res.end(JSON.stringify(out.body));
 * }).listen(3000);
 * ```
 *
 * A SvelteKit endpoint at `src/routes/sg/[method]/+server.ts`:
 *
 * ```ts
 * export const POST = async ({ params, request }) => {
 *   const out = await handle(params.method, await request.json());
 *   return json(out.body, { status: out.status });
 * };
 * ```
 */
import type { SearchOptions, SgClient } from './client.js';
import { SgApiError } from './client.js';
import type { WireGroup } from './filter.js';

/** The methods the protocol carries, one POST each. */
export const PROXY_METHODS = ['entityTypes', 'fields', 'fieldWithProject', 'search', 'textSearch', 'statuses'] as const;

export type ProxyMethod = (typeof PROXY_METHODS)[number];

/** An error as it crosses the wire. `ProxyClient` rebuilds an `SgApiError` from it. */
export interface ProxyError {
  status: number;
  message: string;
  body: unknown;
}

export type ProxyBody = { data: unknown } | { error: ProxyError };

export interface ProxyResult {
  /** HTTP status the wrapper writes. */
  status: number;
  body: ProxyBody;
}

export type ProxyHandler = (method: string, body: unknown) => Promise<ProxyResult>;

export function isProxyMethod(value: string): value is ProxyMethod {
  return (PROXY_METHODS as readonly string[]).includes(value);
}

interface Params {
  entityType?: unknown;
  field?: unknown;
  projectId?: unknown;
  options?: unknown;
  text?: unknown;
  entityTypes?: unknown;
  page?: unknown;
}

class BadRequest extends Error {}

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new BadRequest(`'${name}' must be a non-empty string`);
  return value;
}

function num(value: unknown, name: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new BadRequest(`'${name}' must be a number`);
  return value;
}

function optionalNum(value: unknown, name: string): number | undefined {
  return value === undefined || value === null ? undefined : num(value, name);
}

function fail(status: number, message: string, body: unknown = null): ProxyResult {
  return { status, body: { error: { status, message, body } } };
}

/** Wraps a client so a host app can expose it over its own HTTP endpoints. */
export function createProxyHandler(client: SgClient): ProxyHandler {
  return async function handle(method: string, body: unknown): Promise<ProxyResult> {
    if (!isProxyMethod(method)) return fail(404, `Unknown method '${method}'`);
    if (body !== undefined && body !== null && typeof body !== 'object') return fail(400, 'Body must be a JSON object');
    const p = (body ?? {}) as Params;
    try {
      return { status: 200, body: { data: await call(client, method, p) } };
    } catch (error) {
      if (error instanceof BadRequest) return fail(400, error.message);
      // An API error round-trips whole: the caller's `SgApiError` keeps its status and body.
      if (error instanceof SgApiError) return fail(error.status, error.message, error.body);
      return fail(500, error instanceof Error ? error.message : String(error));
    }
  };
}

function call(client: SgClient, method: ProxyMethod, p: Params): Promise<unknown> {
  switch (method) {
    case 'entityTypes':
      return client.entityTypes();
    case 'fields':
      return client.fields(str(p.entityType, 'entityType'), optionalNum(p.projectId, 'projectId'));
    case 'fieldWithProject':
      return client.fieldWithProject(str(p.entityType, 'entityType'), str(p.field, 'field'), num(p.projectId, 'projectId'));
    case 'search':
      return client.search(str(p.entityType, 'entityType'), (p.options ?? {}) as SearchOptions);
    case 'textSearch':
      return client.textSearch(
        str(p.text, 'text'),
        (p.entityTypes ?? {}) as Record<string, WireGroup | null>,
        (p.page ?? undefined) as { size?: number; number?: number } | undefined,
      );
    case 'statuses':
      return client.statuses();
  }
}
