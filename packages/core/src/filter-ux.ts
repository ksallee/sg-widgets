/**
 * Filter vocabulary, in human wording.
 *
 * `field-types.ts` holds what the API accepts; this holds what a filter editor
 * shows. The two are not one list: `is null` and `is` are the same operator to
 * the API and two different menu entries to a person, and `in_calendar_week 0`
 * reads as "this week". An `OperatorPreset` is one menu entry, and it always
 * names the raw operator it serialises to, so nothing here invents wire
 * behaviour.
 *
 * Operator legality per type comes from the corpus (`findings/017_filter_operators.md`
 * and `findings/field_types/*`) through `operatorsFor`.
 */
import type { ConditionValue, FilterCondition, FilterGroup, FilterNode, Scalar } from './filter.js';
import { condition as makeCondition, group as makeGroup, isBlankCondition } from './filter.js';
import type { DataType, Operator, TimeUnit, ValueShape } from './field-types.js';
import {
  isFilterable,
  isLinkType,
  isNumericType,
  isOperator,
  isTemporalType,
  operatorsFor,
  supportsOperator,
  TIME_UNITS,
  VALUE_SHAPE,
} from './field-types.js';
import type { EntityRow } from './client.js';
import type { FieldSchema } from './schema.js';

/* -------------------------------------------------------------------------- */
/* labels                                                                     */
/* -------------------------------------------------------------------------- */

/** One label per raw operator, for a type that has no wording of its own. */
export const OPERATOR_LABELS: Readonly<Record<Operator, string>> = {
  is: 'is',
  is_not: 'is not',
  in: 'is any of',
  not_in: 'is none of',
  contains: 'contains',
  not_contains: 'does not contain',
  starts_with: 'starts with',
  ends_with: 'ends with',
  greater_than: 'greater than',
  less_than: 'less than',
  between: 'between',
  in_last: 'in the last',
  not_in_last: 'not in the last',
  in_next: 'in the next',
  not_in_next: 'not in the next',
  in_calendar_day: 'in the calendar day',
  in_calendar_week: 'in the calendar week',
  in_calendar_month: 'in the calendar month',
  in_calendar_year: 'in the calendar year',
  name_is: 'name is',
  name_contains: 'name contains',
  name_not_contains: 'name does not contain',
  type_is: 'type is',
  type_is_not: 'type is not',
};

/** Comparison reads as time on a date and as size on a number. */
const TEMPORAL_LABELS: Partial<Record<Operator, string>> = {
  greater_than: 'after',
  less_than: 'before',
};

/** The label a data type puts on an operator. */
export function operatorLabel(operator: Operator, dataType?: string): string {
  if (dataType && isTemporalType(dataType)) {
    const temporal = TEMPORAL_LABELS[operator];
    if (temporal) return temporal;
  }
  return OPERATOR_LABELS[operator] ?? operator;
}

/** Singular and plural wording for a relative-date unit. */
export const TIME_UNIT_LABELS: Readonly<Record<TimeUnit, [string, string]>> = {
  HOUR: ['hour', 'hours'],
  DAY: ['day', 'days'],
  WEEK: ['week', 'weeks'],
  MONTH: ['month', 'months'],
  YEAR: ['year', 'years'],
};

export function timeUnitLabel(unit: TimeUnit, count = 1): string {
  const pair = TIME_UNIT_LABELS[unit];
  return pair ? (count === 1 ? pair[0] : pair[1]) : String(unit).toLowerCase();
}

/* -------------------------------------------------------------------------- */
/* presets                                                                    */
/* -------------------------------------------------------------------------- */

/** How a row edits the value of a preset. */
export type PresetInput =
  | 'none' // the preset pins the value; the row shows no editor
  | 'scalar'
  | 'list'
  | 'range'
  | 'relative'
  | 'string';

/**
 * One entry of the operator menu.
 *
 * `operator` and, for a pinned preset, `value` are what serialisation sends;
 * everything else is wording. A preset whose `id` equals its `operator` is the
 * plain operator with no UX layer on it.
 */
export interface OperatorPreset {
  id: string;
  label: string;
  operator: Operator;
  input: PresetInput;
  /** The value the preset pins. Present only when `input` is `none`. */
  value?: ConditionValue;
}

/** A named run of the operator menu. */
export interface OperatorGroup {
  label: string;
  presets: OperatorPreset[];
}

/**
 * The value "is empty" sends on a type, or `undefined` when the type has no
 * empty test at all.
 *
 * `null` is the spelling on every filterable type but two: uuid takes `""` and
 * 400s on null, and a checkbox is two-state, never null, and 400s on both
 * (field_types/uuid, field_types/checkbox).
 */
export function emptyValueFor(dataType: string): '' | null | undefined {
  if (!isFilterable(dataType) || !supportsOperator(dataType, 'is')) return undefined;
  if (dataType === 'checkbox') return undefined;
  return dataType === 'uuid' ? '' : null;
}

export function supportsEmpty(dataType: string): boolean {
  return emptyValueFor(dataType) !== undefined;
}

/**
 * The calendar bucket a date sits in, named. The offset is a bare signed integer
 * relative to today: `0` is the bucket today falls in, `-1` the one before it and
 * `+1` the one after (field_types/date).
 */
