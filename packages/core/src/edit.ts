/**
 * Input parsing and write serialisation.
 *
 * Pure functions that turn what a person typed into the value Flow Production
 * Tracking accepts on a write, or say why it cannot. Every accepted and rejected
 * shape here was measured against a live site; each rule cites its card in the
 * sg-groundtruth corpus (`findings/field_types/<type>.md`).
 *
 * A parse either yields a value or an error. It never throws and never guesses:
 * an editor that gets an error emits nothing and shows the message.
 */
import { COLOR_SENTINEL, formatTimecode } from './render.js';
import type { TimecodeOptions } from './render.js';


/** A parsed value, or the reason the input was refused. */
export type ParseResult<T> = { value: T } | { error: string };

export function isParseError<T>(result: ParseResult<T>): result is { error: string } {
  return 'error' in result;
}

/**
 * The column behind `number`, `percent`, `duration` and `timecode` is a signed
 * 32-bit integer; one past either end is a 400 (field_types/number, percent,
 * timecode).
 */
export const INT32_MIN = -2147483648;
export const INT32_MAX = 2147483647;

/** Decimals a `float` keeps. Rounding happens on write, at 200 and without warning (field_types/float). */
export const FLOAT_PRECISION = 6;

const OUT_OF_RANGE = `Out of range: whole numbers from ${INT32_MIN} to ${INT32_MAX}.`;

// --- text --------------------------------------------------------------------

/**
 * Free text. Both ends are stripped on write and an empty string is stored as
 * null, so there is no "set but blank" state to preserve (field_types/text).
 */
export function parseTextInput(raw: string): ParseResult<string | null> {
  const trimmed = raw.trim();
  return { value: trimmed.length === 0 ? null : trimmed };
}

// --- numbers -----------------------------------------------------------------

export interface IntegerOptions {
  min?: number;
  max?: number;
}

/**
 * A whole number for `number`, `percent` and `timecode`. A decimal is refused
 * rather than rounded, matching the API: `number` and `percent` 400 on a Float
 * and `timecode` takes `[Integer, NilClass]` alone (field_types/number, percent,
 * timecode). Empty input clears the field.
 */
export function parseInteger(raw: string, options: IntegerOptions = {}): ParseResult<number | null> {
  const text = raw.trim();
  if (text.length === 0) return { value: null };
  if (!/^[+-]?\d+$/.test(text)) {
    return { error: /^[+-]?\d*\.\d*$/.test(text) ? 'Whole numbers only.' : 'Not a number.' };
  }
  const n = Number(text);
  const min = options.min ?? INT32_MIN;
  const max = options.max ?? INT32_MAX;
  if (!Number.isSafeInteger(n)) return { error: OUT_OF_RANGE };
  if (n < min || n > max) {
    return { error: min === INT32_MIN && max === INT32_MAX ? OUT_OF_RANGE : `Out of range: ${min} to ${max}.` };
  }
  return { value: n };
}

export interface FloatParseOptions {
  /** Decimals to keep. Defaults to the six the store itself keeps (field_types/float). */
  precision?: number;
}

/**
 * A decimal for `float`. The store rounds to six decimals on write, so the parse
 * rounds too and the value a caller emits is the value that comes back
 * (field_types/float). Empty input clears the field.
 */
export function parseFloatInput(raw: string, options: FloatParseOptions = {}): ParseResult<number | null> {
  const text = raw.trim();
  if (text.length === 0) return { value: null };
  if (!/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(text)) return { error: 'Not a number.' };
  const n = Number(text);
  if (!Number.isFinite(n)) return { error: 'Not a number.' };
  const precision = options.precision ?? FLOAT_PRECISION;
  return { value: round(n, precision) };
}

