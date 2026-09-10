import { describe, expect, it } from 'vitest';
import {
  colorToHex,
  editorKindFor,
  formatNumberInput,
  formatTimecodeFrames,
  fromApiDateTime,
  editorNeedsContext,
  INT32_MAX,
  INT32_MIN,
  isEditableType,
  isParseError,
  isValidListValue,
  numberSteps,
  parseColorInput,
  parseDurationInput,
  parseFloatInput,
  parseInteger,
  parseTextInput,
  parseTimecodeInput,
  parseUrlInput,
  settleStep,
  stepNumber,
  timeZoneName,
  toApiDate,
  toApiDateTime,
  toApiFloat,
  unformatNumberInput,
} from '../src/edit.js';

/** The value of a parse that must have succeeded. */
function ok<T>(result: { value: T } | { error: string }): T {
  if (isParseError(result)) throw new Error(`expected a value, got ${result.error}`);
  return result.value;
}

function err<T>(result: { value: T } | { error: string }): string {
  if (!isParseError(result)) throw new Error(`expected an error, got ${JSON.stringify(result.value)}`);
  return result.error;
}

describe('parseTextInput', () => {
  it('strips both ends and stores an empty string as null', () => {
    // '  padded  ' reads back 'padded' and '   ' reads back None (field_types/text).
    expect(ok(parseTextInput('  padded  '))).toBe('padded');
    expect(ok(parseTextInput('   '))).toBeNull();
    expect(ok(parseTextInput(''))).toBeNull();
  });

  it('keeps newlines and non-ASCII', () => {
    expect(ok(parseTextInput('line1\nline2'))).toBe('line1\nline2');
    expect(ok(parseTextInput('héllo ✨ 漢字'))).toBe('héllo ✨ 漢字');
  });
});

describe('parseInteger', () => {
  it('takes a whole number and clears on empty', () => {
    expect(ok(parseInteger('42'))).toBe(42);
    expect(ok(parseInteger('-7'))).toBe(-7);
    expect(ok(parseInteger('0'))).toBe(0);
    expect(ok(parseInteger(''))).toBeNull();
  });

  it('refuses a decimal rather than rounding it', () => {
    // 3.7 is a 400 with no truncation and no rounding (field_types/number).
    expect(err(parseInteger('3.7'))).toBe('Whole numbers only.');
    expect(err(parseInteger('42abc'))).toBe('Not a number.');
  });

  it('holds the signed 32-bit ceiling', () => {
    // 2**31-1 stores; 2**31 is 400 "integer out of range" (field_types/number).
    expect(ok(parseInteger(String(INT32_MAX)))).toBe(INT32_MAX);
    expect(ok(parseInteger(String(INT32_MIN)))).toBe(INT32_MIN);
    expect(err(parseInteger('2147483648'))).toContain('Out of range');
    expect(err(parseInteger('-2147483649'))).toContain('Out of range');
  });

  it('takes an explicit range for a percent', () => {
    // The 0-100 range is a convention, not a constraint: 101 stores at 200 (field_types/percent).
    expect(ok(parseInteger('50', { min: 0, max: 100 }))).toBe(50);
    expect(err(parseInteger('101', { min: 0, max: 100 }))).toBe('Out of range: 0 to 100.');
  });
});

describe('parseFloatInput', () => {
  it('rounds to the six decimals the store keeps', () => {
    // 1.23456789012345 reads back "1.234568", rounded not truncated (field_types/float).
    expect(ok(parseFloatInput('1.23456789012345'))).toBe(1.234568);
    expect(ok(parseFloatInput('2.5'))).toBe(2.5);
    expect(ok(parseFloatInput(' 4.5 '))).toBe(4.5);
    expect(ok(parseFloatInput('-1.5'))).toBe(-1.5);
  });

  it('underflows to zero the way the store does', () => {
    // 1e-09 stores as "0.0" (field_types/float).
    expect(ok(parseFloatInput('1e-09'))).toBe(0);
  });

  it('refuses what the API refuses and clears on empty', () => {
    expect(err(parseFloatInput('abc'))).toBe('Not a number.');
    expect(ok(parseFloatInput(''))).toBeNull();
  });

  it('honours a tighter precision', () => {
    expect(ok(parseFloatInput('1.777778', { precision: 2 }))).toBe(1.78);
  });
});

