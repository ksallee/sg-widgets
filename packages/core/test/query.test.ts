import { afterEach, describe, expect, it, vi } from 'vitest';
import { createQueryCache } from '../src/query.js';
import { MockClient } from '../src/mock.js';
import { SgApiError } from '../src/client.js';
import type { EntityTypeInfo, SearchOptions, SearchResult, SgClient, TextSearchRow } from '../src/client.js';
import type { WireGroup } from '../src/filter.js';
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
    search(entityType: string, options: SearchOptions): Promise<SearchResult> {
      calls.push(`search ${entityType}`);
      return inner.search(entityType, options);
    },
    textSearch(text: string, entityTypes: Record<string, WireGroup | null>, page?: { size?: number; number?: number }): Promise<TextSearchRow[]> {
      calls.push(`textSearch ${text}`);
      return inner.textSearch(text, entityTypes, page);
    },
    statuses(): Promise<StatusRecord[]> {
      calls.push('statuses');
      return inner.statuses();
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
