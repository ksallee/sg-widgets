import { describe, expect, it } from 'vitest';
import { compareCells, createListSource, sortRows } from '../src/list-source.js';
import type { EntityRow } from '../src/client.js';
import type { RowUpdate } from '../src/bulk-edit.js';

function row(type: string, id: number, attributes: Record<string, unknown>, relationships: EntityRow['relationships'] = {}): EntityRow {
  return { type, id, attributes, relationships };
}

const rows = [
  row('Shot', 3, { code: 'sh010', frames: 120 }),
  row('Shot', 1, { code: 'sh2', frames: null }),
  row('Asset', 7, { code: 'Hero', frames: 8 }),
  // A row with no record behind it: the host keys it with an id no site row has.
  row('Shot', -1, { code: 'sh005', frames: 40 }),
];

describe('compareCells', () => {
  it('orders numbers by value and text with its digits read as numbers', () => {
    expect(compareCells(9, 10)).toBeLessThan(0);
    expect(compareCells('sh2', 'sh010')).toBeLessThan(0);
  });

  it('puts an empty cell last whichever way the sort runs', () => {
    expect(compareCells(null, 'a')).toBeGreaterThan(0);
    expect(compareCells(null, 'a', true)).toBeGreaterThan(0);
    expect(compareCells('', 3)).toBeGreaterThan(0);
  });

  it('orders an entity by its name', () => {
    expect(compareCells({ type: 'Sequence', id: 9, name: 'A' }, { type: 'Sequence', id: 1, name: 'B' })).toBeLessThan(0);
  });
});

describe('sortRows', () => {
  it('keeps the host order without a sort, and breaks ties on it', () => {
    expect(sortRows(rows, []).map((r) => r.id)).toEqual([3, 1, 7, -1]);
    const tied = [row('Shot', 1, { d: 'a' }), row('Shot', 2, { d: 'a' }), row('Shot', 3, { d: 'b' })];
    expect(sortRows(tied, [{ path: 'd', descending: true }]).map((r) => r.id)).toEqual([3, 1, 2]);
  });

  it('sorts on a plain field and on a link', () => {
    expect(sortRows(rows, [{ path: 'code', descending: false }]).map((r) => r.id)).toEqual([7, 1, -1, 3]);
    expect(sortRows(rows, [{ path: 'frames', descending: true }]).map((r) => r.id)).toEqual([3, -1, 7, 1]);
    const linked = [
      row('Shot', 1, {}, { sg_sequence: { data: { type: 'Sequence', id: 5, name: 'SQ20' } } }),
      row('Shot', 2, {}, { sg_sequence: { data: { type: 'Sequence', id: 4, name: 'SQ10' } } }),
    ];
    expect(sortRows(linked, [{ path: 'sg_sequence', descending: false }]).map((r) => r.id)).toEqual([2, 1]);
  });
});

describe('createListSource', () => {
  it('is ready with every row at once, and nothing pages', async () => {
    const s = createListSource({ entityType: 'Shot', rows });
    expect(s.status).toBe('ready');
    expect(s.rows.length).toBe(4);
    expect(s.hasMore).toBe(false);
    expect(s.total).toBe(4);
    await s.load();
    await s.loadMore();
    expect(s.rows.length).toBe(4);
  });

  it('sorts in memory and tells its subscribers', async () => {
    const s = createListSource({ entityType: 'Shot', rows });
    let told = 0;
    s.subscribe(() => (told += 1));
    await s.setSort([{ path: 'code', descending: false }]);
    expect(s.rows.map((r) => r.id)).toEqual([7, 1, -1, 3]);
    expect(s.snapshot().sort).toEqual([{ path: 'code', descending: false }]);
    expect(told).toBe(1);
  });

  it('takes new rows under the sort in force', async () => {
    const s = createListSource({ entityType: 'Shot', rows, sort: [{ path: 'code', descending: true }] });
    s.setRows([row('Shot', 8, { code: 'a' }), row('Shot', 9, { code: 'b' })]);
    expect(s.rows.map((r) => r.id)).toEqual([9, 8]);
    expect(s.total).toBe(2);
  });

  it('holds a filter for the two-way prop and shows every row', async () => {
    const s = createListSource({ entityType: 'Shot', rows });
    await s.setFilters({ logical_operator: 'and', conditions: [['code', 'is', 'sh2']] });
    expect(s.filters).toEqual({ logical_operator: 'and', conditions: [['code', 'is', 'sh2']] });
    expect(s.rows.length).toBe(4);
  });

  it('hands a write to the host and puts the row it answers in place', async () => {
    const seen: RowUpdate[] = [];
    const s = createListSource({
      entityType: 'Shot',
      rows,
      update: async (update) => {
        seen.push(update);
        const before = rows.find((r) => r.type === update.ref.type && r.id === update.ref.id)!;
        return { ...before, attributes: { ...before.attributes, ...update.patch } };
      },
    });
    const fresh = await s.updateRow({ type: 'Shot', id: -1 }, { code: 'sh006' });
    expect(seen).toEqual([{ ref: { type: 'Shot', id: -1 }, patch: { code: 'sh006' } }]);
    expect(fresh.attributes['code']).toBe('sh006');
    expect(s.rows.find((r) => r.id === -1)?.attributes['code']).toBe('sh006');
  });

  it('writes several rows through updateMany, and a refused row keeps its value', async () => {
    const s = createListSource({
      entityType: 'Shot',
      rows,
      updateMany: async (updates) =>
        updates.map((update) =>
          update.ref.id === 1
            ? { ref: update.ref, ok: false as const, message: 'Refused.' }
            : { ref: update.ref, ok: true as const, row: row(update.ref.type, update.ref.id, { code: 'x' }) },
        ),
    });
    const results = await s.updateRows!([
      { ref: { type: 'Shot', id: 3 }, patch: { code: 'x' } },
      { ref: { type: 'Shot', id: 1 }, patch: { code: 'x' } },
    ]);
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(s.rows.find((r) => r.id === 3)?.attributes['code']).toBe('x');
    expect(s.rows.find((r) => r.id === 1)?.attributes['code']).toBe('sh2');
  });

  it('falls back to one update per row, and refuses every write without either', async () => {
    const one = createListSource({ entityType: 'Shot', rows, update: async (u) => row(u.ref.type, u.ref.id, u.patch) });
    const results = await one.updateRows!([
      { ref: { type: 'Shot', id: 3 }, patch: { code: 'a' } },
      { ref: { type: 'Asset', id: 7 }, patch: { code: 'b' } },
    ]);
    expect(results.every((r) => r.ok)).toBe(true);
    const none = createListSource({ entityType: 'Shot', rows });
    await expect(none.updateRow({ type: 'Shot', id: 3 }, { code: 'a' })).rejects.toThrow('These rows are read only.');
    expect((await none.updateRows!([{ ref: { type: 'Shot', id: 3 }, patch: { code: 'a' } }]))[0]).toMatchObject({ ok: false });
  });
});
