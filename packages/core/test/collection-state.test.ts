import { describe, expect, it } from 'vitest';
import type { EntityRow } from '../src/client.js';
import {
  firstEnabledIndex,
  idsForRefs,
  nextEnabledIndex,
  refsForIds,
  rowIdOf,
  rowIsDisabled,
  sameFilters,
  sameIds,
  sameRefs,
  sameSort,
  toggleId,
  toSortKeys,
  toSortSpecs,
} from '../src/collection-state.js';
import { condition, group } from '../src/filter.js';

function row(id: number, over: Record<string, unknown> = {}): EntityRow {
  return { type: 'Version', id, attributes: { code: `v${id}`, ...over }, relationships: {} };
}

const rows = [row(1), row(2, { locked: true }), row(3)];

describe('row ids', () => {
  it('keys a row Type:id, or by the caller', () => {
    expect(rowIdOf(row(7))).toBe('Version:7');
    expect(rowIdOf(row(7), (r) => String(r.attributes['code']))).toBe('v7');
  });

  it('answers the refs an id list stands for, in row order', () => {
    expect(refsForIds(rows, ['Version:3', 'Version:1'])).toEqual([
      { type: 'Version', id: 1 },
      { type: 'Version', id: 3 },
    ]);
  });

  it('answers the ids a ref list is keyed under, and drops a ref no row stands for', () => {
    const byCode = (r: EntityRow): string => String(r.attributes['code']);
    expect(
      idsForRefs(rows, [{ type: 'Version', id: 2 }, { type: 'Shot', id: 2 }, { type: 'Version', id: 2 }], byCode),
    ).toEqual(['v2']);
  });
});

describe('disabled rows', () => {
  it('is false without a predicate', () => {
    expect(rowIsDisabled(row(1))).toBe(false);
    expect(rowIsDisabled(row(2, { locked: true }), (r) => r.attributes['locked'] === true)).toBe(true);
  });

  it('steps over a disabled row and stops at the ends', () => {
    const disabled = (index: number): boolean => index === 1 || index === 2;
    expect(nextEnabledIndex(4, 0, 1, disabled)).toBe(3);
    expect(nextEnabledIndex(4, 3, -1, disabled)).toBe(0);
    // Nothing enabled that way leaves the cursor where it stands.
    expect(nextEnabledIndex(4, 3, 1, disabled)).toBe(3);
    expect(nextEnabledIndex(0, 0, 1, disabled)).toBe(-1);
  });

  it('finds the first enabled row from an end', () => {
    const disabled = (index: number): boolean => index < 2;
    expect(firstEnabledIndex(4, 0, 1, disabled)).toBe(2);
    expect(firstEnabledIndex(4, 3, -1, disabled)).toBe(3);
    expect(firstEnabledIndex(2, 0, 1, disabled)).toBe(-1);
  });
});

describe('selection lists', () => {
  it('adds, removes and forces a direction', () => {
    expect(toggleId(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleId(['a', 'b'], 'a')).toEqual(['b']);
    expect(toggleId(['a'], 'a', true)).toEqual(['a']);
    expect(toggleId(['a'], 'b', false)).toEqual(['a']);
  });

  it('compares id and ref lists whatever their order', () => {
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(true);
    expect(sameIds(['a'], ['a', 'b'])).toBe(false);
    expect(sameRefs([{ type: 'Version', id: 1 }], [{ type: 'Version', id: 1 }])).toBe(true);
    expect(sameRefs([{ type: 'Version', id: 1 }], [{ type: 'Shot', id: 1 }])).toBe(false);
  });
});

describe('mirroring a source', () => {
  it('compares sort keys in order', () => {
    expect(sameSort([{ path: 'code', descending: false }], [{ path: 'code', descending: false }])).toBe(true);
    expect(sameSort([{ path: 'code', descending: false }], [{ path: 'code', descending: true }])).toBe(false);
    expect(
      sameSort(
        [
          { path: 'code', descending: false },
          { path: 'id', descending: false },
        ],
        [
          { path: 'id', descending: false },
          { path: 'code', descending: false },
        ],
      ),
    ).toBe(false);
  });

  it('reads the editor tree and the wire hash as one filter', () => {
    const tree = group('and', [condition('code', 'is', 'v1')]);
    const wire = { logical_operator: 'and' as const, conditions: [['code', 'is', 'v1'] as [string, 'is', string]] };
    expect(sameFilters(tree, wire)).toBe(true);
    expect(sameFilters(null, null)).toBe(true);
    expect(sameFilters(tree, null)).toBe(false);
  });

  it('turns a sort picker\u2019s keys into the source\u2019s sort and back', () => {
    const keys = [
      { field: 'code', direction: 'asc' as const },
      { field: 'created_at', direction: 'desc' as const },
    ];
    const specs = toSortSpecs(keys);
    expect(specs).toEqual([
      { path: 'code', descending: false },
      { path: 'created_at', descending: true },
    ]);
    expect(toSortKeys(specs)).toEqual(keys);
    expect(toSortSpecs([{ field: '', direction: 'asc' }])).toEqual([]);
  });
});
