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
import { renderKindFor } from './render.js';
import type { FieldSchema } from './schema.js';
import type { SchemaService } from './schema-service.js';
import type { StatusService } from './status-service.js';
import type { StatusRecord } from './status.js';

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

/** The site's Status rows by code, as a widget holds them (probe 010). */
export type StatusTable = Readonly<Record<string, StatusRecord>>;

/** What the sub-label reads its value by. Both parts are optional: without them the value stands as written. */
export interface SubLabelSource {
  /** The data type of the field the sub-label names. */
  dataType?: string | undefined;
  /** The status table, so a status code reads the name the site gives it. */
  statuses?: StatusTable | null | undefined;
}

/** The name a `{type, id, name}` link carries. */
function linkName(value: unknown): string {
  const name = (value as { name?: unknown } | null)?.name;
  return typeof name === 'string' ? name : '';
}

/**
 * The muted line under the label, as text. Empty when nothing names it or the value is blank.
 *
 * The value reads by its data type, as the secondary column does: a status is stored as a
 * bare code and the name a reader knows it by lives on the site's Status row, keyed by code
 * and site-wide (probe 010, field_types/status_list); an entity keeps its name, a list of
 * them joins their names, and a date stays the string the API sent (field_types/date). A
 * caller with no schema hands in no type and gets the value as written.
 */
export function rowSubLabel(
  values: Record<string, unknown>,
  anatomy: RowAnatomy,
  source: SubLabelSource = {},
): string {
  const path = pathOf(anatomy.subLabelField);
  if (!path) return '';
  const raw = values[path];
  if (raw === null || raw === undefined) return '';
  const kind = source.dataType ? renderKindFor(source.dataType) : 'text';
  if (kind === 'status') return source.statuses?.[String(raw)]?.name || String(raw);
  if (kind === 'multi_entity' && Array.isArray(raw)) {
    return raw.map(linkName).filter((name) => name.length > 0).join(', ');
  }
  // A relationship is unwrapped to `{type, id, name}`, so its name is the line.
  if (typeof raw === 'object') return linkName(raw);
  return String(raw);
}

/**
 * The data type the sub-label reads by: the resolved column's own, the schema's when
 * one was read, and nothing otherwise, which leaves the value as written.
 */
export function subLabelType(anatomy: RowAnatomy, fieldType?: string | undefined): string {
  const spec = anatomy.subLabelField;
  if (spec && typeof spec !== 'string' && spec.dataType) return spec.dataType;
  return fieldType ?? '';
}

/** The schemas a row's sub-label and secondary draw with, and the status table when either needs one. */
export interface RowFieldPlan {
  subLabel: FieldSchema | null;
  secondary: FieldSchema | null;
  /** `Status` rows by code, read once and only when a status is on show (probe 010). */
  statuses: StatusTable | null;
}

/** The field a spec names, off the column when it carries one and off the schema otherwise. */
async function fieldFor(
  schema: SchemaService,
  type: string,
  spec: FieldSpec | null | undefined,
): Promise<FieldSchema | null> {
  const path = pathOf(spec);
  // `id` is on the row itself rather than among a type's fields, so it costs no read.
  if (path.length === 0 || path === 'id') return null;
  if (typeof spec !== 'string') return spec?.field ?? null;
  // A field the schema cannot answer renders as text, which is always readable.
  return (await schema.field(type, path).catch(() => undefined)) ?? null;
}

/**
 * The two fields a row resolves, in one pass and with one status read.
 *
 * A resolved column already carries its type, so only a bare path costs a schema
 * read, and that read is the service's cached one.
 */
export async function resolveRowFields(
  schema: SchemaService,
  statusTable: StatusService,
  type: string,
  anatomy: RowAnatomy,
): Promise<RowFieldPlan> {
  const [subLabel, secondary] = await Promise.all([
    fieldFor(schema, type, anatomy.subLabelField),
    fieldFor(schema, type, anatomy.secondaryField),
  ]);
  const onShow = [
    subLabelType(anatomy, subLabel?.dataType),
    secondaryType(anatomy, secondary?.dataType),
  ].some((dataType) => dataType.length > 0 && renderKindFor(dataType) === 'status');
  return {
    subLabel,
    secondary,
    statuses: onShow ? Object.fromEntries(await statusTable.byCode()) : null,
  };
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
