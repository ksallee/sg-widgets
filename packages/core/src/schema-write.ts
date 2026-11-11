/**
 * Schema writes, and the read of one field.
 *
 * A `SchemaClient` creates, updates, retires and revives the fields of an entity
 * type, and reads one field with its wrapped record. `RestSchemaClient` speaks to
 * the REST API, `ProxySchemaClient` to an app's own endpoints behind
 * `createSchemaProxyHandler`.
 *
 * Nothing here verifies a write. A refusal is trustworthy and is surfaced as it
 * came; a 2xx proves the request parsed, not that it happened, so a caller reads
 * the field back and compares (028_loud_and_silent).
 *
 * ```ts
 * const schema = new RestSchemaClient({ siteUrl, token });
 * const { name } = await schema.createField('Version', { dataType: 'text', displayName: 'Plate Note' });
 * const read = await schema.readField('Version', name);
 * ```
 */
import type { RestClientOptions } from './client.js';
import { SgApiError } from './client.js';
import type { ProxyClientOptions } from './proxy-client.js';
import type { ProxyHandler, ProxyResult } from './proxy-handler.js';
import type { FieldSchema, RawFieldSchema } from './schema.js';
import { normalizeField } from './schema.js';

/** One setting of a field, in the shape a create and an update take. */
export interface SchemaProperty {
  property_name: string;
  value: unknown;
}

/** Settings as the API's list, or as a record turned into one in key order. */
export type SchemaProperties = SchemaProperty[] | Record<string, unknown>;

export function toSchemaProperties(properties?: SchemaProperties): SchemaProperty[] {
  if (!properties) return [];
  if (Array.isArray(properties)) return properties;
  return Object.entries(properties).map(([property_name, value]) => ({ property_name, value }));
}

export interface CreateFieldInput {
  /**
   * `text float number date date_time list url duration percent footage` take
   * nothing else. `checkbox` needs `default_value` and `status_list` its
   * `valid_values`; `entity` needs `valid_types`, one type or several, and
   * `multi_entity` exactly one; `color`, `image` and `calculated` are refused
   * (019_create_fields, 116_field_settings_create_update).
   */
  dataType: string;
  /** Sent as the `name` property. The server derives the programmatic name from it. */
  displayName: string;
  /** Every other setting. A `name` here is sent after `displayName`. */
  properties?: SchemaProperties;
}

export interface CreatedField {
  /** The programmatic name the server assigned: the last segment of `links.self`. It is not in the body. */
  name: string;
  /** `links.self` as it came. */
  self: string;
  /** The response's `data`, verbatim. */
  raw: Record<string, unknown> | null;
}

/**
 * What a read of one field answered. `raw` is the wrapped record verbatim, each
 * value beside its `editable` flag, fit to store as a snapshot.
 */
export type FieldReadResult =
  | { status: 'found'; field: FieldSchema; raw: RawFieldSchema }
  /** 404 `Field '<Type>.<field>' does not exist.` A retired field and a name never used read the same (040_field_revive). */
  | { status: 'missing'; message: string }
  /** 200 with `data: null`: the row answers the field and the schema leaves it out (068_note_read_state). */
  | { status: 'undeclared' };

/** `revived: false` carries the refusal as the server sent it. */
export type ReviveFieldResult = { revived: true } | { revived: false; status: number; message: string };

