import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createEntitySource, resolveColumns } from '../src/collection.js';
import type { CollectionColumn } from '../src/collection.js';
import { createSchemaService } from '../src/schema-service.js';
import type { SearchOptions, SearchResult } from '../src/client.js';
import {
  arrangeColumns,
  columnPaths,
  columnsStorageKey,
  parseColumnChoice,
  resolveColumnChoice,
  sameColumnPaths,
  serializeColumnChoice,
  unreadPaths,
} from '../src/column-choice.js';

function column(path: string, over: Partial<CollectionColumn> = {}): CollectionColumn {
  return { path, header: path, dataType: 'text', editable: false, align: 'left', sortable: true, field: null, ...over };
}

describe('columnsStorageKey', () => {
  it('keys a choice by entity type, or by the caller', () => {
    expect(columnsStorageKey('Shot')).toBe('sg-widgets:columns:Shot');
    expect(columnsStorageKey('Shot', 'project-12:Shot')).toBe('project-12:Shot');
    expect(columnsStorageKey('Shot', '')).toBe('sg-widgets:columns:Shot');
  });
});

describe('parseColumnChoice', () => {
  it('reads what serializeColumnChoice wrote', () => {
    expect(parseColumnChoice(serializeColumnChoice(['code', 'sg_status_list']))).toEqual(['code', 'sg_status_list']);
  });

  it('drops blanks and repeats', () => {
    expect(parseColumnChoice('["code","", "code", "entity.Shot.code"]')).toEqual(['code', 'entity.Shot.code']);
  });

  it('answers null for nothing, garbage and the wrong shape', () => {
    expect(parseColumnChoice(null)).toBeNull();
    expect(parseColumnChoice(undefined)).toBeNull();
    expect(parseColumnChoice('not json')).toBeNull();
    expect(parseColumnChoice('{"code":1}')).toBeNull();
    expect(parseColumnChoice('[1, 2]')).toBeNull();
    expect(parseColumnChoice('[]')).toBeNull();
  });
});

describe('paths', () => {
  it('reads the paths off columns and compares them in order', () => {
    const cols = [column('code'), column('description')];
    expect(columnPaths(cols)).toEqual(['code', 'description']);
    expect(sameColumnPaths(['a', 'b'], ['a', 'b'])).toBe(true);
    expect(sameColumnPaths(['a', 'b'], ['b', 'a'])).toBe(false);
    expect(sameColumnPaths(['a'], ['a', 'b'])).toBe(false);
  });

  it('names the paths a source does not read yet', () => {
    expect(unreadPaths(['id', 'code'], ['code', 'description', 'entity.Shot.code'])).toEqual([
      'description',
      'entity.Shot.code',
    ]);
    expect(unreadPaths(['id', 'code'], ['code'])).toEqual([]);
  });
});

describe('arrangeColumns', () => {
  it('orders the known columns by the paths and drops the ones it does not know', () => {
    const known = [column('code', { width: 200 }), column('description'), column('sg_status_list')];
    const out = arrangeColumns(['sg_status_list', 'gone', 'code'], known);
    expect(out.map((c) => c.path)).toEqual(['sg_status_list', 'code']);
    expect(out[1]?.width).toBe(200);
  });
});

describe('resolveColumnChoice', () => {
  it('keeps the columns it knows, resolves the rest, and skips a field the type lacks', async () => {
    const schema = createSchemaService(new MockClient());
    const known = await resolveColumns(schema, 'Version', [{ path: 'code', width: 260 }]);
    const out = await resolveColumnChoice(schema, 'Version', ['sg_status_list', 'code', 'sg_no_such_field', 'entity.Shot.code'], known);
    expect(out.map((c) => c.path)).toEqual(['sg_status_list', 'code', 'entity.Shot.code']);
    expect(out[0]?.header).toBe('Status');
    expect(out[1]?.width).toBe(260);
  });
});

describe('EntitySource.addFields', () => {
  class Counting extends MockClient {
    reads: string[][] = [];
    override search(entityType: string, options: SearchOptions): Promise<SearchResult> {
      this.reads.push([...(options.fields ?? [])]);
      return super.search(entityType, options);
    }
  }

  it('reads the loaded rows again with the new paths', async () => {
    const client = new Counting();
    const source = createEntitySource({ client, entityType: 'Version', fields: ['code'], pageSize: 10 });
    await source.load();
    await source.loadMore();
    await source.addFields(['sg_status_list', 'code']);
    expect(source.fields).toEqual(['id', 'code', 'sg_status_list']);
    expect(source.rows.length).toBe(20);
    expect(source.rows[0]?.attributes['sg_status_list']).toBeDefined();
    expect(client.reads.at(-1)).toEqual(['id', 'code', 'sg_status_list']);
  });

  it('reads nothing when every path is read already', async () => {
    const client = new Counting();
    const source = createEntitySource({ client, entityType: 'Version', fields: ['code'], pageSize: 10 });
    await source.load();
    const before = client.reads.length;
    await source.addFields(['code', 'id']);
    expect(client.reads.length).toBe(before);
  });
});