function round(n: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/**
 * The wire form of a float. An Integer is refused on write and inside a filter,
 * so a whole value has to carry a decimal point; JSON has no way to write one, so
 * the value goes as the numeric string the API also accepts (field_types/float).
 */
export function toApiFloat(value: number | null): string | null {
  if (value === null || !Number.isFinite(value)) return null;
  const text = String(value);
  return text.includes('.') || text.includes('e') || text.includes('E') ? text : `${text}.0`;
}

export interface DurationParseOptions {
  /** The site's `hours_per_day` from `GET /preferences`, for the `d` unit. Default 8. */
  hoursPerDay?: number;
}

const DURATION_PART = /([+-]?\d+(?:\.\d+)?)\s*(days?|d|hours?|hrs?|h|minutes?|mins?|m)(?![\p{L}])/giu;

/**
 * A duration, in whole minutes.
 *
 * The stored integer is minutes and no schema names the unit, so the accepted
 * spellings are the client's own: a bare number is minutes, `1h 30m`, `1.5h` and
 * `2d` scale by the site's working day, and `1:30` is hours and minutes. The API
 * itself takes only something that parses as a number, so `"1h 30m"` never leaves
 * this function (field_types/duration).
 */
export function parseDurationInput(raw: string, options: DurationParseOptions = {}): ParseResult<number | null> {
  const text = raw.trim();
  if (text.length === 0) return { value: null };
  const hoursPerDay = options.hoursPerDay ?? 8;

  const clock = /^([+-]?)(\d+):([0-5]?\d)$/.exec(text);
  if (clock) {
    const sign = clock[1] === '-' ? -1 : 1;
    return bounded(sign * (Number(clock[2]) * 60 + Number(clock[3])));
  }

  if (/^[+-]?(\d+(\.\d*)?|\.\d+)$/.test(text)) return bounded(Math.round(Number(text)));

  // Spacing is free: `1h 30m` and `1h30m` are the same input.
  const compact = text.replace(/\s+/gu, '');
  let minutes = 0;
  let consumed = 0;
  DURATION_PART.lastIndex = 0;
  for (let m = DURATION_PART.exec(compact); m !== null; m = DURATION_PART.exec(compact)) {
    const amount = Number(m[1]);
    const unit = (m[2] ?? '').toLowerCase()[0];
    minutes += amount * (unit === 'd' ? 60 * hoursPerDay : unit === 'h' ? 60 : 1);
    consumed += m[0].length;
  }
  // Every character has to belong to a part, so `1h banana` is refused rather than read as 1h.
  if (consumed === 0 || consumed !== compact.length) {
    return { error: 'Not a duration. Try 90, 1h 30m, 1.5h or 2d.' };
  }
  return bounded(Math.round(minutes));
}

function bounded(minutes: number): ParseResult<number> {
  if (minutes < INT32_MIN || minutes > INT32_MAX) return { error: OUT_OF_RANGE };
  return { value: minutes };
}

const TIMECODE = /^([+-]?)(\d+):([0-5]\d):([0-5]\d)(?:[:;](\d+))?$/;

/**
 * A timecode, in milliseconds.
 *
 * The stored integer is milliseconds: `1000` renders as one whole second in the
 * server's own `_summarize` grouping. The field rejects every timecode string,
 * including the drop-frame spelling, so the conversion is the client's
 * (field_types/timecode). Empty input clears the field.
 */
export function parseTimecodeInput(raw: string, options: TimecodeOptions = {}): ParseResult<number | null> {
  const text = raw.trim();
  if (text.length === 0) return { value: null };

  if (/^[+-]?\d+$/.test(text)) return parseInteger(text);

  const m = TIMECODE.exec(text);
  if (!m) return { error: 'Not a timecode. Try HH:MM:SS, HH:MM:SS:FF or milliseconds.' };
  const sign = m[1] === '-' ? -1 : 1;
  let ms = (Number(m[2]) * 3600 + Number(m[3]) * 60 + Number(m[4])) * 1000;
  const frames = m[5];
  if (frames !== undefined) {
    const rate = options.frameRate;
    if (rate === undefined || !(rate > 0)) return { error: 'Frames need a frame rate.' };
    const f = Number(frames);
    if (f >= rate) return { error: `Frames run 0 to ${Math.ceil(rate) - 1} at ${rate} fps.` };
    ms += Math.round((f / rate) * 1000);
  }
  const total = sign * ms;
  if (total < INT32_MIN || total > INT32_MAX) return { error: OUT_OF_RANGE };
  return { value: total };
}

/** Milliseconds as `HH:MM:SS:FF`, for putting a stored timecode back in an input. */
export function formatTimecodeFrames(ms: number, frameRate: number): string {
  return formatTimecode(ms, { frameRate });
}

// --- stepping ----------------------------------------------------------------

/** The bounds and the amount one step moves, for one numeric data type. */
export interface NumberSteps {
  step: number;
  min?: number;
  max?: number;
}

export interface NumberStepsOptions {
  /** Frames per second. A timecode steps one frame when it is known, one second when it is not. */
  frameRate?: number;
}

/**
 * The step and the bounds a numeric data type takes when the caller names none.
 *
 * A percent runs 0 to 100 because that is the scale it is read on; the column
 * itself clamps nothing, so a caller with out-of-scale data widens the bounds
 * (field_types/percent). A duration steps a quarter of an hour, a timecode one
 * frame, and a float a tenth.
 */
export function numberSteps(dataType: string, options: NumberStepsOptions = {}): NumberSteps {
  switch (dataType) {
    case 'percent':
      return { step: 1, min: 0, max: 100 };
    case 'float':
      return { step: 0.1 };
    case 'currency':
      return { step: 1 };
    case 'duration':
      return { step: 15, min: INT32_MIN, max: INT32_MAX };
    case 'timecode': {
      const rate = options.frameRate;
      const frame = rate !== undefined && rate > 0 ? Math.max(1, Math.round(1000 / rate)) : 1000;
      return { step: frame, min: INT32_MIN, max: INT32_MAX };
    }
    default:
      return { step: 1, min: INT32_MIN, max: INT32_MAX };
  }
}

export interface StepOptions {
  step: number;
  /** Steps taken at once: ten with Shift, a hundred with Page Up and Page Down. */
  multiplier?: number;
  min?: number;
  max?: number;
}

/** Decimals a number is written with, capped at the six a float keeps. */
function decimalsOf(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const text = String(n);
  if (text.includes('e') || text.includes('E')) return FLOAT_PRECISION;
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : Math.min(FLOAT_PRECISION, text.length - dot - 1);
}

/**
 * Where a step lands: rounded to the decimals the step and the starting value
 * carry, then clamped. The rounding is what keeps a tenth-sized step off
 * `0.30000000000000004`.
 */
export function settleStep(from: number | null, to: number, options: StepOptions): number {
  const decimals = Math.max(decimalsOf(options.step), from === null ? 0 : decimalsOf(from));
  const settled = round(to, decimals);
  const min = options.min ?? Number.NEGATIVE_INFINITY;
  const max = options.max ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, settled));
}

