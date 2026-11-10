import { describe, expect, it } from 'vitest';
import { CUSTOM_FIELD_PREFIX, predictFieldName } from '../src/field-name.js';

describe('predictFieldName', () => {
  it('is the custom-field prefix', () => {
    expect(CUSTOM_FIELD_PREFIX).toBe('sg_');
  });

  // Measured pairs, findings/019_create_fields.
  it('lowercases and turns each non-alphanumeric character into one underscore', () => {
    expect(predictFieldName('zzprobe 019 With (Parens)')).toBe('sg_zzprobe_019_with__parens_');
  });

  it('doubles a prefix the display name already carries', () => {
    expect(predictFieldName('sg_zzprobe_019_already_prefixed')).toBe('sg_sg_zzprobe_019_already_prefixed');
  });

  it('names the first field of a display name, not its _1 duplicate', () => {
    expect(predictFieldName('zzprobe 019 collide')).toBe('sg_zzprobe_019_collide');
    expect(predictFieldName('my field')).toBe('sg_my_field');
  });

  it('keeps runs of punctuation and edge underscores', () => {
    expect(predictFieldName('a -- b!')).toBe('sg_a____b_');
    expect(predictFieldName('(x)')).toBe('sg__x_');
  });

  it('doubles the prefix whatever its case', () => {
    expect(predictFieldName('SG_Shot Code')).toBe('sg_sg_shot_code');
  });

  it('predicts nothing for a blank display name', () => {
    expect(predictFieldName('')).toBeNull();
    expect(predictFieldName('   ')).toBeNull();
    expect(predictFieldName('\t\n')).toBeNull();
  });

  // Unmeasured: the literal reading of the measured rule.
  it('does not trim surrounding whitespace', () => {
    expect(predictFieldName(' cut ')).toBe('sg__cut_');
  });

  it('treats only ASCII letters and digits as alphanumeric, one underscore per code point', () => {
    expect(predictFieldName('Café')).toBe('sg_caf_');
    expect(predictFieldName('日本')).toBe('sg___');
    expect(predictFieldName('a🎬b')).toBe('sg_a_b');
    expect(predictFieldName('Kelvin')).toBe('sg__elvin');
  });

  it('keeps a leading digit and does not cut a long name', () => {
    expect(predictFieldName('3D Pass')).toBe('sg_3d_pass');
    const long = 'x'.repeat(300);
    expect(predictFieldName(long)).toBe(`sg_${long}`);
  });
});
