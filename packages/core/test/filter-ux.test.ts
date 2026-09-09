import { describe, expect, it } from 'vitest';
import { conditionArity } from '../src/filter-ux.js';
import { condition, group, toApi3Hash } from '../src/filter.js';
import {
  appendAt,
  applyPreset,
  countActiveConditions,
  countConditions,
  defaultCondition,
  defaultValueFor,
  describeCondition,
  emptyValueFor,
  facetValues,
  filterableFields,
  findCondition,
  fromSortString,
  isHiddenPath,
  isSortable,
  moveAt,
  nodeAt,
  operatorLabel,
  operatorMenu,
  presetById,
  presetIdOf,
  presetsFor,
  relativeFrom,
  relativeOperator,
  removeAt,
  replaceAt,
  setFacet,
  sortableFields,
  supportsEmpty,
  timeUnitLabel,
  toSortString,
  validateCondition,
  valueArity,
  valueEditorFor,
  withoutPaths,
} from '../src/filter-ux.js';
import type { FieldSchema } from '../src/schema.js';

function field(partial: Partial<FieldSchema> & { name: string; dataType: string }): FieldSchema {
  return {
    displayName: partial.name,
    entityType: 'Shot',
    editable: true,
    mandatory: false,
    unique: false,
    ...partial,
  };
}

const status = field({
  name: 'sg_status_list',
  displayName: 'Status',
  dataType: 'status_list',
  validValues: ['wtg', 'ip', 'fin', 'apr'],
  displayValues: { wtg: 'Waiting to Start', ip: 'In Progress', fin: 'Final', apr: 'Approved' },
});
const turnover = field({ name: 'sg_turnover_date', displayName: 'Turnover Date', dataType: 'date' });
const cutIn = field({ name: 'sg_cut_in', displayName: 'Cut In', dataType: 'number' });
const omit = field({ name: 'sg_omit', displayName: 'Omitted', dataType: 'checkbox' });
const sequence = field({ name: 'sg_sequence', displayName: 'Sequence', dataType: 'entity', validTypes: ['Sequence'] });

describe('operatorLabel', () => {
  it('reads comparison as time on a date and as size on a number', () => {
    expect(operatorLabel('greater_than', 'date')).toBe('after');
    expect(operatorLabel('less_than', 'date_time')).toBe('before');
    expect(operatorLabel('greater_than', 'number')).toBe('greater than');
    expect(operatorLabel('in')).toBe('is any of');
    expect(operatorLabel('not_in')).toBe('is none of');
  });
});

describe('presetsFor', () => {
  it('offers every legal operator plus the empty pair, and no raw calendar operator', () => {
    const ids = presetsFor('status_list').map((p) => p.id);
    expect(ids).toEqual(['is', 'is_not', 'in', 'not_in', 'is_empty', 'is_not_empty']);
  });

  it('replaces the calendar operators with named offsets on a date', () => {
    const ids = presetsFor('date').map((p) => p.id);
    expect(ids).not.toContain('in_calendar_week');
    expect(ids).toContain('this_week');
    expect(ids).toContain('today');
    expect(ids).toContain('this_month');
    expect(ids).toContain('this_year');
    const thisWeek = presetById('date', 'this_week');
    expect(thisWeek).toMatchObject({ operator: 'in_calendar_week', value: 0, input: 'none' });
  });

  it('gives a checkbox no empty pair and an image nothing but one', () => {
    expect(supportsEmpty('checkbox')).toBe(false);
    expect(presetsFor('checkbox').map((p) => p.id)).toEqual(['is', 'is_not']);
    expect(presetsFor('image').map((p) => p.id)).toEqual(['is_empty', 'is_not_empty']);
  });

  it('gives an unfilterable type no menu at all', () => {
    for (const dataType of ['url', 'serializable', 'calculated', 'summary', 'password', 'pivot_column']) {
      expect(presetsFor(dataType)).toEqual([]);
      expect(operatorMenu(dataType)).toEqual([]);
    }
  });

  it('leaves uuid without an empty entry because its spelling is a blank row', () => {
    expect(emptyValueFor('uuid')).toBe('');
    expect(presetsFor('uuid').map((p) => p.id)).toEqual(['is', 'is_not', 'in', 'not_in']);
  });
});