const CALENDAR_PRESETS: ReadonlyArray<{ id: string; label: string; operator: Operator; offset: number }> = [
  { id: 'today', label: 'today', operator: 'in_calendar_day', offset: 0 },
  { id: 'yesterday', label: 'yesterday', operator: 'in_calendar_day', offset: -1 },
  { id: 'tomorrow', label: 'tomorrow', operator: 'in_calendar_day', offset: 1 },
  { id: 'this_week', label: 'this week', operator: 'in_calendar_week', offset: 0 },
  { id: 'last_week', label: 'last week', operator: 'in_calendar_week', offset: -1 },
  { id: 'next_week', label: 'next week', operator: 'in_calendar_week', offset: 1 },
  { id: 'this_month', label: 'this month', operator: 'in_calendar_month', offset: 0 },
  { id: 'last_month', label: 'last month', operator: 'in_calendar_month', offset: -1 },
  { id: 'next_month', label: 'next month', operator: 'in_calendar_month', offset: 1 },
  { id: 'this_year', label: 'this year', operator: 'in_calendar_year', offset: 0 },
  { id: 'last_year', label: 'last year', operator: 'in_calendar_year', offset: -1 },
  { id: 'next_year', label: 'next year', operator: 'in_calendar_year', offset: 1 },
];

/** The editor a value shape needs. */
function inputFor(shape: ValueShape): PresetInput {
  switch (shape) {
    case 'list':
      return 'list';
    case 'range':
      return 'range';
    case 'relative':
      return 'relative';
    case 'string':
      return 'string';
    case 'calendar':
    case 'none':
      return 'none';
    default:
      return 'scalar';
  }
}

function plainPreset(operator: Operator, dataType: string): OperatorPreset {
  return {
    id: operator,
    label: operatorLabel(operator, dataType),
    operator,
    input: inputFor(VALUE_SHAPE[operator]),
  };
}

/**
 * The operators a field takes: its data type's vocabulary, narrowed by the
 * field's own `operators` where the API evaluates fewer of them.
 */
export function fieldOperators(field?: Pick<FieldSchema, 'dataType' | 'operators'> | null): readonly Operator[] {
  const all = operatorsFor(field?.dataType ?? '');
  const only = field?.operators;
  return only ? all.filter((operator) => only.includes(operator)) : all;
}

/** Which named run an operator belongs in. */
function groupOf(operator: Operator): string {
  switch (operator) {
    case 'is':
    case 'is_not':
    case 'in':
    case 'not_in':
      return 'Is';
    case 'contains':
    case 'not_contains':
    case 'starts_with':
    case 'ends_with':
      return 'Text';
    case 'greater_than':
    case 'less_than':
    case 'between':
      return 'Compare';
    case 'in_last':
    case 'not_in_last':
    case 'in_next':
    case 'not_in_next':
      return 'Relative';
    default:
      return 'Link';
  }
}

const GROUP_ORDER = ['Is', 'Text', 'Compare', 'Relative', 'Calendar', 'Link', 'Empty'];

/**
 * The operator menu for a data type, grouped. Every entry names the raw operator
 * it serialises to; an unfilterable type gets an empty menu. `operators` narrows
 * the menu to what the field's own site answers.
 */
export function operatorMenu(dataType: string, operators?: readonly Operator[]): OperatorGroup[] {
  const presets = presetsFor(dataType, operators);
  const byGroup = new Map<string, OperatorPreset[]>();
  for (const preset of presets) {
    const label = presetGroup(preset);
    const run = byGroup.get(label);
    if (run) run.push(preset);
    else byGroup.set(label, [preset]);
  }
  return GROUP_ORDER.filter((label) => byGroup.has(label)).map((label) => ({
    label,
    presets: byGroup.get(label) as OperatorPreset[],
  }));
}

function presetGroup(preset: OperatorPreset): string {
  if (preset.id === 'is_empty' || preset.id === 'is_not_empty') return 'Empty';
  if (preset.operator.startsWith('in_calendar_')) return 'Calendar';
  return groupOf(preset.operator);
}

/**
 * Every menu entry for a data type, in menu order. Calendar operators are
 * replaced by their named offsets and never offered raw: an integer offset with
 * no wording around it is not a control anyone can read.
 */
export function presetsFor(dataType: string, only?: readonly Operator[]): OperatorPreset[] {
  const operators = only ?? operatorsFor(dataType);
  if (operators.length === 0) return [];
  const empty = emptyValueFor(dataType);
  const out: OperatorPreset[] = [];
  // An `image` filter takes null and nothing else: a thumbnail is a presigned URL
  // minted per read, so the only question it answers is has-one (field_types/image).
  if (dataType !== 'image') {
    for (const operator of operators) {
      if (operator.startsWith('in_calendar_')) continue;
      out.push(plainPreset(operator, dataType));
    }
    for (const calendar of CALENDAR_PRESETS) {
      if (!operators.includes(calendar.operator)) continue;
      out.push({ id: calendar.id, label: calendar.label, operator: calendar.operator, input: 'none', value: calendar.offset });
    }
  }
  // uuid spells its empty test `is ""`, which the tree reads as an unfilled row and
  // drops, so the menu cannot offer it; every other type spells it `is null`. A field
  // whose own `operators` narrows the type's vocabulary was measured on those operators
  // with values, never on null: `Note.read_by_current_user` evaluates `is` and `is_not`
  // against `read` and `unread` alone (068_note_read_state), so the empty tests follow
  // the narrowing off the menu.
  if (empty === null && !narrowed(dataType, only) && operators.includes('is') && operators.includes('is_not')) {
    out.push({ id: 'is_empty', label: 'is empty', operator: 'is', input: 'none', value: null });
    out.push({ id: 'is_not_empty', label: 'is not empty', operator: 'is_not', input: 'none', value: null });
  }
  return out;
}

