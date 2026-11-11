import { describe, expect, it } from 'vitest';
import { SgApiError } from '../src/client.js';
import { MockClient } from '../src/mock.js';
import { createProxyHandler } from '../src/proxy-handler.js';
import { MockSchemaClient } from '../src/schema-write-mock.js';
import type { SchemaClient } from '../src/schema-write.js';
import {
  createSchemaProxyHandler,
  isSchemaProxyMethod,
  ProxySchemaClient,
  RestSchemaClient,
  SCHEMA_PROXY_METHODS,
  SchemaApiError,
  toSchemaProperties,
} from '../src/schema-write.js';

interface Sent {
  method: string;
  url: string;
  contentType: string | undefined;
  authorization: string | undefined;
  body: unknown;
}

interface Answer {
  status: number;
  body?: unknown;
}

/** A `RestSchemaClient` over a fetch that records each request and answers the canned ones in order. */
function rest(...answers: Answer[]): { client: RestSchemaClient; sent: Sent[] } {
  const sent: Sent[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    sent.push({
      method: String(init?.method),
      url: String(input),
      contentType: headers['Content-Type'],
      authorization: headers['Authorization'],
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    });
    const answer = answers[Math.min(sent.length - 1, answers.length - 1)] ?? { status: 200 };
    const text = answer.body === undefined ? null : typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body);
    return new Response(text, { status: answer.status });
  }) as typeof fetch;
  return { client: new RestSchemaClient({ siteUrl: 'https://studio.example.com/', token: () => 't', fetch: fetchFn }), sent };
}

/** The error envelope the API answers (002_schema). */
function refusal(status: number, error: Record<string, unknown>): Answer {
  return { status, body: { errors: [{ id: 'f1afdea626bdfbd08e283bf75aa5daeb', status, code: 103, source: null, detail: null, meta: null, ...error }] } };
}

const NOT_FOUND = refusal(404, { title: 'Not Found', detail: "Field 'Version.sg_not_a_field' does not exist." });

/** One field as `GET /schema/<Type>/fields/<field>` answers it (get_schema_type_fields_field). */
const STATUS_FIELD = {
  name: { value: 'Status', editable: true },
  entity_type: { value: 'Version', editable: false },
  data_type: { value: 'status_list', editable: false },
  editable: { value: true, editable: false },
  mandatory: { value: false, editable: false },
  unique: { value: false, editable: false },
  visible: { value: true, editable: false },
  properties: {
    default_value: { value: 'rev', editable: true },
    valid_values: { value: ['rev', 'apr', 'pndl'], editable: true },
    hidden_values: { value: ['pndl'], editable: false },
  },
};

describe('reading one field', () => {
  it('reads at site scope and answers the field with its wrapped record verbatim', async () => {
    const { client, sent } = rest({ status: 200, body: { data: STATUS_FIELD, links: { self: '/api/v1/schema/Version/fields/sg_status_list' } } });
    const result = await client.readField('Version', 'sg_status_list');
    expect(sent[0]).toMatchObject({ method: 'GET', url: 'https://studio.example.com/api/v1/schema/Version/fields/sg_status_list', authorization: 'Bearer t' });
    expect(result.status).toBe('found');
    if (result.status !== 'found') return;
    expect(result.raw).toEqual(STATUS_FIELD);
    expect(result.field).toMatchObject({ name: 'sg_status_list', displayName: 'Status', entityType: 'Version', dataType: 'status_list', defaultValue: 'rev', hideable: false });
  });

  it('reads the description at the top level of the record, beside the name', async () => {
    // 116_field_settings_create_update: description reads back as `description.value`, not under `properties`.
    const record = { ...STATUS_FIELD, description: { value: 'Where the review stands', editable: true } };
    const { client } = rest({ status: 200, body: { data: record } });
    const result = await client.readField('Version', 'sg_status_list');
    expect(result.status === 'found' && result.field.description).toBe('Where the review stands');
  });

  it('ignores a description under properties, where the server never puts it', async () => {
    const record = { ...STATUS_FIELD, properties: { ...STATUS_FIELD.properties, description: { value: 'misplaced', editable: true } } };
    const { client } = rest({ status: 200, body: { data: record } });
    const result = await client.readField('Version', 'sg_status_list');
    expect(result.status === 'found' && result.field.description).toBeUndefined();
  });

  it('passes the project as project_id', async () => {
    const { client, sent } = rest({ status: 200, body: { data: STATUS_FIELD } });
    const result = await client.readField('Version', 'sg_status_list', 70);
    expect(sent[0]?.url).toBe('https://studio.example.com/api/v1/schema/Version/fields/sg_status_list?project_id=70');
    expect(result.status === 'found' && result.field.hiddenValues).toEqual(['pndl']);
  });

  it('normalises the keys the card sample leaves out', async () => {
    // The sample on the card has no `entity_type` and no `unique` (get_schema_type_fields_field).
    const { entity_type: _type, unique: _unique, visible: _visible, ...short } = STATUS_FIELD;
    const { client } = rest({ status: 200, body: { data: short } });
    const result = await client.readField('Version', 'sg_status_list');
    expect(result.status === 'found' && result.field).toMatchObject({ entityType: 'Version', unique: false, dataType: 'status_list' });
    expect(result.status === 'found' && result.raw).toEqual(short);
  });

  it('answers missing, with the server message, for the 404 that names the field', async () => {
    const { client } = rest(NOT_FOUND);
    expect(await client.readField('Version', 'sg_not_a_field')).toEqual({ status: 'missing', message: "Field 'Version.sg_not_a_field' does not exist." });
  });

  it('answers undeclared for the 200 with data: null', async () => {
    // A field the site answers on the row and leaves out of its schema (068_note_read_state).
    const { client } = rest({ status: 200, body: { data: null, links: { self: '/api/v1/schema/Note/fields/read_by_current_user' } } });
    expect(await client.readField('Note', 'read_by_current_user')).toEqual({ status: 'undeclared' });
  });

  it('keeps every other failure an error, a missing entity type included', async () => {
    const unknownType = rest(refusal(404, { title: 'Not Found', detail: "Entity type 'NotTypeAtAll' does not exist." }));
    const error = await unknownType.client.readField('NotTypeAtAll', 'code').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SchemaApiError);
    expect(error).toBeInstanceOf(SgApiError);
    expect(error).toMatchObject({ status: 404, title: 'Not Found', detail: "Entity type 'NotTypeAtAll' does not exist.", message: "Entity type 'NotTypeAtAll' does not exist." });

    const down = rest({ status: 502, body: '<html>Bad Gateway</html>' });
    await expect(down.client.readField('Version', 'code')).rejects.toMatchObject({ name: 'SchemaApiError', status: 502, body: '<html>Bad Gateway</html>' });
  });
});