export interface SchemaClient {
  /**
   * One field of a type, at site scope or at a project's. Only `hidden_values`
   * is measured to differ by project (009_status_lists).
   *
   * A field that does not exist is the `missing` result, not a rejection. Every
   * other failure rejects, a type the site does not have included.
   */
  readField(entityType: string, field: string, projectId?: number): Promise<FieldReadResult>;
  /** Every field of a type as the wrapped records, verbatim. About 48KB a type (get_schema_type_fields). */
  readRawFields(entityType: string, projectId?: number): Promise<Record<string, RawFieldSchema>>;
  /**
   * Create a field and answer the name the server gave it.
   *
   * A display name already in use is a 201 for a suffixed field, `<name>_1`, with
   * no warning, and a display name that starts `sg_` is prefixed again: compare
   * the answered name with the wanted one, and read the type's fields before
   * creating (019_create_fields, reports/006). A name a retired field holds is
   * refused at 400; `reviveField` is the way back (040_field_revive).
   */
  createField(entityType: string, input: CreateFieldInput): Promise<CreatedField>;
  /**
   * Change a field's settings, at site scope or at a project's, and answer the
   * record the server sent back.
   *
   * The answer is not proof: a `data_type` sent beside `properties` is a 200 that
   * changes nothing. Read the field back (put_schema_type_fields_field). A
   * property the update does not take is a 400 that lists the ones it does;
   * `hidden_values` is not one (114_schema_admin_recheck).
   */
  updateField(entityType: string, field: string, properties: SchemaProperties, projectId?: number): Promise<RawFieldSchema | null>;
  /**
   * Retire a field. Its programmatic name is spent: the same name does not create
   * again, only revive, and no call frees it (delete_schema_type_fields_field). A
   * field already retired rejects with a 404 (114_schema_admin_recheck).
   */
  retireField(entityType: string, field: string): Promise<void>;
  /**
   * Bring a retired field back. It returns at the data type it was created at,
   * so read it back (040_field_revive).
   *
   * A 204 is `revived: true`. A 4xx other than 401 and 403 is `revived: false`
   * with the server's status and message; those two and everything else reject.
   * The answer for a name with nothing retired behind it is not measured.
   */
  reviveField(entityType: string, field: string): Promise<ReviveFieldResult>;
}

interface WireError {
  code?: unknown;
  title?: unknown;
  detail?: unknown;
  source?: unknown;
}

function firstError(body: unknown): WireError {
  if (body === null || typeof body !== 'object') return {};
  const errors = (body as { errors?: unknown }).errors;
  const first: unknown = Array.isArray(errors) ? errors[0] : null;
  return first !== null && typeof first === 'object' ? (first as WireError) : {};
}

/** The strings a `source` holds, e.g. `{"revive": ["revive is missing"]}`. */
function sourceMessages(source: unknown): string[] {
  if (source === null || typeof source !== 'object') return [];
  return Object.values(source as Record<string, unknown>)
    .flat()
    .filter((value): value is string => typeof value === 'string');
}

/**
 * A refusal from a schema call, as the server sent it: `status` and `body` whole,
 * and the first error's `code`, `title`, `detail` and `source` lifted out.
 *
 * `message` is the `detail` where there is one and the `title` otherwise, followed
 * by whatever only the `source` says. A 404 is titled `Not Found` and says which
 * name is wrong in its `detail` (002_schema).
 */
export class SchemaApiError extends SgApiError {
  readonly code: number | null;
  readonly title: string | null;
  readonly detail: string | null;
  readonly source: unknown;

  constructor(status: number, body: unknown, message?: string) {
    const first = firstError(body);
    const title = typeof first.title === 'string' ? first.title : null;
    const detail = typeof first.detail === 'string' ? first.detail : null;
    const said = detail ?? title;
    const extra = sourceMessages(first.source).filter((text) => !said?.includes(text));
    const composed = [said, ...extra].filter((text) => text).join(' ');
    super(status, body, message ?? (composed || `Flow PT API error ${status}`));
    this.name = 'SchemaApiError';
    this.code = typeof first.code === 'number' ? first.code : null;
    this.title = title;
    this.detail = detail;
    this.source = first.source ?? null;
  }
}

/** The one 404 that means the field is absent; an unknown type's 404 says `Entity type` (get_schema_type_fields_field). */
const FIELD_MISSING = /^Field '.*' does not exist/;