describe('operatorMenu', () => {
  it('groups a date menu in reading order', () => {
    expect(operatorMenu('date').map((g) => g.label)).toEqual(['Is', 'Compare', 'Relative', 'Calendar', 'Empty']);
  });

  it('groups a text menu with its text run', () => {
    expect(operatorMenu('text').map((g) => g.label)).toEqual(['Is', 'Text', 'Empty']);
  });

  it('groups an entity menu with its link run', () => {
    expect(operatorMenu('entity').map((g) => g.label)).toEqual(['Is', 'Link', 'Empty']);
  });
});

describe('presetIdOf', () => {
  it('reads a null equality back as the empty pair', () => {
    expect(presetIdOf(condition('sg_sequence', 'is', null), 'entity')).toBe('is_empty');
    expect(presetIdOf(condition('sg_sequence', 'is_not', null), 'entity')).toBe('is_not_empty');
    expect(presetIdOf(condition('code', 'is', 'x'), 'text')).toBe('is');
  });

  it('reads a calendar offset back as its name', () => {
    expect(presetIdOf(condition('created_at', 'in_calendar_week', 0), 'date')).toBe('this_week');
    expect(presetIdOf(condition('created_at', 'in_calendar_day', -1), 'date')).toBe('yesterday');
    // An offset with no name of its own still lands on its calendar operator.
    expect(presetIdOf(condition('created_at', 'in_calendar_year', -9), 'date')).toBe('this_year');
  });
});

describe('applyPreset', () => {
  it('keeps a value across entries that edit the same shape', () => {
    const before = condition('code', 'contains', 'sh010');
    const after = applyPreset(before, presetById('text', 'starts_with') as never, 'text');
    expect(after).toMatchObject({ operator: 'starts_with', value: 'sh010' });
  });

  it('resets a value when the shape changes', () => {
    const before = condition('sg_status_list', 'is', 'fin');
    const after = applyPreset(before, presetById('status_list', 'in') as never, 'status_list');
    expect(after).toMatchObject({ operator: 'in', value: [] });
  });

  it('pins the value of a preset that carries one, and does not carry it back out', () => {
    const empty = applyPreset(condition('code', 'is', 'x'), presetById('text', 'is_empty') as never, 'text');
    expect(empty).toMatchObject({ operator: 'is', value: null });
    const back = applyPreset(empty, presetById('text', 'is') as never, 'text');
    expect(back.value).toBe('');
  });
});

describe('defaultValueFor', () => {
  it('starts blank wherever a person supplies the value', () => {
    expect(defaultValueFor('text', 'is')).toBe('');
    expect(defaultValueFor('status_list', 'in')).toEqual([]);
    expect(defaultValueFor('date', 'between')).toEqual([null, null]);
    expect(defaultValueFor('entity', 'name_contains')).toBe('');
  });

  it('starts filled where the type has one sensible value', () => {
    expect(defaultValueFor('checkbox', 'is')).toBe(true);
    expect(defaultValueFor('date', 'in_last')).toEqual([7, 'DAY']);
    expect(defaultValueFor('date', 'in_calendar_week')).toBe(0);
  });

  it('makes a fresh row on a text field serialise to nothing', () => {
    expect(toApi3Hash(defaultCondition('code', 'text'))).toBeNull();
    expect(toApi3Hash(defaultCondition('sg_status_list', 'status_list'))).toBeNull();
  });

  it('makes a fresh row on a checkbox a complete filter', () => {
    expect(toApi3Hash(defaultCondition('sg_omit', 'checkbox'))?.conditions).toEqual([['sg_omit', 'is', true]]);
  });
});

