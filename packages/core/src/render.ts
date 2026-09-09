/**
 * Display formatting.
 *
 * Pure functions that turn a raw Flow Production Tracking attribute value into the
 * string a widget shows. No framework, no DOM, no locale guessing beyond `Intl`.
 *
 * Every value shape here is what the API actually returns, taken from the
 * sg-groundtruth corpus (`findings/field_types/<type>.md`); each rule cites its card.
 */
import type { DataType } from './field-types.js';

/**
 * The renderings a value can need. Deliberately small: several data types share a
 * rendering, and the exact number formatting is chosen from the `dataType` itself.
 */
export type RenderKind =
  | 'text'
  | 'number'
  | 'date'
  | 'datetime'
  | 'entity'
  | 'multi_entity'
  | 'status'
  | 'image'
  | 'checkbox'
  | 'url'
  | 'color'
  | 'list'
  | 'empty';

const RENDER_KIND: Readonly<Record<DataType, RenderKind>> = {
  // A plain string in `attributes`; "" is never stored, so null is the only empty (field_types/text).
  text: 'text',
  // Bare integers and decimal strings; `float` arrives quoted (field_types/number, float).
  number: 'number',
  float: 'number',
  percent: 'number',
  duration: 'number',
  timecode: 'number',
  currency: 'number',
  footage: 'number',
  // Two-state, never null (field_types/checkbox).
  checkbox: 'checkbox',
  // "YYYY-MM-DD" with no zone; "YYYY-MM-DDTHH:MM:SSZ" always UTC (field_types/date, date_time).
  date: 'date',
  date_time: 'datetime',
  // One bare string out of `valid_values` (field_types/list).
  list: 'list',
  // A bare code; the label lives in `display_values` (field_types/status_list).
  status_list: 'status',
  // A bare schema type name (field_types/entity_type).
  entity_type: 'text',
  // Decimal "r,g,b", or the sentinel `pipeline_step` (field_types/color).
  color: 'color',
  uuid: 'text',
  // `{type, id, name}` under `relationships`, `name` being `cached_display_name` (field_types/entity).
  entity: 'entity',
  // A list of those, never null (field_types/multi_entity).
  multi_entity: 'multi_entity',
  tag_list: 'multi_entity',
  // A presigned URL string, re-signed on every read (field_types/image).
  image: 'image',
  // An object whose keys depend on `link_type`, or a bare string (field_types/url).
  url: 'url',
  jsonb: 'text',
  serializable: 'text',
  // Live rollups: whatever the site computed, shown as text (field_types/calculated, summary).
  calculated: 'text',
  summary: 'text',
  // A seven-asterisk mask on every row; show it as the text it is (field_types/password).
  password: 'text',
  // No REST implementation at all: null on every row (field_types/pivot_column).
  pivot_column: 'empty',
};

/** The rendering a data type needs. Unknown types fall back to text. */
export function renderKindFor(dataType: string): RenderKind {
  return RENDER_KIND[dataType as DataType] ?? 'text';
}

/**
 * True when there is nothing to show. `0`, `false` and `"0"` are values, not
 * emptiness: a `number` holding 0 is `is_not None` on the server too
 * (field_types/number, percent, duration).
 */