describe('toApiFloat', () => {
  it('always carries a decimal point', () => {
    // An Integer is refused on write and inside a filter (field_types/float).
    expect(toApiFloat(2)).toBe('2.0');
    expect(toApiFloat(2.5)).toBe('2.5');
    expect(toApiFloat(0)).toBe('0.0');
    expect(toApiFloat(null)).toBeNull();
  });
});

describe('parseDurationInput', () => {
  it('reads a bare number as minutes', () => {
    // The stored integer is minutes; the stock field is named est_in_mins (field_types/duration).
    expect(ok(parseDurationInput('90'))).toBe(90);
    expect(ok(parseDurationInput('0'))).toBe(0);
    expect(ok(parseDurationInput('-30'))).toBe(-30);
  });

  it('reads hours and minutes', () => {
    expect(ok(parseDurationInput('1h 30m'))).toBe(90);
    expect(ok(parseDurationInput('1h30m'))).toBe(90);
    expect(ok(parseDurationInput('1.5h'))).toBe(90);
    expect(ok(parseDurationInput('2 hours'))).toBe(120);
    expect(ok(parseDurationInput('45min'))).toBe(45);
    expect(ok(parseDurationInput('1:30'))).toBe(90);
  });

  it('scales days by the site working day', () => {
    // hours_per_day comes from GET /preferences; the probed site holds 8.0 (field_types/duration).
    expect(ok(parseDurationInput('2d', { hoursPerDay: 8 }))).toBe(960);
    expect(ok(parseDurationInput('1d', { hoursPerDay: 10 }))).toBe(600);
    expect(ok(parseDurationInput('1d 2h', { hoursPerDay: 8 }))).toBe(600);
  });

  it('rounds to a whole minute', () => {
    // A Float truncates toward zero at 200, so the client rounds first (field_types/duration).
    expect(ok(parseDurationInput('90.6'))).toBe(91);
  });

  it('refuses what it cannot read whole and clears on empty', () => {
    expect(err(parseDurationInput('1h banana'))).toContain('Not a duration');
    expect(err(parseDurationInput('banana'))).toContain('Not a duration');
    expect(ok(parseDurationInput(''))).toBeNull();
  });
});

describe('parseTimecodeInput', () => {
  it('reads a bare number as milliseconds', () => {
    // 1000 renders as one whole second in the server's own grouping (field_types/timecode).
    expect(ok(parseTimecodeInput('3600000'))).toBe(3600000);
    expect(ok(parseTimecodeInput('0'))).toBe(0);
  });

  it('converts HH:MM:SS', () => {
    expect(ok(parseTimecodeInput('01:00:00'))).toBe(3600000);
    expect(ok(parseTimecodeInput('24:00:00'))).toBe(86400000);
    expect(ok(parseTimecodeInput('-01:00:00'))).toBe(-3600000);
  });

  it('converts frames at a given rate', () => {
    // The rate is on neither the schema nor the preferences; solve it per site (field_types/timecode).
    expect(ok(parseTimecodeInput('00:00:01:00', { frameRate: 23.976 }))).toBe(1000);
    expect(ok(parseTimecodeInput('00:00:00:12', { frameRate: 23.976 }))).toBe(501);
    expect(err(parseTimecodeInput('00:00:00:12'))).toBe('Frames need a frame rate.');
    expect(err(parseTimecodeInput('00:00:00:24', { frameRate: 23.976 }))).toContain('Frames run 0 to');
  });

  it('refuses anything else and clears on empty', () => {
    expect(err(parseTimecodeInput('banana'))).toContain('Not a timecode');
    expect(err(parseTimecodeInput('01:00:00;00 extra'))).toContain('Not a timecode');
    expect(ok(parseTimecodeInput(''))).toBeNull();
  });

  it('holds the signed 32-bit ceiling', () => {
    expect(ok(parseTimecodeInput(String(INT32_MAX)))).toBe(INT32_MAX);
    expect(err(parseTimecodeInput('2147483648'))).toContain('Out of range');
  });
});

describe('formatTimecodeFrames', () => {
  it('renders milliseconds the way the server groups them', () => {
    // 500 groups as 00:00:00:12 and 3600000 as 01:00:00:00 (field_types/timecode).
    expect(formatTimecodeFrames(500, 23.976)).toBe('00:00:00:12');
    expect(formatTimecodeFrames(3600000, 23.976)).toBe('01:00:00:00');
    expect(formatTimecodeFrames(86400000, 23.976)).toBe('24:00:00:00');
  });
});

