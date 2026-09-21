import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryCache } from '../src/query.js';
import { MockClient } from '../src/mock.js';
import { SgApiError } from '../src/client.js';
import type { EntityRow, EntityTypeInfo, EventLogOptions, EventLogResult, FollowingOptions, HierarchyNode, HierarchyPath, SummarizeOptions, SummarizeResult, SearchOptions, SearchResult, SgClient, TextSearchRow, ThreadRow, UploadFile, UploadResult } from '../src/client.js';
import type { EntityRef, TextSearchFilter } from '../src/filter.js';
import type { FieldSchema } from '../src/schema.js';
import type { StatusRecord } from '../src/status.js';

/** Wrap a client and record every call that actually reaches it. */
function counting(inner: SgClient): { client: SgClient; calls: string[] } {
  const calls: string[] = [];
  const client: SgClient = {
    entityTypes(): Promise<EntityTypeInfo[]> {
      calls.push('entityTypes');
      return inner.entityTypes();
    },
    fields(entityType: string, projectId?: number): Promise<Record<string, FieldSchema>> {
      calls.push(`fields ${entityType} ${projectId ?? '-'}`);
      return inner.fields(entityType, projectId);
    },
    fieldWithProject(entityType: string, field: string, projectId: number): Promise<FieldSchema> {
      calls.push(`fieldWithProject ${entityType}.${field} ${projectId}`);
      return inner.fieldWithProject(entityType, field, projectId);
    },
    search(entityType: string, options: SearchOptions): Promise<SearchResult> {
      calls.push(`search ${entityType}`);
      return inner.search(entityType, options);
    },
    textSearch(text: string, entityTypes: Record<string, TextSearchFilter>, page?: { size?: number; number?: number }): Promise<TextSearchRow[]> {
      calls.push(`textSearch ${text}`);
      return inner.textSearch(text, entityTypes, page);
    },
    statuses(): Promise<StatusRecord[]> {
      calls.push('statuses');
      return inner.statuses();
    },
    create(entityType: string, body: Record<string, unknown>): Promise<EntityRow> {
      calls.push(`create ${entityType}`);
      return inner.create(entityType, body);
    },
    upload(entityType: string, id: number, file: UploadFile): Promise<UploadResult> {
      calls.push(`upload ${entityType} ${id}`);
      return inner.upload(entityType, id, file);
    },
    update(entityType: string, id: number, patch: Record<string, unknown>): Promise<EntityRow> {
      calls.push(`update ${entityType} ${id}`);
      return inner.update(entityType, id, patch);
    },
    threadContents(noteId: number, entityFields?: Record<string, string[]>): Promise<ThreadRow[]> {
      calls.push(`threadContents ${noteId}`);
      return inner.threadContents(noteId, entityFields);
    },
    eventLog(eventOptions?: EventLogOptions): Promise<EventLogResult> {
      calls.push('eventLog');
      return inner.eventLog(eventOptions);
    },
    following(userId: number, followingOptions?: FollowingOptions): Promise<EntityRef[]> {
      calls.push(`following ${userId}`);
      return inner.following(userId, followingOptions);
    },
    hierarchySearch(rootPath: string, entity: EntityRef): Promise<HierarchyPath[]> {
      calls.push(`hierarchySearch ${rootPath} ${entity.type}:${entity.id}`);
      return inner.hierarchySearch(rootPath, entity);
    },
    hierarchyExpand(path: string): Promise<HierarchyNode> {
      calls.push(`hierarchyExpand ${path}`);
      return inner.hierarchyExpand(path);
    },
    summarize(entityType: string, summarizeOptions?: SummarizeOptions): Promise<SummarizeResult> {
      calls.push(`summarize ${entityType}`);
      return inner.summarize(entityType, summarizeOptions);
    },
  };
  return { client, calls };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('caching', () => {
  it('answers a repeat call without touching the client', async () => {
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client);
    const first = await cache.fields('Shot');
    const second = await cache.fields('Shot');
    expect(calls).toEqual(['fields Shot -']);
    // The same object comes back, so a UI can compare by identity.
    expect(second).toBe(first);
  });

  it('keys on the arguments, so a different project or filter is a different entry', async () => {
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client);
    await cache.fields('Shot');
    await cache.fields('Shot', 70);
    await cache.fields('Shot', 71);
    await cache.fields('Asset', 70);
    expect(calls).toEqual(['fields Shot -', 'fields Shot 70', 'fields Shot 71', 'fields Asset 70']);

    await cache.search('Shot', { fields: ['code'], page: { size: 5 } });
    await cache.search('Shot', { fields: ['code'], page: { size: 6 } });
    expect(calls.filter((c) => c.startsWith('search'))).toHaveLength(2);
  });

  it('is insensitive to the order of keys in the options object', async () => {
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client);
    await cache.search('Shot', { fields: ['code'], sort: 'code', page: { size: 5 } });
    await cache.search('Shot', { page: { size: 5 }, sort: 'code', fields: ['code'] });
    expect(calls).toEqual(['search Shot']);
  });
});