/** True where `only` leaves out an operator the data type's own vocabulary holds. */
function narrowed(dataType: string, only?: readonly Operator[]): boolean {
  if (!only) return false;
  return operatorsFor(dataType).some((operator) => !only.includes(operator));
}

export function presetById(dataType: string, id: string, operators?: readonly Operator[]): OperatorPreset | undefined {
  return presetsFor(dataType, operators).find((p) => p.id === id);
}

/** The menu entry a condition currently sits on. */
export function presetIdOf(condition: FilterCondition, dataType: string): string {
  const { operator, value } = condition;
  if (value === null && (operator === 'is' || operator === 'is_not') && emptyValueFor(dataType) === null) {
    return operator === 'is' ? 'is_empty' : 'is_not_empty';
  }
  if (operator.startsWith('in_calendar_')) {
    const found = CALENDAR_PRESETS.find((c) => c.operator === operator && c.offset === value);
    // An offset with no name of its own still belongs to its calendar operator.
    return found ? found.id : (CALENDAR_PRESETS.find((c) => c.operator === operator)?.id ?? operator);
  }
  return operator;
}

/**
 * Move a condition onto another menu entry. The value survives when the two
 * entries edit the same shape and is reset to the type's default otherwise, so
 * switching "is" to "is any of" keeps what was typed only where it fits.
 */
export function applyPreset(condition: FilterCondition, preset: OperatorPreset, dataType: string): FilterCondition {
  if (preset.input === 'none') {
    return { ...condition, operator: preset.operator, value: preset.value as ConditionValue };
  }
  const before = VALUE_SHAPE[condition.operator];
  const after = VALUE_SHAPE[preset.operator];
  const keep = before === after && !isPinned(condition, dataType);
  return {
    ...condition,
    operator: preset.operator,
    value: keep ? condition.value : defaultValueFor(dataType, preset.operator),
  };
}

/** True when the condition sits on a preset that pins its value, so no editor is drawn. */
export function isPinned(condition: FilterCondition, dataType: string): boolean {
  const id = presetIdOf(condition, dataType);
  return id === 'is_empty' || id === 'is_not_empty' || condition.operator.startsWith('in_calendar_');
}

/* -------------------------------------------------------------------------- */
/* defaults                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * The value a row starts on. Blank wherever a person has to supply the value, so
 * a half-built row serialises to nothing; filled where the type has only one
 * sensible starting point (a checkbox is two-state and never null, and a
 * relative window with no length is not a window).
 */
export function defaultValueFor(dataType: string, operator: Operator): ConditionValue {
  switch (VALUE_SHAPE[operator]) {
    case 'list':
      return [];
    case 'range':
      return [null, null];
    case 'relative':
      // `[count, UNIT]` with a positive integer count and an uppercase unit
      // (field_types/date); the window includes today.
      return [7, 'DAY'];
    case 'calendar':
      return 0;
    case 'string':
      return '';
    default:
      return dataType === 'checkbox' ? true : '';
  }
}

/** A blank condition on a field, ready for its value. */
export function defaultCondition(path: string, dataType: string, operators?: readonly Operator[]): FilterCondition {
  const preset = presetsFor(dataType, operators)[0];
  const operator: Operator = preset ? preset.operator : 'is';
  return {
    kind: 'condition',
    path,
    operator,
    value: preset?.input === 'none' ? (preset.value as ConditionValue) : defaultValueFor(dataType, operator),
  };
}

/* -------------------------------------------------------------------------- */
/* summary                                                                    */
/* -------------------------------------------------------------------------- */

/** Between the values of a list, wherever one is spelled out. */
const VALUE_SEPARATOR = ', ';

function scalarLabel(value: Scalar, field?: FieldSchema | null): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return value.name ?? `${value.type} #${value.id}`;
  if (typeof value === 'string' && field?.displayValues) return field.displayValues[value] ?? value;
  return String(value);
}

function valueSummary(condition: FilterCondition, field?: FieldSchema | null): string {
  const { operator, value } = condition;
  switch (VALUE_SHAPE[operator]) {
    case 'list':
      return Array.isArray(value) ? value.map((v) => scalarLabel(v as Scalar, field)).join(VALUE_SEPARATOR) : '';
    case 'range': {
      if (!Array.isArray(value) || value.length !== 2) return '';
      return `${scalarLabel(value[0] as Scalar, field)} and ${scalarLabel(value[1] as Scalar, field)}`;
    }
    case 'relative': {
      if (!Array.isArray(value) || value.length !== 2) return '';
      const count = Number(value[0]);
      return `${count} ${timeUnitLabel(value[1] as TimeUnit, count)}`;
    }
    case 'calendar':
    case 'none':
      return '';
    default:
      return scalarLabel(value as Scalar, field);
  }
}

/** A condition read as three segments: what is compared, how, and against what. */
export interface ConditionParts {
  field: string;
  operator: string;
  /** Empty when the operator pins its own value, as `is empty` and the calendar presets do. */
  value: string;
}

/**
 * The three segments of a condition's summary. A pill draws them apart and a
 * sentence joins them; both read the same words.
 */
