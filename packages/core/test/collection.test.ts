import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createEntitySource, cellValue, rowKey, serializeSort } from '../src/collection.js';
import { condition, group } from '../src/filter.js';
import type { EntitySource } from '../src/collection.js';

function source(over: Partial<Parameters<typeof createEntitySource>[0]> = {}): EntitySource {
  return createEntitySource({
    client: new MockClient(),
    entityType: 'Version',
    fields: ['code', 'sg_status_list', 'entity', 'created_at'],
    pageSize: 10,
    ...over,
  });
}

describe('paths', () => {
  it('reads a plain field, a link and a dotted path off one row', async () => {
    const s = source({ fields: ['code', 'entity', 'entity.Shot.code'] });
    await s.load();
    const row = s.rows[0];
    if (!row) throw new Error('no row');
    expect(typeof cellValue(row, 'code')).toBe('string');
    // A link comes back under `relationships`, a dotted path flat under its literal key.
    expect(cellValue(row, 'entity')).toMatchObject({ type: expect.any(String), id: expect.any(Number) });
    expect(typeof cellValue(row, 'entity.Shot.code')).toBe('string');
    expect(cellValue(row, 'id')).toBe(row.id);
    expect(cellValue(row, 'sg_not_asked_for')).toBeNull();
    expect(rowKey(row)).toBe(`Version:${row.id}`);
  });

  it('always projects id, whatever the caller asked for', () => {
    expect(source({ fields: ['code'] }).fields).toEqual(['id', 'code']);
  });
});

describe('sort', () => {
  it('serialises keys the way the body takes them', () => {
    expect(serializeSort([{ path: 'code', descending: false }])).toBe('code');
    expect(serializeSort([{ path: 'sg_status_list', descending: false }, { path: 'id', descending: true }])).toBe(
      'sg_status_list,-id',
    );
    expect(serializeSort([])).toBeUndefined();
  });

  it('reorders through the server and starts again at the first page', async () => {
    const s = source();
    await s.load();
    await s.loadMore();
    const ascending = s.rows.map((r) => r.id);
    expect(ascending.length).toBe(20);

    await s.setSort([{ path: 'id', descending: true }]);
    expect(s.rows.length).toBe(10);
    expect(s.rows[0]?.id).toBeGreaterThan(ascending[0] ?? 0);
  });
});

describe('paging', () => {
  it('appends a page and stops on a short one', async () => {
    const s = source({ pageSize: 25 });
    await s.load();
    expect(s.status).toBe('ready');
    expect(s.rows.length).toBe(25);
    expect(s.hasMore).toBe(true);

    await s.loadMore();
    expect(s.rows.length).toBe(50);
    await s.loadMore();
    // 60 Versions: the third page is short, which is the end of the set.
    expect(s.rows.length).toBe(60);
    expect(s.hasMore).toBe(false);

    await s.loadMore();
    expect(s.rows.length).toBe(60);
  });

  it('refresh keeps the rows already shown', async () => {
    const s = source();
    await s.load();
    await s.loadMore();
    await s.refresh();
    expect(s.rows.length).toBe(20);
    expect(s.status).toBe('ready');
  });
});

describe('filters', () => {
  it('takes the editor tree and the wire group alike', async () => {
    const tree = group('and', [condition('sg_status_list', 'is', 'ip')]);
    const s = source();
    await s.setFilters(tree);
    expect(s.filters).toEqual({ logical_operator: 'and', conditions: [['sg_status_list', 'is', 'ip']] });
    for (const row of s.rows) expect(row.attributes['sg_status_list']).toBe('ip');

    await s.setFilters({ logical_operator: 'and', conditions: [['sg_status_list', 'is', 'fin']] });
    for (const row of s.rows) expect(row.attributes['sg_status_list']).toBe('fin');
  });

  it('counts the whole matching set, not the loaded page', async () => {
    const s = source();
    await s.load();
    expect(s.rows.length).toBe(10);
    expect(await s.count()).toBe(60);

    await s.setFilters(group('and', [condition('sg_status_list', 'is', 'ip')]));
    const counted = await s.count();
    expect(counted).toBe(s.rows.length + (s.hasMore ? counted! - s.rows.length : 0));
  });
});

describe('states', () => {
  it('reports a failed read without losing the rows it had', async () => {
    const client = new MockClient();
    const s = createEntitySource({ client, entityType: 'Version', fields: ['code'], pageSize: 5 });
    await s.load();
    expect(s.status).toBe('ready');

    client.failNext({ status: 500, message: 'Flow PT API error 500' });
    await s.loadMore();
    expect(s.status).toBe('error');
    expect(s.error?.message).toBe('Flow PT API error 500');
    expect(s.rows.length).toBe(5);
  });

  it('notifies a subscriber on every change and stops on unsubscribe', async () => {
    const s = source();
    let seen = 0;
    const stop = s.subscribe(() => {
      seen += 1;
    });
    await s.load();
    expect(seen).toBeGreaterThan(0);
    const before = seen;
    stop();
    await s.loadMore();
    expect(seen).toBe(before);
  });

  it('hands out one state object until something changes', async () => {
    const s = source();
    const first = s.snapshot();
    expect(s.snapshot()).toBe(first);
    await s.load();
    expect(s.snapshot()).not.toBe(first);
  });
});

describe('updateRow', () => {
  it('writes through the client and puts the re-read row back in place', async () => {
    const s = source({ fields: ['code', 'description', 'entity.Shot.code'] });
    await s.load();
    const row = s.rows[2];
    if (!row) throw new Error('no row');

    const fresh = await s.updateRow({ type: 'Version', id: row.id }, { description: 'a new note' });
    expect(fresh.attributes['description']).toBe('a new note');
    // The re-read carries the projection, which a write's own answer never does.
    expect(fresh.attributes['entity.Shot.code']).toBe(row.attributes['entity.Shot.code']);
    expect(s.rows[2]?.attributes['description']).toBe('a new note');
    expect(s.rows.length).toBe(10);
  });

  it('reads the row back even when the change moves it out of the filter', async () => {
    const s = source({ fields: ['code', 'sg_status_list'] });
    await s.setFilters(group('and', [condition('sg_status_list', 'is', 'ip')]));
    const row = s.rows[0];
    if (!row) throw new Error('no row');
    const fresh = await s.updateRow({ type: 'Version', id: row.id }, { sg_status_list: 'fin' });
    expect(fresh.attributes['sg_status_list']).toBe('fin');
    expect(s.rows[0]?.attributes['sg_status_list']).toBe('fin');
  });

  it('throws and changes nothing when the write is refused', async () => {
    const s = source({ fields: ['code'] });
    await s.load();
    const row = s.rows[0];
    if (!row) throw new Error('no row');
    const before = s.rows;
    await expect(s.updateRow({ type: 'Version', id: row.id }, { created_at: 'x' })).rejects.toMatchObject({ status: 400 });
    expect(s.rows).toBe(before);
    expect(s.status).toBe('ready');
  });
});
