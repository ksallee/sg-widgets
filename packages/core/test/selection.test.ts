import { describe, expect, it } from 'vitest';
import type { EntityRow } from '../src/client.js';
import type { EntityRef } from '../src/filter.js';
import {
  extendByStep,
  extendRange,
  gestureOf,
  matchingOffer,
  selectionKeyIntent,
  setRefs,
  toggleRow,
} from '../src/selection.js';

function row(id: number, over: Record<string, unknown> = {}): EntityRow {
  return { type: 'Shot', id, attributes: { code: `s${id}`, ...over }, relationships: {} };
}

const rows = [row(1), row(2), row(3, { locked: true }), row(4), row(5)];
const locked = (r: EntityRow): boolean => r.attributes['locked'] === true;
const ref = (id: number): EntityRef => ({ type: 'Shot', id });
const ids = (refs: readonly EntityRef[]): number[] => refs.map((r) => r.id).sort((a, b) => a - b);

describe('gestureOf', () => {
  it('reads Shift as a range and anything else as a toggle', () => {
    expect(gestureOf({ shiftKey: true })).toBe('range');
    expect(gestureOf({ shiftKey: true, metaKey: true })).toBe('range');
    expect(gestureOf({ metaKey: true })).toBe('toggle');
    expect(gestureOf({ ctrlKey: true })).toBe('toggle');
    expect(gestureOf({})).toBe('toggle');
  });
});

describe('toggleRow', () => {
  it('adds a row and anchors on it', () => {
    const step = toggleRow([], null, rows, 1);
    expect(ids(step.selection)).toEqual([2]);
    expect(step.anchor?.key).toBe('Shot:2');
    expect(step.anchor?.on).toBe(true);
  });

  it('drops a selected row and anchors a clearing range on it', () => {
    const step = toggleRow([ref(2), ref(4)], null, rows, 1);
    expect(ids(step.selection)).toEqual([4]);
    expect(step.anchor?.on).toBe(false);
  });

  it('refuses a disabled row and leaves the anchor', () => {
    const first = toggleRow([], null, rows, 0);
    const step = toggleRow(first.selection, first.anchor, rows, 2, locked);
    expect(step.selection).toEqual(first.selection);
    expect(step.anchor).toBe(first.anchor);
  });

  it('ignores an index outside the rows', () => {
    const step = toggleRow([ref(1)], null, rows, 9);
    expect(ids(step.selection)).toEqual([1]);
    expect(step.anchor).toBeNull();
  });
});

describe('extendRange', () => {
  it('takes every enabled row from the anchor to the target, either way', () => {
    const first = toggleRow([], null, rows, 0);
    const down = extendRange(first.selection, first.anchor, rows, 4, locked);
    expect(ids(down.selection)).toEqual([1, 2, 4, 5]);
    const up = toggleRow([], null, rows, 4);
    expect(ids(extendRange(up.selection, up.anchor, rows, 1, locked).selection)).toEqual([2, 4, 5]);
  });

  it('keeps the anchor, so a second Shift+press moves the far end', () => {
    const first = toggleRow([], null, rows, 0);
    const far = extendRange(first.selection, first.anchor, rows, 4);
    const back = extendRange(far.selection, far.anchor, rows, 1);
    expect(ids(back.selection)).toEqual([1, 2]);
    expect(back.anchor?.key).toBe('Shot:1');
  });

  it('keeps the picks made before the anchor', () => {
    const first = toggleRow([ref(5), { type: 'Shot', id: 99 }], null, rows, 0);
    const step = extendRange(first.selection, first.anchor, rows, 1);
    expect(ids(step.selection)).toEqual([1, 2, 5, 99]);
  });

  it('clears the range when the anchor was cleared', () => {
    const all = rows.map((r) => ref(r.id));
    const first = toggleRow(all, null, rows, 1);
    const step = extendRange(first.selection, first.anchor, rows, 3);
    expect(ids(step.selection)).toEqual([1, 5]);
  });

  it('lays the range over a selection that moved under the anchor', () => {
    const first = toggleRow([], null, rows, 0);
    // The header box or the host changed the selection since.
    const moved = [ref(1), ref(5)];
    const step = extendRange(moved, first.anchor, rows, 1);
    expect(ids(step.selection)).toEqual([1, 2, 5]);
  });

  it('with no anchor, or one no longer loaded, takes the one row and anchors there', () => {
    const none = extendRange([ref(5)], null, rows, 1);
    expect(ids(none.selection)).toEqual([2, 5]);
    expect(none.anchor?.key).toBe('Shot:2');
    const gone = extendRange([], { key: 'Shot:77', on: true, base: [], last: [] }, rows, 0);
    expect(ids(gone.selection)).toEqual([1]);
  });

  it('with no anchor, refuses a disabled target', () => {
    const step = extendRange([ref(1)], null, rows, 2, locked);
    expect(ids(step.selection)).toEqual([1]);
    expect(step.anchor).toBeNull();
  });
});