describe('describeCondition', () => {
  it('names the field, the wording and the values', () => {
    expect(describeCondition(condition('sg_status_list', 'in', ['apr', 'fin']), status)).toBe(
      'Status is any of Approved, Final',
    );
    expect(describeCondition(condition('sg_status_list', 'is', 'ip'), status)).toBe('Status is In Progress');
  });

  it('says what a pinned preset means', () => {
    expect(describeCondition(condition('sg_turnover_date', 'in_calendar_week', 0), turnover)).toBe(
      'Turnover Date this week',
    );
    expect(describeCondition(condition('sg_turnover_date', 'is', null), turnover)).toBe('Turnover Date is empty');
  });

  it('spells a relative window and a range', () => {
    expect(describeCondition(condition('sg_turnover_date', 'in_last', [1, 'WEEK']), turnover)).toBe(
      'Turnover Date in the last 1 week',
    );
    expect(describeCondition(condition('sg_turnover_date', 'in_next', [3, 'DAY']), turnover)).toBe(
      'Turnover Date in the next 3 days',
    );
    expect(describeCondition(condition('sg_cut_in', 'between', [1001, 1100]), cutIn)).toBe('Cut In between 1001 and 1100');
  });

  it('spells a checkbox and an entity', () => {
    expect(describeCondition(condition('sg_omit', 'is', false), omit)).toBe('Omitted is No');
    expect(describeCondition(condition('sg_sequence', 'is', { type: 'Sequence', id: 5, name: 'sh010' }), sequence)).toBe(
      'Sequence is sh010',
    );
    expect(describeCondition(condition('sg_sequence', 'is', { type: 'Sequence', id: 5 }), sequence)).toBe(
      'Sequence is Sequence #5',
    );
  });

  it('falls back to the path with no schema', () => {
    expect(describeCondition(condition('entity.Shot.code', 'contains', '010'))).toBe('entity.Shot.code contains 010');
  });
});

describe('validateCondition', () => {
  it('passes a filled row', () => {
    expect(validateCondition(condition('sg_status_list', 'in', ['fin']), status)).toEqual([]);
  });

  it('flags a row with no field and a path that resolves to nothing', () => {
    expect(validateCondition(condition('', 'is', 'x')).map((i) => i.code)).toEqual(['no-field']);
    expect(validateCondition(condition('nope', 'is', 'x'), null).map((i) => i.code)).toEqual(['unknown-field']);
  });

  it('flags an unfilterable type', () => {
    const movie = field({ name: 'sg_uploaded_movie', displayName: 'Uploaded Movie', dataType: 'url' });
    expect(validateCondition(condition('sg_uploaded_movie', 'is', 'x'), movie).map((i) => i.code)).toEqual(['unfilterable']);
  });

  it('flags an operator the type does not take', () => {
    expect(validateCondition(condition('sg_status_list', 'contains', 'fi'), status).map((i) => i.code)).toContain(
      'unknown-operator',
    );
  });

  it('flags a value of the wrong shape and a blank one', () => {
    expect(validateCondition(condition('sg_status_list', 'in', 'fin'), status).map((i) => i.code)).toEqual(['wrong-shape']);
    expect(validateCondition(condition('sg_status_list', 'in', []), status).map((i) => i.code)).toEqual(['blank-value']);
    expect(validateCondition(condition('sg_turnover_date', 'in_last', [0, 'DAY']), turnover).map((i) => i.code)).toEqual([
      'blank-value',
    ]);
  });
});

describe('value editors', () => {
  it('picks an editor from the type and an arity from the operator', () => {
    expect(valueEditorFor('status_list', 'in')).toBe('options');
    expect(valueEditorFor('entity', 'is')).toBe('entity');
    expect(valueEditorFor('entity', 'name_contains')).toBe('text');
    expect(valueEditorFor('date_time', 'between')).toBe('date_time');
    expect(valueEditorFor('percent', 'greater_than')).toBe('number');
    expect(valueEditorFor('checkbox', 'is')).toBe('checkbox');
    expect(valueEditorFor('date', 'in_calendar_week')).toBe('none');

    expect(valueArity('in')).toBe('many');
    expect(valueArity('between')).toBe('two');
    expect(valueArity('in_last')).toBe('relative');
    expect(valueArity('in_calendar_day')).toBe('none');
    expect(valueArity('is')).toBe('one');
  });
});

describe('relative dates', () => {
  it('maps a window onto its operator and back', () => {
    expect(relativeOperator({ direction: 'last' })).toBe('in_last');
    expect(relativeOperator({ direction: 'next', negated: true })).toBe('not_in_next');
    expect(relativeFrom('not_in_last', [4, 'MONTH'])).toEqual({
      count: 4,
      unit: 'MONTH',
      direction: 'last',
      negated: true,
    });
    expect(relativeFrom('is', 'x')).toBeNull();
  });

  it('pluralises a unit', () => {
    expect(timeUnitLabel('DAY', 1)).toBe('day');
    expect(timeUnitLabel('DAY', 3)).toBe('days');
  });
});

