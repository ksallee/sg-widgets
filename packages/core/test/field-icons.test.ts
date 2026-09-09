import { describe, expect, it } from 'vitest';
import { DATA_TYPES } from '../src/field-types.js';
import { DEFAULT_FIELD_ICON, FIELD_ICON_NAMES, iconNameFor } from '../src/field-icons.js';

describe('iconNameFor', () => {
  it('names a lucide icon for every data type', () => {
    for (const type of DATA_TYPES) {
      const name = iconNameFor(type);
      expect(name, type).toMatch(/^[a-z][a-z0-9]*(-[a-z0-9]+)*$/);
      expect(FIELD_ICON_NAMES, type).toContain(name);
    }
  });

  it('gives the types a reader recognises their own glyph', () => {
    expect(iconNameFor('text')).toBe('type');
    expect(iconNameFor('date')).toBe('calendar');
    expect(iconNameFor('date_time')).toBe('calendar-clock');
    expect(iconNameFor('checkbox')).toBe('square-check');
    expect(iconNameFor('status_list')).toBe('circle-dot');
    expect(iconNameFor('image')).toBe('image');
    expect(iconNameFor('url')).toBe('globe');
  });

  it('separates a single link from a multi link', () => {
    expect(iconNameFor('entity')).toBe('link');
    expect(iconNameFor('multi_entity')).toBe('link-2');
    expect(iconNameFor('entity')).not.toBe(iconNameFor('multi_entity'));
  });

  it('shares one glyph across the numeric types', () => {
    expect(iconNameFor('number')).toBe(iconNameFor('float'));
    expect(iconNameFor('duration')).toBe(iconNameFor('timecode'));
  });

  it('falls back to the document glyph for a type it does not know', () => {
    expect(iconNameFor('sg_not_a_data_type')).toBe(DEFAULT_FIELD_ICON);
    expect(iconNameFor('')).toBe(DEFAULT_FIELD_ICON);
  });

  it('lists every name it can return, once each', () => {
    expect(FIELD_ICON_NAMES).toContain(DEFAULT_FIELD_ICON);
    expect(new Set(FIELD_ICON_NAMES).size).toBe(FIELD_ICON_NAMES.length);
    for (const type of DATA_TYPES) expect(FIELD_ICON_NAMES).toContain(iconNameFor(type));
  });
});