describe('reading every field of a type, wrapped', () => {
  it('answers the records as they came', async () => {
    const { client, sent } = rest({ status: 200, body: { data: { sg_status_list: STATUS_FIELD } } });
    expect(await client.readRawFields('Version', 70)).toEqual({ sg_status_list: STATUS_FIELD });
    expect(sent[0]?.url).toBe('https://studio.example.com/api/v1/schema/Version/fields?project_id=70');
  });
});

describe('creating a field', () => {
  it('sends data_type and a property list led by the display name, and reads the name off the self link', async () => {
    // The body carries no programmatic name (post_schema_type_fields, 019_create_fields).
    const { client, sent } = rest({
      status: 201,
      body: {
        data: { name: { value: 'zzprobe 019 With (Parens)' }, data_type: { value: 'text' } },
        links: { self: '/api/v1/schema/Version/fields/sg_zzprobe_019_with__parens_' },
      },
    });
    const created = await client.createField('Version', { dataType: 'text', displayName: 'zzprobe 019 With (Parens)' });
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: 'https://studio.example.com/api/v1/schema/Version/fields',
      contentType: 'application/json',
      body: { data_type: 'text', properties: [{ property_name: 'name', value: 'zzprobe 019 With (Parens)' }] },
    });
    expect(created).toEqual({
      name: 'sg_zzprobe_019_with__parens_',
      self: '/api/v1/schema/Version/fields/sg_zzprobe_019_with__parens_',
      raw: { name: { value: 'zzprobe 019 With (Parens)' }, data_type: { value: 'text' } },
    });
  });

  it('sends the other properties after the name, from a record or a list', async () => {
    const answer = { status: 201, body: { data: {}, links: { self: '/api/v1/schema/Version/fields/sg_source_plate' } } };
    const a = rest(answer);
    await a.client.createField('Version', { dataType: 'entity', displayName: 'Source Plate', properties: { valid_types: ['Shot'] } });
    const b = rest(answer);
    await b.client.createField('Version', { dataType: 'entity', displayName: 'Source Plate', properties: [{ property_name: 'valid_types', value: ['Shot'] }] });
    const body = {
      data_type: 'entity',
      properties: [
        { property_name: 'name', value: 'Source Plate' },
        { property_name: 'valid_types', value: ['Shot'] },
      ],
    };
    expect(a.sent[0]?.body).toEqual(body);
    expect(b.sent[0]?.body).toEqual(body);
  });

  it('answers the suffixed name a duplicate display name is given', async () => {
    // 201 with no warning (reports/006).
    const { client } = rest({ status: 201, body: { data: {}, links: { self: '/api/v1/schema/Version/fields/sg_zzprobe_019_collide_1' } } });
    expect((await client.createField('Version', { dataType: 'text', displayName: 'zzprobe 019 collide' })).name).toBe('sg_zzprobe_019_collide_1');
  });

  it('surfaces a refusal with its status and message unchanged', async () => {
    const title =
      'API schema_field_create() failed, there is a retired field with the same field_name: sg_my_field. Delete the retired field forever from the Trash Page in Shotgun and try again.';
    const { client } = rest(refusal(400, { title }));
    const error = await client.createField('Version', { dataType: 'text', displayName: 'my field' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SchemaApiError);
    expect(error).toMatchObject({ status: 400, code: 103, title, message: title });
    expect((error as SchemaApiError).body).toMatchObject({ errors: [{ status: 400, title }] });
  });

  it('puts what only the source says into the message', async () => {
    const { client } = rest(refusal(400, { title: 'Request Parameters invalid.', source: { data_type: ['data_type is not valid'] } }));
    await expect(client.createField('Version', { dataType: 'color', displayName: 'Tint' })).rejects.toMatchObject({
      status: 400,
      source: { data_type: ['data_type is not valid'] },
      message: 'Request Parameters invalid. data_type is not valid',
    });
  });

  it('rejects a 201 that carries no self link, since the name is nowhere else', async () => {
    const { client } = rest({ status: 201, body: { data: {} } });
    await expect(client.createField('Version', { dataType: 'text', displayName: 'x' })).rejects.toMatchObject({ name: 'SchemaApiError', status: 201 });
  });
});

