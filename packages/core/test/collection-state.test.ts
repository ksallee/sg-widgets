import { describe, expect, it } from 'vitest';
import type { EntityRow } from '../src/client.js';
import {
  asCollapseState,
  collapseAll,
  collapsedKeys,
  collapseStateFrom,
  expandAll,
  firstEnabledIndex,
  idsForRefs,
  isCollapsed,
  nextEnabledIndex,
  refsForIds,
  rowIdOf,
  rowIsDisabled,
  sameFilters,
  selectableRefs,
  selectionState,
  sameCollapse,
  sameIds,
  sameRefs,
  sameSort,
  toggleCollapsed,
  toggleId,
  toggleRef,
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

describe('a selection over loaded rows', () => {
  const locked = (candidate: EntityRow): boolean => candidate.attributes['locked'] === true;

  it('adds a row it does not hold and drops one it does', () => {
    const one = toggleRef([], { type: 'Version', id: 1 });
    expect(one).toEqual([{ type: 'Version', id: 1 }]);
    expect(toggleRef(one, { type: 'Version', id: 1 })).toEqual([]);
    expect(toggleRef(one, { type: 'Version', id: 2 })).toEqual([
      { type: 'Version', id: 1 },
      { type: 'Version', id: 2 },
    ]);
  });

  it('reads a header checkbox as all, some or neither', () => {
    expect(selectionState(rows, [])).toEqual({ all: false, some: false });
    expect(selectionState(rows, [{ type: 'Version', id: 1 }])).toEqual({ all: false, some: true });
    expect(selectionState(rows, rows.map((r) => ({ type: r.type, id: r.id })))).toEqual({ all: true, some: true });
    expect(selectionState([], [])).toEqual({ all: false, some: false });
  });

  it('leaves a disabled row out of both readings', () => {
    const open = [
      { type: 'Version', id: 1 },
      { type: 'Version', id: 3 },
    ];
    expect(selectionState(rows, open, locked)).toEqual({ all: true, some: true });
    expect(selectableRefs(rows, locked)).toEqual(open);
    expect(selectionState([rows[1] as EntityRow], [], locked)).toEqual({ all: false, some: false });
  });
});

describe('collapse state', () => {
  it('holds a mode, so a group that arrives later follows it', () => {
    const shut = collapseAll();
    expect(isCollapsed(shut, 'group:0:"apr"')).toBe(true);
    // The key the next page brings was never named, and is shut all the same.
    expect(isCollapsed(shut, 'group:9:"new"')).toBe(true);
    expect(isCollapsed(expandAll(), 'group:9:"new"')).toBe(false);
  });

  it('toggles one group against the mode and back out of the exceptions', () => {
    const opened = toggleCollapsed(collapseAll(), 'a');
    expect(opened).toEqual({ all: true, except: ['a'] });
    expect(isCollapsed(opened, 'a')).toBe(false);
    expect(isCollapsed(opened, 'b')).toBe(true);
    // Shutting it again leaves no exception behind.
    expect(toggleCollapsed(opened, 'a')).toEqual({ all: true, except: [] });
    // `on` is whether the group ends up shut, and asking for what already holds changes nothing.
    expect(toggleCollapsed(opened, 'a', true)).toEqual({ all: true, except: [] });
    expect(toggleCollapsed(opened, 'a', false)).toEqual({ all: true, except: ['a'] });
    expect(toggleCollapsed(opened, 'b', true)).toEqual({ all: true, except: ['a'] });
  });

  it('toggles one group under expand-all and back', () => {
    const shut = toggleCollapsed(expandAll(), 'a');
    expect(shut).toEqual({ all: false, except: ['a'] });
    expect(isCollapsed(shut, 'a')).toBe(true);
    expect(isCollapsed(shut, 'b')).toBe(false);
    expect(toggleCollapsed(shut, 'a')).toEqual({ all: false, except: [] });
  });

  it('reads a bare key list as the open mode with those keys shut', () => {
    expect(asCollapseState(['a', 'b'])).toEqual({ all: false, except: ['a', 'b'] });
    expect(asCollapseState(undefined)).toEqual({ all: false, except: [] });
    expect(asCollapseState(null)).toEqual({ all: false, except: [] });
    expect(isCollapsed(asCollapseState(['a']), 'a')).toBe(true);
    expect(isCollapsed(asCollapseState(['a']), 'b')).toBe(false);
  });

  it('reads a mode written without exceptions', () => {
    expect(asCollapseState({ all: true })).toEqual({ all: true, except: [] });
    expect(asCollapseState({ all: false })).toEqual({ all: false, except: [] });
    // The copy is the caller's own list no longer.
    const except = ['a'];
    const state = asCollapseState({ all: true, except });
    except.push('b');
    expect(state.except).toEqual(['a']);
  });

  it('answers which of the drawn keys are shut', () => {
    expect(collapsedKeys(collapseAll(), ['a', 'b'])).toEqual(['a', 'b']);
    expect(collapsedKeys(toggleCollapsed(collapseAll(), 'a'), ['a', 'b'])).toEqual(['b']);
    expect(collapsedKeys(asCollapseState(['b']), ['a', 'b', 'c'])).toEqual(['b']);
  });

  it('reads a set of shut headers back under the mode in force', () => {
    const keys = ['a', 'b', 'c'];
    // Under collapse-all, an open header is the exception and the mode survives.
    expect(collapseStateFrom(collapseAll(), ['a', 'c'], keys)).toEqual({ all: true, except: ['b'] });
    // Under expand-all it is the other way.
    expect(collapseStateFrom(expandAll(), ['a', 'c'], keys)).toEqual({ all: false, except: ['a', 'c'] });
    // An exception for a key no longer drawn is dropped.
    expect(collapseStateFrom({ all: true, except: ['gone'] }, keys, keys)).toEqual({ all: true, except: [] });
  });

  it('keeps the mode and no exception when nothing is drawn', () => {
    expect(collapseStateFrom(collapseAll(), [], [])).toEqual({ all: true, except: [] });
    expect(collapseStateFrom({ all: false, except: ['a'] }, [], [])).toEqual({ all: false, except: [] });
  });

  it('compares two states by what they shut', () => {
    expect(sameCollapse(collapseAll(), { all: true, except: [] })).toBe(true);
    expect(sameCollapse({ all: true, except: ['a', 'b'] }, { all: true, except: ['b', 'a'] })).toBe(true);
    expect(sameCollapse(collapseAll(), expandAll())).toBe(false);
  });
});
