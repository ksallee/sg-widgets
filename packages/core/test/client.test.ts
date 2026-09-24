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
  it('sends the hash content type with a hash group per type, and flattens the row', async () => {
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
      entity_types: { Version: { logical_operator: 'and', conditions: [['id', 'is', 1]] } },
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


/** A fetch that answers a canned body per path fragment. */
function stubFetch(answers: Record<string, unknown>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = String(input);
    const key = Object.keys(answers).find((k) => url.includes(k));
    return new Response(JSON.stringify(key ? answers[key] : { data: [] }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof fetch;
}

function statusRow(id: number, code: string, iconId: number) {
  return {
    type: 'Status',
    id,
    attributes: { code, name: code.toUpperCase(), bg_color: '25,118,27' },
    relationships: { icon: { data: { type: 'Icon', id: iconId } } },
  };
}

/** A client whose statuses carry the given icon rows, in order from id 3. */
function withIcons(icons: Array<Record<string, unknown>>, rows = [statusRow(1, 'custom', 3)]): RestClient {
  return new RestClient({
    siteUrl: 'https://studio.example.com',
    token: () => 'bearer',
    fetch: stubFetch({
      '/entity/statuses': { data: rows },
      '/entity/icons/_search': {
        data: icons.map((attributes, i) => ({ type: 'Icon', id: 3 + i, attributes, relationships: {} })),
      },
    }),
  });
}

describe('status icons on the wire', () => {
  it('drops an image icon the site holds with an empty url', async () => {
    const client = withIcons(
      [{ display_type: 'image', url: '' }, { display_type: 'image_map', image_map_key: 'icon_apr' }],
      [statusRow(1, 'custom', 3), statusRow(2, 'apr', 4)],
    );
    const [custom, approved] = await client.statuses();
    expect(custom?.icon).toBeNull();
    expect(approved?.icon).toEqual({ displayType: 'image_map', imageMapKey: 'icon_apr' });
  });

  it('strips the newlines an image icon carries in its data url', async () => {
    const client = withIcons([{ display_type: 'image', url: 'data:image/png;base64,AA\nBB' }]);
    expect((await client.statuses())[0]?.icon).toEqual({ displayType: 'image', dataUrl: 'data:image/png;base64,AABB' });
  });
});

describe('normalizeHierarchyNode', () => {
  it('keeps one child when _expand repeats the no-sequence bucket after every group', async () => {
    const mod = await import('../src/client.js');
    const bucket = { path: '/Project/91/Shot/sg_sequence/Sequence/__none__', label: 'Shots with no Sequence', has_children: true, ref: { kind: 'entity_type', value: 'Shot' } };
    const seq = (id: number) => ({ path: `/Project/91/Shot/sg_sequence/Sequence/${id}`, label: String(id), has_children: true, ref: { kind: 'entity', value: { type: 'Sequence', id } } });
    const node = mod.normalizeHierarchyNode({ path: '/Project/91/Shot', label: 'Shots', has_children: true, ref: { kind: 'entity_type', value: 'Shot' }, children: [seq(41), bucket, seq(307), bucket, seq(1362), bucket] } as never, '/Project/91/Shot');
    expect(node.children.map((c) => c.path)).toEqual(['/Project/91/Shot/sg_sequence/Sequence/41', '/Project/91/Shot/sg_sequence/Sequence/__none__', '/Project/91/Shot/sg_sequence/Sequence/307', '/Project/91/Shot/sg_sequence/Sequence/1362']);
  });
});

describe('a note thread on the wire', () => {
  it('asks for one path, widens a type through entity_fields, and reads the author from two keys', async () => {
    const { client, sent } = rest({
      data: [
        { type: 'Note', id: 6376, content: 'the note body', created_at: '2025-05-30T20:39:17Z', created_by: { id: 88, name: 'Anna van der Meer', type: 'HumanUser' } },
        { type: 'Attachment', id: 650, created_at: '2025-05-30T20:39:19Z', created_by: { id: 88, name: 'Anna van der Meer', type: 'HumanUser' } },
        { type: 'Reply', id: 477, content: 'the reply body', created_at: '2025-05-30T21:21:50Z', user: { id: 88, name: 'Anna van der Meer', type: 'HumanUser', image: 'https://media.example.com/avatar.png' } },
      ],
    });
    const thread = await client.threadContents(6376, { Note: ['subject', 'sg_status_list'] });
    expect(sent[0]?.url).toBe(
      'https://studio.example.com/api/v1/entity/notes/6376/thread_contents?entity_fields%5BNote%5D=subject%2Csg_status_list',
    );
    expect(thread.map((row) => [row.type, row.id])).toEqual([
      ['Note', 6376],
      ['Attachment', 650],
      ['Reply', 477],
    ]);
    expect(thread[0]?.author).toEqual({ type: 'HumanUser', id: 88, name: 'Anna van der Meer' });
    // A Reply's author comes from `user` and carries the avatar the other two lack.
    expect(thread[2]?.author).toEqual({ type: 'HumanUser', id: 88, name: 'Anna van der Meer', image: 'https://media.example.com/avatar.png' });
    expect(thread[1]?.content).toBeNull();
  });

  it('keeps the author under created_by on a Note widened with user', async () => {
    const { client } = rest({
      data: [
        {
          type: 'Note',
          id: 6376,
          content: 'the note body',
          created_at: '2025-05-30T20:39:17Z',
          created_by: { id: 88, name: 'Anna van der Meer', type: 'HumanUser' },
          user: { id: 91, name: 'j.doe', type: 'HumanUser' },
        },
        { type: 'Reply', id: 477, content: 'the reply body', created_at: '2025-05-30T21:21:50Z', user: { id: 91, name: 'j.doe', type: 'HumanUser', image: null } },
      ],
    });
    const thread = await client.threadContents(6376, { Note: ['user'] });
    expect(thread[0]?.author).toEqual({ type: 'HumanUser', id: 88, name: 'Anna van der Meer' });
    expect(thread[0]?.fields['user']).toEqual({ id: 91, name: 'j.doe', type: 'HumanUser' });
    expect(thread[1]?.author).toEqual({ type: 'HumanUser', id: 91, name: 'j.doe', image: null });
  });
});

describe('one field of the schema on the wire', () => {
  it('answers the override when the site reads the field as data: null', async () => {
    // An undeclared field the site still answers on the row (068_note_read_state).
    const { client, sent } = rest({ data: null, links: { self: '/api/v1/schema/Note/fields/read_by_current_user' } });
    const field = await client.fieldWithProject('Note', 'read_by_current_user', 70);
    expect(sent[0]?.url).toBe('https://studio.example.com/api/v1/schema/Note/fields/read_by_current_user?project_id=70');
    expect(field).toMatchObject({ name: 'read_by_current_user', entityType: 'Note', dataType: 'list', editable: true });
  });

  it('refuses a data: null answer for a field it has no override for', async () => {
    const { client } = rest({ data: null, links: { self: '/api/v1/schema/Shot/fields/sg_mystery' } });
    await expect(client.fieldWithProject('Shot', 'sg_mystery', 70)).rejects.toThrow("Field 'Shot.sg_mystery' is not in the schema.");
  });
});

describe('the event log on the wire', () => {
  it('narrows on the filterable fields, sorts -id, and lifts the two values out of meta', async () => {
    const { client, sent } = rest({
      data: [
        {
          type: 'EventLogEntry',
          id: 247337,
          attributes: {
            event_type: 'Shotgun_Shot_Change',
            attribute_name: 'sg_status_list',
            description: 'Anna van der Meer changed "Status"',
            created_at: '2026-01-21T19:47:33Z',
            meta: { type: 'attribute_change', attribute_name: 'sg_status_list', entity_type: 'Shot', entity_id: 862, old_value: 'wtg', new_value: 'ip' },
          },
          relationships: { entity: { data: { id: 862, name: 'sh010', type: 'Shot' } }, project: { data: { id: 70, type: 'Project' } }, user: { data: null } },
        },
      ],
    });
    const log = await client.eventLog({
      projectId: 70,
      entity: { type: 'Shot', id: 862 },
      eventType: ['Shotgun_Shot_Change', 'Shotgun_Shot_New'],
      attributeName: 'sg_status_list',
      since: '2026-01-01T00:00:00Z',
      page: { size: 1 },
    });
    expect(sent[0]?.url).toBe('https://studio.example.com/api/v1/entity/event_log_entries/_search');
    expect(sent[0]?.body).toEqual({
      filters: {
        logical_operator: 'and',
        conditions: [
          ['project', 'is', { type: 'Project', id: 70 }],
          ['entity', 'is', { type: 'Shot', id: 862 }],
          ['event_type', 'in', ['Shotgun_Shot_Change', 'Shotgun_Shot_New']],
          ['attribute_name', 'is', 'sg_status_list'],
          ['created_at', 'greater_than', '2026-01-01T00:00:00Z'],
        ],
      },
      fields: 'event_type,attribute_name,description,created_at,meta,entity,project,user',
      sort: '-id',
      page: { size: 1, number: 1 },
    });
    expect(log.data[0]?.oldValue).toBe('wtg');
    expect(log.data[0]?.newValue).toBe('ip');
    expect(log.data[0]?.entity).toEqual({ type: 'Shot', id: 862, name: 'sh010' });
    expect(log.data[0]?.user).toBeNull();
    // A full page means another may exist, the same rule `search` follows (probe 006).
    expect(log.hasMore).toBe(true);
  });

  it('sends an empty group when nothing narrows it', async () => {
    const { client, sent } = rest({ data: [] });
    const log = await client.eventLog();
    expect(sent[0]?.body).toMatchObject({ filters: { logical_operator: 'and', conditions: [] }, page: { size: 50, number: 1 } });
    expect(log.hasMore).toBe(false);
  });
});

describe('following on the wire', () => {
  it('sends the two filters it takes and reads a type and an id per row', async () => {
    const { client, sent } = rest({
      data: [
        { id: 346, type: 'Note', links: { self: '/api/v1/entity/Note/346' } },
        { id: 360, type: 'Note', links: { self: '/api/v1/entity/Note/360' } },
      ],
    });
    const rows = await client.following(3, { entity: 'notes', projectId: 70 });
    expect(sent[0]?.url).toBe('https://studio.example.com/api/v1/entity/human_users/3/following?entity=notes&project_id=70');
    expect(rows).toEqual([
      { type: 'Note', id: 346 },
      { type: 'Note', id: 360 },
    ]);
  });
});

describe('a create on the wire', () => {
  it('posts plain JSON to the type and answers the row', async () => {
    const { client, sent } = rest({ data: { type: 'Reply', id: 610, attributes: { content: 'on it' }, relationships: {} } });
    const row = await client.create('Reply', { entity: { type: 'Note', id: 11030 }, content: 'on it' });
    expect(sent[0]?.url).toBe('https://studio.example.com/api/v1/entity/replies');
    // A write takes plain JSON; the vendor types are a `_search` requirement (probe 004).
    expect(sent[0]?.contentType).toBe('application/json');
    expect(sent[0]?.body).toEqual({ entity: { type: 'Note', id: 11030 }, content: 'on it' });
    expect(row.id).toBe(610);
  });
});

describe('an upload on the wire', () => {
  interface Call {
    url: string;
    method: string;
    headers: Record<string, string> | undefined;
    body: unknown;
  }

  /** A fetch that answers the three calls of the handshake in order. */
  function uploading(completeUpload = '/api/v1/entity/shots/862/image/_upload'): { client: RestClient; calls: Call[] } {
    const calls: Call[] = [];
    const info = {
      timestamp: '2026-09-04T03:53:31Z',
      upload_type: 'Thumbnail',
      upload_id: null,
      storage_service: 's3',
      original_filename: 'frame.png',
      multipart_upload: false,
    };
    const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET', headers: init?.headers as Record<string, string> | undefined, body: init?.body });
      if (url.includes('/_upload') && (init?.method ?? 'GET') === 'GET') {
        return new Response(
          JSON.stringify({ data: info, links: { upload: 'https://storage.example.com/signed?sig=abc', complete_upload: completeUpload } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }
      if (init?.method === 'PUT') {
        return new Response(null, { status: 200, headers: { ETag: '"9ef430cc6d563983f362487a051169cd"' } });
      }
      // 201 with a body of one space, which is not JSON (post_links_complete_upload).
      return new Response(' ', { status: 201 });
    }) as typeof fetch;
    return { client: new RestClient({ siteUrl: 'https://studio.example.com', token: () => 't', fetch: fetchFn }), calls };
  }

  it('takes a ticket, puts the bytes with no auth header, and completes without parsing the reply', async () => {
    const { client, calls } = uploading();
    const data = new Uint8Array([137, 80, 78, 71]);
    const result = await client.upload('Shot', 862, { filename: 'frame.png', data, field: 'image' });

    expect(calls[0]?.url).toBe('https://studio.example.com/api/v1/entity/shots/862/image/_upload?filename=frame.png');
    expect(calls[0]?.headers?.['Authorization']).toBe('Bearer t');

    expect(calls[1]).toMatchObject({ url: 'https://storage.example.com/signed?sig=abc', method: 'PUT' });
    // The signature covers the request: a bearer token is not part of it (put_links_upload).
    expect(calls[1]?.headers).toBeUndefined();
    expect(calls[1]?.body).toBe(data);

    // `complete_upload` already carries `/api/v1`; prefixing it again is a 404.
    expect(calls[2]?.url).toBe('https://studio.example.com/api/v1/entity/shots/862/image/_upload');
    expect(calls[2]?.method).toBe('POST');
    expect(calls[2]?.headers?.['Content-Type']).toBe('application/json');
    expect(JSON.parse(String(calls[2]?.body))).toEqual({
      upload_info: {
        timestamp: '2026-09-04T03:53:31Z',
        upload_type: 'Thumbnail',
        upload_id: null,
        storage_service: 's3',
        original_filename: 'frame.png',
        multipart_upload: false,
      },
      // Required even though it is empty (probe 013).
      upload_data: {},
    });

    expect(result.uploadType).toBe('Thumbnail');
    expect(result.etag).toBe('9ef430cc6d563983f362487a051169cd');
  });

  it('leaves the field out of the path for a generic attachment', async () => {
    const { client, calls } = uploading();
    await client.upload('Version', 17055, { filename: 'workflow.json', data: new Uint8Array([123, 125]) });
    expect(calls[0]?.url).toBe('https://studio.example.com/api/v1/entity/versions/17055/_upload?filename=workflow.json');
  });

  it('calls an absolute complete_upload link as it is', async () => {
    const { client, calls } = uploading('https://studio.example.com/api/v1/entity/shots/862/image/_upload');
    await client.upload('Shot', 862, { filename: 'frame.png', data: new Uint8Array([1]), field: 'image' });
    expect(calls[2]?.url).toBe('https://studio.example.com/api/v1/entity/shots/862/image/_upload');
  });
});

interface Call {
  method: string;
  url: string;
  contentType: string | undefined;
  body: string | undefined;
}

/** A `RestClient` over a fetch that records the method and answers a canned status and body. */
function answering(status: number, answer: unknown): { client: RestClient; calls: Call[] } {
  const calls: Call[] = [];
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({ method: String(init?.method), url: String(input), contentType: headers['Content-Type'], body: init?.body as string | undefined });
    const text = answer === undefined ? null : JSON.stringify(answer);
    return new Response(text, { status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { client: new RestClient({ siteUrl: 'https://studio.example.com', token: () => 't', fetch: fetchFn }), calls };
}

describe('a delete on the wire', () => {
  it('sends DELETE with no body and reads the empty 204', async () => {
    const { client, calls } = answering(204, undefined);
    await expect(client.delete('Shot', 7653)).resolves.toBeUndefined();
    expect(calls).toEqual([{ method: 'DELETE', url: 'https://studio.example.com/api/v1/entity/shots/7653', contentType: undefined, body: undefined }]);
  });

  it('rejects a row that is not there with the 404 the site answers', async () => {
    const title = 'Entity of type [Shot] with id=7653 does not exist.';
    const { client } = answering(404, { errors: [{ status: 404, code: 104, title }] });
    await expect(client.delete('Shot', 7653)).rejects.toMatchObject({ name: 'SgApiError', status: 404, message: title });
  });
});

describe('a revive on the wire', () => {
  it('posts revive=1 with no body and reads did_revive out of meta', async () => {
    const { client, calls } = answering(200, {
      data: { type: 'Shot', id: 7683 },
      links: { self: '/api/v1/entity/shots/7683' },
      meta: { did_revive: true },
    });
    await expect(client.revive('Shot', 7683)).resolves.toBe(true);
    expect(calls).toEqual([{ method: 'POST', url: 'https://studio.example.com/api/v1/entity/shots/7683?revive=1', contentType: undefined, body: undefined }]);
  });

  it('answers false for a row that was already live', async () => {
    const { client } = answering(200, { data: { type: 'Shot', id: 7683 }, links: {}, meta: { did_revive: false } });
    await expect(client.revive('Shot', 7683)).resolves.toBe(false);
  });
});

describe('a batch on the wire', () => {
  it('posts the requests as plain JSON and pairs each row with its request by position', async () => {
    const version = { type: 'Version', id: 29926, attributes: { code: 'v001' }, relationships: {}, links: { self: '/api/v1/entity/versions/29926' } };
    const shot = { type: 'Shot', id: 7557, attributes: { description: 'batch 2' }, relationships: {} };
    const deleted = { request_type: 'delete', type: 'Version', id: 29941, uuid: '906c4522-a701-11f1-b496-0a58a9feac02', did_delete: true };
    const { client, calls } = answering(200, {
      data: [{ data: version }, { data: shot, links: { self: '/api/v1/entity/shots/7557' }, status: 'success' }, deleted],
    });
    const requests = [
      { request_type: 'create' as const, entity: 'Version', data: { project: { type: 'Project', id: 1234 }, code: 'v001' } },
      { request_type: 'update' as const, entity: 'Shot', record_id: 7557, data: { description: 'batch 2' } },
      { request_type: 'delete' as const, entity: 'Version', record_id: 29941 },
    ];
    const results = await client.batch(requests);
    expect(calls[0]?.method).toBe('POST');
    expect(calls[0]?.url).toBe('https://studio.example.com/api/v1/entity/_batch');
    // Plain JSON; the vendor array type is a 415 here (recipes/002).
    expect(calls[0]?.contentType).toBe('application/json');
    // The list goes under `requests`, not `data` (post_entity_batch).
    expect(JSON.parse(calls[0]?.body ?? 'null')).toEqual({ requests });
    // A create or update row nests the record under `data`; a delete row is flat (recipes/002).
    expect(results).toEqual([
      { request_type: 'create', data: version },
      { request_type: 'update', data: shot },
      deleted,
    ]);
  });

  it('rejects the whole batch with the status and title of the request that failed', async () => {
    const title = 'Entity of type [Version] with id=999999999 does not exist.';
    const body = { errors: [{ status: 404, code: 104, title }] };
    const { client } = answering(404, body);
    const rejected = client.batch([{ request_type: 'delete', entity: 'Version', record_id: 999999999 }]);
    await expect(rejected).rejects.toMatchObject({ name: 'SgApiError', status: 404, message: title, body });
  });
});