/** The value one step away. An empty field lands on zero first, then steps. */
export function stepNumber(from: number | null, direction: 1 | -1, options: StepOptions): number {
  if (from === null) return settleStep(null, 0, options);
  return settleStep(from, from + options.step * (options.multiplier ?? 1) * direction, options);
}

// --- locale numbers ----------------------------------------------------------

export interface NumberInputFormat {
  locale?: string;
  /** Exactly this many decimals, zeros kept. */
  decimals?: number;
}

/** A number written the way the locale writes it, for putting a stored value back in an input. */
export function formatNumberInput(value: number, options: NumberInputFormat = {}): string {
  if (!Number.isFinite(value)) return '';
  const decimals = options.decimals;
  return new Intl.NumberFormat(options.locale, {
    useGrouping: true,
    ...(decimals === undefined
      ? { maximumFractionDigits: FLOAT_PRECISION }
      : { minimumFractionDigits: decimals, maximumFractionDigits: decimals }),
  }).format(value);
}

/**
 * The digits behind a locale-formatted number: spacing and group marks dropped,
 * the decimal mark turned into a point, so the parsers above read back what the
 * formatter wrote. A comma is a group mark in every locale that does not spell
 * its decimal with one.
 */
export function unformatNumberInput(raw: string, locale?: string): string {
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  const group = parts.find((part) => part.type === 'group')?.value ?? ',';
  const decimal = parts.find((part) => part.type === 'decimal')?.value ?? '.';
  let text = raw.replace(/[\s\u00a0\u202f]/gu, '');
  text = text.split(group).join('');
  if (decimal !== ',') text = text.split(',').join('');
  if (decimal !== '.') text = text.split(decimal).join('.');
  return text;
}