function isMissingField(error: SchemaApiError): boolean {
  return error.status === 404 && FIELD_MISSING.test(error.detail ?? error.title ?? error.message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * A wrapped record as a `FieldSchema`. The record is left as it came; a key the
 * response leaves out is read as its default, with the type taken from the path.
 */
export function fieldFromRaw(entityType: string, name: string, raw: RawFieldSchema): FieldSchema {
  const fixed = <T>(value: T) => ({ value, editable: false });
  const loose = raw as Partial<RawFieldSchema>;
  return normalizeField(name, {
    ...raw,
    name: loose.name ?? fixed(name),
    entity_type: loose.entity_type ?? fixed(entityType),
    data_type: loose.data_type ?? fixed(''),
    editable: loose.editable ?? fixed(false),
    mandatory: loose.mandatory ?? fixed(false),
    unique: loose.unique ?? fixed(false),
    properties: loose.properties ?? {},
  });
}

function fieldPath(entityType: string, field?: string): string {
  const base = `/schema/${encodeURIComponent(entityType)}/fields`;
  return field === undefined ? base : `${base}/${encodeURIComponent(field)}`;
}

interface Reply {
  status: number;
  body: unknown;
}

export class RestSchemaClient implements SchemaClient {
  private readonly base: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: RestClientOptions) {
    this.base = options.siteUrl.replace(/\/+$/, '') + '/api/v1';
    // Bound: the default `fetch` called as a method of this object is an Illegal invocation in a browser.
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async request(method: string, path: string, body?: unknown, projectId?: number): Promise<Reply> {
    const url = new URL(this.base + path);
    if (projectId !== undefined) url.searchParams.set('project_id', String(projectId));
    const headers: Record<string, string> = {
      Accept: 'application/json',
      Authorization: `Bearer ${await this.options.token()}`,
    };
    const init: RequestInit = { method, headers };
    if (body !== undefined) {
      // A schema write takes plain JSON (019_create_fields).
      headers['Content-Type'] = 'application/json';
      init.body = JSON.stringify(body);
    }
    const res = await this.fetchFn(url, init);
    const text = await res.text();
    let parsed: unknown = null;
    try {
      parsed = text ? JSON.parse(text) : null;
    } catch {
      // A gateway or a server fault may answer HTML.
      parsed = text;
    }
    if (!res.ok) throw new SchemaApiError(res.status, parsed);
    return { status: res.status, body: parsed };
  }

  async readField(entityType: string, field: string, projectId?: number): Promise<FieldReadResult> {
    let reply: Reply;
    try {
      reply = await this.request('GET', fieldPath(entityType, field), undefined, projectId);
    } catch (error) {
      if (error instanceof SchemaApiError && isMissingField(error)) return { status: 'missing', message: error.message };
      throw error;
    }
    const raw = isRecord(reply.body) ? reply.body['data'] : null;
    if (!isRecord(raw)) return { status: 'undeclared' };
    const record = raw as unknown as RawFieldSchema;
    return { status: 'found', field: fieldFromRaw(entityType, field, record), raw: record };
  }

  async readRawFields(entityType: string, projectId?: number): Promise<Record<string, RawFieldSchema>> {
    const reply = await this.request('GET', fieldPath(entityType), undefined, projectId);
    const data = isRecord(reply.body) ? reply.body['data'] : null;
    return (isRecord(data) ? data : {}) as Record<string, RawFieldSchema>;
  }

  async createField(entityType: string, input: CreateFieldInput): Promise<CreatedField> {
    const body = {
      data_type: input.dataType,
      properties: [{ property_name: 'name', value: input.displayName }, ...toSchemaProperties(input.properties)],
    };
    const reply = await this.request('POST', fieldPath(entityType), body);
    const envelope = isRecord(reply.body) ? reply.body : {};
    const links = envelope['links'];
    const self = isRecord(links) && typeof links['self'] === 'string' ? links['self'] : '';
    // The name is the last segment of `links.self` and nowhere else (post_schema_type_fields).
    const name = decodeURIComponent(self.split('?')[0]?.split('/').filter(Boolean).pop() ?? '');
    if (!name) throw new SchemaApiError(reply.status, reply.body, 'The create answered no links.self, so the name of the field is unknown');
    const data = envelope['data'];
    return { name, self, raw: isRecord(data) ? data : null };
  }

  async updateField(entityType: string, field: string, properties: SchemaProperties, projectId?: number): Promise<RawFieldSchema | null> {
    const body: Record<string, unknown> = { properties: toSchemaProperties(properties) };
    // In the body, the spelling the update was probed with (114_schema_admin_recheck).
    if (projectId !== undefined) body['project_id'] = projectId;
    const reply = await this.request('PUT', fieldPath(entityType, field), body);
    const data = isRecord(reply.body) ? reply.body['data'] : null;
    return isRecord(data) ? (data as unknown as RawFieldSchema) : null;
  }

  async retireField(entityType: string, field: string): Promise<void> {
    // 204 with an empty body (delete_schema_type_fields_field).
    await this.request('DELETE', fieldPath(entityType, field));
  }

  async reviveField(entityType: string, field: string): Promise<ReviveFieldResult> {
    try {
      // `revive` is required and must be true; the answer is an empty 204 (post_schema_type_fields_field).
      await this.request('POST', fieldPath(entityType, field), { revive: true });
      return { revived: true };
    } catch (error) {
      if (error instanceof SchemaApiError && isDeclined(error.status)) return { revived: false, status: error.status, message: error.message };
      throw error;
    }
  }
}

/** A refusal of the revive itself, as against a refused sign-in, a missing right or a fault. */
function isDeclined(status: number): boolean {
  return status >= 400 && status < 500 && status !== 401 && status !== 403;
}

/* -------------------------------------------------------------------------- */
/* the proxy                                                                  */
/* -------------------------------------------------------------------------- */

/** The schema methods the proxy protocol carries, one POST each, beside `PROXY_METHODS`. */
export const SCHEMA_PROXY_METHODS = ['readField', 'readRawFields', 'createField', 'updateField', 'retireField', 'reviveField'] as const;

export type SchemaProxyMethod = (typeof SCHEMA_PROXY_METHODS)[number];

export function isSchemaProxyMethod(value: string): value is SchemaProxyMethod {
  return (SCHEMA_PROXY_METHODS as readonly string[]).includes(value);
}

class BadRequest extends Error {}

function str(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new BadRequest(`'${name}' must be a non-empty string`);
  return value;
}

function optionalNum(value: unknown, name: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new BadRequest(`'${name}' must be a number`);
  return value;
}

/** A list of `{property_name, value}` or a record; the API names what is wrong inside one. */
function properties(value: unknown, name: string): SchemaProperties {
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      if (!isRecord(item) || typeof item['property_name'] !== 'string') throw new BadRequest(`'${name}[${i}]' must be a {property_name, value} object`);
    }
    return value as SchemaProperty[];
  }
  if (!isRecord(value)) throw new BadRequest(`'${name}' must be a list or a JSON object`);
  return value;
}

