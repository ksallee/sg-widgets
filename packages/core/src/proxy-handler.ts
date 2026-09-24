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
import type { BatchRequest, EventLogOptions, FollowingOptions, SearchOptions, SgClient, SummarizeOptions, UploadFile } from './client.js';
import { SgApiError } from './client.js';
import type { EntityRef, TextSearchFilter } from './filter.js';

/** The methods the protocol carries, one POST each. */
export const PROXY_METHODS = ['entityTypes', 'fields', 'fieldWithProject', 'search', 'textSearch', 'statuses', 'create', 'update', 'upload', 'hierarchyExpand', 'hierarchySearch', 'summarize', 'threadContents', 'eventLog', 'following', 'delete', 'revive', 'batch'] as const;

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
  id?: unknown;
  patch?: unknown;
  path?: unknown;
  rootPath?: unknown;
  entity?: unknown;
  body?: unknown;
  file?: unknown;
  noteId?: unknown;
  entityFields?: unknown;
  userId?: unknown;
  requests?: unknown;
}

class BadRequest extends Error {}

/**
 * Bytes as base64. The protocol is one JSON object per call, so an upload's bytes
 * cross it encoded and are decoded here.
 */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  // In chunks: one spread of a large array overflows the argument stack.
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(binary);
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** `{filename, data, field}` with the bytes still base64. A zero-byte file is an empty string. */
function uploadFile(value: unknown, name: string): UploadFile {
  const raw = obj(value, name);
  const field = raw['field'];
  if (field !== undefined && field !== null && typeof field !== 'string') throw new BadRequest(`'${name}.field' must be a string`);
  const file: UploadFile = { filename: str(raw['filename'], `${name}.filename`), data: base64(raw['data'], `${name}.data`) };
  if (typeof field === 'string') file.field = field;
  return file;
}

function base64(value: unknown, name: string): Uint8Array {
  if (typeof value !== 'string') throw new BadRequest(`'${name}' must be a base64 string`);
  try {
    return base64ToBytes(value);
  } catch {
    throw new BadRequest(`'${name}' is not base64`);
  }
}

function entityRef(value: unknown, name: string): EntityRef {
  const ref = value as EntityRef | null;
  if (ref === null || typeof ref !== 'object') throw new BadRequest(`'${name}' must be a {type, id} object`);
  return { type: str(ref.type, `${name}.type`), id: num(ref.id, `${name}.id`) };
}

/** The list is passed on as sent; the API names what is wrong with a request (recipes/002). */
function requestList(value: unknown, name: string): BatchRequest[] {
  if (!Array.isArray(value)) throw new BadRequest(`'${name}' must be a list`);
  for (const [i, request] of value.entries()) obj(request, `${name}[${i}]`);
  return value as BatchRequest[];
}

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

function obj(value: unknown, name: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new BadRequest(`'${name}' must be a JSON object`);
  return value as Record<string, unknown>;
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
        (p.entityTypes ?? {}) as Record<string, TextSearchFilter>,
        (p.page ?? undefined) as { size?: number; number?: number } | undefined,
      );
    case 'statuses':
      return client.statuses();
    case 'create':
      return client.create(str(p.entityType, 'entityType'), obj(p.body, 'body'));
    case 'update':
      return client.update(str(p.entityType, 'entityType'), num(p.id, 'id'), obj(p.patch, 'patch'));
    case 'upload':
      return client.upload(str(p.entityType, 'entityType'), num(p.id, 'id'), uploadFile(p.file, 'file'));
    case 'hierarchySearch':
      return client.hierarchySearch(str(p.rootPath, 'rootPath'), entityRef(p.entity, 'entity'));
    case 'hierarchyExpand':
      return client.hierarchyExpand(str(p.path, 'path'));
    case 'summarize':
      return client.summarize(str(p.entityType, 'entityType'), (p.options ?? {}) as SummarizeOptions);
    case 'threadContents':
      return client.threadContents(
        num(p.noteId, 'noteId'),
        (p.entityFields ?? undefined) as Record<string, string[]> | undefined,
      );
    case 'eventLog':
      return client.eventLog((p.options ?? {}) as EventLogOptions);
    case 'following':
      return client.following(num(p.userId, 'userId'), (p.options ?? {}) as FollowingOptions);
    case 'delete':
      return client.delete(str(p.entityType, 'entityType'), num(p.id, 'id')).then(() => null);
    case 'revive':
      return client.revive(str(p.entityType, 'entityType'), num(p.id, 'id'));
    case 'batch':
      return client.batch(requestList(p.requests, 'requests'));
  }
}
