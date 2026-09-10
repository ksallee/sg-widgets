/**
 * Row anatomy, rule 9 of `docs/design-rules.md`.
 *
 * Every widget that lists entity rows draws the same row from the same six props:
 * a picture, a label with the matched runs bold, a muted sub-label, a right-aligned
 * secondary rendered by its data type, an optional programmatic code, and the extra
 * fields a caller's own sub-label or secondary needs. What each part reads off a row
 * lives here, so a picker row, a tree row and a search row cannot drift.
 */
import type { CollectionColumn } from './collection.js';

/**
 * A field named by a row-anatomy prop: a bare path, or a column already resolved
 * from the schema so the value renders by its data type. One type everywhere.
 */
export type FieldSpec = string | CollectionColumn;

/** The path a field spec names. Empty when nothing is named. */
export function pathOf(spec: FieldSpec | null | undefined): string {
  if (spec === null || spec === undefined) return '';
  return typeof spec === 'string' ? spec : spec.path;
}

/** The six props of rule 9, as a widget holds them. */
export interface RowAnatomy {
  /** `false`, or the field name holding the image URL. */
  thumbnail?: string | false | undefined;
  /** The field shown as the main label. The display-name chain answers it when absent. */
  labelField?: string | undefined;
  /** The muted line under the label. */
  subLabelField?: FieldSpec | null | undefined;
  /** The right-aligned column, rendered by data type. */
  secondaryField?: FieldSpec | null | undefined;
  /** Show programmatic names beside display names. */
  showCode?: boolean | undefined;
  /** Extra fields to request, so a caller's own sub-label or secondary can read them. */
  fields?: string[] | undefined;
}

/** The field a row's thumbnail is read from, or null when there is none. */
export function thumbnailField(anatomy: RowAnatomy): string | null {
  if (anatomy.thumbnail === false) return null;
  return anatomy.thumbnail ?? 'image';
}

/**
 * Every field a row anatomy has to read, `base` first and duplicates dropped.
 *
 * An unknown field name is a silent 200 with the key absent (003_query), so asking
 * for a path a type does not carry costs nothing.
 */
export function rowFields(anatomy: RowAnatomy, base: readonly string[] = []): string[] {
  const wanted = [...base];
  if (anatomy.labelField) wanted.push(anatomy.labelField);
  const sub = pathOf(anatomy.subLabelField);
  if (sub) wanted.push(sub);
  const secondary = pathOf(anatomy.secondaryField);
  if (secondary) wanted.push(secondary);
  const image = thumbnailField(anatomy);
  if (image) wanted.push(image);
  if (anatomy.showCode) wanted.push('code');
  wanted.push(...(anatomy.fields ?? []));
  return [...new Set(wanted.filter((name) => name.length > 0))];
}

/** The picture a row shows, or null when the field is off or holds no URL. */
export function rowThumbnail(values: Record<string, unknown>, anatomy: RowAnatomy): string | null {
  const field = thumbnailField(anatomy);
  if (!field) return null;
  const raw = values[field];
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
}

/** The muted line under the label. Empty when nothing names it or the value is blank. */
export function rowSubLabel(values: Record<string, unknown>, anatomy: RowAnatomy): string {
  const path = pathOf(anatomy.subLabelField);
  if (!path) return '';
  const raw = values[path];
  if (raw === null || raw === undefined) return '';
  // A relationship is unwrapped to `{type, id, name}`, so its name is the line.
  if (typeof raw === 'object') {
    const name = (raw as { name?: unknown }).name;
    return typeof name === 'string' ? name : '';
  }
  return String(raw);
}

/** The programmatic name beside the label, when it says something the label does not. */
export function rowCode(values: Record<string, unknown>, label: string, showCode = false): string {
  if (!showCode) return '';
  const raw = values['code'];
  return typeof raw === 'string' && raw.length > 0 && raw !== label ? raw : '';
}

/**
 * The raw value the secondary column draws. `id` is on the row itself rather than
 * among the attributes a read returns, so it is answered from the reference.
 */
export function rowSecondary(
  row: { id: number; values: Record<string, unknown> },
  anatomy: RowAnatomy,
): unknown {
  const path = pathOf(anatomy.secondaryField);
  if (!path) return null;
  return path === 'id' ? row.id : row.values[path];
}

/**
 * The data type the secondary renders as: the resolved column's own, the schema's
 * when one was read, and `number` for `id`, which is a code rather than a name.
 */
export function secondaryType(anatomy: RowAnatomy, fieldType?: string | undefined): string {
  const spec = anatomy.secondaryField;
  if (spec && typeof spec !== 'string' && spec.dataType) return spec.dataType;
  if (fieldType) return fieldType;
  return pathOf(spec) === 'id' ? 'number' : 'text';
}