function createInput(value: unknown): CreateFieldInput {
  if (!isRecord(value)) throw new BadRequest("'input' must be a JSON object");
  const input: CreateFieldInput = { dataType: str(value['dataType'], 'input.dataType'), displayName: str(value['displayName'], 'input.displayName') };
  if (value['properties'] !== undefined && value['properties'] !== null) input.properties = properties(value['properties'], 'input.properties');
  return input;
}

function fail(status: number, message: string, body: unknown = null): ProxyResult {
  return { status, body: { error: { status, message, body } } };
}

function call(client: SchemaClient, method: SchemaProxyMethod, p: Record<string, unknown>): Promise<unknown> {
  const entityType = str(p['entityType'], 'entityType');
  switch (method) {
    case 'readField':
      return client.readField(entityType, str(p['field'], 'field'), optionalNum(p['projectId'], 'projectId'));
    case 'readRawFields':
      return client.readRawFields(entityType, optionalNum(p['projectId'], 'projectId'));
    case 'createField':
      return client.createField(entityType, createInput(p['input']));
    case 'updateField':
      return client.updateField(entityType, str(p['field'], 'field'), properties(p['properties'], 'properties'), optionalNum(p['projectId'], 'projectId'));
    case 'retireField':
      return client.retireField(entityType, str(p['field'], 'field')).then(() => null);
    case 'reviveField':
      return client.reviveField(entityType, str(p['field'], 'field'));
  }
}