// --- dates -------------------------------------------------------------------

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_ONLY = /^(\d{1,2}):([0-5]\d)(?::([0-5]\d))?$/;

/**
 * A calendar date as `YYYY-MM-DD`, with no time and no zone. The API validates
 * the date rather than only parsing it, and refuses every timestamp
 * (field_types/date). Empty input clears the field.
 */
export function toApiDate(raw: string): ParseResult<string | null> {
  const text = raw.trim();
  if (text.length === 0) return { value: null };
  const m = DATE_ONLY.exec(text);
  if (!m) return { error: 'Not a date. Use YYYY-MM-DD.' };
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() !== month - 1 || probe.getUTCDate() !== day) {
    return { error: 'No such day.' };
  }
  return { value: text };
}

export interface DateTimeOptions {
  /** IANA zone the typed wall-clock time is read in. Defaults to the runtime's. */
  timeZone?: string;
}

/**
 * A local wall-clock date and time as the UTC `YYYY-MM-DDTHH:MM:SSZ` the field
 * stores. A written offset is normalised away and a zoneless string is taken as
 * UTC, so the conversion has to happen here or the instant is wrong
 * (field_types/date_time). Both parts empty clears the field; a date with no time
 * is midnight local.
 */
export function toApiDateTime(date: string, time: string, options: DateTimeOptions = {}): ParseResult<string | null> {
  const day = date.trim();
  const clock = time.trim();
  if (day.length === 0 && clock.length === 0) return { value: null };
  const parsedDay = toApiDate(day);
  if (isParseError(parsedDay)) return parsedDay;
  if (parsedDay.value === null) return { error: 'A time needs a date.' };

  let hours = 0;
  let minutes = 0;
  let seconds = 0;
  if (clock.length > 0) {
    const m = TIME_ONLY.exec(clock);
    if (!m) return { error: 'Not a time. Use HH:MM.' };
    hours = Number(m[1]);
    minutes = Number(m[2]);
    seconds = m[3] === undefined ? 0 : Number(m[3]);
    if (hours > 23) return { error: 'Not a time. Use HH:MM.' };
  }
  const dm = DATE_ONLY.exec(parsedDay.value) as RegExpExecArray;
  const utc = zonedToUtc(
    { year: Number(dm[1]), month: Number(dm[2]), day: Number(dm[3]), hours, minutes, seconds },
    options.timeZone,
  );
  return { value: `${utc}Z` };
}

export interface LocalDateTime {
  /** `YYYY-MM-DD` in the given zone. */
  date: string;
  /** `HH:MM` in the given zone. */
  time: string;
  /** `HH:MM:SS` in the given zone, for a value whose seconds matter. */
  timeWithSeconds: string;
}

/**
 * The stored UTC instant as local wall-clock parts, for putting back in a date
 * and a time input. The store is second-resolution UTC with a literal `Z`
 * (field_types/date_time).
 */
