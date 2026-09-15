import { describe, expect, it } from 'vitest';
import { MockClient } from '../src/mock.js';
import { createEntitySource } from '../src/collection.js';
import type { EntityRow } from '../src/client.js';
import type { EntitySource, EntitySourceState } from '../src/collection.js';
import {
  canLoadNext,
  collectionBottom,
  collectionView,
  groupRowsKeyed,
  hasFailedPage,
  loadsOnArrowDown,
  reachedEnd,
  shouldLoadNext,
  sourceModeFor,
} from '../src/paging.js';

function source(over: Partial<Parameters<typeof createEntitySource>[0]> = {}): EntitySource {
  return createEntitySource({
    client: new MockClient(),
    entityType: 'Version',
    fields: ['code', 'sg_status_list'],
    pageSize: 10,
    ...over,
  });
}

function state(over: Partial<EntitySourceState> = {}): EntitySourceState {
  return {
    rows: [],
    status: 'ready',
    error: null,
    hasMore: true,
    total: null,
    filters: null,
    sort: [],
    mode: 'infinite',
    page: 1,
    pageSize: 10,
    ...over,
  };
}

function rows(count: number, value: string): EntityRow[] {
  return Array.from({ length: count }, (_, at) => ({
    type: 'Version',
    id: at + 1,
    attributes: { sg_status_list: value },
    relationships: {},
  }));
}

describe('modes', () => {
  it('maps a paging mode onto the source mode it needs', () => {
    expect(sourceModeFor('pages')).toBe('pages');
    expect(sourceModeFor('more')).toBe('infinite');
    expect(sourceModeFor('scroll')).toBe('infinite');
  });

  it('switches a source between walking and appending', async () => {
    const s = source({ mode: 'pages', pageSize: 25 });
    await s.load();
    await s.setPage(2);
    expect(s.rows.length).toBe(25);

    await s.setMode('infinite');
    expect(s.mode).toBe('infinite');
    // Appending opens at the first page again, whatever page was on screen.
    expect(s.page).toBe(1);
    await s.loadMore();
    expect(s.rows.length).toBe(50);

    const same = s.snapshot();
    await s.setMode('infinite');
    expect(s.snapshot()).toBe(same);
  });
});

describe('reaching the end', () => {
  it('is a short page, and never an unread set', async () => {
    expect(reachedEnd(state({ status: 'idle', hasMore: false }))).toBe(false);
    expect(reachedEnd(state({ status: 'loading', hasMore: false }))).toBe(false);

    const s = source({ pageSize: 25 });
    await s.load();
    expect(reachedEnd(s.snapshot())).toBe(false);
    await s.loadMore();
    await s.loadMore();
    // 60 rows in three pages of 25: the third is short.
    expect(s.rows.length).toBe(60);
    expect(reachedEnd(s.snapshot())).toBe(true);
  });
});

describe('loading the next page', () => {
  it('refuses in pages mode, at the end, and while a read is in flight', () => {
    expect(canLoadNext(state(), 'pages')).toBe(false);
    expect(canLoadNext(state({ hasMore: false }), 'scroll')).toBe(false);
    expect(canLoadNext(state({ status: 'loadingMore' }), 'more')).toBe(false);
    expect(canLoadNext(state({ status: 'loading' }), 'more')).toBe(false);
    expect(canLoadNext(state({ status: 'idle' }), 'more')).toBe(false);
    expect(canLoadNext(state(), 'more')).toBe(true);
    // A failed page is asked for again, which is the retry.
    expect(canLoadNext(state({ status: 'error' }), 'more')).toBe(true);
  });

  it('asks on a scroll within the threshold of the last loaded row', () => {
    const loaded = state({ rows: rows(50, 'ip') });
    expect(shouldLoadNext(loaded, { paging: 'scroll', lastVisible: 20 })).toBe(false);
    expect(shouldLoadNext(loaded, { paging: 'scroll', lastVisible: 44 })).toBe(true);
    expect(shouldLoadNext(loaded, { paging: 'scroll', lastVisible: 49 })).toBe(true);
    expect(shouldLoadNext(loaded, { paging: 'scroll', lastVisible: 44, threshold: 0 })).toBe(false);
    // Only `scroll` follows the scroller, and a failed page waits for its retry.
    expect(shouldLoadNext(loaded, { paging: 'more', lastVisible: 49 })).toBe(false);
    expect(shouldLoadNext(loaded, { paging: 'pages', lastVisible: 49 })).toBe(false);
    expect(shouldLoadNext({ ...loaded, status: 'error' }, { paging: 'scroll', lastVisible: 49 })).toBe(false);
  });

  it('asks when a cursor steps past the last loaded row', () => {
    const loaded = state({ rows: rows(50, 'ip') });
    expect(loadsOnArrowDown(loaded, 'more', 49)).toBe(false);
    expect(loadsOnArrowDown(loaded, 'more', 50)).toBe(true);
    expect(loadsOnArrowDown(loaded, 'scroll', 52)).toBe(true);
    expect(loadsOnArrowDown(loaded, 'pages', 50)).toBe(false);
    expect(loadsOnArrowDown({ ...loaded, hasMore: false }, 'more', 50)).toBe(false);
    expect(loadsOnArrowDown({ ...loaded, status: 'loadingMore' }, 'more', 50)).toBe(false);
  });

  it('retries a failed page and keeps the rows that landed before it', async () => {
    const client = new MockClient();
    const s = createEntitySource({ client, entityType: 'Version', fields: ['code'], pageSize: 10 });
    await s.load();

    client.failNext({ status: 500, message: 'Flow PT API error 500' });
    await s.loadMore();
    expect(hasFailedPage(s.snapshot())).toBe(true);
    expect(s.rows.length).toBe(10);

    await s.loadMore();
    expect(s.status).toBe('ready');
    expect(s.rows.length).toBe(20);
    expect(hasFailedPage(s.snapshot())).toBe(false);
  });

  it('reads a failed first read as a state of its own, with no rows under it', async () => {
    const client = new MockClient();
    const s = createEntitySource({ client, entityType: 'Version', fields: ['code'], pageSize: 10 });
    client.failNext({ status: 500, message: 'Flow PT API error 500' });
    await s.load();
    expect(s.status).toBe('error');
    expect(hasFailedPage(s.snapshot())).toBe(false);
  });
});