export function conditionParts(condition: FilterCondition, field?: FieldSchema | null): ConditionParts {
  const dataType = field?.dataType ?? '';
  const preset = presetById(dataType, presetIdOf(condition, dataType));
  return {
    field: field?.displayName ?? condition.path,
    operator: preset?.label ?? operatorLabel(condition.operator, dataType),
    value: valueSummary(condition, field),
  };
}

/** A condition's values, as much of them as a pill has room to name. */
export interface ConditionValues {
  /** The values the pill names, in order. */
  shown: string[];
  /** Values past `shown`, which the pill reads as `+n`. */
  overflow: number;
  /** Every value, comma-joined, for the `title` a truncated pill carries. */
  title: string;
  /** The shown values as one line, for a pill that spells its values rather than drawing them. */
  text: string;
  /** The scalar behind each shown value, for a pill that draws its values rather than spelling them. */
  values: Scalar[];
}

/**
 * A condition's values as a pill reads them: the first `max`, a count of the rest,
 * and the whole list for the title. A condition on any other shape than a list has
 * one value and no overflow, so a pill draws it whole.
 */
export function conditionValues(
  condition: FilterCondition,
  field?: FieldSchema | null,
  max = 2,
): ConditionValues {
  const title = valueSummary(condition, field);
  if (VALUE_SHAPE[condition.operator] !== 'list' || !Array.isArray(condition.value)) {
    return { shown: title ? [title] : [], overflow: 0, title, text: title, values: [] };
  }
  const all = condition.value as Scalar[];
  const limit = max > 0 ? Math.min(max, all.length) : all.length;
  const shown = all.slice(0, limit).map((v) => scalarLabel(v, field));
  return {
    shown,
    overflow: all.length - limit,
    title,
    text: shown.join(VALUE_SEPARATOR),
    values: all.slice(0, limit),
  };
}

/**
 * One line naming what a condition matches, such as
 * `Status is any of Approved, Final`. Without a schema the field's dotted path
 * stands in for its label and codes stand in for their display values.
 */
export function describeCondition(condition: FilterCondition, field?: FieldSchema | null): string {
  const parts = conditionParts(condition, field);
  const head = `${parts.field} ${parts.operator}`;
  return parts.value ? `${head} ${parts.value}` : head;
}

/* -------------------------------------------------------------------------- */
/* validation                                                                 */
/* -------------------------------------------------------------------------- */

export type ConditionIssueCode =
  | 'no-field'
  | 'unknown-field'
  | 'unfilterable'
  | 'unknown-operator'
  | 'wrong-shape'
  | 'blank-value';

export interface ConditionIssue {
  code: ConditionIssueCode;
  message: string;
}

function shapeHolds(shape: ValueShape, value: ConditionValue): boolean {
  switch (shape) {
    case 'list':
      return Array.isArray(value);
    case 'range':
      return Array.isArray(value) && value.length === 2;
    case 'relative':
      return Array.isArray(value) && value.length === 2 && typeof value[0] === 'number' && typeof value[1] === 'string';
    case 'calendar':
      return typeof value === 'number' && Number.isInteger(value);
    case 'string':
      return typeof value === 'string';
    case 'none':
      return true;
    default:
      return !Array.isArray(value);
  }
}

/**
 * Everything wrong with one row, in the order a person would fix it. An empty
 * array means the row serialises to a filter the API accepts.
 *
 * `field` is the schema of the path's last segment. Pass `null` when the path
 * resolved to nothing and omit it when no schema is loaded, which suppresses
 * every check that needs one.
 */
export function validateCondition(condition: FilterCondition, field?: FieldSchema | null): ConditionIssue[] {
  const issues: ConditionIssue[] = [];
  if (!condition.path) {
    return [{ code: 'no-field', message: 'Pick a field.' }];
  }
  if (field === null) {
    return [{ code: 'unknown-field', message: `No field at ${condition.path}.` }];
  }
  const dataType = field?.dataType;
  if (dataType !== undefined && !isFilterable(dataType)) {
    return [{ code: 'unfilterable', message: `${field?.displayName ?? condition.path} cannot be filtered on.` }];
  }
  if (!isOperator(condition.operator)) {
    issues.push({ code: 'unknown-operator', message: `${condition.operator} is not an operator.` });
    return issues;
  }
  if (dataType !== undefined && !supportsOperator(dataType, condition.operator)) {
    issues.push({
      code: 'unknown-operator',
      message: `${operatorLabel(condition.operator, dataType)} does not apply to a ${dataType} field.`,
    });
  }
  const shape = VALUE_SHAPE[condition.operator];
  if (!shapeHolds(shape, condition.value)) {
    issues.push({ code: 'wrong-shape', message: `${operatorLabel(condition.operator, dataType)} needs a ${shape} value.` });
  } else if (isBlankCondition(condition)) {
    issues.push({ code: 'blank-value', message: 'Fill in a value.' });
  }
  return issues;
}

/* -------------------------------------------------------------------------- */
/* value editors                                                              */
/* -------------------------------------------------------------------------- */

/** The value editor a data type needs, once the operator has chosen the shape. */
export type ValueEditorKind =
  | 'none'
  | 'text'
  | 'number'
  | 'date'
  | 'date_time'
  | 'checkbox'
  | 'options'
  | 'entity'
  | 'color'
  | 'url';

