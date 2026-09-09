/**
 * Query cache.
 *
 * A `SgClient` decorator that remembers answers, dedupes concurrent identical
 * calls into one request, and forgets on demand. It is deliberately tiny and
 * framework-free: UI packages wrap it in a store or a hook, they do not
 * reimplement it.
 *
 * Reads on this API are expensive in ways worth caching. `/schema/<Type>/fields`
 * is 48KB and ~330ms a type and must never be looped (probe 002), and a picker
 * that re-asks for the same page on every keystroke pays ~270ms a call
 * (probe 053). Nothing here writes, so no invalidation happens by itself: a
 * caller that mutates rows calls `invalidate()`.
 */
import type { EntityTypeInfo, SearchOptions, SearchResult, SgClient, TextSearchRow } from './client.js';
import type { WireGroup } from './filter.js';
import type { FieldSchema } from './schema.js';
import type { StatusRecord } from './status.js';

export interface QueryCacheOptions {
  /**
   * How long a resolved value stays fresh, in milliseconds. Default 30000.
   * `Infinity` keeps values until `invalidate()`; `0` disables caching and
   * leaves only the in-flight deduping.
   */
  ttlMs?: number;
}

export interface QueryCache extends SgClient {
  /**
   * Forget cached values. With no argument, all of them. With a prefix, every
   * key that starts with it; a key is `<method>:<json args>`, so `'fields'`
   * drops every schema read and `'fields:["Shot"'` drops only Shot's.
   */
  invalidate(prefix?: string): void;
}

/** Stable JSON: object keys sorted, so `{fields, filters}` and `{filters, fields}` are one key. */
function stable(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  const o = value as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(',')}}`;
}

function keyOf(method: string, args: readonly unknown[]): string {
  return `${method}:${stable(args)}`;
}

interface Entry {
  value: unknown;
  expiresAt: number;
}

export function createQueryCache(client: SgClient, options: QueryCacheOptions = {}): QueryCache {
  const ttlMs = options.ttlMs ?? 30_000;
  const entries = new Map<string, Entry>();
  const inFlight = new Map<string, Promise<unknown>>();

  function run<T>(method: string, args: readonly unknown[], call: () => Promise<T>): Promise<T> {
    const key = keyOf(method, args);
    const hit = entries.get(key);
    if (hit) {
      if (hit.expiresAt > Date.now()) return Promise.resolve(hit.value as T);
      entries.delete(key);
    }
    const pending = inFlight.get(key);
    // Two concurrent identical calls share one request.
    if (pending) return pending as Promise<T>;

    const promise = call().then(
      (value) => {
        // A value invalidated while its request was in flight must not come back.
        if (inFlight.get(key) === promise) {
          inFlight.delete(key);
          if (ttlMs > 0) entries.set(key, { value, expiresAt: Date.now() + ttlMs });
        }
        return value;
      },
      (error: unknown) => {
        // Errors are never cached, so the next call retries rather than replaying the failure.
        if (inFlight.get(key) === promise) inFlight.delete(key);
        throw error;
      },
    );
    inFlight.set(key, promise);
    return promise;
  }

  return {
    entityTypes(): Promise<EntityTypeInfo[]> {
      return run('entityTypes', [], () => client.entityTypes());
    },
    fields(entityType: string, projectId?: number): Promise<Record<string, FieldSchema>> {
      // `project_id` changes only `hidden_values` (probe 009), but it is still a different answer.
      return run('fields', [entityType, projectId ?? null], () => client.fields(entityType, projectId));
    },
    search(entityType: string, searchOptions: SearchOptions): Promise<SearchResult> {
      return run('search', [entityType, searchOptions], () => client.search(entityType, searchOptions));
    },
    textSearch(
      text: string,
      entityTypes: Record<string, WireGroup | null>,
      page?: { size?: number; number?: number },
    ): Promise<TextSearchRow[]> {
      return run('textSearch', [text, entityTypes, page ?? null], () => client.textSearch(text, entityTypes, page));
    },
    statuses(): Promise<StatusRecord[]> {
      return run('statuses', [], () => client.statuses());
    },
    invalidate(prefix?: string): void {
      if (prefix === undefined) {
        entries.clear();
        inFlight.clear();
        return;
      }
      for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
      for (const key of [...inFlight.keys()]) if (key.startsWith(prefix)) inFlight.delete(key);
    },
  };
}
