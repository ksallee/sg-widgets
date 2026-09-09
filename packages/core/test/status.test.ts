import { describe, expect, it } from 'vitest';
import { foregroundFor, intersectStatuses, parseBgColor, usableStatuses } from '../src/status.js';
import { displayNameOf, normalizeField, statusFieldFor } from '../src/schema.js';

describe('usableStatuses', () => {
  const field = {
    validValues: ['na', 'rev', 'vwd', 'apr', 'fin', 'part'],
    hiddenValues: ['part', 'blk'],
    displayValues: { rev: 'Pending Review', fin: 'Final' },
  };
  it('subtracts hidden from valid and tolerates hidden codes outside valid', () => {
    expect(usableStatuses(field).map((s) => s.code)).toEqual(['na', 'rev', 'vwd', 'apr', 'fin']);
    expect(usableStatuses(field)[1]).toEqual({ code: 'rev', label: 'Pending Review' });
  });
  it('intersects across projects keeping the first order', () => {
    const other = { ...field, hiddenValues: ['na', 'vwd'] };
    expect(intersectStatuses([field, other]).map((s) => s.code)).toEqual(['rev', 'apr', 'fin']);
  });
});

describe('colours', () => {
  it('parses decimal rgb triples and rejects hex', () => {
    expect(parseBgColor('25,118,27')).toEqual({ r: 25, g: 118, b: 27 });
    expect(parseBgColor('#19761b')).toBeNull();
    expect(foregroundFor({ r: 25, g: 118, b: 27 })).toBe('white');
    expect(foregroundFor({ r: 240, g: 240, b: 240 })).toBe('black');
  });
});

describe('schema', () => {
  it('normalises the {value, editable} wrapper', () => {
    const f = normalizeField('sg_status_list', {
      name: { value: 'Status', editable: true },
      entity_type: { value: 'Version', editable: false },
      data_type: { value: 'status_list', editable: false },
      editable: { value: true, editable: false },
      mandatory: { value: false, editable: false },
      unique: { value: false, editable: false },
      properties: {
        valid_values: { value: ['rev', 'fin'], editable: true },
        hidden_values: { value: ['fin'], editable: true },
        display_values: { value: { rev: 'Pending Review', fin: 'Final' }, editable: true },
        default_value: { value: 'rev', editable: true },
      },
    });
    expect(f.displayName).toBe('Status');
    expect(f.dataType).toBe('status_list');
    expect(f.hiddenValues).toEqual(['fin']);
    expect(statusFieldFor('Version', { sg_status_list: f })).toBe(f);
    expect(statusFieldFor('Project')).toBe('sg_status');
  });
  it('display name falls back through the conventional fields', () => {
    expect(displayNameOf({ code: 'sh010', name: 'x' })).toBe('sh010');
    expect(displayNameOf({ content: 'Comp' })).toBe('Comp');
    expect(displayNameOf({}, '#12')).toBe('#12');
  });
});