/**
 * Which editor a row draws. The operator picks the arity (one value, a list, a
 * range, a relative window) and the data type picks the editor inside it.
 *
 * A `url` field takes no filter at all, so no field list offers one; the kind is
 * here for a tree that carries a path the schema no longer filters on
 * (field_types/url).
 */
export function valueEditorFor(dataType: string, operator: Operator): ValueEditorKind {
  const shape = VALUE_SHAPE[operator];
  if (shape === 'calendar' || shape === 'none') return 'none';
  // `name_*` and `type_*` compare against a plain string whatever the field holds.
  if (shape === 'string') return 'text';
  if (shape === 'relative') return 'none';
  if (dataType === 'checkbox') return 'checkbox';
  if (dataType === 'date') return 'date';
  if (dataType === 'date_time') return 'date_time';
  if (dataType === 'list' || dataType === 'status_list') return 'options';
  if (isLinkType(dataType)) return 'entity';
  if (isNumericType(dataType)) return 'number';
  if (dataType === 'color') return 'color';
  if (dataType === 'url') return 'url';
  return 'text';
}

/** Whether a value editor holds one value or many. */
/** The arity a row draws: none for a pinned preset, else the operator's own. */
export function conditionArity(condition: FilterCondition, dataType: string): 'none' | 'one' | 'many' | 'two' | 'relative' {
  return isPinned(condition, dataType) ? 'none' : valueArity(condition.operator);
}

export function valueArity(operator: Operator): 'none' | 'one' | 'many' | 'two' | 'relative' {
  switch (VALUE_SHAPE[operator]) {
    case 'list':
      return 'many';
    case 'range':
      return 'two';
    case 'relative':
      return 'relative';
    case 'calendar':
    case 'none':
      return 'none';
    default:
      return 'one';
  }
}

/* -------------------------------------------------------------------------- */
/* list values                                                                */
/* -------------------------------------------------------------------------- */

/**
 * The values a list-shaped condition holds, as a row edits them. `in` and `not_in`
 * take a JSON array, so anything else on the condition reads as no values yet.
 */
export function conditionList(value: ConditionValue): Scalar[] {
  return Array.isArray(value) ? ([...value] as Scalar[]) : [];
}

/** The list with one value replaced. An index outside it leaves the list alone. */
export function withListValue(value: ConditionValue, index: number, next: Scalar): Scalar[] {
  const values = conditionList(value);
  if (index < 0 || index >= values.length) return values;
  values[index] = next;
  return values;
}

/** The list with one value dropped. */
export function withoutListValue(value: ConditionValue, index: number): Scalar[] {
  return conditionList(value).filter((_, i) => i !== index);
}

/**
 * The list with one more entry on the end, blank. A blank entry serialises to
 * nothing: a row whose value is still unfilled is dropped rather than sent.
 */
export function withAddedListValue(value: ConditionValue): Scalar[] {
  return [...conditionList(value), ''];
}

/* -------------------------------------------------------------------------- */
/* relative dates                                                             */
/* -------------------------------------------------------------------------- */

/** A relative-date window, as a filter row edits it. */
export interface RelativeDate {
  count: number;
  unit: TimeUnit;
  direction: 'last' | 'next';
  /** Negated windows also match rows where the field is unset (017_filter_operators). */
  negated?: boolean;
}

export function relativeOperator(relative: Pick<RelativeDate, 'direction' | 'negated'>): Operator {
  if (relative.direction === 'next') return relative.negated ? 'not_in_next' : 'in_next';
  return relative.negated ? 'not_in_last' : 'in_last';
}

export function relativeValue(relative: Pick<RelativeDate, 'count' | 'unit'>): [number, TimeUnit] {
  return [relative.count, relative.unit];
}

/** Read a condition back as a relative window, or `null` when it is not one. */
export function relativeFrom(operator: Operator, value: ConditionValue): RelativeDate | null {
  if (VALUE_SHAPE[operator] !== 'relative') return null;
  if (!Array.isArray(value) || value.length !== 2) return null;
  return {
    count: Number(value[0]),
    unit: value[1] as TimeUnit,
    direction: operator === 'in_next' || operator === 'not_in_next' ? 'next' : 'last',
    negated: operator === 'not_in_last' || operator === 'not_in_next',
  };
}

/** The count and the unit a relative row shows, with the default window for an unfilled one. */
export function relativeWindow(value: ConditionValue): { count: number | null; unit: TimeUnit } {
  const pair = Array.isArray(value) ? value : [];
  const count = Number(pair[0]);
  const unit = pair[1];
  return {
    count: Number.isFinite(count) && String(pair[0] ?? '') !== '' ? count : null,
    unit: (TIME_UNITS as readonly string[]).includes(String(unit)) ? (unit as TimeUnit) : 'DAY',
  };
}

/** The window with one half replaced. A missing count goes as 1, the smallest the API takes. */
export function withRelativeWindow(
  value: ConditionValue,
  next: Partial<{ count: number | null; unit: TimeUnit }>,
): [number, TimeUnit] {
  const current = relativeWindow(value);
  const merged = { ...current, ...next };
  return [merged.count === null ? 1 : merged.count, merged.unit];
}

/**
 * The time units as a field, so a relative row picks its unit with the same list
 * control a `list` field uses. Mandatory: a window always has a unit.
 */
export function timeUnitField(displayName = 'Unit'): Pick<
  FieldSchema,
  'displayName' | 'mandatory' | 'validValues' | 'displayValues'
