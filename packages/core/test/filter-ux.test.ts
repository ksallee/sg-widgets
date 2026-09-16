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
  conditionParts,
  conditionValues,
  describeCondition,
  emptyValueFor,
  facetPresets,
  facetShape,
  facetValues,
  fieldOperators,
  findFacet,
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
  setFacetPreset,
  sortableFields,
  supportsEmpty,
  timeUnitLabel,
  toSortString,
  validateCondition,
  valueArity,
  conditionList,
  relativeWindow,
  timeUnitField,
  valueEditorFor,
  withAddedListValue,
  withListValue,
  withoutListValue,
  withRelativeWindow,
  withoutPaths,
} from '../src/filter-ux.js';
import type { FieldSchema } from '../src/schema.js';
import { normalizeFields } from '../src/schema.js';

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

  it('names every bucket around today on a date and on a date_time', () => {
    const expected: Array<[string, string, number]> = [
      ['today', 'in_calendar_day', 0],
      ['yesterday', 'in_calendar_day', -1],
      ['tomorrow', 'in_calendar_day', 1],
      ['this_week', 'in_calendar_week', 0],
      ['last_week', 'in_calendar_week', -1],
      ['next_week', 'in_calendar_week', 1],
      ['this_month', 'in_calendar_month', 0],
      ['last_month', 'in_calendar_month', -1],
      ['next_month', 'in_calendar_month', 1],
      ['this_year', 'in_calendar_year', 0],
      ['last_year', 'in_calendar_year', -1],
      ['next_year', 'in_calendar_year', 1],
    ];
    for (const dataType of ['date', 'date_time']) {
      const calendar = operatorMenu(dataType).find((run) => run.label === 'Calendar');
      expect(calendar?.presets.map((p) => [p.id, p.operator, p.value])).toEqual(expected);
      for (const [id] of expected) expect(presetById(dataType, id)?.input).toBe('none');
    }
  });

  it('keeps the forward buckets off a type that has no calendar operator', () => {
    for (const id of ['next_week', 'next_month', 'next_year']) {
      expect(presetById('number', id)).toBeUndefined();
      expect(presetById('status_list', id)).toBeUndefined();
    }
  });

  it('reads a forward bucket back as its name and serialises the signed offset', () => {
    expect(presetIdOf(condition('sg_turnover_date', 'in_calendar_week', 1), 'date')).toBe('next_week');
    expect(presetIdOf(condition('sg_turnover_date', 'in_calendar_month', 1), 'date')).toBe('next_month');
    expect(presetIdOf(condition('sg_turnover_date', 'in_calendar_year', 1), 'date')).toBe('next_year');
    const moved = applyPreset(
      condition('sg_turnover_date', 'is', '2026-01-01'),
      presetById('date', 'next_week')!,
      'date',
    );
    expect(moved).toMatchObject({ operator: 'in_calendar_week', value: 1 });
  });

  it('reads a forward bucket as a sentence', () => {
    expect(describeCondition(condition('sg_turnover_date', 'in_calendar_week', 1), turnover)).toBe(
      'Turnover Date next week',
    );
    expect(describeCondition(condition('sg_turnover_date', 'in_calendar_month', 1), turnover)).toBe(
      'Turnover Date next month',
    );
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

  it('gives colour and web-link conditions their own editors', () => {
    expect(valueEditorFor('color', 'is')).toBe('color');
    expect(valueEditorFor('color', 'in')).toBe('color');
    expect(valueEditorFor('url', 'is')).toBe('url');
    // A name comparison is a plain string whatever the field holds.
    expect(valueEditorFor('color', 'name_contains')).toBe('text');
  });
});

describe('list values', () => {
  it('reads a list condition and leaves anything else empty', () => {
    expect(conditionList(['a', 'b'])).toEqual(['a', 'b']);
    expect(conditionList('a')).toEqual([]);
    expect(conditionList(null)).toEqual([]);
  });

  it('replaces, drops and adds one value at a time', () => {
    expect(withListValue(['a', 'b'], 1, 'c')).toEqual(['a', 'c']);
    expect(withListValue(['a', 'b'], 5, 'c')).toEqual(['a', 'b']);
    expect(withoutListValue(['a', 'b', 'c'], 1)).toEqual(['a', 'c']);
    expect(withAddedListValue(['a'])).toEqual(['a', '']);
    expect(withAddedListValue(null)).toEqual(['']);
  });

  it('never edits the list in place', () => {
    const values = ['a', 'b'];
    expect(withListValue(values, 0, 'z')).not.toBe(values);
    expect(values).toEqual(['a', 'b']);
  });
});