describe('field lists', () => {
  it('hides a pattern and everything under it', () => {
    expect(isHiddenPath('sg_task', ['sg_task'])).toBe(true);
    expect(isHiddenPath('sg_task.Task.content', ['sg_task'])).toBe(true);
    expect(isHiddenPath('sg_tasks', ['sg_task'])).toBe(false);
  });

  it('drops unfilterable fields and sorts by display name', () => {
    const fields = {
      sg_status_list: status,
      sg_uploaded_movie: field({ name: 'sg_uploaded_movie', displayName: 'Uploaded Movie', dataType: 'url' }),
      sg_cut_in: cutIn,
      sg_omit: omit,
    };
    expect(filterableFields(fields).map((f) => f.name)).toEqual(['sg_cut_in', 'sg_omit', 'sg_status_list']);
    expect(filterableFields(fields, { hidePaths: ['sg_omit'] }).map((f) => f.name)).toEqual(['sg_cut_in', 'sg_status_list']);
    expect(filterableFields(fields, { dataTypes: ['status_list'] }).map((f) => f.name)).toEqual(['sg_status_list']);
  });
});

describe('tree editing', () => {
  const tree = group('and', [
    condition('code', 'contains', 'sh'),
    group('or', [condition('sg_status_list', 'is', 'fin'), condition('sg_status_list', 'is', 'apr')]),
  ]);

  it('reads a node by its index path', () => {
    expect(nodeAt(tree, [])).toBe(tree);
    expect(nodeAt(tree, [1, 0])).toMatchObject({ path: 'sg_status_list', value: 'fin' });
    expect(nodeAt(tree, [9])).toBeUndefined();
    expect(nodeAt(tree, [0, 0])).toBeUndefined();
  });

  it('replaces, removes and appends without touching the original', () => {
    const replaced = replaceAt(tree, [1, 0], condition('sg_status_list', 'is', 'ip'));
    expect(nodeAt(replaced, [1, 0])).toMatchObject({ value: 'ip' });
    expect(nodeAt(tree, [1, 0])).toMatchObject({ value: 'fin' });

    expect(countConditions(removeAt(tree, [1, 1]))).toBe(2);
    expect(countConditions(removeAt(tree, [1]))).toBe(1);

    const appended = appendAt(tree, [1], condition('code', 'is', 'x'));
    expect(countConditions(appended)).toBe(4);
    expect(countConditions(tree)).toBe(3);
    // Appending to a condition is a no-op, not a crash.
    expect(appendAt(tree, [0], condition('code', 'is', 'x'))).toBe(tree);
  });

  it('moves a node among its siblings and stops at the ends', () => {
    const moved = moveAt(tree, [1, 0], 1);
    expect(nodeAt(moved, [1, 0])).toMatchObject({ value: 'apr' });
    expect(moveAt(tree, [0], -1)).toEqual(tree);
    expect(moveAt(tree, [1], 1)).toEqual(tree);
  });

  it('counts every condition and only the ones that survive serialisation', () => {
    const withBlank = appendAt(tree, [], condition('', 'is', ''));
    expect(countConditions(withBlank)).toBe(4);
    expect(countActiveConditions(withBlank)).toBe(3);
  });
});