describe('the reads a notes app makes', () => {
  it('caches a thread and a follow list, and never caches the event log', async () => {
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client);
    await cache.threadContents(11030);
    await cache.threadContents(11030);
    await cache.threadContents(11030, { Note: ['subject'] });
    await cache.following(20);
    await cache.following(20);
    // A change feed answered from a cache reports that nothing changed.
    await cache.eventLog({ page: { size: 2 } });
    await cache.eventLog({ page: { size: 2 } });
    expect(calls).toEqual(['threadContents 11030', 'threadContents 11030', 'following 20', 'eventLog', 'eventLog']);
  });
});

describe('the writes', () => {
  it('drops every cached page of a type after a create and after an upload', async () => {
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client);
    await cache.search('Note', { fields: ['subject'] });
    await cache.create('Note', { project: { type: 'Project', id: 70 }, subject: 'Fresh' });
    await cache.search('Note', { fields: ['subject'] });
    await cache.upload('Note', 11030, { filename: 'a.png', data: new Uint8Array([1]), field: 'attachments' });
    await cache.search('Note', { fields: ['subject'] });
    expect(calls).toEqual(['search Note', 'create Note', 'search Note', 'upload Note 11030', 'search Note']);
  });

  it('drops a cached thread after a reply, an upload and an update, within the ttl', async () => {
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client, { ttlMs: Number.POSITIVE_INFINITY });
    const before = await cache.threadContents(11030);
    const reply = await cache.create('Reply', { entity: { type: 'Note', id: 11030 }, content: 'Seen it.' });
    const replied = await cache.threadContents(11030);
    expect(replied).toHaveLength(before.length + 1);
    expect(replied.at(-1)?.id).toBe(reply.id);

    await cache.upload('Note', 11030, { filename: 'a.png', data: new Uint8Array([1]), field: 'attachments' });
    const attached = await cache.threadContents(11030);
    expect(attached.filter((row) => row.type === 'Attachment')).toHaveLength(
      replied.filter((row) => row.type === 'Attachment').length + 1,
    );

    await cache.update('Note', 11030, { content: 'Edited.' });
    const edited = await cache.threadContents(11030);
    expect(edited[0]?.content).toBe('Edited.');
    expect(calls.filter((c) => c.startsWith('threadContents'))).toHaveLength(4);
  });
});

describe('deduping', () => {
  it('makes one request for two concurrent identical calls', async () => {
    const { client, calls } = counting(new MockClient({ latencyMs: 5 }));
    const cache = createQueryCache(client);
    const [a, b, c] = await Promise.all([cache.statuses(), cache.statuses(), cache.statuses()]);
    expect(calls).toEqual(['statuses']);
    expect(b).toBe(a);
    expect(c).toBe(a);
  });

  it('dedupes even with caching switched off', async () => {
    const { client, calls } = counting(new MockClient({ latencyMs: 5 }));
    const cache = createQueryCache(client, { ttlMs: 0 });
    await Promise.all([cache.entityTypes(), cache.entityTypes()]);
    expect(calls).toEqual(['entityTypes']);
    // Nothing was stored, so the next call is a fresh request.
    await cache.entityTypes();
    expect(calls).toEqual(['entityTypes', 'entityTypes']);
  });
});

describe('errors', () => {
  it('does not cache a failure', async () => {
    const mock = new MockClient();
    const { client, calls } = counting(mock);
    const cache = createQueryCache(client);
    mock.failNext({ status: 503 });
    await expect(cache.statuses()).rejects.toBeInstanceOf(SgApiError);
    // The retry reaches the client again, and its answer is cached.
    await expect(cache.statuses()).resolves.toBeInstanceOf(Array);
    await cache.statuses();
    expect(calls).toEqual(['statuses', 'statuses']);
  });

  it('rejects every concurrent caller of a failed request', async () => {
    const mock = new MockClient({ latencyMs: 5 });
    const cache = createQueryCache(mock);
    mock.failNext({ status: 500 });
    const results = await Promise.allSettled([cache.statuses(), cache.statuses()]);
    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
  });
});

describe('invalidate', () => {
  it('drops everything with no argument', async () => {
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client);
    await cache.fields('Shot');
    await cache.statuses();
    cache.invalidate();
    await cache.fields('Shot');
    await cache.statuses();
    expect(calls).toEqual(['fields Shot -', 'statuses', 'fields Shot -', 'statuses']);
  });

  it('drops only the keys under a prefix', async () => {
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client);
    await cache.fields('Shot');
    await cache.fields('Asset');
    await cache.statuses();
    // A key is `<method>:<json args>`, so this narrows to Shot's schema alone.
    cache.invalidate('fields:["Shot"');
    await cache.fields('Shot');
    await cache.fields('Asset');
    await cache.statuses();
    expect(calls).toEqual(['fields Shot -', 'fields Asset -', 'statuses', 'fields Shot -']);

    // The method name alone drops every schema read.
    cache.invalidate('fields');
    await cache.fields('Shot');
    await cache.fields('Asset');
    expect(calls.filter((c) => c.startsWith('fields'))).toHaveLength(5);
  });

  it('does not let an in-flight request repopulate a key that was invalidated', async () => {
    const { client, calls } = counting(new MockClient({ latencyMs: 5 }));
    const cache = createQueryCache(client);
    const inFlight = cache.statuses();
    cache.invalidate();
    await inFlight;
    await cache.statuses();
    expect(calls).toEqual(['statuses', 'statuses']);
  });
});

