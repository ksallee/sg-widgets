import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { ProxyClient } from '../src/proxy-client.js';
import { createProxyHandler } from '../src/proxy-handler.js';
import { SgApiError } from '../src/client.js';

/** A `fetch` that routes `POST /sg/<method>` straight into the handler. */
function wired(client: MockClient): { fetch: typeof fetch; seen: Array<Record<string, string>> } {
  const handle = createProxyHandler(client);
  const seen: Array<Record<string, string>> = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    seen.push({ ...((init?.headers ?? {}) as Record<string, string>) });
    const out = await handle(url.slice(url.lastIndexOf('/') + 1), JSON.parse(String(init?.body ?? '{}')));
    return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { fetch: fetchFn, seen };
}

function proxy(client: MockClient): ProxyClient {
  return new ProxyClient({ basePath: '/sg', fetch: wired(client).fetch });
}

describe('round trip', () => {
  it('carries every method to the client behind the handler', async () => {
    const direct = new MockClient();
    const client = proxy(new MockClient());

    expect(await client.entityTypes()).toEqual(await direct.entityTypes());
    expect(await client.fields('Shot')).toEqual(await direct.fields('Shot'));
    expect(await client.fields('Shot', 70)).toEqual(await direct.fields('Shot', 70));
    expect(await client.fieldWithProject('Shot', 'sg_status_list', 70)).toEqual(
      await direct.fieldWithProject('Shot', 'sg_status_list', 70),
    );
    expect(await client.statuses()).toEqual(await direct.statuses());

    const written = await client.update('Shot', 862, { description: 'through the proxy' });
    expect(written.attributes['description']).toBe('through the proxy');
    expect(await client.hierarchyExpand('/Project/70')).toEqual(await direct.hierarchyExpand('/Project/70'));
    expect(await client.summarize('Version')).toEqual(await direct.summarize('Version'));
  });

  it('carries search options and paging', async () => {
    const direct = new MockClient();
    const client = proxy(new MockClient());
    const options = {
      filters: { logical_operator: 'and' as const, conditions: [['sg_status_list', 'is', 'ip'] as [string, 'is', unknown]] },
      fields: ['code', 'sg_status_list'],
      page: { size: 5, number: 1 },
    };
    const through = await client.search('Shot', options);
    expect(through).toEqual(await direct.search('Shot', options));
    expect(through.data.length).toBeGreaterThan(0);
    // `hasMore` survives, so a caller pages the same way through the proxy (probe 006).
    expect(through).toHaveProperty('hasMore');
  });

  it('carries a text search', async () => {
    const direct = new MockClient();
    const client = proxy(new MockClient());
    const rows = await client.textSearch('sh', { Shot: null }, { size: 3 });
    expect(rows).toEqual(await direct.textSearch('sh', { Shot: null }, { size: 3 }));
  });

  it('carries both hierarchy calls', async () => {
    const direct = new MockClient();
    const client = proxy(new MockClient());
    const entity = { type: 'Shot', id: 862 };
    expect(await client.hierarchySearch('/Project/70', entity)).toEqual(await direct.hierarchySearch('/Project/70', entity));
    expect(await client.hierarchyExpand('/Project/70')).toEqual(await direct.hierarchyExpand('/Project/70'));
  });

  it('rejects a hierarchy search with no entity, before it reaches the client', async () => {
    const client = proxy(new MockClient());
    await expect(client.hierarchySearch('/Project/70', null as never)).rejects.toThrow(/must be a \{type, id\} object/);
  });

  it('carries a note thread, the event log and a follow list', async () => {
    const direct = new MockClient();
    const client = proxy(new MockClient());
    expect(await client.threadContents(11030)).toEqual(await direct.threadContents(11030));
    expect(await client.threadContents(11030, { Note: ['subject'] })).toEqual(
      await direct.threadContents(11030, { Note: ['subject'] }),
    );
    const options = { entity: { type: 'Shot' as const, id: 862 }, page: { size: 5 } };
    expect(await client.eventLog(options)).toEqual(await direct.eventLog(options));
    expect(await client.eventLog()).toEqual(await direct.eventLog());
    expect(await client.following(20, { entity: 'notes' })).toEqual(await direct.following(20, { entity: 'notes' }));
  });

  it('carries a create, and the bytes of an upload base64-encoded', async () => {
    const direct = new MockClient();
    const client = proxy(new MockClient());
    const body = { entity: { type: 'Note', id: 11030 }, content: 'through the proxy' };
    const made = await client.create('Reply', body);
    expect(made).toEqual(await direct.create('Reply', body));
    expect(made.attributes['content']).toBe('through the proxy');

    const file = { filename: 'screenshot.png', data: new Uint8Array([137, 80, 78, 71]), field: 'attachments' };
    expect(await client.upload('Note', 11030, file)).toEqual(await direct.upload('Note', 11030, file));
  });

  it('carries a delete, a revive and a batch', async () => {
    const direct = new MockClient();
    const client = proxy(new MockClient());
    await expect(client.delete('Shot', 862)).resolves.toBeUndefined();
    await direct.delete('Shot', 862);
    expect(await client.revive('Shot', 862)).toBe(await direct.revive('Shot', 862));
    expect(await client.read('Shot', 862, { fields: ['code'] })).toEqual(await direct.read('Shot', 862, { fields: ['code'] }));
    await expect(client.read('Task', 999999999)).rejects.toMatchObject({ status: 404, body: await direct.read('Task', 999999999).catch((e: SgApiError) => e.body) });
    const requests = [
      { request_type: 'update' as const, entity: 'Shot', record_id: 862, data: { description: 'batched' } },
      { request_type: 'delete' as const, entity: 'Shot', record_id: 862 },
    ];
    const through = await client.batch(requests);
    const straight = await direct.batch(requests);
    expect(through.map((r) => r.request_type)).toEqual(['update', 'delete']);
    expect(through[0]).toEqual(straight[0]);
    expect(through[1]).toMatchObject({ type: 'Shot', id: 862, did_delete: true });
  });

  it('rejects a batch whose requests are not a list, before it reaches the client', async () => {
    const client = proxy(new MockClient());
    await expect(client.batch(null as never)).rejects.toThrow(/'requests' must be a list/);
  });

  it('sends the headers the caller supplies, per request', async () => {
    const inner = new MockClient();
    const { fetch, seen } = wired(inner);
    let n = 0;
    const client = new ProxyClient({ basePath: '/sg', fetch, headers: () => ({ 'x-csrf': `t${(n += 1)}` }) });
    await client.entityTypes();
    await client.entityTypes();
    expect(seen.map((h) => h['x-csrf'])).toEqual(['t1', 't2']);
    expect(seen[0]?.['Content-Type']).toBe('application/json');
  });
});

