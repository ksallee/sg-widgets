import { describe, expect, it } from 'vitest';
import { bulkUpdates, countResults, planBulkEdit, writeEach } from '../src/bulk-edit.js';
import type { EntityRow } from '../src/client.js';

function shot(id: number, code = `sh${id}`): EntityRow {
  return { type: 'Shot', id, attributes: { code }, relationships: {} };
}

const rows = [shot(1), shot(2), shot(3), shot(4), shot(5)];
const ref = (id: number) => ({ type: 'Shot', id });
const open = () => null;

describe('planBulkEdit', () => {
  it('reaches the edited row alone when it is not selected', () => {
    const edit = planBulkEdit({ rows, selection: [ref(2), ref(3)], edited: rows[0]!, path: 'code', value: 'x', lockOf: open });
    expect(edit.bulk).toBe(false);
    expect(edit.rows.map((r) => r.id)).toEqual([1]);
  });

  it('reaches the edited row alone when it is the only row selected', () => {
    const edit = planBulkEdit({ rows, selection: [ref(1)], edited: rows[0]!, path: 'code', value: 'x', lockOf: open });
    expect(edit.bulk).toBe(false);
    expect(edit.rows.map((r) => r.id)).toEqual([1]);
  });

  it('reaches every selected row on screen, the edited one first, then in row order', () => {
    const edit = planBulkEdit({ rows, selection: [ref(5), ref(1), ref(3)], edited: rows[2]!, path: 'code', value: 'x', lockOf: open });
    expect(edit.bulk).toBe(true);
    expect(edit.rows.map((r) => r.id)).toEqual([3, 1, 5]);
    expect(edit.skipped).toEqual([]);
    expect(edit.unloaded).toBe(0);
  });

  it('leaves a selected row whose cell is locked, with the reason', () => {
    const lockOf = (row: EntityRow) => (row.id === 4 ? 'No Flow PT row.' : null);
    const edit = planBulkEdit({ rows, selection: [ref(2), ref(4)], edited: rows[1]!, path: 'code', value: 'x', lockOf });
    expect(edit.rows.map((r) => r.id)).toEqual([2]);
    expect(edit.skipped).toEqual([{ row: rows[3], reason: 'No Flow PT row.' }]);
    expect(edit.bulk).toBe(true);
  });

  it('counts the selected rows not loaded, which it does not reach', () => {
    const edit = planBulkEdit({ rows, selection: [ref(1), ref(2), ref(90), ref(91)], edited: rows[0]!, path: 'code', value: 'x', lockOf: open });
    expect(edit.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(edit.unloaded).toBe(2);
  });

  it('keys rows by type and id, so a Shot and an Asset with one id are two rows', () => {
    const asset: EntityRow = { type: 'Asset', id: 1, attributes: {}, relationships: {} };
    const edit = planBulkEdit({ rows: [...rows, asset], selection: [ref(1), { type: 'Asset', id: 1 }], edited: rows[0]!, path: 'code', value: 'x', lockOf: open });
    expect(edit.rows).toEqual([rows[0], asset]);
  });
});

describe('bulkUpdates', () => {
  it('sets the one field on every row the plan reaches', () => {
    const edit = planBulkEdit({ rows, selection: [ref(1), ref(2)], edited: rows[1]!, path: 'sg_difficulty', value: 'Hero', lockOf: open });
    expect(bulkUpdates(edit)).toEqual([
      { ref: ref(2), patch: { sg_difficulty: 'Hero' } },
      { ref: ref(1), patch: { sg_difficulty: 'Hero' } },
    ]);
  });
});

describe('writeEach', () => {
  it('answers a result per update in order, and a refusal does not stop the rest', async () => {
    const results = await writeEach([{ ref: ref(1), patch: { code: 'a' } }, { ref: ref(2), patch: { code: 'b' } }, { ref: ref(3), patch: { code: 'c' } }], async (update) => {
      if (update.ref.id === 2) throw new Error('The field is not editable for this user: [Shot.code].');
      return { ...shot(update.ref.id), attributes: update.patch };
    });
    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
    expect(results[1]).toEqual({ ref: ref(2), ok: false, message: 'The field is not editable for this user: [Shot.code].' });
    expect(countResults(results)).toEqual({ landed: 2, refused: 1 });
  });
});