describe('relative windows', () => {
  it('reads the pair back, with a day as the unit it cannot read', () => {
    expect(relativeWindow([3, 'MONTH'])).toEqual({ count: 3, unit: 'MONTH' });
    expect(relativeWindow([2, 'FORTNIGHT'])).toEqual({ count: 2, unit: 'DAY' });
    expect(relativeWindow(null)).toEqual({ count: null, unit: 'DAY' });
    expect(relativeWindow(['', 'WEEK'])).toEqual({ count: null, unit: 'WEEK' });
  });

  it('replaces one half and sends a count of one for an unfilled window', () => {
    expect(withRelativeWindow([3, 'MONTH'], { unit: 'WEEK' })).toEqual([3, 'WEEK']);
    expect(withRelativeWindow([3, 'MONTH'], { count: 7 })).toEqual([7, 'MONTH']);
    expect(withRelativeWindow(null, { unit: 'YEAR' })).toEqual([1, 'YEAR']);
  });

  it('offers the units as a list field', () => {
    const unit = timeUnitField();
    expect(unit.validValues).toEqual(['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR']);
    expect(unit.displayValues?.['WEEK']).toBe('weeks');
    expect(unit.mandatory).toBe(true);
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

  it('writes the facet on the operator it is given', () => {
    const negated = setFacet(tree, 'sg_status_list', ['fin'], 'not_in');
    expect(nodeAt(negated, [1])).toMatchObject({ operator: 'not_in', value: ['fin'] });
  });

  it('offers a facet the list operators and the empty tests, and nothing that takes one value', () => {
    expect(facetPresets('status_list').map((p) => p.id)).toEqual(['in', 'not_in', 'is_empty', 'is_not_empty']);
    expect(facetPresets('checkbox')).toEqual([]);
  });

  it('moves a facet onto another of its entries, keeping the ticked values where the shape holds', () => {
    const negated = setFacetPreset(tree, 'sg_status_list', presetById('status_list', 'not_in')!, 'status_list');
    expect(nodeAt(negated, [1])).toMatchObject({ operator: 'not_in', value: ['fin'] });

    const emptied = setFacetPreset(tree, 'sg_status_list', presetById('status_list', 'is_empty')!, 'status_list');
    expect(nodeAt(emptied, [1])).toMatchObject({ operator: 'is', value: null });

    const fresh = setFacetPreset(tree, 'sg_omit', presetById('checkbox', 'is')!, 'checkbox');
    expect(nodeAt(fresh, [3])).toMatchObject({ path: 'sg_omit', operator: 'is' });
  });
});

describe('a facet on a field the API evaluates no `in` on', () => {
  const readState = normalizeFields({ data: {} }, 'Note')['read_by_current_user'] as FieldSchema;
  const empty = group('and', []);

  it('narrows the data type vocabulary to what the field declares', () => {
    expect(fieldOperators(readState)).toEqual(['is', 'is_not']);
    expect(fieldOperators({ dataType: 'list' })).toEqual(['is', 'is_not', 'in', 'not_in']);
    expect(facetShape(readState)).toEqual({ any: 'is', none: 'is_not', spread: true });
    expect(facetShape(status)).toEqual({ any: 'in', none: 'not_in', spread: false });
  });

  it('serialises one ticked value to `is` and several to an `or` of `is`', () => {
    const one = setFacet(empty, 'read_by_current_user', ['read'], 'in', readState);
    expect(toApi3Hash(one)).toEqual({
      logical_operator: 'and',
      conditions: [['read_by_current_user', 'is', 'read']],
    });

    const both = setFacet(empty, 'read_by_current_user', ['read', 'unread'], 'in', readState);
    expect(toApi3Hash(both)).toEqual({
      logical_operator: 'and',
      conditions: [
        {
          logical_operator: 'or',
          conditions: [
            ['read_by_current_user', 'is', 'read'],
            ['read_by_current_user', 'is', 'unread'],
          ],
        },
      ],
    });
  });

  it('negates as `is_not`, which is `and` over several values', () => {
    const negated = setFacet(empty, 'read_by_current_user', ['read', 'unread'], 'not_in', readState);
    expect(toApi3Hash(negated)).toEqual({
      logical_operator: 'and',
      conditions: [
        {
          logical_operator: 'and',
          conditions: [
            ['read_by_current_user', 'is_not', 'read'],
            ['read_by_current_user', 'is_not', 'unread'],
          ],
        },
      ],
    });
  });

  it('reads the spread conditions back as one checklist, and replaces them in place', () => {
    const both = setFacet(empty, 'read_by_current_user', ['read', 'unread'], 'in', readState);
    const found = findFacet(both, 'read_by_current_user', readState);
    expect(found?.checklist).toBe(true);
    expect(found?.operator).toBe('is');
    expect(found?.values).toEqual(['read', 'unread']);
    // The pill reads every facet the same way, so the group stands in as one list condition.
    expect(found?.summary).toMatchObject({ operator: 'in', value: ['read', 'unread'] });

    const one = setFacet(both, 'read_by_current_user', ['read'], 'is', readState);
    expect(countConditions(one)).toBe(1);
    expect(nodeAt(one, [0])).toMatchObject({ operator: 'is', value: 'read' });
    expect(setFacet(both, 'read_by_current_user', [], 'in', readState).conditions).toEqual([]);
  });

  it('strips the whole group when the pill is removed', () => {
    const tree = group('and', [
      condition('project', 'is', { type: 'Project', id: 1180 }),
      group('or', [
        condition('read_by_current_user', 'is', 'read'),
        condition('read_by_current_user', 'is', 'unread'),
      ]),
    ]);
    const stripped = withoutPaths(tree, ['read_by_current_user']);
    expect(stripped.conditions).toHaveLength(1);
    expect(nodeAt(stripped, [0])).toMatchObject({ path: 'project' });
  });

  it('keeps `in` off the editor menu for the field', () => {
    const ids = operatorMenu('list', fieldOperators(readState)).flatMap((run) => run.presets.map((p) => p.id));
    expect(ids).toEqual(['is', 'is_not', 'is_empty', 'is_not_empty']);
    expect(presetById('list', 'in', fieldOperators(readState))).toBeUndefined();
    expect(defaultCondition('read_by_current_user', 'list', fieldOperators(readState)).operator).toBe('is');
  });

  it('names the ticked values as one comma-joined line', () => {
    const found = findFacet(
      setFacet(empty, 'read_by_current_user', ['read', 'unread'], 'in', readState),
      'read_by_current_user',
      readState,
    );
    expect(conditionValues(found!.summary, readState, 2).text).toBe('read, unread');
    expect(conditionValues(found!.summary, readState, 1)).toMatchObject({ text: 'read', overflow: 1 });
  });
});

describe('conditionParts', () => {
  it('splits the sentence describeCondition joins', () => {
    const ticked = condition('sg_status_list', 'in', ['apr', 'fin']);
    expect(conditionParts(ticked, status)).toEqual({
      field: 'Status',
      operator: 'is any of',
      value: 'Approved, Final',
    });
    expect(describeCondition(ticked, status)).toBe('Status is any of Approved, Final');
  });

  it('leaves the value empty where the operator pins it', () => {
    expect(conditionParts(condition('sg_turnover_date', 'in_calendar_week', 1), turnover)).toEqual({
      field: 'Turnover Date',
      operator: 'next week',
      value: '',
    });
    expect(conditionParts(condition('sg_turnover_date', 'is', null), turnover).value).toBe('');
  });

  it('falls back to the dotted path with no schema', () => {
    expect(conditionParts(condition('entity.Shot.code', 'contains', '010')).field).toBe('entity.Shot.code');
  });
});

describe('conditionValues', () => {
  it('names the first values and counts the rest, with the whole list in the title', () => {
    const ticked = condition('sg_status_list', 'in', ['apr', 'fin', 'ip', 'rev']);
    expect(conditionValues(ticked, status, 2)).toEqual({
      shown: ['Approved', 'Final'],
      overflow: 2,
      title: 'Approved, Final, In Progress, rev',
      text: 'Approved, Final',
      values: ['apr', 'fin'],
    });
    // `max` of 0 is every value, and a list shorter than `max` never overflows.
    expect(conditionValues(ticked, status, 0).overflow).toBe(0);
    expect(conditionValues(condition('sg_status_list', 'in', ['apr']), status, 2).overflow).toBe(0);
  });

  it('gives a condition on any other shape its one value and no overflow', () => {
    const one = conditionValues(condition('code', 'contains', '010'));
    expect(one.shown).toEqual(['010']);
    expect(one.overflow).toBe(0);
    expect(one.values).toEqual([]);
    // An operator that pins its own value has nothing to name.
    expect(conditionValues(condition('sg_status_list', 'is', null), status).shown).toEqual([]);
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