describe('updating a field', () => {
  it('puts the property list and answers the record the server sent back', async () => {
    const { client, sent } = rest({ status: 200, body: { data: STATUS_FIELD } });
    const raw = await client.updateField('Version', 'sg_my_field', { name: 'Renamed' });
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      url: 'https://studio.example.com/api/v1/schema/Version/fields/sg_my_field',
      contentType: 'application/json',
      body: { properties: [{ property_name: 'name', value: 'Renamed' }] },
    });
    expect(raw).toEqual(STATUS_FIELD);
  });

  it('scopes the write to a project with project_id in the body', async () => {
    // The spelling probe 114 sent.
    const { client, sent } = rest({ status: 200, body: { data: STATUS_FIELD } });
    await client.updateField('Version', 'sg_my_field', [{ property_name: 'visible', value: false }], 70);
    expect(sent[0]?.body).toEqual({ properties: [{ property_name: 'visible', value: false }], project_id: 70 });
  });

  it('surfaces the refusal that lists the valid property names', async () => {
    const title = `API schema_field_update() invalid property 'hidden_values': Valid property names: ["name", "visible"]`;
    const { client } = rest(refusal(400, { title }));
    await expect(client.updateField('Task', 'sg_status_list', { hidden_values: ['pndl'] }, 70)).rejects.toMatchObject({ status: 400, message: title });
  });
});

describe('retiring a field', () => {
  it('deletes and reads the empty 204', async () => {
    const { client, sent } = rest({ status: 204 });
    await expect(client.retireField('Version', 'sg_my_field')).resolves.toBeUndefined();
    expect(sent[0]).toMatchObject({ method: 'DELETE', url: 'https://studio.example.com/api/v1/schema/Version/fields/sg_my_field', body: undefined });
  });

  it('rejects with the 404 a field already in the trash answers', async () => {
    const { client } = rest(NOT_FOUND);
    await expect(client.retireField('Version', 'sg_not_a_field')).rejects.toMatchObject({ status: 404, message: "Field 'Version.sg_not_a_field' does not exist." });
  });
});

describe('reviving a field', () => {
  it('posts revive: true and answers revived on the empty 204', async () => {
    const { client, sent } = rest({ status: 204 });
    expect(await client.reviveField('Version', 'sg_zzprobe_040_revive')).toEqual({ revived: true });
    expect(sent[0]).toMatchObject({
      method: 'POST',
      url: 'https://studio.example.com/api/v1/schema/Version/fields/sg_zzprobe_040_revive',
      contentType: 'application/json',
      body: { revive: true },
    });
  });

  it('answers not revived, with the status and message, when the server refuses', async () => {
    const { client } = rest(NOT_FOUND);
    expect(await client.reviveField('Version', 'sg_not_a_field')).toEqual({ revived: false, status: 404, message: "Field 'Version.sg_not_a_field' does not exist." });
  });

  it('keeps a refused sign-in, a missing right and a server fault as errors', async () => {
    for (const status of [401, 403, 500]) {
      const { client } = rest(refusal(status, { title: 'No' }));
      await expect(client.reviveField('Version', 'sg_x')).rejects.toMatchObject({ name: 'SchemaApiError', status });
    }
  });
});