describe('toApiDate', () => {
  it('takes YYYY-MM-DD and nothing else', () => {
    // A timestamp is a 400 on write and as a filter value (field_types/date).
    expect(ok(toApiDate('2026-09-02'))).toBe('2026-09-02');
    expect(err(toApiDate('2026-09-02T13:45:06Z'))).toBe('Not a date. Use YYYY-MM-DD.');
    expect(err(toApiDate('09/07/2026'))).toBe('Not a date. Use YYYY-MM-DD.');
    expect(err(toApiDate('2026-9-8'))).toBe('Not a date. Use YYYY-MM-DD.');
  });

  it('validates the day, not just the shape', () => {
    // 2026-02-30 is rejected by the same message as 'tomorrow' (field_types/date).
    expect(err(toApiDate('2026-02-30'))).toBe('No such day.');
    expect(ok(toApiDate('2024-02-29'))).toBe('2024-02-29');
  });

  it('clears on empty', () => {
    expect(ok(toApiDate(''))).toBeNull();
  });
});

describe('toApiDateTime', () => {
  it('converts local wall clock to the stored UTC string', () => {
    // The store is UTC YYYY-MM-DDTHH:MM:SSZ at second resolution (field_types/date_time).
    expect(ok(toApiDateTime('2026-03-04', '05:06', { timeZone: 'UTC' }))).toBe('2026-03-04T05:06:00Z');
    expect(ok(toApiDateTime('2026-03-04', '05:06:07', { timeZone: 'UTC' }))).toBe('2026-03-04T05:06:07Z');
    // A written offset is not preserved: 05:06:07+05:00 reads back 00:06:07Z (field_types/date_time).
    expect(ok(toApiDateTime('2026-03-04', '05:06:07', { timeZone: 'Asia/Karachi' }))).toBe('2026-03-04T00:06:07Z');
    expect(ok(toApiDateTime('2026-03-04', '05:06:07', { timeZone: 'America/Los_Angeles' }))).toBe(
      '2026-03-04T13:06:07Z',
    );
  });

  it('reads a date with no time as midnight local', () => {
    expect(ok(toApiDateTime('2026-03-04', '', { timeZone: 'UTC' }))).toBe('2026-03-04T00:00:00Z');
    expect(ok(toApiDateTime('2026-03-04', '', { timeZone: 'Asia/Karachi' }))).toBe('2026-03-03T19:00:00Z');
  });

  it('clears when both parts are empty and refuses a lone time', () => {
    // Only null clears a date_time; "" is a 400 (field_types/date_time).
    expect(ok(toApiDateTime('', '', { timeZone: 'UTC' }))).toBeNull();
    expect(err(toApiDateTime('', '05:06', { timeZone: 'UTC' }))).toBe('A time needs a date.');
    expect(err(toApiDateTime('2026-03-04', '25:00', { timeZone: 'UTC' }))).toBe('Not a time. Use HH:MM.');
  });
});

describe('fromApiDateTime', () => {
  it('splits the stored instant into local parts', () => {
    expect(fromApiDateTime('2026-03-04T05:06:07Z', { timeZone: 'UTC' })).toEqual({
      date: '2026-03-04',
      time: '05:06',
      timeWithSeconds: '05:06:07',
    });
    expect(fromApiDateTime('2026-03-04T00:06:07Z', { timeZone: 'Asia/Karachi' })).toEqual({
      date: '2026-03-04',
      time: '05:06',
      timeWithSeconds: '05:06:07',
    });
  });

  it('round-trips through toApiDateTime', () => {
    const local = fromApiDateTime('2026-03-04T13:06:07Z', { timeZone: 'America/Los_Angeles' });
    expect(local).not.toBeNull();
    const back = toApiDateTime(local!.date, local!.timeWithSeconds, { timeZone: 'America/Los_Angeles' });
    expect(ok(back)).toBe('2026-03-04T13:06:07Z');
  });

  it('gives null for an empty or unreadable value', () => {
    expect(fromApiDateTime(null)).toBeNull();
    expect(fromApiDateTime('')).toBeNull();
    expect(fromApiDateTime('not-a-time')).toBeNull();
  });
});

describe('timeZoneName', () => {
  it('names the zone a wall-clock input is read in', () => {
    expect(timeZoneName('Europe/Paris')).toBe('Europe/Paris');
    expect(timeZoneName().length).toBeGreaterThan(0);
  });
});

