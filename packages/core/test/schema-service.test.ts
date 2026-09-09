import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createQueryCache } from '../src/query.js';
import { createSchemaService } from '../src/schema-service.js';
import type { EntityRow, EntityTypeInfo, HierarchyNode, SummarizeOptions, SummarizeResult, SearchOptions, SearchResult, SgClient, TextSearchRow } from '../src/client.js';
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
    fieldWithProject(entityType: string, field: string, projectId: number): Promise<FieldSchema> {
      calls.push(`fieldWithProject ${entityType}.${field} ${projectId}`);
      return inner.fieldWithProject(entityType, field, projectId);
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
    update(entityType: string, id: number, patch: Record<string, unknown>): Promise<EntityRow> {
      calls.push(`update ${entityType} ${id}`);
      return inner.update(entityType, id, patch);
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

describe('caching', () => {
  it('fetches a type once however many widgets ask', async () => {
    const { client, calls } = counting(new MockClient());
    const schema = createSchemaService(client);
    const [a, b] = await Promise.all([schema.fields('Shot'), schema.fields('Shot')]);
    await schema.field('Shot', 'code');
    await schema.statusField('Shot');
    expect(calls).toEqual(['fields Shot -']);
    expect(b).toBe(a);
  });

  it('reads fields at site scope, never with a project', async () => {
    const { client, calls } = counting(new MockClient());
    const schema = createSchemaService(client);
    await schema.fields('Shot');
    await schema.statusOptions('Shot', 70);
    expect(calls).toEqual(['fields Shot -', 'fieldWithProject Shot.sg_status_list 70']);
  });

  it('keys hidden values on type, field and project', async () => {
    const { client, calls } = counting(new MockClient());
    const schema = createSchemaService(client);
    await schema.hiddenValues('Shot', 'sg_status_list', 70);
    await schema.hiddenValues('Shot', 'sg_status_list', 70);
    await schema.hiddenValues('Shot', 'sg_status_list', 71);
    await schema.hiddenValues('Task', 'sg_status_list', 70);
    expect(calls).toEqual([
      'fieldWithProject Shot.sg_status_list 70',
      'fieldWithProject Shot.sg_status_list 71',
      'fieldWithProject Task.sg_status_list 70',
    ]);
  });

  it('drops only the schema keys out of a cache it was handed', async () => {
    const { client, calls } = counting(new MockClient());
    const cache = createQueryCache(client);
    const schema = createSchemaService(cache);
    await schema.fields('Shot');
    await cache.search('Shot', { fields: ['code'] });
    schema.invalidate();
    await schema.fields('Shot');
    await cache.search('Shot', { fields: ['code'] });
    expect(calls).toEqual(['fields Shot -', 'search Shot', 'fields Shot -']);
  });

  it('drops everything out of a cache it owns', async () => {
    const { client, calls } = counting(new MockClient());
    const schema = createSchemaService(client);
    await schema.entityTypes();
    schema.invalidate();
    await schema.entityTypes();
    expect(calls).toEqual(['entityTypes', 'entityTypes']);
  });
});

describe('status options', () => {
  it('subtracts the project hidden values, which the API does not enforce', async () => {
    const schema = createSchemaService(new MockClient());
    const site = await schema.statusOptions('Shot');
    const scoped = await schema.statusOptions('Shot', 70);
    expect(site.map((s) => s.code)).toEqual(['wtg', 'ip', 'rev', 'apr', 'fin', 'hld', 'omt']);
    expect(await schema.hiddenValues('Shot', 'sg_status_list', 70)).toEqual(['omt']);
    expect(scoped.map((s) => s.code)).toEqual(['wtg', 'ip', 'rev', 'apr', 'fin', 'hld']);
  });

  it('labels from display_values and falls back to the raw code', async () => {
    const schema = createSchemaService(new MockClient());
    const options = await schema.statusOptions('Shot', 70);
    expect(options.find((s) => s.code === 'ip')?.label).toBe('In Progress');
  });

  it('intersects across projects, in the first project order', async () => {
    const schema = createSchemaService(new MockClient());
    // Project 70 hides `omt`, project 71 hides `hld` and `omt`.
    const both = await schema.statusOptionsForProjects('Shot', [70, 71]);
    expect(both.map((s) => s.code)).toEqual(['wtg', 'ip', 'rev', 'apr', 'fin']);
    expect(await schema.statusOptionsForProjects('Shot', [])).toEqual([]);
  });

  it('finds Project own status field, a plain list under another name', async () => {
    const schema = createSchemaService(new MockClient());
    const field = await schema.statusField('Project');
    expect(typeof field === 'string' ? field : field.name).toBe('sg_status');
    expect(typeof field === 'string' ? '' : field.dataType).toBe('list');
    // Project 71 hides `On Hold` on it.
    expect((await schema.statusOptions('Project', 71)).map((s) => s.code)).toEqual(['Active', 'Bidding', 'Complete']);
  });

  it('offers a named field instead of the type status field', async () => {
    const schema = createSchemaService(new MockClient());
    const types = await schema.statusOptions('Version', undefined, 'sg_version_type');
    expect(types.map((s) => s.code)).toEqual(['Type A', 'Type B', 'Type C']);
    expect(await schema.statusOptions('Version', 70, 'nosuchfield')).toEqual([]);
    const intersected = await schema.statusOptionsForProjects('Version', [70, 71], 'sg_version_type');
    expect(intersected.map((s) => s.code)).toEqual(['Type A', 'Type B', 'Type C']);
  });

  it('falls back to the conventional name on a type with no status field', async () => {
    const schema = createSchemaService(new MockClient());
    expect(await schema.statusField('Icon')).toBe('sg_status_list');
    expect(await schema.statusOptions('Icon')).toEqual([]);
  });
});

describe('path resolution', () => {
  it('resolves a plain field', async () => {
    const schema = createSchemaService(new MockClient());
    const segments = await schema.resolvePath('Shot', 'code');
    expect(segments).toHaveLength(1);
    expect(segments[0]).toMatchObject({ entityType: 'Shot', name: 'code', displayName: 'Shot Code', dataType: 'text' });
    expect(segments[0]?.through).toBeUndefined();
  });

  it('walks a link through the type the path names', async () => {
    const schema = createSchemaService(new MockClient());
    const segments = await schema.resolvePath('Shot', 'sg_sequence.Sequence.code');
    expect(segments.map((s) => [s.entityType, s.name, s.displayName, s.dataType, s.through])).toEqual([
      ['Shot', 'sg_sequence', 'Sequence', 'entity', 'Sequence'],
      ['Sequence', 'code', 'Sequence Name', 'text', undefined],
    ]);
  });

  it('walks more than one hop', async () => {
    const schema = createSchemaService(new MockClient());
    const segments = await schema.resolvePath('Version', 'entity.Shot.project.Project.name');
    expect(segments.map((s) => s.name)).toEqual(['entity', 'project', 'name']);
    expect(segments.at(-1)?.dataType).toBe('text');
  });

  it('refuses a leaf the type does not have', async () => {
    const schema = createSchemaService(new MockClient());
    await expect(schema.resolvePath('Shot', 'bogusfield')).rejects.toThrow(/Shot\.bogusfield does not exist/);
    await expect(schema.resolvePath('Shot', 'sg_sequence.Sequence.bogusfield')).rejects.toThrow(/does not exist/);
  });

  it('refuses a middle segment outside the field valid_types', async () => {
    const schema = createSchemaService(new MockClient());
    // The type is real and the leaf is real, but Shot.sg_sequence does not link Asset.
    await expect(schema.resolvePath('Shot', 'sg_sequence.Asset.code')).rejects.toThrow(/does not link Asset/);
    await expect(schema.resolvePath('Shot', 'sg_sequence.Bogus.code')).rejects.toThrow(/does not link Bogus/);
  });

  it('refuses an empty path, and one that ends on a type', async () => {
    const schema = createSchemaService(new MockClient());
    await expect(schema.resolvePath('Shot', '')).rejects.toThrow(/Empty field path/);
    await expect(schema.resolvePath('Shot', 'sg_sequence.Sequence')).rejects.toThrow(/ends on a type/);
  });
});
