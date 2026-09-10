/**
 * Filter model.
 *
 * The editor works on a tree of groups and conditions. The wire format is the
 * `api3_hash` body of `POST /entity/<type>/_search`: a group is
 * `{logical_operator, conditions}` and a condition is `[path, relation, value]`.
 * `api3_hash` also expresses a plain `and`, so it is the only content type the
 * client needs. Nesting is safe to 265 levels (probe 030); no one will get there.
 */
import type { Operator, TimeUnit } from './field-types.js';
import { VALUE_SHAPE } from './field-types.js';

export type LogicalOperator = 'and' | 'or';

export interface EntityRef {
  type: string;
  id: number;
  /** `cached_display_name` of the target when known. Never sent to the API. */
  name?: string;
}

export type Scalar = string | number | boolean | null | EntityRef;

export type ConditionValue =
  | Scalar
  | Scalar[]
  | [Scalar, Scalar]
  | [number, TimeUnit];

export interface FilterCondition {
  kind: 'condition';
  /** Dotted path such as `entity.Shot.code`. */
  path: string;
  operator: Operator;
  value: ConditionValue;
}

export interface FilterGroup {
  kind: 'group';
  logicalOperator: LogicalOperator;
  conditions: FilterNode[];
}

export type FilterNode = FilterGroup | FilterCondition;

/** Wire shapes. */
export type WireCondition = [string, Operator, unknown];
export interface WireGroup {
  logical_operator: LogicalOperator;
  conditions: Array<WireCondition | WireGroup>;
}

/**
 * What one type's entry in `_text_search`'s `entity_types` map accepts: a filter
 * array, or a group this converts to one.
 */
export type TextSearchFilter = WireGroup | WireCondition[] | null | undefined;

/**
 * The filter array `entity_types` wants, `[]` for no filter
 * (post_entity_text_search). The array form is `and` only and cannot express a
 * nested group, so one is refused here rather than sent and guessed at.
 */
export function toFilterArray(filter: TextSearchFilter): WireCondition[] {
  if (!filter) return [];
  if (Array.isArray(filter)) return filter;
  if (filter.logical_operator !== 'and') {
    throw new Error("A '_text_search' filter is an array of conditions, which is 'and' only.");
  }
  return filter.conditions.map((c) => {
    if (!Array.isArray(c)) throw new Error("A '_text_search' filter is an array of conditions and cannot nest a group.");
    return c;
  });
}

export function group(logicalOperator: LogicalOperator, conditions: FilterNode[] = []): FilterGroup {
  return { kind: 'group', logicalOperator, conditions };
}

export function condition(path: string, operator: Operator, value: ConditionValue): FilterCondition {
  return { kind: 'condition', path, operator, value };
}

export function emptyFilter(): FilterGroup {
  return group('and');
}

/**
 * A condition is blank when it has no path, or when its operator needs a value
 * and none was given. Blank conditions are dropped on serialisation rather than
 * sent as a degenerate filter.
 */
export function isBlankCondition(c: FilterCondition): boolean {
  if (!c.path) return true;
  const shape = VALUE_SHAPE[c.operator];
  const v = c.value;
  switch (shape) {
    case 'scalar':
    case 'string':
      // `is null` and `is_not null` are meaningful on every type but checkbox and uuid.
      return v === undefined || v === '';
    case 'list':
      return !Array.isArray(v) || v.length === 0;
    case 'range':
      return !Array.isArray(v) || v.length !== 2 || v[0] == null || v[1] == null;
    case 'relative':
      return !Array.isArray(v) || v.length !== 2 || typeof v[0] !== 'number' || v[0] <= 0 || !v[1];
    case 'calendar':
      return typeof v !== 'number';
    case 'none':
      return false;
  }
}

/** True when serialisation would produce no conditions at all. */
export function isEmptyFilter(node: FilterNode): boolean {
  if (node.kind === 'condition') return isBlankCondition(node);
  return node.conditions.every(isEmptyFilter);
}

function stripName(v: Scalar): unknown {
  if (v !== null && typeof v === 'object') return { type: v.type, id: v.id };
  return v;
}

function serializeValue(c: FilterCondition): unknown {
  const shape = VALUE_SHAPE[c.operator];
  const v = c.value;
  if (shape === 'list' || shape === 'range') {
    return (v as Scalar[]).map(stripName);
  }
  if (shape === 'relative' || shape === 'calendar' || shape === 'none') return v;
  return stripName(v as Scalar);
}

/**
 * Serialise a tree to the `api3_hash` `filters` value. Blank conditions and
 * groups that end up empty are dropped. Returns `null` when nothing remains,
 * so callers can omit `filters` rather than send `[]` (which matches every
 * row on the site).
 */
export function toApi3Hash(node: FilterNode): WireGroup | null {
  const out = serializeNode(node);
  if (out === null) return null;
  if (Array.isArray(out)) return { logical_operator: 'and', conditions: [out] };
  return out;
}

function serializeNode(node: FilterNode): WireGroup | WireCondition | null {
  if (node.kind === 'condition') {
    if (isBlankCondition(node)) return null;
    return [node.path, node.operator, serializeValue(node)];
  }
  const conditions = node.conditions
    .map(serializeNode)
    .filter((c): c is WireGroup | WireCondition => c !== null);
  if (conditions.length === 0) return null;
  return { logical_operator: node.logicalOperator, conditions };
}

/** Parse a wire group (or a flat `api3_array` list) back into the editor tree. */
export function fromWire(wire: WireGroup | WireCondition[]): FilterGroup {
  if (Array.isArray(wire)) {
    return group('and', wire.map(fromWireCondition));
  }
  return group(
    wire.logical_operator,
    wire.conditions.map((c) => (Array.isArray(c) ? fromWireCondition(c) : fromWire(c))),
  );
}

function fromWireCondition([path, operator, value]: WireCondition): FilterCondition {
  return condition(path, operator, value as ConditionValue);
}

/** Depth-first walk, useful for collecting referenced paths or validating against a schema. */
export function* walk(node: FilterNode): Generator<FilterNode> {
  yield node;
  if (node.kind === 'group') {
    for (const child of node.conditions) yield* walk(child);
  }
}

export function referencedPaths(node: FilterNode): string[] {
  const paths = new Set<string>();
  for (const n of walk(node)) if (n.kind === 'condition' && n.path) paths.add(n.path);
  return [...paths];
}
