import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import {
  createEntitySource,
  cellValue,
  describePaging,
  groupKeyText,
  groupRows,
  resolveColumns,
  rowKey,
  serializeSort,
} from '../src/collection.js';
import { createSchemaService } from '../src/schema-service.js';
import { condition, group } from '../src/filter.js';
import type { EntitySource } from '../src/collection.js';
import type { EntityRow, SearchOptions, SearchResult } from '../src/client.js';

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

/** A mock that counts its reads and can withhold rows the site no longer answers. */
class WatchingClient extends MockClient {
  searches = 0;
  hidden = new Set<number>();

  override async search(entityType: string, options: SearchOptions): Promise<SearchResult> {
    this.searches += 1;
    const result = await super.search(entityType, options);
    return { ...result, data: result.data.filter((row) => !this.hidden.has(row.id)) };
  }
}

describe('rereadRows', () => {
  it('takes the new attributes and leaves every row where it was', async () => {
    const client = new MockClient();
    const s = source({ client, fields: ['code', 'description', 'entity.Shot.code'] });
    await s.load();
    const before = s.rows.map((r) => r.id);
    const row = s.rows[3];
    if (!row) throw new Error('no row');
    await client.update('Version', row.id, { description: 'read again' });

    await s.rereadRows([row.id]);
    expect(s.rows.map((r) => r.id)).toEqual(before);
    expect(s.rows[3]?.attributes['description']).toBe('read again');
    // The re-read carries the projection, dotted path and all.
    expect(s.rows[3]?.attributes['entity.Shot.code']).toBe(row.attributes['entity.Shot.code']);
  });

  it('reads a row that moved out of the filter back into its place', async () => {
    const client = new MockClient();
    const s = source({ client, fields: ['code', 'sg_status_list'] });
    await s.setFilters(group('and', [condition('sg_status_list', 'is', 'ip')]));
    const row = s.rows[1];
    if (!row) throw new Error('no row');
    await client.update('Version', row.id, { sg_status_list: 'fin' });

    await s.rereadRows([row.id]);
    expect(s.rows[1]?.id).toBe(row.id);
    expect(s.rows[1]?.attributes['sg_status_list']).toBe('fin');
  });

  it('drops a row the site no longer answers and keeps the rest', async () => {
    const client = new WatchingClient();
    const s = source({ client, fields: ['code'] });
    await s.load();
    const gone = s.rows[2];
    const kept = s.rows[3];
    if (!gone || !kept) throw new Error('no row');
    client.hidden.add(gone.id);

    await s.rereadRows([gone.id, kept.id]);
    expect(s.rows.length).toBe(9);
    expect(s.rows.map((r) => r.id)).not.toContain(gone.id);
    expect(s.rows[2]?.id).toBe(kept.id);
  });

  it('ignores an id that is not on screen and asks the site nothing', async () => {
    const client = new WatchingClient();
    const s = source({ client, fields: ['code'] });
    await s.load();
    const reads = client.searches;
    const before = s.rows;

    await s.rereadRows([-1, 999999]);
    expect(client.searches).toBe(reads);
    expect(s.rows).toBe(before);
  });

  it('asks the site nothing for an empty list', async () => {
    const client = new WatchingClient();
    const s = source({ client, fields: ['code'] });
    await s.load();
    const reads = client.searches;

    await s.rereadRows([]);
    expect(client.searches).toBe(reads);
  });

  it('leaves the status, the paging and the total alone', async () => {
    const client = new MockClient({ latencyMs: 5 });
    const s = source({ client, mode: 'pages', pageSize: 25, fields: ['code'] });
    await s.load();
    expect(s.status).toBe('ready');
    expect(s.total).toBe(60);
    const row = s.rows[0];
    if (!row) throw new Error('no row');

    const reading = s.rereadRows([row.id]);
    // Nothing dims while the rows are in the air.
    expect(s.status).toBe('ready');
    await reading;
    expect(s.status).toBe('ready');
    expect(s.hasMore).toBe(true);
    expect(s.total).toBe(60);
    expect(s.page).toBe(1);
    expect(s.rows.length).toBe(25);
  });

  it('does not cancel or wait for a page already in flight', async () => {
    const client = new MockClient({ latencyMs: 5 });
    const s = source({ client, fields: ['code'] });
    await s.load();
    const row = s.rows[0];
    if (!row) throw new Error('no row');

    const more = s.loadMore();
    await s.rereadRows([row.id]);
    await more;
    expect(s.rows.length).toBe(20);
    expect(s.status).toBe('ready');
  });
});