> {
  return {
    displayName,
    mandatory: true,
    validValues: [...TIME_UNITS],
    displayValues: Object.fromEntries(TIME_UNITS.map((unit) => [unit, timeUnitLabel(unit, 2)])),
  };
}

/* -------------------------------------------------------------------------- */
/* tree editing                                                               */
/* -------------------------------------------------------------------------- */

/**
 * Where a node sits in the tree: the index it holds in each group from the root
 * down. `[]` is the root itself.
 */
export type NodePath = readonly number[];

export function nodeAt(root: FilterNode, path: NodePath): FilterNode | undefined {
  let node: FilterNode | undefined = root;
  for (const index of path) {
    if (node === undefined || node.kind !== 'group') return undefined;
    node = node.conditions[index];
  }
  return node;
}

function mapChild(
  node: FilterNode,
  path: NodePath,
  change: (children: FilterNode[], index: number) => FilterNode[],
): FilterNode {
  if (node.kind !== 'group' || path.length === 0) return node;
  const [index, ...rest] = path as number[];
  const at = index as number;
  if (rest.length === 0) return { ...node, conditions: change([...node.conditions], at) };
  const child = node.conditions[at];
  if (!child) return node;
  const next = [...node.conditions];
  next[at] = mapChild(child, rest, change);
  return { ...node, conditions: next };
}

/** A copy of the tree with the node at `path` replaced. The root cannot be replaced this way. */
export function replaceAt(root: FilterGroup, path: NodePath, node: FilterNode): FilterGroup {
  if (path.length === 0) return node.kind === 'group' ? node : root;
  return mapChild(root, path, (children, index) => {
    children[index] = node;
    return children;
  }) as FilterGroup;
}

/** A copy of the tree with the node at `path` gone. */
export function removeAt(root: FilterGroup, path: NodePath): FilterGroup {
  if (path.length === 0) return root;
  return mapChild(root, path, (children, index) => {
    children.splice(index, 1);
    return children;
  }) as FilterGroup;
}

/** A copy of the tree with `node` appended to the group at `path`. */
export function appendAt(root: FilterGroup, path: NodePath, node: FilterNode): FilterGroup {
  const target = nodeAt(root, path);
  if (!target || target.kind !== 'group') return root;
  return replaceAt(root, path, { ...target, conditions: [...target.conditions, node] }) as FilterGroup;
}

/** A copy of the tree with the node at `path` moved `delta` places among its siblings. */
export function moveAt(root: FilterGroup, path: NodePath, delta: number): FilterGroup {
  if (path.length === 0) return root;
  return mapChild(root, path, (children, index) => {
    const to = index + delta;
    if (to < 0 || to >= children.length) return children;
    const [moved] = children.splice(index, 1);
    children.splice(to, 0, moved as FilterNode);
    return children;
  }) as FilterGroup;
}

/** Conditions in the tree, nested groups included. */
export function countConditions(node: FilterNode): number {
  if (node.kind === 'condition') return 1;
  return node.conditions.reduce((n, child) => n + countConditions(child), 0);
}

/** Conditions that would survive serialisation. */
export function countActiveConditions(node: FilterNode): number {
  if (node.kind === 'condition') return isBlankCondition(node) ? 0 : 1;
  return node.conditions.reduce((n, child) => n + countActiveConditions(child), 0);
}

/** The first condition on a field path, with where it sits. */
export function findCondition(
  root: FilterNode,
  path: string,
  at: NodePath = [],
): { at: NodePath; condition: FilterCondition } | undefined {
  if (root.kind === 'condition') return root.path === path ? { at, condition: root } : undefined;
  for (let i = 0; i < root.conditions.length; i += 1) {
    const found = findCondition(root.conditions[i] as FilterNode, path, [...at, i]);
    if (found) return found;
  }
  return undefined;
}

/**
 * A copy of the tree with every condition on one of `paths` gone. A group the
 * pruning emptied goes with it, so the `or` of `is` conditions a facet writes
 * leaves nothing behind.
 */
export function withoutPaths(root: FilterGroup, paths: readonly string[]): FilterGroup {
  const drop = new Set(paths);
  const prune = (node: FilterNode): FilterNode | null => {
    if (node.kind === 'condition') return drop.has(node.path) ? null : node;
    const conditions = node.conditions.map(prune).filter((c): c is FilterNode => c !== null);
    if (node.conditions.length > 0 && conditions.length === 0) return null;
    return { ...node, conditions };
  };
  return (prune(root) as FilterGroup | null) ?? { ...root, conditions: [] };
}

/**
 * How a facet spells a set of ticked values on a field.
 *
 * A field the API evaluates `in` on takes one condition holding the list. A field
 * it does not takes one condition per value: `is` joined by `or`, `is_not` joined
 * by `and`, which is the same set of rows.
 */
export interface FacetShape {
  /** The operator a ticked set writes. */
  any: Operator;
  /** The operator a negated set writes. */
  none: Operator;
  /** True where a set of several values is one condition per value. */
  spread: boolean;
}

export function facetShape(field?: Pick<FieldSchema, 'dataType' | 'operators'> | null): FacetShape {
  const operators = fieldOperators(field);
  if (operators.includes('in') && operators.includes('not_in')) return { any: 'in', none: 'not_in', spread: false };
  return { any: 'is', none: 'is_not', spread: true };
}

