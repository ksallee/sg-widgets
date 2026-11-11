import { describe, expect, it } from 'vitest';
import { CUSTOM_FIELD_PREFIX, hasNonAscii, predictFieldName } from '../src/field-name.js';

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

  // Measured pairs, findings/117_field_types_and_names, on currency fields.
  it('does not trim surrounding whitespace', () => {
    expect(predictFieldName('  zzprobe 117 spaces  ')).toBe('sg___zzprobe_117_spaces__');
    expect(predictFieldName(' cut ')).toBe('sg__cut_');
  });

  it('keeps every punctuation character as its own underscore', () => {
    expect(predictFieldName('zzprobe 117 a--b..c!!d  e_f')).toBe('sg_zzprobe_117_a__b__c__d__e_f');
    expect(predictFieldName('zzprobe 117 MiXed CASE')).toBe('sg_zzprobe_117_mixed_case');
  });

  it('keeps a leading digit and does not cut a long name', () => {
    expect(predictFieldName('117 zzprobe digit')).toBe('sg_117_zzprobe_digit');
    expect(predictFieldName('3D Pass')).toBe('sg_3d_pass');
    const long = 'zzprobe 117 long ' + 'abcdefghij'.repeat(10) + 'abc';
    expect(long).toHaveLength(120);
    expect(predictFieldName(long)).toHaveLength(123);
    expect(predictFieldName('x'.repeat(300))).toBe(`sg_${'x'.repeat(300)}`);
  });

  it('names a field with a non-ASCII display name after its data type', () => {
    expect(predictFieldName('zzprobe 117 Durée Écran ñ', 'currency')).toBe('sg_currency');
    expect(predictFieldName('zzprobe 117 日本語 поле', 'currency')).toBe('sg_currency');
  });

  // Inferred from the currency measurement: the data type names the field on every type.
  it('names it after any data type it is given', () => {
    expect(predictFieldName('Café', 'text')).toBe('sg_text');
    expect(predictFieldName('a🎬b', 'number')).toBe('sg_number');
    expect(predictFieldName('\u212Aelvin', 'list')).toBe('sg_list');
  });

  it('predicts nothing for a non-ASCII display name without a data type', () => {
    expect(predictFieldName('Café')).toBeNull();
    expect(predictFieldName('日本')).toBeNull();
    expect(predictFieldName('a🎬b')).toBeNull();
    expect(predictFieldName('\u212Aelvin')).toBeNull();
  });

  it('ignores the data type for an ASCII display name', () => {
    expect(predictFieldName('Plate Note', 'text')).toBe('sg_plate_note');
  });

  it('predicts nothing for a blank display name, with or without a data type', () => {
    expect(predictFieldName('   ', 'text')).toBeNull();
  });
});

describe('hasNonAscii', () => {
  it('is true when any character is outside ASCII', () => {
    expect(hasNonAscii('Café')).toBe(true);
    expect(hasNonAscii('a🎬b')).toBe(true);
    expect(hasNonAscii('\u212Aelvin')).toBe(true);
    expect(hasNonAscii('nbsp\u00A0here')).toBe(true);
  });

  it('is false for ASCII, control characters and punctuation included', () => {
    expect(hasNonAscii('zzprobe 117 a--b..c!!d  e_f')).toBe(false);
    expect(hasNonAscii('tab\there~\u007F')).toBe(false);
    expect(hasNonAscii('')).toBe(false);
  });
});
