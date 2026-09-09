import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createSgContext } from '../src/context.js';
import type { EntityRow, EntityTypeInfo, HierarchyNode, HierarchyPath, SummarizeOptions, SummarizeResult, SearchOptions, SearchResult, SgClient, TextSearchRow } from '../src/client.js';
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
    update(entityType: string, id: number, patch: Record<string, unknown>): Promise<EntityRow> {
      calls.push(`update ${entityType} ${id}`);
      return inner.update(entityType, id, patch);
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

  it('answers the widgets a picker needs from one place', async () => {
    const sg = createSgContext({ client: new MockClient() });
    const options = await sg.schema.statusOptions('Shot', 70);
    const first = options[0];
    expect(first?.code).toBe('wtg');
    expect((await sg.statuses.record(first?.code ?? ''))?.bgColor).toBe('178,178,178');
  });
});