export function fromApiDateTime(value: string | null | undefined, options: DateTimeOptions = {}): LocalDateTime | null {
  if (value === null || value === undefined || String(value).trim().length === 0) return null;
  const ms = Date.parse(String(value));
  if (Number.isNaN(ms)) return null;
  const parts = zoneParts(new Date(ms), options.timeZone);
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return {
    date: `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`,
    time: `${pad(parts.hours)}:${pad(parts.minutes)}`,
    timeWithSeconds: `${pad(parts.hours)}:${pad(parts.minutes)}:${pad(parts.seconds)}`,
  };
}

/** The zone a wall-clock input is read in, named for the line under a date-time field. */
export function timeZoneName(timeZone?: string): string {
  if (timeZone !== undefined) return timeZone;
  try {
    return new Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Wall-clock fields of an instant in a zone. */
function zoneParts(date: Date, timeZone?: string): WallClock {
  const format: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  };
  if (timeZone !== undefined) format.timeZone = timeZone;
  const parts = new Intl.DateTimeFormat('en-US', format).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? '0');
  // ICU spells midnight as hour 24 under hour12:false; the day is already the right one.
  const hours = get('hour') % 24;
  return { year: get('year'), month: get('month'), day: get('day'), hours, minutes: get('minute'), seconds: get('second') };
}

/**
 * A wall-clock time in a zone as the UTC `YYYY-MM-DDTHH:MM:SS` of the same
 * instant. Two passes: the offset is read back from the first guess, which
 * settles every zone but the hour a DST jump repeats or skips.
 */
function zonedToUtc(local: WallClock, timeZone?: string): string {
  const target = Date.UTC(local.year, local.month - 1, local.day, local.hours, local.minutes, local.seconds);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const seen = zoneParts(new Date(guess), timeZone);
    const seenUtc = Date.UTC(seen.year, seen.month - 1, seen.day, seen.hours, seen.minutes, seen.seconds);
    const drift = target - seenUtc;
    if (drift === 0) break;
    guess += drift;
  }
  return new Date(guess).toISOString().slice(0, 19);
}

// --- list --------------------------------------------------------------------

/**
 * A value is legal only if it is in `valid_values`, byte for byte: a write is
 * case-sensitive and a trailing space is a 400, while a filter on the same string
 * matches (field_types/list).
 */
export function isValidListValue(validValues: readonly string[] | undefined, value: string): boolean {
  return (validValues ?? []).includes(value);
}

// --- url ---------------------------------------------------------------------

/** The web-link write shape: an object holding `url`, optionally `name` (field_types/url). */
export interface UrlWriteValue {
  url: string;
  name?: string;
}

/**
 * A web link for a `url` field. The only accepted input is an object holding
 * `url`: a bare string 400s, `{}` 400s, and the url itself is validated, a raw
 * space being the one character measured to fail. With no `name` the field reads
 * back the whole url as its name (field_types/url).
 */
export function parseUrlInput(url: string, name = ''): ParseResult<UrlWriteValue | null> {
  const href = url.trim();
  const label = name.trim();
  if (href.length === 0) return label.length === 0 ? { value: null } : { error: 'A name needs a link.' };
  if (/\s/u.test(href)) return { error: 'No spaces in a link. Percent-encode them.' };
  return { value: label.length === 0 ? { url: href } : { url: href, name: label } };
}

// --- colour ------------------------------------------------------------------

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i;
const TRIPLE = /^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/;

/**
 * A colour as the decimal `r,g,b` the field stores, with no spaces and no `#`.
 * Hex is rejected on write, so it is converted here; spaces inside the triple are
 * rejected too, so they are stripped (field_types/color). The pipeline-step token
 * passes through.
 */
