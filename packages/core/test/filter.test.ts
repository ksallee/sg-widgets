import { describe, expect, it } from 'vitest';
import { condition, emptyFilter, fromWire, group, isEmptyFilter, referencedPaths, toApi3Hash } from '../src/filter.js';

describe('toApi3Hash', () => {
  it('serialises a nested and/or tree in the shape _search accepts', () => {
    const tree = group('and', [
      condition('project', 'is', { type: 'Project', id: 70, name: 'Demo' }),
      group('or', [condition('sg_status_list', 'is', 'fin'), condition('sg_status_list', 'is', 'rev')]),
    ]);
    expect(toApi3Hash(tree)).toEqual({
      logical_operator: 'and',
      conditions: [
        ['project', 'is', { type: 'Project', id: 70 }],
        { logical_operator: 'or', conditions: [['sg_status_list', 'is', 'fin'], ['sg_status_list', 'is', 'rev']] },
      ],
    });
  });

  it('drops blank conditions and empty groups, and returns null when nothing remains', () => {
    expect(toApi3Hash(emptyFilter())).toBeNull();
    const tree = group('and', [condition('', 'is', 'x'), group('or', [condition('code', 'in', [])])]);
    expect(toApi3Hash(tree)).toBeNull();
    expect(isEmptyFilter(tree)).toBe(true);
  });

  it('keeps `is null` as a real condition', () => {
    expect(toApi3Hash(condition('entity', 'is', null))).toEqual({
      logical_operator: 'and',
      conditions: [['entity', 'is', null]],
    });
  });

  it('keeps relative and range values verbatim', () => {
    const tree = group('and', [
      condition('created_at', 'in_last', [3, 'DAY']),
      condition('sg_turnover_date', 'between', ['2026-09-01', '2026-09-03']),
      condition('created_at', 'in_calendar_week', 0),
    ]);
    expect(toApi3Hash(tree)?.conditions).toEqual([
      ['created_at', 'in_last', [3, 'DAY']],
      ['sg_turnover_date', 'between', ['2026-09-01', '2026-09-03']],
      ['created_at', 'in_calendar_week', 0],
    ]);
  });

  it('treats a non-positive relative count as blank', () => {
    expect(toApi3Hash(condition('created_at', 'in_last', [0, 'DAY']))).toBeNull();
  });
});

describe('fromWire', () => {
  it('round-trips a hash group and accepts a flat api3_array list', () => {
    const wire = { logical_operator: 'or' as const, conditions: [['id', 'is', 862], ['id', 'is', 863]] as Array<[string, 'is', number]> };
    const tree = fromWire(wire);
    expect(toApi3Hash(tree)).toEqual(wire);
    expect(fromWire([['id', 'is', 1]]).logicalOperator).toBe('and');
  });
});

describe('referencedPaths', () => {
  it('collects unique paths depth first', () => {
    const tree = group('and', [condition('code', 'is', 'a'), group('or', [condition('entity.Shot.code', 'is', 'b'), condition('code', 'is', 'c')])]);
    expect(referencedPaths(tree)).toEqual(['code', 'entity.Shot.code']);
  });
});