describe('a write against a request already in flight', () => {
  it('keeps a text search and a count started before it out of the cache', async () => {
    const { client, calls } = counting(new MockClient());
    let gated = true;
    const waiting: (() => void)[] = [];
    // Hold the two reads open until the write has been through the cache.
    const held: SgClient = {
      ...client,
      textSearch(text: string, entityTypes: Record<string, TextSearchFilter>, page?: { size?: number; number?: number }): Promise<TextSearchRow[]> {
        if (!gated) return client.textSearch(text, entityTypes, page);
        return new Promise((resolve) => waiting.push(() => resolve(client.textSearch(text, entityTypes, page))));
      },
      summarize(entityType: string, summarizeOptions?: SummarizeOptions): Promise<SummarizeResult> {
        if (!gated) return client.summarize(entityType, summarizeOptions);
        return new Promise((resolve) => waiting.push(() => resolve(client.summarize(entityType, summarizeOptions))));
      },
    };
    const cache = createQueryCache(held);

    const text = cache.textSearch('sh010', { Shot: null });
    const counted = cache.summarize('Shot');
    await cache.update('Shot', 862, { description: 'x' });
    gated = false;
    for (const release of waiting) release();
    await Promise.all([text, counted]);

    await cache.textSearch('sh010', { Shot: null });
    await cache.summarize('Shot');
    expect(calls.filter((c) => c.startsWith('textSearch'))).toHaveLength(2);
    expect(calls.filter((c) => c.startsWith('summarize'))).toHaveLength(2);
  });
});

describe('ttl', () => {
  it('refetches once a value has gone stale', async () => {
    vi.useFakeTimers();
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client, { ttlMs: 1000 });
    await cache.entityTypes();
    vi.advanceTimersByTime(500);
    await cache.entityTypes();
    expect(calls).toEqual(['entityTypes']);
    vi.advanceTimersByTime(600);
    await cache.entityTypes();
    expect(calls).toEqual(['entityTypes', 'entityTypes']);
  });

  it('keeps a value forever with ttlMs: Infinity', async () => {
    vi.useFakeTimers();
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client, { ttlMs: Number.POSITIVE_INFINITY });
    await cache.entityTypes();
    vi.advanceTimersByTime(10 * 365 * 24 * 3600 * 1000);
    await cache.entityTypes();
    expect(calls).toEqual(['entityTypes']);
  });
});

describe('as an SgClient', () => {
  it('passes every method through and returns the same answers', async () => {
    const mock = new MockClient();
    const cache = createQueryCache(mock);
    expect(await cache.entityTypes()).toEqual(await mock.entityTypes());
    expect(await cache.fields('Shot', 70)).toEqual(await mock.fields('Shot', 70));
    expect(await cache.statuses()).toEqual(await mock.statuses());
    expect(await cache.textSearch('sh010', { Shot: null })).toEqual(await mock.textSearch('sh010', { Shot: null }));
    const options: SearchOptions = { fields: ['code'], page: { size: 3 } };
    expect(await cache.search('Shot', options)).toEqual(await mock.search('Shot', options));
  });
});

describe('writes', () => {
  it('is never cached, and drops the cached pages of the type it touched', async () => {
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client);
    await cache.search('Shot', { fields: ['code'], page: { size: 2 } });
    await cache.search('Version', { fields: ['code'], page: { size: 2 } });
    await cache.search('Shot', { fields: ['code'], page: { size: 2 } });
    expect(calls).toEqual(['search Shot', 'search Version']);

    await cache.update('Shot', 862, { description: 'x' });
    await cache.search('Shot', { fields: ['code'], page: { size: 2 } });
    // Version's page survives; Shot's is read again.
    await cache.search('Version', { fields: ['code'], page: { size: 2 } });
    expect(calls).toEqual(['search Shot', 'search Version', 'update Shot 862', 'search Shot']);
  });

  it('re-reads the changed value through the cache', async () => {
    const cache = createQueryCache(new MockClient());
    await cache.search('Shot', { fields: ['description'], page: { size: 1 } });
    await cache.update('Shot', 862, { description: 'written through the cache' });
    const after = await cache.search('Shot', { fields: ['description'], page: { size: 1 } });
    expect(after.data[0]?.attributes['description']).toBe('written through the cache');
  });
});
