import { describe, expect, it } from 'vitest';
import { DATA_TYPES } from '../src/field-types.js';
import { DATA_TYPE_LABELS, dataTypeLabel, dataTypeOptions } from '../src/data-type-labels.js';

describe('dataTypeLabel', () => {
  it('labels every data type this build knows', () => {
    for (const type of DATA_TYPES) {
      expect(DATA_TYPE_LABELS[type], type).toBeTruthy();
      expect(dataTypeLabel(type), type).toBe(DATA_TYPE_LABELS[type]);
      expect(dataTypeLabel(type), type).not.toContain('_');
    }
  });

  it('reads as words, not as the wire name', () => {
    expect(dataTypeLabel('text')).toBe('Text');
    expect(dataTypeLabel('date_time')).toBe('Date and time');
    expect(dataTypeLabel('status_list')).toBe('Status list');
    expect(dataTypeLabel('multi_entity')).toBe('Multi-entity');
    expect(dataTypeLabel('url')).toBe('URL');
  });

  it('tells apart the types that share a glyph', () => {
    expect(dataTypeLabel('number')).not.toBe(dataTypeLabel('float'));
    expect(dataTypeLabel('entity')).not.toBe(dataTypeLabel('multi_entity'));
    expect(new Set(Object.values(DATA_TYPE_LABELS)).size).toBe(DATA_TYPES.length);
  });

  it('gives a type it does not know back as it was given', () => {
    expect(dataTypeLabel('sg_not_a_data_type')).toBe('sg_not_a_data_type');
    expect(dataTypeLabel('Query')).toBe('Query');
    expect(dataTypeLabel('')).toBe('');
  });

  it('does not answer with a property of the map itself', () => {
    expect(dataTypeLabel('constructor')).toBe('constructor');
    expect(dataTypeLabel('toString')).toBe('toString');
  });

  it('lets a caller reword a label, or name a type this build does not know', () => {
    const labels = { url: 'File/Link', sg_new_type: 'New type' };
    expect(dataTypeLabel('url', labels)).toBe('File/Link');
    expect(dataTypeLabel('sg_new_type', labels)).toBe('New type');
    expect(dataTypeLabel('text', labels)).toBe('Text');
  });
});

describe('dataTypeOptions', () => {
  it('keeps the order it was given', () => {
    expect(dataTypeOptions(['list', 'text', 'date_time'])).toEqual([
      { code: 'list', label: 'List' },
      { code: 'text', label: 'Text' },
      { code: 'date_time', label: 'Date and time' },
    ]);
  });

  it('offers a type once and never an empty one', () => {
    expect(dataTypeOptions(['text', '', 'text', 'number']).map((option) => option.code)).toEqual(['text', 'number']);
  });

  it('offers a type it does not know under its own name', () => {
    expect(dataTypeOptions(['sg_not_a_data_type'])).toEqual([
      { code: 'sg_not_a_data_type', label: 'sg_not_a_data_type' },
    ]);
  });

  it('keeps a value outside the set, after it', () => {
    expect(dataTypeOptions(['text', 'number'], { value: 'calculated' })).toEqual([
      { code: 'text', label: 'Text' },
      { code: 'number', label: 'Number' },
      { code: 'calculated', label: 'Calculated' },
    ]);
    expect(dataTypeOptions(['text'], { value: 'text' })).toHaveLength(1);
    expect(dataTypeOptions(['text'], { value: null })).toHaveLength(1);
    expect(dataTypeOptions(['text'], { value: '' })).toHaveLength(1);
  });

  it('labels through the caller\'s map', () => {
    expect(dataTypeOptions(['url'], { labels: { url: 'File/Link' } })).toEqual([{ code: 'url', label: 'File/Link' }]);
  });
});
