import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { contextFromClient, createSgContext, preferencesOf } from '../src/context.js';
import type { EntityRow, EntityTypeInfo, EventLogOptions, EventLogResult, FollowingOptions, HierarchyNode, HierarchyPath, SummarizeOptions, SummarizeResult, SearchOptions, SearchResult, SgClient, TextSearchRow, ThreadRow, UploadFile, UploadResult } from '../src/client.js';
import type { EntityRef, TextSearchFilter } from '../src/filter.js';
import type { FieldSchema } from '../src/schema.js';
import type { StatusRecord } from '../src/status.js';

function counting(inner: SgClient): { client: SgClient; calls: string[] } {
  const calls: string[] = [];
  const client: SgClient = {
    entityTypes(): Promise<EntityTypeInfo[]> {
      calls.push('entityTypes');
      return inner.entityTypes();
    },
    fields(entityType: string, projectId?: number): Promise<Record<string, FieldSchema>> {
      calls.push(`fields ${entityType}`);
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

describe('the context', () => {
  it('caches rows, schema and the status table behind one object', async () => {
    const { client, calls } = counting(new MockClient());
    const sg = createSgContext({ client });
    await sg.client.search('Shot', { fields: ['code'] });
    await sg.client.search('Shot', { fields: ['code'] });
    await sg.schema.fields('Shot');
    await sg.schema.statusField('Shot');
    await sg.statuses.all();
    await sg.statuses.record('apr');
    expect(calls).toEqual(['search Shot', 'fields Shot', 'statuses']);
  });

  it('drops everything on invalidate', async () => {
    const { client, calls } = counting(new MockClient());
    const sg = createSgContext({ client });
    await sg.client.search('Shot', { fields: ['code'] });
    await sg.schema.fields('Shot');
    await sg.statuses.all();
    sg.invalidate();
    await sg.client.search('Shot', { fields: ['code'] });
    await sg.schema.fields('Shot');
    await sg.statuses.all();
    expect(calls).toEqual(['search Shot', 'fields Shot', 'statuses', 'search Shot', 'fields Shot', 'statuses']);
  });

  it('keeps schema past the row ttl', async () => {
    const { client, calls } = counting(new MockClient());
    // Rows go stale at once; schema keeps its own hour.
    const sg = createSgContext({ client, ttlMs: 0 });
    await sg.client.search('Shot', { fields: ['code'] });
    await sg.client.search('Shot', { fields: ['code'] });
    await sg.schema.fields('Shot');
    await sg.schema.fields('Shot');
    expect(calls).toEqual(['search Shot', 'search Shot', 'fields Shot']);
  });

  it('carries the site preferences a formatter takes', () => {
    // hours_per_day comes from GET /preferences; nothing on the site names a frame rate
    // (field_types/duration, field_types/timecode).
    const sg = createSgContext({ client: new MockClient(), hoursPerDay: 8, locale: 'en-GB', timeZone: 'Europe/Paris', frameRate: 23.976 });
    expect(sg.preferences).toEqual({ hoursPerDay: 8, locale: 'en-GB', timeZone: 'Europe/Paris', frameRate: 23.976 });
    expect(preferencesOf(sg)).toEqual(sg.preferences);
  });

  it('has no preferences when the app named none', () => {
    const sg = createSgContext({ client: new MockClient() });
    expect(sg.preferences).toEqual({});
    expect(preferencesOf(sg)).toEqual({});
    expect(preferencesOf(undefined)).toEqual({});
  });

  it('answers the widgets a picker needs from one place', async () => {
    const sg = createSgContext({ client: new MockClient() });
    const options = await sg.schema.statusOptions('Shot', 70);
    const first = options[0];
    expect(first?.code).toBe('wtg');
    expect((await sg.statuses.record(first?.code ?? ''))?.bgColor).toBe('178,178,178');
  });
});

describe('a context from a bare client', () => {
  it('builds one context per client, so two widgets share the caches', async () => {
    const { client, calls } = counting(new MockClient());
    const first = contextFromClient(client, { hoursPerDay: 8 });
    const second = contextFromClient(client);
    expect(second).toBe(first);
    expect(second.preferences).toEqual({ hoursPerDay: 8 });
    await first.schema.fields('Shot');
    await second.schema.fields('Shot');
    await first.statuses.all();
    await second.statuses.all();
    expect(calls).toEqual(['fields Shot', 'statuses']);
  });

  it('gives another client its own context', () => {
    const one = contextFromClient(new MockClient());
    const other = contextFromClient(new MockClient());
    expect(other).not.toBe(one);
  });
});