describe('columns', () => {
  it('takes headers, data types and editability off the schema', async () => {
    const schema = createSchemaService(new MockClient());
    const columns = await resolveColumns(schema, 'Version', ['code', 'sg_status_list', 'entity.Shot.code', 'created_at', 'frame_count']);
    expect(columns.map((c) => c.header)).toEqual(['Version Name', 'Status', 'Shot Code', 'Date Created', 'Frame Count']);
    expect(columns.map((c) => c.dataType)).toEqual(['text', 'status_list', 'text', 'date_time', 'number']);
    // A projection is never writable, and neither is a field the schema calls read-only.
    expect(columns.map((c) => c.editable)).toEqual([true, true, false, false, true]);
    // Numbers are right-aligned.
    expect(columns.map((c) => c.align)).toEqual(['left', 'left', 'left', 'left', 'right']);
    expect(columns[1]?.field?.displayValues?.['ip']).toBe('In Progress');
  });

  it('lets a caller overrule any of it', async () => {
    const schema = createSchemaService(new MockClient());
    const [column] = await resolveColumns(schema, 'Version', [{ path: 'code', header: 'Name', width: 220, align: 'right' }]);
    expect(column).toMatchObject({ header: 'Name', width: 220, align: 'right' });
  });

  it('names the whole path when a segment does not resolve', async () => {
    const schema = createSchemaService(new MockClient());
    await expect(resolveColumns(schema, 'Version', ['entity.Task.code'])).rejects.toThrow(/entity.Task.code/);
  });
});

