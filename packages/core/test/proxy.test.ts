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
  });

  it('reports a non-JSON answer from anything between the two halves', async () => {
    const fetchFn = (async () => new Response('<html>502</html>', { status: 502 })) as typeof fetch;
    const client = new ProxyClient({ basePath: '/sg', fetch: fetchFn });
    const error = await client.statuses().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SgApiError);
    expect((error as SgApiError).status).toBe(502);
  });
});