/** The node a facet contributes, read back as one checklist. */
export interface FacetCondition {
  /** Where the node sits in the tree. */
  at: NodePath;
  /** The condition, or the group of one-value conditions, the facet wrote. */
  node: FilterNode;
  /**
   * The condition a pill reads. A group of one-value conditions stands in as one
   * list-shaped condition, so a pill draws every facet the same way. Never serialised.
   */
  summary: FilterCondition;
  /** The operator the checklist writes, `in` or `is` and their negations. */
  operator: Operator;
  /** The values ticked. Empty where the node is not a checklist. */
  values: Scalar[];
  /** True where the node is a checklist this facet can edit, false where the editor wrote it. */
  checklist: boolean;
}

/**
 * The values a node holds as one checklist on `path`, or `null` where it is not one.
 * A group qualifies only when every child is a one-value condition on the path; the
 * root never does, since a facet writes into the root and never is it.
 */
function facetValuesOf(node: FilterNode, path: string, shape: FacetShape, dataType: string, root = false): Scalar[] | null {
  if (node.kind === 'condition') {
    if (node.path !== path || isPinned(node, dataType)) return null;
    if (node.operator === 'in' || node.operator === 'not_in') {
      return Array.isArray(node.value) ? (node.value as Scalar[]) : null;
    }
    if (!shape.spread || (node.operator !== shape.any && node.operator !== shape.none)) return null;
    return [node.value as Scalar];
  }
  if (root || !shape.spread || node.conditions.length === 0) return null;
  const wanted = node.logicalOperator === 'or' ? shape.any : shape.none;
  const values: Scalar[] = [];
  for (const child of node.conditions) {
    if (child.kind !== 'condition' || child.path !== path || child.operator !== wanted) return null;
    if (isPinned(child, dataType)) return null;
    values.push(child.value as Scalar);
  }
  return values;
}

function facetOperatorOf(node: FilterNode, shape: FacetShape): Operator {
  if (node.kind === 'condition') return node.operator;
  return node.logicalOperator === 'or' ? shape.any : shape.none;
}

/**
 * The node a facet contributes on `path`, wherever it sits: the condition it
 * wrote, or the group of one-value conditions it wrote on a field the API
 * evaluates no `in` on.
 */
export function findFacet(
  root: FilterNode,
  path: string,
  field?: Pick<FieldSchema, 'dataType' | 'operators'> | null,
  at: NodePath = [],
): FacetCondition | undefined {
  const shape = facetShape(field);
  const dataType = field?.dataType ?? '';
  const read = (node: FilterNode, where: NodePath): FacetCondition | undefined => {
    const values = facetValuesOf(node, path, shape, dataType, node === root);
    if (values) {
      const operator = facetOperatorOf(node, shape);
      const list = operator === shape.none || operator === 'not_in' ? 'not_in' : 'in';
      return { at: where, node, summary: makeCondition(path, list, values), operator, values, checklist: true };
    }
    if (node.kind === 'condition') {
      if (node.path !== path) return undefined;
      return { at: where, node, summary: node, operator: node.operator, values: [], checklist: false };
    }
    for (let i = 0; i < node.conditions.length; i += 1) {
      const found = read(node.conditions[i] as FilterNode, [...where, i]);
      if (found) return found;
    }
    return undefined;
  };
  return read(root, at);
}

/**
 * Set the condition a facet contributes: replaced where one exists, appended to
 * the root where none does, removed when nothing is ticked. `operator` is the
 * list operator the facet holds, spelled out as one `is` per value on a field the
 * API evaluates no `in` on.
 */
export function setFacet(
  root: FilterGroup,
  path: string,
  values: readonly Scalar[],
  operator: Operator = 'in',
  field?: Pick<FieldSchema, 'dataType' | 'operators'> | null,
): FilterGroup {
  const shape = facetShape(field);
  const negated = operator === 'not_in' || operator === 'is_not';
  const op = negated ? shape.none : shape.any;
  const found = findFacet(root, path, field);
  if (values.length === 0) return found ? removeAt(root, found.at) : root;
  const next: FilterNode = !shape.spread
    ? makeCondition(path, op, [...values])
    : values.length === 1
      ? makeCondition(path, op, values[0] as Scalar)
      : makeGroup(negated ? 'and' : 'or', values.map((v) => makeCondition(path, op, v)));
  return found ? replaceAt(root, found.at, next) : appendAt(root, [], next);
}

/** A facet's condition moved onto another of its menu entries. */
export function setFacetPreset(
  root: FilterGroup,
  path: string,
  preset: OperatorPreset,
  dataType: string,
  field?: Pick<FieldSchema, 'dataType' | 'operators'> | null,
): FilterGroup {
  const found = findFacet(root, path, field ?? { dataType });
  // A list preset keeps the values and changes only which way the facet spells them.
  if (preset.input === 'list' && found?.checklist) {
    return setFacet(root, path, found.values, preset.operator, field ?? { dataType });
  }
  const current = found?.summary ?? { kind: 'condition' as const, path, operator: 'in' as Operator, value: [] };
  const next = applyPreset(current, preset, dataType);
  return found ? replaceAt(root, found.at, next) : appendAt(root, [], next);
}

/* -------------------------------------------------------------------------- */
/* facets                                                                     */
/* -------------------------------------------------------------------------- */