export function parseColorInput(raw: string): ParseResult<string | null> {
  const text = raw.trim();
  if (text.length === 0) return { value: null };
  if (text.toLowerCase() === COLOR_SENTINEL) return { value: COLOR_SENTINEL };

  const hex = HEX.exec(text);
  if (hex) {
    const digits = hex[1] as string;
    const full = digits.length === 3 ? [...digits].map((d) => d + d).join('') : digits;
    const channels = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
    return { value: channels.join(',') };
  }

  const triple = TRIPLE.exec(text);
  if (!triple) return { error: 'Not a colour. Use r,g,b or a hex code.' };
  const channels = [Number(triple[1]), Number(triple[2]), Number(triple[3])];
  if (channels.some((n) => n > 255)) return { error: 'Each channel runs 0 to 255.' };
  return { value: channels.join(',') };
}

/** A stored `r,g,b` as `#rrggbb`, for a colour input. Null for the sentinel and for anything else. */
export function colorToHex(value: string | null | undefined): string | null {
  if (!value || value === COLOR_SENTINEL) return null;
  const triple = TRIPLE.exec(String(value).trim());
  if (!triple) return null;
  const channels = [Number(triple[1]), Number(triple[2]), Number(triple[3])];
  if (channels.some((n) => n > 255)) return null;
  return `#${channels.map((n) => n.toString(16).padStart(2, '0')).join('')}`;
}

// --- dispatch ----------------------------------------------------------------

/** The editor a data type needs. `none` means the type has no editor here. */
export type EditorKind =
  | 'text'
  | 'number'
  | 'checkbox'
  | 'date'
  | 'date_time'
  | 'list'
  | 'url'
  | 'color'
  | 'status_list'
  | 'entity'
  | 'multi_entity'
  | 'none';

const EDITOR_KIND: Readonly<Record<string, EditorKind>> = {
  text: 'text',
  entity_type: 'text',
  uuid: 'text',
  number: 'number',
  float: 'number',
  percent: 'number',
  duration: 'number',
  timecode: 'number',
  currency: 'number',
  footage: 'number',
  checkbox: 'checkbox',
  date: 'date',
  date_time: 'date_time',
  list: 'list',
  url: 'url',
  color: 'color',
  status_list: 'status_list',
  entity: 'entity',
  multi_entity: 'multi_entity',
};

/**
 * The editor for a data type. The read-only types and the ones REST cannot write
 * have no editor at all (field_types/calculated, summary, pivot_column).
 */
export function editorKindFor(dataType: string): EditorKind {
  return EDITOR_KIND[dataType] ?? 'none';
}

/** The three kinds a picker widget owns; each needs a context to read through. */
const PICKER_KINDS: ReadonlySet<EditorKind> = new Set<EditorKind>(['status_list', 'entity', 'multi_entity']);

/**
 * True when the editor for a data type reads the API, so the caller has to hand it
 * a context. A status picker reads the schema and the Status table; an entity
 * picker searches.
 */
export function editorNeedsContext(dataType: string): boolean {
  return PICKER_KINDS.has(editorKindFor(dataType));
}

/** True when a data type can be edited by one of these widgets. */
export function isEditableType(dataType: string): boolean {
  return editorKindFor(dataType) !== 'none';
}

/** Where a cell's editor opens: in the cell, or in a popover anchored to it. */
export type EditorPlacement = 'inline' | 'popover';

/**
 * Kinds that stay in the cell. A checkbox is one press, and a status, a list or a
 * single entity opens a popup of its own, so a second surface around them adds
 * nothing.
 */
const INLINE_KINDS: ReadonlySet<EditorKind> = new Set<EditorKind>([
  'checkbox',
  'status_list',
  'entity',
  'list',
  'none',
]);

/**
 * Where the editor for a data type opens when the caller names no placement.
 * Everything typed into, and the multi-entity picker, takes the room a popover
 * has; the rest stays in the cell.
 */
export function editorPlacementFor(dataType: string): EditorPlacement {
  return INLINE_KINDS.has(editorKindFor(dataType)) ? 'inline' : 'popover';
}