describe('extendByStep', () => {
  it('anchors on the row the cursor leaves when nothing anchors yet', () => {
    const step = extendByStep([], null, rows, 0, 1);
    expect(ids(step.selection)).toEqual([1, 2]);
    expect(step.anchor?.key).toBe('Shot:1');
  });

  it('grows and shrinks around the anchor', () => {
    const a = extendByStep([], null, rows, 1, 2, locked);
    expect(ids(a.selection)).toEqual([2]);
    const b = extendByStep(a.selection, a.anchor, rows, 2, 3, locked);
    expect(ids(b.selection)).toEqual([2, 4]);
    const c = extendByStep(b.selection, b.anchor, rows, 3, 2, locked);
    const d = extendByStep(c.selection, c.anchor, rows, 2, 1, locked);
    expect(ids(d.selection)).toEqual([2]);
    const e = extendByStep(d.selection, d.anchor, rows, 1, 0, locked);
    expect(ids(e.selection)).toEqual([1, 2]);
  });
});

describe('setRefs', () => {
  it('adds the refs it lacks and keeps the rest', () => {
    expect(ids(setRefs([ref(9)], [ref(1), ref(9)], true))).toEqual([1, 9]);
  });

  it('drops only the refs named', () => {
    expect(ids(setRefs([ref(9), ref(1), ref(2)], [ref(1), ref(2)], false))).toEqual([9]);
  });
});

describe('selectionKeyIntent', () => {
  it('reads Space, Shift+arrows and Cmd or Ctrl+A', () => {
    expect(selectionKeyIntent({ key: ' ' })).toBe('toggle');
    expect(selectionKeyIntent({ key: 'ArrowDown', shiftKey: true })).toBe('extend-down');
    expect(selectionKeyIntent({ key: 'ArrowUp', shiftKey: true })).toBe('extend-up');
    expect(selectionKeyIntent({ key: 'a', metaKey: true })).toBe('all');
    expect(selectionKeyIntent({ key: 'A', ctrlKey: true })).toBe('all');
  });

  it('leaves everything else alone', () => {
    expect(selectionKeyIntent({ key: 'ArrowDown' })).toBeNull();
    expect(selectionKeyIntent({ key: 'a' })).toBeNull();
    expect(selectionKeyIntent({ key: 'a', metaKey: true, shiftKey: true })).toBeNull();
    expect(selectionKeyIntent({ key: 'a', ctrlKey: true, altKey: true })).toBeNull();
    expect(selectionKeyIntent({ key: ' ', metaKey: true })).toBeNull();
    expect(selectionKeyIntent({ key: 'ArrowDown', shiftKey: true, metaKey: true })).toBeNull();
  });
});

describe('matchingOffer', () => {
  const base = { allLoaded: true, loaded: 25, selected: 25, hasMore: false, total: null as number | null };

  it('offers the whole set once every loaded row is picked and more exist', () => {
    expect(matchingOffer({ ...base, hasMore: true })).toEqual({ show: true, total: null });
    expect(matchingOffer({ ...base, total: 312 })).toEqual({ show: true, total: 312 });
  });

  it('says nothing while a loaded row is unpicked', () => {
    expect(matchingOffer({ ...base, allLoaded: false, hasMore: true }).show).toBe(false);
  });

  it('says nothing when the loaded rows are the set', () => {
    expect(matchingOffer({ ...base, total: 25 }).show).toBe(false);
    expect(matchingOffer(base).show).toBe(false);
  });

  it('says nothing once the selection covers the counted set', () => {
    expect(matchingOffer({ ...base, hasMore: true, total: 312, selected: 312 }).show).toBe(false);
  });
});
