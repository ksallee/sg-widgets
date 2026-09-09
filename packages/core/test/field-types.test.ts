import { describe, expect, it } from 'vitest';
import { isFilterable, operatorsFor, supportsOperator, OPERATORS_BY_TYPE, VALUE_SHAPE, DATA_TYPES } from '../src/field-types.js';

describe('operator vocabularies', () => {
  it('match what the API printed for a bogus operator', () => {
    expect(operatorsFor('text')).toEqual(['contains', 'not_contains', 'is', 'is_not', 'starts_with', 'ends_with', 'in', 'not_in']);
    expect(operatorsFor('status_list')).toEqual(['is', 'is_not', 'in', 'not_in']);
    expect(operatorsFor('checkbox')).toEqual(['is', 'is_not']);
    expect(operatorsFor('entity')).toContain('name_contains');
    expect(operatorsFor('date')).toEqual(operatorsFor('date_time'));
    expect(operatorsFor('number')).not.toContain('greater_than_or_equal');
  });

  it('marks the five unfilterable types', () => {
    for (const t of ['url', 'serializable', 'calculated', 'summary', 'password']) expect(isFilterable(t)).toBe(false);
    expect(isFilterable('text')).toBe(true);
  });

  it('every operator of every type has a value shape', () => {
    for (const t of DATA_TYPES) for (const op of OPERATORS_BY_TYPE[t]) expect(VALUE_SHAPE[op]).toBeDefined();
  });

  it('supportsOperator is per type', () => {
    expect(supportsOperator('status_list', 'contains')).toBe(false);
    expect(supportsOperator('text', 'contains')).toBe(true);
  });
});