/**
 * The server half of `ProxySchemaClient`, in the protocol of `createProxyHandler`.
 * It answers 404 to a method that is not a schema one, so a host routes on
 * `isSchemaProxyMethod`, or hands the schema client to `createProxyHandler`.
 *
 * These calls change the site's schema for everyone: expose them only to the
 * people who may.
 */
export function createSchemaProxyHandler(client: SchemaClient): ProxyHandler {
  return async function handle(method: string, body: unknown): Promise<ProxyResult> {
    if (!isSchemaProxyMethod(method)) return fail(404, `Unknown method '${method}'`);
    if (body !== undefined && body !== null && !isRecord(body)) return fail(400, 'Body must be a JSON object');
    try {
      return { status: 200, body: { data: await call(client, method, body ?? {}) } };
    } catch (error) {
      if (error instanceof BadRequest) return fail(400, error.message);
      // A refusal round-trips whole: the caller's `SchemaApiError` keeps its status and body.
      if (error instanceof SgApiError) return fail(error.status, error.message, error.body);
      return fail(500, error instanceof Error ? error.message : String(error));
    }
  };
}

/** A `SchemaClient` over the host app's own endpoints: one POST per method under `basePath`. */
export class ProxySchemaClient implements SchemaClient {
  private readonly base: string;
  private readonly fetchFn: typeof fetch;

  constructor(private readonly options: ProxyClientOptions) {
    this.base = options.basePath.replace(/\/+$/, '');
    // Bound: the default `fetch` called as a method of this object is an Illegal invocation in a browser.
    this.fetchFn = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  private async post<T>(method: SchemaProxyMethod, body: Record<string, unknown>): Promise<T> {
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
      throw new SchemaApiError(res.status, text, `Proxy returned a non-JSON body for '${method}'`);
    }
    const envelope = isRecord(payload) ? payload : {};
    const error = envelope['error'];
    if (isRecord(error) && typeof error['status'] === 'number' && typeof error['message'] === 'string') {
      throw new SchemaApiError(error['status'], error['body'] ?? null, error['message']);
    }
    if (!res.ok) throw new SchemaApiError(res.status, payload, `Proxy error ${res.status} for '${method}'`);
    return (envelope['data'] ?? null) as T;
  }

  readField(entityType: string, field: string, projectId?: number): Promise<FieldReadResult> {
    return this.post('readField', { entityType, field, projectId: projectId ?? null });
  }

  readRawFields(entityType: string, projectId?: number): Promise<Record<string, RawFieldSchema>> {
    return this.post('readRawFields', { entityType, projectId: projectId ?? null });
  }

  createField(entityType: string, input: CreateFieldInput): Promise<CreatedField> {
    return this.post('createField', { entityType, input });
  }

  updateField(entityType: string, field: string, properties: SchemaProperties, projectId?: number): Promise<RawFieldSchema | null> {
    return this.post('updateField', { entityType, field, properties, projectId: projectId ?? null });
  }

  async retireField(entityType: string, field: string): Promise<void> {
    await this.post('retireField', { entityType, field });
  }

  reviveField(entityType: string, field: string): Promise<ReviveFieldResult> {
    return this.post('reviveField', { entityType, field });
  }
}