export function isEmptyValue(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

// --- numbers -----------------------------------------------------------------

export interface DurationOptions {
  /**
   * The site's `hours_per_day` from `GET /preferences`. Given, the duration is
   * rendered in days, which is what a site with `duration_units: "days"` expects.
   * The field schema names no unit; only the site does (field_types/duration).
   */
  hoursPerDay?: number;
}

/** A stored duration is a whole number of minutes (field_types/duration). */
export function formatDuration(minutes: number | null | undefined, options: DurationOptions = {}): string {
  if (minutes === null || minutes === undefined || !Number.isFinite(minutes)) return '';
  const sign = minutes < 0 ? '-' : '';
  const abs = Math.abs(minutes);
  const hoursPerDay = options.hoursPerDay;
  if (hoursPerDay !== undefined && hoursPerDay > 0) {
    return `${sign}${trimDecimals((abs / (60 * hoursPerDay)).toFixed(2))}d`;
  }
  const hours = Math.floor(abs / 60);
  const rest = Math.round(abs % 60);
  return `${sign}${hours}:${String(rest).padStart(2, '0')}`;
}

/**
 * A percent is a bare integer on a 0-100 scale, and nothing is clamped: -1 and
 * 1000 both store at 200, so render what is there (field_types/percent).
 */
export function formatPercent(value: number | string | null | undefined): string {
  if (isEmptyValue(value)) return '';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${trimDecimals(String(n))}%`;
}

/**
 * A timecode is milliseconds in a signed 32-bit integer. Nothing wraps at 24
 * hours and negatives are stored, so hours are not clamped either
 * (field_types/timecode). Frames are omitted: no schema or preference names the
 * site's frame rate.
 */
export function formatTimecode(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return '';
  const sign = ms < 0 ? '-' : '';
  const total = Math.floor(Math.abs(ms) / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return `${sign}${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

export interface FloatOptions {
  /** Decimals to keep at most; trailing zeros are dropped. The store itself rounds to 6 (field_types/float). */
  maxDecimals?: number;
  /** Exactly this many decimals, zeros kept. Wins over `maxDecimals`. */
  decimals?: number;
}

/**
 * A float reads back as a JSON *string* rounded to 6 decimals ("25.0"), never a
 * JSON number, so it is formatted from the string to avoid a needless round trip
 * through binary (field_types/float).
 */
export function formatFloat(value: number | string | null | undefined, options: FloatOptions = {}): string {
  if (isEmptyValue(value)) return '';
  const raw = typeof value === 'number' ? String(value) : String(value).trim();
  if (options.decimals !== undefined) {
    const n = Number(raw);
    return Number.isFinite(n) ? n.toFixed(options.decimals) : raw;
  }
  const max = options.maxDecimals;
  if (/^-?\d+(\.\d+)?$/.test(raw)) {
    return trimDecimals(max === undefined ? raw : fixed(raw, max));
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  return trimDecimals(max === undefined ? String(n) : n.toFixed(max));
}

function fixed(raw: string, decimals: number): string {
  const n = Number(raw);
  return Number.isFinite(n) ? n.toFixed(decimals) : raw;
}

/** "25.00" -> "25", "1.500" -> "1.5". Leaves an integer alone. */
function trimDecimals(raw: string): string {
  if (!raw.includes('.')) return raw;
  return raw.replace(/\.?0+$/, '') || '0';
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// --- dates -------------------------------------------------------------------

export interface DateOptions {
  locale?: string | string[];
  /** IANA zone. Defaults to the runtime's, which is what "local" means to a viewer. */
  timeZone?: string;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * A `date` is exactly "YYYY-MM-DD": no time, no zone (field_types/date). It is
 * therefore formatted in UTC whatever the viewer's zone, because shifting a
 * zoneless day into a local zone moves it to the wrong day.
 */
export function formatDate(value: string | null | undefined, options: DateOptions = {}): string {
  if (isEmptyValue(value)) return '';
  const raw = String(value);
  const m = DATE_ONLY.exec(raw);
  if (!m) return raw;
  const ms = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return normalizeSpaces(
    new Intl.DateTimeFormat(options.locale, { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(ms)),
  );
}

/**
 * A `date_time` is always UTC "YYYY-MM-DDTHH:MM:SSZ" at second resolution
 * (field_types/date_time). It is shown in the viewer's zone; keep the raw string
 * as a `title` so the stored instant stays readable.
 */
export function formatDateTime(value: string | null | undefined, options: DateOptions = {}): string {
  if (isEmptyValue(value)) return '';
  const raw = String(value);
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) return raw;
  const format: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' };
  if (options.timeZone !== undefined) format.timeZone = options.timeZone;
  return normalizeSpaces(new Intl.DateTimeFormat(options.locale, format).format(new Date(ms)));
}

/** ICU emits narrow no-break spaces around the day period; collapse them so output is copyable and stable. */
function normalizeSpaces(text: string): string {
  return text.replace(/[\u00a0\u202f\u2009\u2007]/g, ' ');
}

// --- urls, images, colours ---------------------------------------------------

/** The `upload`/`web` and `local` shapes of a `url` field (field_types/url). */
export interface UrlValue {
  url?: string | null;
  name?: string | null;
  content_type?: string | null;
  link_type?: 'upload' | 'web' | 'local' | string;
  local_path_mac?: string | null;
  local_path_linux?: string | null;
  local_path_windows?: string | null;
  relative_path?: string | null;
  type?: string;
  id?: number;
}

/**
 * The last path segment of a URL or path, percent-decoded, with the query
 * dropped. A presigned attachment URL carries the signature in the query and the
 * content hash in the path, so the query is never part of a file name
 * (field_types/url, field_types/image).
 */
export function fileNameFromUrl(url: string | null | undefined): string {
  if (isEmptyValue(url)) return '';
  const raw = String(url).split(/[?#]/)[0] ?? '';
  const segment = raw.split(/[\\/]/).filter(Boolean).pop() ?? '';
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

export type LocalPlatform = 'mac' | 'linux' | 'windows';

/** The platform the current browser reports, for choosing which local path to open. */
export function currentPlatform(): LocalPlatform {
  const p = typeof navigator === 'undefined' ? '' : navigator.platform || navigator.userAgent || '';
  if (/win/i.test(p)) return 'windows';
  if (/mac|iphone|ipad/i.test(p)) return 'mac';
  return 'linux';
}

/** `file:` URL for a local path: a Windows drive path gains a third slash, and every segment is encoded. */
export function fileHref(path: string): string {
  const win = /^[a-zA-Z]:[\\/]/.test(path);
  const normalized = win ? path.replace(/\\/g, '/') : path;
  const encoded = normalized.split('/').map((seg) => encodeURIComponent(seg)).join('/');
  return win ? `file:///${encoded}` : `file://${encoded.startsWith('/') ? '' : '/'}${encoded}`;
}

export interface UrlLinkInfo {
  /** Where to open, or null when nothing can be opened. A local link opens through `file:`. */
  href: string | null;
  label: string;
  /** Present on a `local` link: the path per platform, and the one for the current platform. */
  local?: { mac: string | null; linux: string | null; windows: string | null; path: string | null };
}

/**
 * A displayable link out of a `url` value. Three shapes exist and no fourth:
 * `upload`/`web` (has `url` and `name`), `local` (paths, no `url`), and a bare
 * string (field_types/url). A local link resolves to a `file:` href for the
 * current platform; browsers refuse to follow one from an http page, so an app
 * that opens paths another way rewrites it with its own scheme.
 */
export function urlLink(value: unknown, platform: LocalPlatform = currentPlatform()): UrlLinkInfo | null {
  if (isEmptyValue(value)) return null;
  if (typeof value === 'string') return { href: value, label: fileNameFromUrl(value) || value };
  if (typeof value !== 'object') return null;
  const v = value as UrlValue;
  if (v.link_type === 'local') {
    const mac = v.local_path_mac ?? null;
    const linux = v.local_path_linux ?? null;
    const windows = v.local_path_windows ?? null;
    const path = (platform === 'mac' ? mac : platform === 'windows' ? windows : linux) ?? mac ?? linux ?? windows ?? null;
    const label = v.name ?? fileNameFromUrl(path);
    if (!label && !path) return null;
    return { href: path ? fileHref(path) : null, label: label || fileNameFromUrl(path), local: { mac, linux, windows, path } };
  }
  const href = typeof v.url === 'string' && v.url.length > 0 ? v.url : null;
  const path = v.local_path_mac ?? v.local_path_linux ?? v.local_path_windows ?? v.relative_path ?? null;
  const label = v.name ?? (href ? fileNameFromUrl(href) : fileNameFromUrl(path));
  if (!label && !href) return null;
  return { href, label: label || fileNameFromUrl(href) };
}

/** The prefix Flow PT serves while a thumbnail is still transcoding (field_types/image). */
export const THUMBNAIL_PENDING_PATH = '/images/status/transient/';

/**
 * An `image` value is the only state marker there is: test the transient prefix,
 * never truthiness (field_types/image).
 */
export function imageState(value: string | null | undefined): 'none' | 'pending' | 'ready' {
  if (isEmptyValue(value)) return 'none';
  return String(value).includes(THUMBNAIL_PENDING_PATH) ? 'pending' : 'ready';
}

/**
 * `Task.color` holds this token instead of a colour, meaning "use the colour of
 * my Pipeline Step". Resolve it with a dotted `step.Step.color` read in the same
 * call and keep a client default (field_types/color).
 */
export const COLOR_SENTINEL = 'pipeline_step';

/**
 * Initials for an avatar fallback, from a person's display name. Takes the first
 * letter of the first and last word, so "Kevin Sallee" is KS and "Kevin van der
 * Meer" is KM. A single word gives one letter; a `login` such as `k.sallee` is
 * split on its punctuation too.
 */
export function initialsOf(name: string | null | undefined, max = 2): string {
  if (isEmptyValue(name)) return '';
  const words = String(name)
    .split(/[\s._\-,]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 0);
  if (words.length === 0) return '';
  const first = words[0] ?? '';
  const letters = words.length === 1 || max < 2 ? [first] : [first, words[words.length - 1] ?? ''];
  return letters
    .map((w) => [...w][0] ?? '')
    .join('')
    .toUpperCase()
    .slice(0, max);
}