describe('errors', () => {
  it('round-trips an SgApiError with its status and body', async () => {
    const inner = new MockClient();
    inner.failNext({ status: 403, message: 'Permission denied.', body: { errors: [{ status: 403 }] } });
    const client = proxy(inner);
    const error = await client.entityTypes().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SgApiError);
    expect((error as SgApiError).status).toBe(403);
    expect((error as SgApiError).message).toBe('Permission denied.');
    expect((error as SgApiError).body).toEqual({ errors: [{ status: 403 }] });
  });

  it('round-trips the 404 a missing type answers', async () => {
    const client = proxy(new MockClient());
    const error = await client.fields('Bogus').catch((e: unknown) => e);
    expect((error as SgApiError).status).toBe(404);
    expect((error as SgApiError).message).toBe("Entity type 'Bogus' does not exist.");
  });

  it('refuses an unknown method and a bad body at the handler', async () => {
    const handle = createProxyHandler(new MockClient());
    expect(await handle('drop_everything', {})).toEqual({
      status: 404,
      body: { error: { status: 404, message: "Unknown method 'drop_everything'", body: null } },
    });
    expect((await handle('fields', {})).status).toBe(400);
    expect((await handle('fields', 'nope')).status).toBe(400);
    expect((await handle('fieldWithProject', { entityType: 'Shot', field: 'sg_status_list' })).status).toBe(400);
    expect((await handle('threadContents', {})).status).toBe(400);
    expect((await handle('create', { entityType: 'Note' })).status).toBe(400);
    expect((await handle('upload', { entityType: 'Note', id: 11030, file: { filename: 'a.png' } })).status).toBe(400);
    expect((await handle('following', {})).status).toBe(400);
  });

  it('carries a zero-byte file, and answers 400 on bytes that are not base64', async () => {
    const handle = createProxyHandler(new MockClient());
    const empty = await handle('upload', { entityType: 'Note', id: 11030, file: { filename: 'empty.txt', data: '', field: 'attachments' } });
    expect(empty.status).toBe(200);
    const bad = await handle('upload', { entityType: 'Note', id: 11030, file: { filename: 'a.png', data: '%%not base64%%', field: 'attachments' } });
    expect(bad).toEqual({ status: 400, body: { error: { status: 400, message: "'file.data' is not base64", body: null } } });
  });

  it('reports a non-JSON answer from anything between the two halves', async () => {
    const fetchFn = (async () => new Response('<html>502</html>', { status: 502 })) as typeof fetch;
    const client = new ProxyClient({ basePath: '/sg', fetch: fetchFn });
    const error = await client.statuses().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SgApiError);
    expect((error as SgApiError).status).toBe(502);
  });
});