/** One value a facet offers, with how many of the rows read hold it. */
export interface FacetValue {
  /** Stable identity for the UI. An entity is `Type:id`; everything else is its own string. */
  key: string;
  label: string;
  /** The value an `in` condition sends. */
  value: Scalar;
  count: number;
}

function facetKey(value: Scalar): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return `${value.type}:${value.id}`;
  return String(value);
}

function rowValues(row: EntityRow, field: FieldSchema): Scalar[] {
  if (isLinkType(field.dataType)) {
    const data = row.relationships?.[field.name]?.data;
    if (!data) return [];
    return (Array.isArray(data) ? data : [data]) as Scalar[];
  }
  const value = row.attributes?.[field.name];
  return value === null || value === undefined ? [] : [value as Scalar];
}

/**
 * The values a facet offers, most common first.
 *
 * The site vocabulary of a `list` or `status_list` field comes from the schema so
 * a value nobody holds still appears at zero; every other type can only be
 * discovered from the rows that were read, so its list is as complete as the page
 * size allowed.
 */
export function facetValues(rows: readonly EntityRow[], field: FieldSchema): FacetValue[] {
  const found = new Map<string, FacetValue>();
  const add = (value: Scalar, count: number) => {
    const key = facetKey(value);
    if (key === '') return;
    const at = found.get(key);
    if (at) at.count += count;
    else found.set(key, { key, label: facetLabel(value, field), value, count });
  };
  for (const code of field.validValues ?? []) add(code, 0);
  if (field.dataType === 'checkbox') {
    add(true, 0);
    add(false, 0);
  }
  for (const row of rows) for (const value of rowValues(row, field)) add(value, 1);
  return [...found.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

/**
 * The menu a facet pill's operator segment offers: the operators that take the
 * checklist's list of values, and the empty tests, which take none. A field the
 * API evaluates no `in` on still offers both list entries, since the facet spells
 * a list out as one condition per value.
 */
export function facetPresets(dataType: string, field?: Pick<FieldSchema, 'dataType' | 'operators'> | null): OperatorPreset[] {
  const lists = presetsFor(dataType).filter((p) => p.input === 'list');
  const empties = presetsFor(dataType, field ? fieldOperators(field) : undefined).filter(
    (p) => p.id === 'is_empty' || p.id === 'is_not_empty',
  );
  return [...lists, ...empties];
}

function facetLabel(value: Scalar, field: FieldSchema): string {
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value !== null && typeof value === 'object') return value.name ?? `${value.type} #${value.id}`;
  const text = String(value);
  return field.displayValues?.[text] ?? text;
}

/* -------------------------------------------------------------------------- */
/* sort                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Types a `sort` may name. Sorting is a silent 200 no-op on `summary`, `url` and
 * `password`, and a 400 on `uuid` and `pivot_column`; `calculated` sorts
 * correctly even though it cannot be filtered (026_result_order, reports/003).
 */
const UNSORTABLE: ReadonlySet<string> = new Set(['summary', 'url', 'password', 'serializable', 'uuid', 'pivot_column']);

export function isSortable(dataType: string): boolean {
  return !UNSORTABLE.has(dataType);
}

/** Fields a sort picker may offer, sorted by display name. */
export function sortableFields(
  fields: Record<string, FieldSchema>,
  options: { hidePaths?: readonly string[] } = {},
): FieldSchema[] {
  return Object.values(fields)
    .filter((f) => isSortable(f.dataType))
    .filter((f) => !isHiddenPath(f.name, options.hidePaths))
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.name.localeCompare(b.name));
}

export interface SortKey {
  /** Field name or dotted path. */
  field: string;
  direction: 'asc' | 'desc';
}

/**
 * The `sort` string `_search` takes: field names comma-joined, each descending
 * one prefixed with `-`. A leading `+` and a trailing ` desc` are both 400s, and
 * id ascending is the implicit tiebreak (026_result_order).
 */
export function toSortString(keys: readonly SortKey[]): string {
  return keys
    .filter((k) => k.field)
    .map((k) => (k.direction === 'desc' ? `-${k.field}` : k.field))
    .join(',');
}

export function fromSortString(sort: string | null | undefined): SortKey[] {
  if (!sort) return [];
  return sort
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) =>
      part.startsWith('-') ? { field: part.slice(1), direction: 'desc' as const } : { field: part, direction: 'asc' as const },
    );
}

/* -------------------------------------------------------------------------- */
/* fields                                                                     */
/* -------------------------------------------------------------------------- */

/** A path pattern hides the exact path and everything under it. */
export function isHiddenPath(path: string, hidePaths: readonly string[] | undefined): boolean {
  if (!hidePaths || hidePaths.length === 0) return false;
  return hidePaths.some((pattern) => path === pattern || path.startsWith(`${pattern}.`));
}

/** Fields a filter row may choose, sorted by display name. */
export function filterableFields(
  fields: Record<string, FieldSchema>,
  options: { hidePaths?: readonly string[]; dataTypes?: readonly DataType[] } = {},
): FieldSchema[] {
  return Object.values(fields)
    .filter((f) => isFilterable(f.dataType))
    .filter((f) => !isHiddenPath(f.name, options.hidePaths))
    .filter((f) => !options.dataTypes || (options.dataTypes as readonly string[]).includes(f.dataType))
    .sort((a, b) => a.displayName.localeCompare(b.displayName) || a.name.localeCompare(b.name));
}
