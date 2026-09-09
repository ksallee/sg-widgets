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
  const image = options.imagePath ?? DEFAULT_IMAGE_PATH;
  const thumbnail = row.attributes[image];
  return {
    entity: { type: row.type, id: row.id, name: displayNameOf(row.attributes) },
    row,
    name: displayNameOf(row.attributes, `${row.type} #${row.id}`),
    typeLabel: types.find((t) => t.name === row.type)?.displayName ?? row.type,
    thumbnail: typeof thumbnail === 'string' ? thumbnail : null,
    status: typeof status === 'string' || typeof code !== 'string' ? null : { code, field: status },
    columns,
  };
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