describe('isValidListValue', () => {
  it('is case-sensitive, as the write is', () => {
    // 'type a' and 'Type A ' are both 400 on write (field_types/list).
    const valid = ['Type A', 'Type B', 'Type C'];
    expect(isValidListValue(valid, 'Type A')).toBe(true);
    expect(isValidListValue(valid, 'type a')).toBe(false);
    expect(isValidListValue(valid, 'Type A ')).toBe(false);
    expect(isValidListValue(undefined, 'Type A')).toBe(false);
  });
});

describe('parseUrlInput', () => {
  it('builds the object write shape', () => {
    // The only accepted input is an object holding url; a bare string 400s (field_types/url).
    expect(ok(parseUrlInput('https://example.com/plate.mov'))).toEqual({ url: 'https://example.com/plate.mov' });
    expect(ok(parseUrlInput('https://example.com/plate.mov', 'plate.mov'))).toEqual({
      url: 'https://example.com/plate.mov',
      name: 'plate.mov',
    });
  });

  it('refuses a raw space', () => {
    // A raw space is the one character measured to fail; percent-encode it (field_types/url).
    expect(err(parseUrlInput('https://example.com/a folder/plate.exr'))).toBe('No spaces in a link. Percent-encode them.');
    expect(ok(parseUrlInput('https://example.com/a%20folder/plate.exr'))).toEqual({
      url: 'https://example.com/a%20folder/plate.exr',
    });
  });

  it('clears on empty and refuses a name with no link', () => {
    expect(ok(parseUrlInput('', ''))).toBeNull();
    expect(err(parseUrlInput('', 'plate.mov'))).toBe('A name needs a link.');
  });
});

describe('parseColorInput', () => {
  it('keeps a decimal triple and drops the spaces the API refuses', () => {
    // "255, 128, 0" is a 400; decimal r,g,b with no spaces is the stored form (field_types/color).
    expect(ok(parseColorInput('255,128,0'))).toBe('255,128,0');
    expect(ok(parseColorInput('255, 128, 0'))).toBe('255,128,0');
  });

  it('converts hex, which the API rejects', () => {
    expect(ok(parseColorInput('#ff8000'))).toBe('255,128,0');
    expect(ok(parseColorInput('ff8000'))).toBe('255,128,0');
    expect(ok(parseColorInput('#f80'))).toBe('255,136,0');
  });

  it('passes the pipeline-step token through', () => {
    // Writing the token is the only way to un-set Task.color; null is a 400 (field_types/color).
    expect(ok(parseColorInput('pipeline_step'))).toBe('pipeline_step');
  });

  it('refuses an out-of-range channel and anything unreadable', () => {
    expect(err(parseColorInput('300,0,0'))).toBe('Each channel runs 0 to 255.');
    expect(err(parseColorInput('255,128'))).toBe('Not a colour. Use r,g,b or a hex code.');
    expect(err(parseColorInput('255,128,0,255'))).toBe('Not a colour. Use r,g,b or a hex code.');
    expect(ok(parseColorInput(''))).toBeNull();
  });
});

describe('colorToHex', () => {
  it('renders a stored triple for a colour input', () => {
    expect(colorToHex('255,128,0')).toBe('#ff8000');
    expect(colorToHex('253,94,99')).toBe('#fd5e63');
  });

  it('gives null for the sentinel and for anything unreadable', () => {
    expect(colorToHex('pipeline_step')).toBeNull();
    expect(colorToHex(null)).toBeNull();
    expect(colorToHex('300,0,0')).toBeNull();
  });
});

describe('editorKindFor', () => {
  it('groups the numeric family under one editor', () => {
    for (const type of ['number', 'float', 'percent', 'duration', 'timecode', 'currency']) {
      expect(editorKindFor(type)).toBe('number');
    }
  });

  it('keeps the rest apart', () => {
    expect(editorKindFor('text')).toBe('text');
    expect(editorKindFor('checkbox')).toBe('checkbox');
    expect(editorKindFor('date')).toBe('date');
    expect(editorKindFor('date_time')).toBe('date_time');
    expect(editorKindFor('list')).toBe('list');
    expect(editorKindFor('url')).toBe('url');
    expect(editorKindFor('color')).toBe('color');
  });

  it('gives the three picker types an editor of their own', () => {
    expect(editorKindFor('status_list')).toBe('status_list');
    expect(editorKindFor('entity')).toBe('entity');
    expect(editorKindFor('multi_entity')).toBe('multi_entity');
    for (const type of ['status_list', 'entity', 'multi_entity']) {
      expect(isEditableType(type)).toBe(true);
      expect(editorNeedsContext(type)).toBe(true);
    }
  });

  it('leaves the read-only types with no editor', () => {
    for (const type of ['image', 'calculated', 'summary', 'pivot_column', 'tag_list', 'jsonb']) {
      expect(editorKindFor(type)).toBe('none');
      expect(isEditableType(type)).toBe(false);
    }
    expect(isEditableType('text')).toBe(true);
  });

  it('asks for a context only where the editor reads the API', () => {
    for (const type of ['text', 'number', 'date', 'list', 'url', 'color', 'checkbox', 'calculated']) {
      expect(editorNeedsContext(type)).toBe(false);
    }
  });
});

