/**
 * Field data types and their filter vocabularies.
 *
 * Every list here is what a live Flow Production Tracking site answered when a
 * probe sent it an unknown operator: the 400 names the legal set. Source:
 * sg-groundtruth corpus, `findings/field_types/*.md` and `findings/017_filter_operators.md`.
 */

export const DATA_TYPES = [
  'text', 'number', 'float', 'percent', 'duration', 'timecode', 'currency',
  'checkbox', 'date', 'date_time', 'list', 'status_list', 'entity', 'multi_entity',
  'entity_type', 'color', 'image', 'url', 'jsonb', 'serializable', 'uuid',
  'calculated', 'summary', 'password', 'pivot_column', 'footage', 'tag_list',
] as const;

export type DataType = (typeof DATA_TYPES)[number];

export const OPERATORS = [
  'is', 'is_not', 'in', 'not_in',
  'contains', 'not_contains', 'starts_with', 'ends_with',
  'greater_than', 'less_than', 'between',
  'in_last', 'not_in_last', 'in_next', 'not_in_next',
  'in_calendar_day', 'in_calendar_week', 'in_calendar_month', 'in_calendar_year',
  'name_is', 'name_contains', 'name_not_contains', 'type_is', 'type_is_not',
] as const;

export type Operator = (typeof OPERATORS)[number];

export const TIME_UNITS = ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'] as const;
export type TimeUnit = (typeof TIME_UNITS)[number];

const EQUALITY: readonly Operator[] = ['is', 'is_not', 'in', 'not_in'];
const TEXT: readonly Operator[] = ['contains', 'not_contains', 'is', 'is_not', 'starts_with', 'ends_with', 'in', 'not_in'];
const NUMERIC: readonly Operator[] = ['is', 'is_not', 'greater_than', 'less_than', 'between', 'in', 'not_in'];
const TEMPORAL: readonly Operator[] = [
  'is', 'is_not', 'greater_than', 'less_than', 'in_last', 'not_in_last', 'in_next', 'not_in_next',
  'in_calendar_week', 'in_calendar_month', 'in_calendar_day', 'in_calendar_year', 'between', 'in', 'not_in',
];
const LINK: readonly Operator[] = [
  'is', 'is_not', 'name_contains', 'name_not_contains', 'name_is', 'type_is', 'type_is_not', 'in', 'not_in',
];
const NONE: readonly Operator[] = [];

/**
 * Operators each data type accepts in a `_search` filter. An empty list means the
 * type "cannot be used in a filter" and the API 400s on every operator.
 */
export const OPERATORS_BY_TYPE: Readonly<Record<DataType, readonly Operator[]>> = {
  text: TEXT,
  number: NUMERIC,
  float: NUMERIC,
  percent: NUMERIC,
  duration: NUMERIC,
  timecode: NUMERIC,
  currency: NUMERIC,
  footage: NUMERIC,
  checkbox: ['is', 'is_not'],
  date: TEMPORAL,
  date_time: TEMPORAL,
  list: EQUALITY,
  status_list: EQUALITY,
  entity_type: EQUALITY,
  color: EQUALITY,
  uuid: EQUALITY,
  entity: LINK,
  multi_entity: LINK,
  tag_list: LINK,
  image: ['is', 'is_not'],
  jsonb: ['is', 'is_not', 'contains', 'not_contains'],
  url: NONE,
  serializable: NONE,
  calculated: NONE,
  summary: NONE,
  password: NONE,
  pivot_column: NONE,
};

/** Shape of the value an operator expects on the wire. */
export type ValueShape =
  | 'scalar'      // one value of the field's kind, or null
  | 'list'        // a JSON array of scalars (or entity hashes)
  | 'range'       // exactly two scalars, inclusive, order-insensitive
  | 'relative'    // [count, TimeUnit], count positive
  | 'calendar'    // an integer offset: 0 = current, -1 = previous, +1 = next
  | 'string'      // a plain string regardless of field kind (name_*, type_*)
  | 'none';       // e.g. in_calendar_* take an int but no field-typed value

export const VALUE_SHAPE: Readonly<Record<Operator, ValueShape>> = {
  is: 'scalar', is_not: 'scalar',
  in: 'list', not_in: 'list',
  contains: 'scalar', not_contains: 'scalar', starts_with: 'scalar', ends_with: 'scalar',
  greater_than: 'scalar', less_than: 'scalar',
  between: 'range',
  in_last: 'relative', not_in_last: 'relative', in_next: 'relative', not_in_next: 'relative',
  in_calendar_day: 'calendar', in_calendar_week: 'calendar', in_calendar_month: 'calendar', in_calendar_year: 'calendar',
  name_is: 'string', name_contains: 'string', name_not_contains: 'string',
  type_is: 'string', type_is_not: 'string',
};

/**
 * Operators whose result set includes rows where the field is null.
 * `is_not X` is not the complement of `is X` on Flow PT: every negating operator
 * matches unset rows, while comparisons exclude them.
 */
export const NEGATING_OPERATORS: ReadonlySet<Operator> = new Set([
  'is_not', 'not_in', 'not_contains', 'not_in_last', 'not_in_next', 'name_not_contains', 'type_is_not',
]);

export function isDataType(value: string): value is DataType {
  return (DATA_TYPES as readonly string[]).includes(value);
}

export function isOperator(value: string): value is Operator {
  return (OPERATORS as readonly string[]).includes(value);
}

/** Operators legal for a data type. Unknown types get the equality set, the smallest one the API prints. */
export function operatorsFor(dataType: string): readonly Operator[] {
  return isDataType(dataType) ? OPERATORS_BY_TYPE[dataType] : EQUALITY;
}

export function isFilterable(dataType: string): boolean {
  return operatorsFor(dataType).length > 0;
}

export function supportsOperator(dataType: string, operator: Operator): boolean {
  return operatorsFor(dataType).includes(operator);
}

/** Types whose scalar value is a `{type, id}` entity hash. */
export function isLinkType(dataType: string): boolean {
  return dataType === 'entity' || dataType === 'multi_entity' || dataType === 'tag_list';
}

/** Types whose scalar value is a number (integer unless noted). */
export function isNumericType(dataType: string): boolean {
  return ['number', 'float', 'percent', 'duration', 'timecode', 'currency', 'footage'].includes(dataType);
}

export function isTemporalType(dataType: string): boolean {
  return dataType === 'date' || dataType === 'date_time';
}