describe('facets', () => {
  const tree = group('and', [
    condition('code', 'contains', 'sh'),
    condition('sg_status_list', 'in', ['fin']),
    group('or', [condition('sg_shot_type', 'in', ['Insert'])]),
  ]);

  it('finds a condition by field path wherever it sits', () => {
    expect(findCondition(tree, 'sg_status_list')?.at).toEqual([1]);
    expect(findCondition(tree, 'sg_shot_type')?.at).toEqual([2, 0]);
    expect(findCondition(tree, 'nope')).toBeUndefined();
  });

  it('strips every condition on the named paths, nested groups included', () => {
    const stripped = withoutPaths(tree, ['sg_status_list', 'sg_shot_type']);
    expect(countConditions(stripped)).toBe(1);
    expect(nodeAt(stripped, [0])).toMatchObject({ path: 'code' });
  });

  it('sets, replaces and removes a facet condition', () => {
    const added = setFacet(tree, 'sg_omit', ['x']);
    expect(nodeAt(added, [3])).toMatchObject({ path: 'sg_omit', operator: 'in', value: ['x'] });

    const replaced = setFacet(tree, 'sg_status_list', ['fin', 'apr']);
    expect(nodeAt(replaced, [1])).toMatchObject({ value: ['fin', 'apr'] });
    expect(countConditions(replaced)).toBe(3);

    const removed = setFacet(tree, 'sg_shot_type', []);
    expect(countConditions(removed)).toBe(2);
    expect(setFacet(tree, 'sg_omit', [])).toBe(tree);
  });
});

describe('facetValues', () => {
  function row(attributes: Record<string, unknown>, relationships: Record<string, unknown> = {}) {
    return { type: 'Shot', id: 1, attributes, relationships } as never;
  }

  it('keeps the site vocabulary at zero and counts what the rows hold', () => {
    const values = facetValues([row({ sg_status_list: 'fin' }), row({ sg_status_list: 'fin' })], status);
    expect(values.map((v) => [v.key, v.label, v.count])).toEqual([
      ['fin', 'Final', 2],
      ['apr', 'Approved', 0],
      ['ip', 'In Progress', 0],
      ['wtg', 'Waiting to Start', 0],
    ]);
  });

  it('reads a link value out of relationships and keys it by type and id', () => {
    const values = facetValues(
      [
        row({}, { sg_sequence: { data: { type: 'Sequence', id: 5, name: 'sh010' } } }),
        row({}, { sg_sequence: { data: null } }),
      ],
      sequence,
    );
    expect(values).toEqual([{ key: 'Sequence:5', label: 'sh010', value: { type: 'Sequence', id: 5, name: 'sh010' }, count: 1 }]);
  });

  it('offers both states of a checkbox even when the rows show one', () => {
    expect(facetValues([row({ sg_omit: false })], omit).map((v) => [v.key, v.label, v.count])).toEqual([
      ['false', 'No', 1],
      ['true', 'Yes', 0],
    ]);
  });
});

describe('sortable fields', () => {
  it('keeps out the types a sort cannot name', () => {
    for (const dataType of ['summary', 'url', 'password', 'serializable', 'uuid', 'pivot_column']) {
      expect(isSortable(dataType)).toBe(false);
    }
    // `calculated` sorts even though it cannot be filtered.
    expect(isSortable('calculated')).toBe(true);
    expect(isSortable('text')).toBe(true);
  });

  it('sorts what it offers by display name', () => {
    const fields = {
      code: field({ name: 'code', displayName: 'Shot Code', dataType: 'text' }),
      uuid: field({ name: 'uuid', displayName: 'UUID', dataType: 'uuid' }),
      sg_cut_in: cutIn,
    };
    expect(sortableFields(fields).map((f) => f.name)).toEqual(['sg_cut_in', 'code']);
  });
});

describe('sort strings', () => {
  it('joins keys with a minus for descending', () => {
    expect(
      toSortString([
        { field: 'sg_status_list', direction: 'asc' },
        { field: 'id', direction: 'desc' },
      ]),
    ).toBe('sg_status_list,-id');
    expect(toSortString([])).toBe('');
    expect(toSortString([{ field: '', direction: 'asc' }])).toBe('');
  });

  it('reads one back, dotted paths included', () => {
    expect(fromSortString('-created_at,entity.Shot.code')).toEqual([
      { field: 'created_at', direction: 'desc' },
      { field: 'entity.Shot.code', direction: 'asc' },
    ]);
    expect(fromSortString('')).toEqual([]);
    expect(fromSortString(null)).toEqual([]);
  });
});

describe('conditionArity', () => {
  it('draws no editor for a pinned preset', () => {
    expect(conditionArity(condition('image', 'is', null), 'image')).toBe('none');
    expect(conditionArity(condition('created_at', 'in_calendar_week', 0), 'date_time')).toBe('none');
    expect(conditionArity(condition('code', 'is', 'x'), 'text')).toBe('one');
  });
});