describe('groups across a page boundary', () => {
  it('grows the last group when the next page continues it', () => {
    const first = groupRowsKeyed([...rows(3, 'ip'), ...rows(2, 'fin')], 'sg_status_list');
    expect(first.map((g) => g.key)).toEqual(['group:0:"ip"', 'group:1:"fin"']);

    // The page that follows opens on the value the last group carries.
    const second = groupRowsKeyed([...rows(3, 'ip'), ...rows(2, 'fin'), ...rows(4, 'fin')], 'sg_status_list');
    expect(second.length).toBe(2);
    expect(second[1]?.key).toBe('group:1:"fin"');
    expect(second[1]?.rows.length).toBe(6);
  });

  it('opens a group when the next page starts a new value', () => {
    const grown = groupRowsKeyed([...rows(3, 'ip'), ...rows(2, 'fin'), ...rows(4, 'rev')], 'sg_status_list');
    expect(grown.map((g) => g.key)).toEqual(['group:0:"ip"', 'group:1:"fin"', 'group:2:"rev"']);
    expect(grown[2]?.rows.length).toBe(4);
  });

  it('keys a derived group the same way, so a shut group survives the next page', () => {
    const note = (id: number, record: string) => ({
      type: 'Note',
      id,
      attributes: { subject: `n${id}` },
      relationships: { note_links: { data: [{ type: 'Shot', id: record.length, name: record }] } },
    });
    const recordOf = (row: EntityRow) =>
      (row.relationships?.['note_links'] as { data?: { name?: string }[] } | undefined)?.data?.[0]?.name ?? null;
    const first = groupRowsKeyed([note(1, 'sh010'), note(2, 'sh010'), note(3, 'tree')], recordOf);
    expect(first.map((g) => g.key)).toEqual(['group:0:"sh010"', 'group:1:"tree"']);
    const second = groupRowsKeyed([note(1, 'sh010'), note(2, 'sh010'), note(3, 'tree'), note(4, 'tree')], recordOf);
    expect(second[1]?.key).toBe('group:1:"tree"');
    expect(second[1]?.rows.length).toBe(2);
  });

  it('keys an empty value and reads no rows as no groups', () => {
    expect(groupRowsKeyed([], 'sg_status_list')).toEqual([]);
    const none = groupRowsKeyed(
      [{ type: 'Version', id: 1, attributes: {}, relationships: {} }],
      'sg_status_list',
    );
    expect(none[0]?.key).toBe('group:0:null');
  });
});

describe('what a collection draws', () => {
  it('reads the body as error, loading, empty or rows', () => {
    expect(collectionView(state({ status: 'error', error: new Error('no') }), 0)).toBe('error');
    expect(collectionView(state({ status: 'loading' }), 0)).toBe('loading');
    expect(collectionView(state(), 0)).toBe('empty');
    expect(collectionView(state({ rows: rows(2, 'ip') }), 2)).toBe('rows');
  });

  it('leaves the rows up when a later page fails', () => {
    const failed = state({ status: 'error', error: new Error('no'), rows: rows(3, 'ip') });
    expect(collectionView(failed, 3)).toBe('rows');
  });

  it('counts the lines the layout drew, not the rows', () => {
    // A grouped table draws headers as well, so a set with rows is never empty.
    expect(collectionView(state({ rows: rows(2, 'ip') }), 0)).toBe('empty');
  });

  it('puts one block under the last row', () => {
    expect(collectionBottom(state({ status: 'error', error: new Error('no'), rows: rows(3, 'ip') }), 'scroll')).toBe(
      'error',
    );
    expect(collectionBottom(state({ status: 'loadingMore' }), 'scroll')).toBe('loading');
    expect(collectionBottom(state(), 'more')).toBe('more');
    expect(collectionBottom(state(), 'scroll')).toBe('sentinel');
    expect(collectionBottom(state(), 'pages')).toBe(null);
    expect(collectionBottom(state({ hasMore: false }), 'scroll')).toBe(null);
  });
});