describe('the property list', () => {
  it('keeps a list as it is and turns a record into one, in key order', () => {
    expect(toSchemaProperties()).toEqual([]);
    expect(toSchemaProperties({ name: 'A', description: 'b' })).toEqual([
      { property_name: 'name', value: 'A' },
      { property_name: 'description', value: 'b' },
    ]);
    const list = [{ property_name: 'visible', value: false }];
    expect(toSchemaProperties(list)).toEqual(list);
  });
});

/** A `ProxySchemaClient` whose fetch routes `POST /sg/<method>` into `handle`. */
function proxied(handle: (method: string, body: unknown) => Promise<{ status: number; body: unknown }>): { client: ProxySchemaClient; seen: string[] } {
  const seen: string[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push(url);
    const out = await handle(url.slice(url.lastIndexOf('/') + 1), JSON.parse(String(init?.body ?? '{}')));
    return new Response(JSON.stringify(out.body), { status: out.status });
  }) as typeof fetch;
  return { client: new ProxySchemaClient({ basePath: '/sg/', fetch: fetchFn, headers: () => ({ 'x-csrf': 'k' }) }), seen };
}

describe('the schema calls through the proxy', () => {
  async function lifecycle(client: SchemaClient): Promise<unknown[]> {
    const created = await client.createField('Shot', { dataType: 'text', displayName: 'Plate Note', properties: { description: 'From the shoot' } });
    const out: unknown[] = [created];
    out.push(await client.readField('Shot', created.name));
    out.push(await client.updateField('Shot', created.name, { name: 'Plate Notes' }));
    out.push(await client.readField('Shot', created.name, 70));
    out.push(await client.retireField('Shot', created.name));
    out.push(await client.readField('Shot', created.name));
    out.push(await client.reviveField('Shot', created.name));
    out.push(await client.reviveField('Shot', created.name));
    out.push(Object.keys(await client.readRawFields('Shot')).includes(created.name));
    return out;
  }

  it('carries every method to the client behind the standalone handler', async () => {
    const { client, seen } = proxied(createSchemaProxyHandler(new MockSchemaClient({ client: new MockClient() })));
    const through = await lifecycle(client);
    expect(through).toEqual(await lifecycle(new MockSchemaClient({ client: new MockClient() })));
    expect(through[0]).toMatchObject({ name: 'sg_plate_note' });
    expect(through[5]).toEqual({ status: 'missing', message: "Field 'Shot.sg_plate_note' does not exist." });
    expect(through[6]).toEqual({ revived: true });
    expect(seen[0]).toBe('/sg/createField');
    expect(new Set(seen.map((url) => url.slice(4)))).toEqual(new Set(SCHEMA_PROXY_METHODS));
  });

  it('rebuilds the refusal on the far side', async () => {
    const { client } = proxied(createSchemaProxyHandler(new MockSchemaClient()));
    const error = await client.createField('Shot', { dataType: 'color', displayName: 'Tint' }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SchemaApiError);
    expect(error).toMatchObject({ status: 400, source: { data_type: ['data_type is not valid'] } });
  });

  it('refuses a method it does not carry and a malformed body', async () => {
    const handle = createSchemaProxyHandler(new MockSchemaClient());
    expect(isSchemaProxyMethod('createField')).toBe(true);
    expect(isSchemaProxyMethod('search')).toBe(false);
    expect((await handle('search', {})).status).toBe(404);
    expect(await handle('readField', { entityType: 'Shot' })).toMatchObject({ status: 400, body: { error: { message: "'field' must be a non-empty string" } } });
    expect((await handle('createField', { entityType: 'Shot', input: { dataType: 'text' } })).status).toBe(400);
    expect((await handle('updateField', { entityType: 'Shot', field: 'code', properties: 'name' })).status).toBe(400);
    expect((await handle('readField', { entityType: 'Shot', field: 'code', projectId: '70' })).status).toBe(400);
  });

  it('rides the main handler only when a schema client is given to it', async () => {
    const closed = createProxyHandler(new MockClient());
    expect((await closed('createField', { entityType: 'Shot', input: { dataType: 'text', displayName: 'x' } })).status).toBe(404);

    const base = new MockClient();
    const open = createProxyHandler(base, { schema: new MockSchemaClient({ client: base }) });
    const { client } = proxied(open);
    expect(await client.createField('Shot', { dataType: 'checkbox', displayName: 'On Hold', properties: { default_value: false } })).toMatchObject({ name: 'sg_on_hold' });
    expect((await open('entityTypes', {})).status).toBe(200);
  });
});

describe('the address', () => {
  it('escapes a type or a field that is not a plain name', async () => {
    const { client, sent } = rest({ status: 204 });
    await client.retireField('Version', '../../entity/shots/1');
    expect(sent[0]?.url).toBe('https://studio.example.com/api/v1/schema/Version/fields/..%2F..%2Fentity%2Fshots%2F1');
  });
});