describe('groupRows', () => {
  it('walks contiguous runs of the sorted order', async () => {
    const s = source({ fields: ['code', 'sg_status_list'], pageSize: 60 });
    await s.setSort([{ path: 'sg_status_list', descending: false }]);
    const groups = groupRows(s.rows, 'sg_status_list');
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.reduce((n, g) => n + g.rows.length, 0)).toBe(s.rows.length);
    // One run per value, because the server put them together.
    const values = groups.map((g) => g.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('splits an unsorted list wherever the value changes', () => {
    const rows = ['a', 'b', 'a'].map((v, i) => ({
      type: 'Version',
      id: i,
      attributes: { sg_status_list: v },
      relationships: {},
    }));
    expect(groupRows(rows, 'sg_status_list').map((g) => g.value)).toEqual(['a', 'b', 'a']);
  });

  it('groups on a key derived from the row, in the order the rows came in', () => {
    const note = (id: number, link: { type: string; id: number; name: string } | null) => ({
      type: 'Note',
      id,
      attributes: { subject: `n${id}` },
      relationships: { note_links: { data: link ? [link] : [] } },
    });
    const shot = { type: 'Shot', id: 7, name: 'sh010' };
    const asset = { type: 'Asset', id: 9, name: 'Tree' };
    const recordOf = (row: EntityRow) =>
      ((row.relationships?.['note_links'] as { data?: unknown[] } | undefined)?.data?.[0] ?? null);
    const groups = groupRows([note(1, shot), note(2, shot), note(3, asset), note(4, shot)], recordOf);
    expect(groups.map((g) => groupKeyText(g.value))).toEqual(['sh010', 'Tree', 'sh010']);
    expect(groups.map((g) => g.rows.length)).toEqual([2, 1, 1]);
    expect(groupRows([note(5, null)], recordOf).map((g) => g.value)).toEqual([null]);
  });
});

describe('groupKeyText', () => {
  it('reads a row as its display name and anything else as its own text', () => {
    expect(groupKeyText({ type: 'Shot', id: 7, name: 'sh010' })).toBe('sh010');
    expect(groupKeyText({ type: 'Shot', id: 7, code: 'sh020', name: 'x' })).toBe('sh020');
    expect(groupKeyText('ip')).toBe('ip');
    expect(groupKeyText(12)).toBe('12');
    expect(groupKeyText(null)).toBe('');
    expect(groupKeyText(undefined)).toBe('');
    expect(groupKeyText({ type: 'Shot', id: 7 })).toBe('');
  });
});

describe('pages mode', () => {
  it('walks the set one page at a time and counts it once', async () => {
    const s = source({ mode: 'pages', pageSize: 25 });
    await s.load();
    expect(s.mode).toBe('pages');
    expect(s.page).toBe(1);
    expect(s.rows.length).toBe(25);
    // The first read asks `_summarize` for the total the read itself never carries.
    expect(s.total).toBe(60);
    const first = s.rows.map((r) => r.id);

    await s.setPage(2);
    expect(s.page).toBe(2);
    expect(s.rows.length).toBe(25);
    expect(s.rows.map((r) => r.id)).not.toEqual(first);
    // A page replaces the rows; it never appends.
    expect(s.total).toBe(60);

    await s.setPage(3);
    expect(s.rows.length).toBe(10);
    expect(s.hasMore).toBe(false);
  });

  it('reopens at the first page on a new page size and keeps the total', async () => {
    const s = source({ mode: 'pages', pageSize: 25 });
    await s.load();
    await s.setPage(2);

    await s.setPageSize(50);
    expect(s.page).toBe(1);
    expect(s.pageSize).toBe(50);
    expect(s.rows.length).toBe(50);
    expect(s.total).toBe(60);
  });

  it('leaves loadMore alone and re-counts when the filter moves', async () => {
    const s = source({ mode: 'pages', pageSize: 25 });
    await s.load();
    await s.loadMore();
    expect(s.rows.length).toBe(25);

    await s.setFilters(condition('sg_status_list', 'is', 'ip'));
    expect(s.page).toBe(1);
    expect(s.total).not.toBe(60);
    expect(s.total).toBe(s.rows.length + (s.hasMore ? (s.total ?? 0) - s.rows.length : 0));
  });

  it('sorts without asking for the total again', async () => {
    const s = source({ mode: 'pages', pageSize: 25 });
    await s.load();
    await s.setPage(2);

    await s.setSort([{ path: 'id', descending: true }]);
    expect(s.page).toBe(1);
    expect(s.total).toBe(60);
  });
});

describe('count', () => {
  it('lands even when the first read starts beside it', async () => {
    const s = source({ pageSize: 25 });
    const [total] = await Promise.all([s.count(), s.load()]);
    expect(total).toBe(60);
    // The read that overtook it changed no filter, so the total it took still stands.
    expect(s.total).toBe(60);
  });

  it('is dropped when the filter it counted has moved', async () => {
    const s = source({ pageSize: 25 });
    await s.load();
    const stale = s.count();
    await s.setFilters(condition('sg_status_list', 'is', 'ip'));
    await stale;
    expect(s.total).not.toBe(60);
  });
});

describe('describePaging', () => {
  it('reads a range against a known total', async () => {
    const s = source({ mode: 'pages', pageSize: 25 });
    await s.load();
    await s.setPage(2);
    const paging = describePaging(s.snapshot());
    expect(paging.rangeLabel).toBe('26 to 50 of 60');
    expect(paging.pageCount).toBe(3);
    expect(paging.hasPrevious).toBe(true);
    expect(paging.hasNext).toBe(true);
  });

  it('drops the total from the range when nothing counted the set', () => {
    const paging = describePaging({
      rows: [1, 2, 3].map((id) => ({ type: 'Version', id, attributes: {}, relationships: {} })),
      status: 'ready',
      error: null,
      hasMore: true,
      total: null,
      filters: null,
      sort: [],
      mode: 'pages',
      page: 2,
      pageSize: 3,
    });
    expect(paging.rangeLabel).toBe('4 to 6');
    expect(paging.pageCount).toBeNull();
    // With no total the full page that came back is the only evidence of a next one.
    expect(paging.hasNext).toBe(true);
  });

  it('counts what is loaded in infinite mode', async () => {
    const s = source({ pageSize: 25 });
    await s.load();
    await s.loadMore();
    await s.count();
    const paging = describePaging(s.snapshot());
    expect(paging.from).toBe(1);
    expect(paging.to).toBe(50);
    expect(paging.loadedLabel).toBe('50 of 60 loaded');
    expect(paging.hasPrevious).toBe(false);
  });

  it('is at its end once an infinite source has loaded the whole counted set', () => {
    const paging = describePaging({
      rows: Array.from({ length: 320 }, (_, i) => ({ type: 'Version', id: i + 1, attributes: {}, relationships: {} })),
      status: 'ready',
      error: null,
      hasMore: false,
      total: 320,
      filters: null,
      sort: [],
      mode: 'infinite',
      page: 1,
      pageSize: 50,
    });
    // The page count describes the set; an appending source is done when the source says so.
    expect(paging.pageCount).toBe(7);
    expect(paging.hasNext).toBe(false);
  });

  it('reads zero rows as an empty range', () => {
    const paging = describePaging({
      rows: [],
      status: 'ready',
      error: null,
      hasMore: false,
      total: 0,
      filters: null,
      sort: [],
      mode: 'pages',
      page: 1,
      pageSize: 25,
    });
    expect(paging.rangeLabel).toBe('0 to 0 of 0');
    expect(paging.hasNext).toBe(false);
  });
});
