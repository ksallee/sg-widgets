import { describe, expect, it } from 'vitest';
import { RestClient } from '../src/client.js';

interface Sent {
  url: string;
  contentType: string | undefined;
  body: unknown;
}

/** A `RestClient` over a fetch that records the request and answers a canned body. */
function rest(answer: unknown): { client: RestClient; sent: Sent[] } {
  const sent: Sent[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    sent.push({ url: String(input), contentType: headers['Content-Type'], body: JSON.parse(String(init?.body ?? 'null')) });
    return new Response(JSON.stringify(answer), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { client: new RestClient({ siteUrl: 'https://studio.example.com', token: () => 't', fetch: fetchFn }), sent };
}

describe('_text_search on the wire', () => {
  it('sends a vendor content type and a filter array, and flattens the row', async () => {
    const { client, sent } = rest({
      data: [
        {
          id: 17055,
          type: 'Version',
          attributes: { name: 'zzprobe_053_zzz_v001', links: ['Shot', 'zzprobe_053_qat_0020'], status: 'rev' },
          links: { self: '/api/v1/entity/versions/17055' },
        },
      ],
    });
    const rows = await client.textSearch('qat 0020', { Version: { logical_operator: 'and', conditions: [['id', 'is', 1]] } });
    expect(sent[0]?.url).toBe('https://studio.example.com/api/v1/entity/_text_search');
    expect(sent[0]?.contentType).toBe('application/vnd+shotgun.api3_hash+json');
    expect(sent[0]?.body).toEqual({
      text: 'qat 0020',
      entity_types: { Version: [['id', 'is', 1]] },
      page: { size: 25, number: 1 },
    });
    // Name, links and status live under `attributes`, and there is nothing else on the row.
    expect(rows[0]).toEqual({
      type: 'Version',
      id: 17055,
      name: 'zzprobe_053_zzz_v001',
      links: ['Shot', 'zzprobe_053_qat_0020'],
      status: 'rev',
    });
  });

  it('caps the page size at 25, which is the cap and the default', async () => {
    const { client, sent } = rest({ data: [] });
    await client.textSearch('x', { Shot: null }, { size: 100, number: 3 });
    expect(sent[0]?.body).toMatchObject({ page: { size: 25, number: 3 } });
  });

  it('reads a row that links to nothing as two empty strings', async () => {
    const { client } = rest({ data: [{ id: 70, type: 'Project', attributes: { name: 'Blue Moon Rising', links: ['', ''] } }] });
    const rows = await client.textSearch('blue', { Project: null });
    expect(rows[0]).toEqual({ type: 'Project', id: 70, name: 'Blue Moon Rising', links: ['', ''], status: null });
  });
});

describe('the hierarchy endpoints on the wire', () => {
  it('sends plain JSON, which is the only content type they take', async () => {
    const { client, sent } = rest({
      data: [
        {
          label: 'sh010_0010',
          incremental_path: ['/Project/70', '/Project/70/Shot'],
          path_label: 'Shots',
          ref: { id: 862, type: 'Shot' },
          project_id: 70,
        },
      ],
    });
    const paths = await client.hierarchySearch('/Project/70', { type: 'Shot', id: 862, name: 'sh010_0010' });
    expect(sent[0]?.url).toBe('https://studio.example.com/api/v1/hierarchy/_search');
    expect(sent[0]?.contentType).toBe('application/json');
    // The criteria takes the literal key `entity`, and the name a caller carries is not sent.
    expect(sent[0]?.body).toEqual({ root_path: '/Project/70', search_criteria: { entity: { type: 'Shot', id: 862 } } });
    expect(paths[0]?.ref).toEqual({ type: 'Shot', id: 862 });
    expect(paths[0]?.pathLabel).toBe('Shots');
    expect(paths[0]?.projectId).toBe(70);
  });

  it('reads both ref shapes out of an expand', async () => {
    const { client, sent } = rest({
      data: {
        label: 'Blue Moon Rising',
        ref: { kind: 'entity', value: { type: 'Project', id: 70 } },
        parent_path: '/',
        path: '/Project/70',
        has_children: true,
        children: [{ label: 'Shots', ref: { kind: 'entity_type', value: 'Shot' }, has_children: true }],
      },
    });
    const node = await client.hierarchyExpand('/Project/70');
    expect(sent[0]?.url).toBe('https://studio.example.com/api/v1/hierarchy/_expand');
    expect(sent[0]?.contentType).toBe('application/json');
    expect(sent[0]?.body).toEqual({ path: '/Project/70' });
    expect(node.ref).toEqual({ kind: 'entity', value: { type: 'Project', id: 70 } });
    // `value` is a bare schema name on an entity_type ref, not an object.
    expect(node.children[0]?.ref).toEqual({ kind: 'entity_type', value: 'Shot' });
    expect(node.children[0]?.hasChildren).toBe(true);
  });
});
