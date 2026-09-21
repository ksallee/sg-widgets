/**
 * The model behind an entity card.
 *
 * A card shows one row: its thumbnail, name, type, status and a chosen list of
 * field paths. Working out which fields to ask for, what each path is called and
 * what type its value has is schema work, not rendering, so it lives here and
 * both framework cards read the same model.
 */
import type { EntityRow } from './client.js';
import { cellValue } from './collection.js';
import type { SgContext } from './context.js';
import type { EntityRef } from './filter.js';
import { pathLabel } from './presentation.js';
import { isEmptyValue } from './render.js';
import type { FieldSpec } from './row.js';
import { pathOf } from './row.js';
import type { FieldSchema } from './schema.js';
import { DISPLAY_NAME_FIELDS, displayNameOf, statusFieldFor } from './schema.js';

export interface EntityCardOptions {
  /** Dotted field paths for the grid, in order. */
  fields?: readonly string[];
  /** The `image` field to read the thumbnail from. Default `image`. */
  imagePath?: string;
}

/** One field of the grid, resolved. */
export interface EntityCardColumn {
  path: string;
  /** `pathLabel` of the resolved path; the raw path when the path does not resolve. */
  label: string;
  dataType: string;
  /** The leaf field's schema, for a status label out of `display_values` (probe 009). */
  field: FieldSchema | null;
  value: unknown;
}

export interface EntityCardModel {
  entity: EntityRef;
  /** The row the model was built from, for a caller's own label or sub-label. */
  row: EntityRow;
  name: string;
  /** The type's display name, from the site's enabled types. */
  typeLabel: string;
  thumbnail: string | null;
  /** The type's status field and the row's code, when the type has one. */
  status: { code: string; field: FieldSchema } | null;
  /** The caller's paths, less the one naming the type's own status field. */
  columns: EntityCardColumn[];
}

const DEFAULT_IMAGE_PATH = 'image';

/**
 * The fields one card read asks for: the identity chain the type actually has,
 * its thumbnail, its status field and the caller's paths.
 *
 * The chain is intersected with the type's schema because a name absent from a
 * type is not an empty column but a 400 on the read: Task has neither `code` nor
 * `name` (entity_types/Task).
 */
export async function entityCardFields(
  context: SgContext,
  entityType: string,
  options: EntityCardOptions = {},
): Promise<string[]> {
  const schema = await context.schema.fields(entityType);
  const image = options.imagePath ?? DEFAULT_IMAGE_PATH;
  const status = statusFieldFor(entityType, schema);
  const wanted = [
    ...DISPLAY_NAME_FIELDS.filter((name) => name in schema),
    ...(image in schema ? [image] : []),
    ...(typeof status === 'string' ? [] : [status.name]),
    ...(options.fields ?? []),
  ];
  return [...new Set(wanted)];
}

/** The card model for a row already read. Resolves the labels and types of the paths. */
export async function describeEntityCard(
  context: SgContext,
  row: EntityRow,
  options: EntityCardOptions = {},
): Promise<EntityCardModel> {
  const paths = options.fields ?? [];
  const [schema, types, columns] = await Promise.all([
    context.schema.fields(row.type),
    context.schema.entityTypes(),
    Promise.all(paths.map((path) => describeColumn(context, row, path))),
  ]);
  const status = statusFieldFor(row.type, schema);
  const code = typeof status === 'string' ? null : row.attributes[status.name];
  const badge = typeof status === 'string' || typeof code !== 'string' ? null : { code, field: status };
  const image = options.imagePath ?? DEFAULT_IMAGE_PATH;
  const thumbnail = row.attributes[image];
  return {
    entity: { type: row.type, id: row.id, name: displayNameOf(row.attributes) },
    row,
    name: displayNameOf(row.attributes, `${row.type} #${row.id}`),
    typeLabel: types.find((t) => t.name === row.type)?.displayName ?? row.type,
    thumbnail: typeof thumbnail === 'string' ? thumbnail : null,
    status: badge,
    // The header draws this row's own status when it has one, so the same field asked
    // for by name is one value with one badge. With no status to draw, the column is
    // where its emptiness shows. A path that ends at a linked row's status is a
    // different row's and stays.
    columns: badge ? columns.filter((column) => column.path !== badge.field.name) : columns,
  };
}

/**
 * The column one metadata slot of a tile draws, or null when there is nothing to draw.
 *
 * The slot takes the same spec as every other row-anatomy prop: a bare path, resolved
 * against the card's own columns so the value renders by its data type, or a column the
 * caller already resolved, which is taken at its word and costs no lookup. A slot naming
 * the row's own status field draws it: the grid leaves that field to the header, and a
 * caller who puts it on the metadata line has asked for it there. A status reads the name
 * the site gives the code, off the field's `display_values`, which covers the whole
 * vocabulary (recipes/010, field_types/status_list).
 */
export function entityCardSlot(
  card: EntityCardModel,
  spec: FieldSpec | null | undefined,
): EntityCardColumn | null {
  const path = pathOf(spec);
  if (path.length === 0) return null;
  const value = cellValue(card.row, path);
  if (isEmptyValue(value)) return null;
  if (spec !== null && spec !== undefined && typeof spec !== 'string') {
    return { path, label: spec.header, dataType: spec.dataType, field: spec.field, value };
  }
  const column = card.columns.find((entry) => entry.path === path);
  if (column) return column;
  const status = card.status;
  if (status && path === status.field.name) {
    return { path, label: status.field.displayName, dataType: status.field.dataType, field: status.field, value };
  }
  return null;
}

/** The card model for a reference: one search for the row, then its description. */
export async function loadEntityCard(
  context: SgContext,
  entity: EntityRef,
  options: EntityCardOptions = {},
): Promise<EntityCardModel> {
  const fields = await entityCardFields(context, entity.type, options);
  const found = await context.client.search(entity.type, {
    filters: { logical_operator: 'and', conditions: [['id', 'is', entity.id]] },
    fields,
    page: { size: 1 },
  });
  const row = found.data[0];
  if (!row) throw new Error(`${entity.type} ${entity.id} is not readable.`);
  return describeEntityCard(context, row, options);
}

/**
 * One column. A path that names no field is shown under its own text rather than
 * failing the card: a projection answers 200 with the key absent for a segment
 * outside the field's `valid_types`, so an unresolvable path is an empty value
 * (probe 059).
 */
async function describeColumn(context: SgContext, row: EntityRow, path: string): Promise<EntityCardColumn> {
  const value = cellValue(row, path);
  try {
    const segments = await context.schema.resolvePath(row.type, path);
    const leaf = segments[segments.length - 1];
    const typeLabels = Object.fromEntries((await context.schema.entityTypes()).map((t) => [t.name, t.displayName]));
    return {
      path,
      label: pathLabel(segments, { typeLabels }),
      dataType: leaf?.dataType ?? 'text',
      field: leaf?.field ?? null,
      value,
    };
  } catch {
    return { path, label: path, dataType: 'text', field: null, value };
  }
}