describe('numberSteps', () => {
  it('gives each numeric type the step its unit reads in', () => {
    expect(numberSteps('number')).toEqual({ step: 1, min: INT32_MIN, max: INT32_MAX });
    expect(numberSteps('currency')).toEqual({ step: 1 });
    expect(numberSteps('float')).toEqual({ step: 0.1 });
    expect(numberSteps('percent')).toEqual({ step: 1, min: 0, max: 100 });
    expect(numberSteps('duration')).toEqual({ step: 15, min: INT32_MIN, max: INT32_MAX });
  });

  it('steps a timecode one frame when the rate is known, one second when it is not', () => {
    expect(numberSteps('timecode', { frameRate: 25 }).step).toBe(40);
    expect(numberSteps('timecode', { frameRate: 23.976 }).step).toBe(42);
    expect(numberSteps('timecode').step).toBe(1000);
  });
});

describe('stepNumber', () => {
  it('moves one step, and ten or a hundred with a multiplier', () => {
    expect(stepNumber(480, 1, { step: 15 })).toBe(495);
    expect(stepNumber(480, -1, { step: 15 })).toBe(465);
    expect(stepNumber(480, 1, { step: 15, multiplier: 10 })).toBe(630);
    expect(stepNumber(480, -1, { step: 15, multiplier: 100 })).toBe(-1020);
  });

  it('keeps a tenth-sized step off binary noise', () => {
    expect(stepNumber(0.2, 1, { step: 0.1 })).toBe(0.3);
    expect(stepNumber(1.23456, 1, { step: 0.1 })).toBe(1.33456);
  });

  it('clamps at both bounds', () => {
    expect(stepNumber(100, 1, { step: 1, min: 0, max: 100 })).toBe(100);
    expect(stepNumber(0, -1, { step: 1, min: 0, max: 100 })).toBe(0);
    expect(stepNumber(95, 1, { step: 1, min: 0, max: 100, multiplier: 10 })).toBe(100);
  });

  it('lands an empty field on zero before it steps', () => {
    expect(stepNumber(null, 1, { step: 15 })).toBe(0);
    expect(stepNumber(null, -1, { step: 1, min: 0, max: 100 })).toBe(0);
  });
});

describe('settleStep', () => {
  it('rounds where a step landed and clamps it', () => {
    expect(settleStep(0.2, 0.30000000000000004, { step: 0.1 })).toBe(0.3);
    expect(settleStep(50, 150, { step: 1, min: 0, max: 100 })).toBe(100);
    expect(settleStep(null, 0, { step: 1 })).toBe(0);
  });
});

describe('formatNumberInput and unformatNumberInput', () => {
  it('round-trips a grouped number back through the parsers', () => {
    expect(formatNumberInput(12500.5, { locale: 'en-US', decimals: 2 })).toBe('12,500.50');
    expect(unformatNumberInput('12,500.50', 'en-US')).toBe('12500.50');
    expect(ok(parseFloatInput(unformatNumberInput('12,500.50', 'en-US')))).toBe(12500.5);
  });

  it('reads the marks the locale writes', () => {
    expect(formatNumberInput(1001, { locale: 'de-DE' })).toBe('1.001');
    expect(unformatNumberInput('1.234,5', 'de-DE')).toBe('1234.5');
    expect(unformatNumberInput('1 234,5', 'fr-FR')).toBe('1234.5');
  });

  it('drops a comma wherever the locale spells its decimal with a point', () => {
    expect(unformatNumberInput('1,001', 'en-GB')).toBe('1001');
    expect(ok(parseInteger(unformatNumberInput('1,001', 'en-US')))).toBe(1001);
  });
});
