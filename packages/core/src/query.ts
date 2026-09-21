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
 * (probe 053). A read is invalidated by `invalidate()` or by a write through
 * this cache: `create`, `update` and `upload` are never cached, and each drops
 * every cached row read of the type it touched, and every cached thread, before
 * it returns.
 */
import type {
  EntityRow,
  EntityTypeInfo,
  EventLogOptions,
  EventLogResult,
  FollowingOptions,
  HierarchyNode,
  HierarchyPath,
  SearchOptions,
  SearchResult,
  SgClient,
  SummarizeOptions,
  SummarizeResult,
  TextSearchRow,
  ThreadRow,
  UploadFile,
  UploadResult,
} from './client.js';
import type { EntityRef, TextSearchFilter } from './filter.js';
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

  /** Forget a prefix in both maps, so a request started before a write cannot land after it. */
  function drop(prefix: string): void {
    for (const key of [...entries.keys()]) if (key.startsWith(prefix)) entries.delete(key);
    for (const key of [...inFlight.keys()]) if (key.startsWith(prefix)) inFlight.delete(key);
  }

  function invalidateSearches(entityType: string): void {
    drop(`search:[${JSON.stringify(entityType)}`);
    drop('textSearch');
    drop(`summarize:[${JSON.stringify(entityType)}`);
  }

  /**
   * A write may land in a thread: a Reply names its Note in `entity`, an Attachment
   * in `attachment_links`, and a Note's own row is the thread's first line
   * (get_entity_notes_id_thread_contents). Every cached thread goes.
   */
  function invalidateThreads(): void {
    drop('threadContents');
  }

  return {
    entityTypes(): Promise<EntityTypeInfo[]> {
      return run('entityTypes', [], () => client.entityTypes());
    },
    fields(entityType: string, projectId?: number): Promise<Record<string, FieldSchema>> {
      // `project_id` changes only `hidden_values` (probe 009), but it is still a different answer.
      return run('fields', [entityType, projectId ?? null], () => client.fields(entityType, projectId));
    },
    fieldWithProject(entityType: string, field: string, projectId: number): Promise<FieldSchema> {
      return run('fieldWithProject', [entityType, field, projectId], () => client.fieldWithProject(entityType, field, projectId));
    },
    search(entityType: string, searchOptions: SearchOptions): Promise<SearchResult> {
      return run('search', [entityType, searchOptions], () => client.search(entityType, searchOptions));
    },
    textSearch(
      text: string,
      entityTypes: Record<string, TextSearchFilter>,
      page?: { size?: number; number?: number },
    ): Promise<TextSearchRow[]> {
      return run('textSearch', [text, entityTypes, page ?? null], () => client.textSearch(text, entityTypes, page));
    },
    statuses(): Promise<StatusRecord[]> {
      return run('statuses', [], () => client.statuses());
    },
    summarize(entityType: string, summarizeOptions?: SummarizeOptions): Promise<SummarizeResult> {
      return run('summarize', [entityType, summarizeOptions ?? null], () => client.summarize(entityType, summarizeOptions));
    },
    hierarchySearch(rootPath: string, entity: EntityRef): Promise<HierarchyPath[]> {
      // A search result's path is asked for once per row shown, so deduping it matters
      // more here than caching it: several rows of one query hit the same branch.
      return run('hierarchySearch', [rootPath, entity.type, entity.id], () => client.hierarchySearch(rootPath, entity));
    },
    hierarchyExpand(path: string): Promise<HierarchyNode> {
      // One level per call, so a tree that walks a project is one cached entry per node
      // (post_hierarchy_expand).
      return run('hierarchyExpand', [path], () => client.hierarchyExpand(path));
    },
    threadContents(noteId: number, entityFields?: Record<string, string[]>): Promise<ThreadRow[]> {
      return run('threadContents', [noteId, entityFields ?? null], () => client.threadContents(noteId, entityFields));
    },
    eventLog(eventOptions?: EventLogOptions): Promise<EventLogResult> {
      // Never cached: a change feed answered from a cache reports that nothing changed.
      return client.eventLog(eventOptions);
    },
    following(userId: number, followingOptions?: FollowingOptions): Promise<EntityRef[]> {
      return run('following', [userId, followingOptions ?? null], () => client.following(userId, followingOptions));
    },
    async create(entityType: string, body: Record<string, unknown>): Promise<EntityRow> {
      const row = await client.create(entityType, body);
      invalidateSearches(entityType);
      invalidateThreads();
      return row;
    },
    async upload(entityType: string, id: number, file: UploadFile): Promise<UploadResult> {
      const result = await client.upload(entityType, id, file);
      // The row gained a field value or an Attachment, and the Attachment is a new row.
      invalidateSearches(entityType);
      invalidateSearches('Attachment');
      invalidateThreads();
      return result;
    },
    async update(entityType: string, id: number, patch: Record<string, unknown>): Promise<EntityRow> {
      const row = await client.update(entityType, id, patch);
      // Every cached page of the type is now stale, including one whose filter or sort
      // the change moved the row out of.
      invalidateSearches(entityType);
      invalidateThreads();
      return row;
    },
    invalidate(prefix?: string): void {
      if (prefix === undefined) {
        entries.clear();
        inFlight.clear();
        return;
      }
      drop(prefix);
    },
  };
}
