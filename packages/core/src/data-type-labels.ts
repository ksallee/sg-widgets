/**
 * A label per field data type.
 *
 * The wording is this library's own: the API names a data type by its wire name
 * only, so a caller who wants a site's wording passes its own map. A type this
 * build does not know is labelled with the name the site gave it.
 */
import type { DataType } from './field-types.js';
import type { StatusOption } from './status.js';

export const DATA_TYPE_LABELS: Readonly<Record<DataType, string>> = {
  text: 'Text',
  number: 'Number',
  float: 'Float',
  percent: 'Percent',
  currency: 'Currency',
  duration: 'Duration',
  timecode: 'Timecode',
  footage: 'Footage',
  checkbox: 'Checkbox',
  date: 'Date',
  date_time: 'Date and time',
  list: 'List',
  status_list: 'Status list',
  entity: 'Entity',
  multi_entity: 'Multi-entity',
  tag_list: 'Tag list',
  entity_type: 'Entity type',
  image: 'Image',
  url: 'URL',
  color: 'Color',
  uuid: 'UUID',
  jsonb: 'JSON',
  calculated: 'Calculated',
  summary: 'Summary',
  serializable: 'Serializable',
  password: 'Password',
  pivot_column: 'Pivot column',
};

/** The label of a data type: the caller's, else this build's, else the name as given. */
export function dataTypeLabel(dataType: string, labels?: Readonly<Record<string, string>>): string {
  if (labels && Object.hasOwn(labels, dataType)) return labels[dataType] as string;
  return Object.hasOwn(DATA_TYPE_LABELS, dataType) ? DATA_TYPE_LABELS[dataType as DataType] : dataType;
}

export interface DataTypeOptionsConfig {
  /** The held type. Outside the set, it is kept as a last option, since a row may hold it. */
  value?: string | null;
  /** Labels of the caller's own, which win over this build's. */
  labels?: Readonly<Record<string, string>>;
}

/** The options a picker offers for a set of data types, in the order given, each once. */
export function dataTypeOptions(types: readonly string[], config: DataTypeOptionsConfig = {}): StatusOption[] {
  const codes = new Set(types);
  if (config.value) codes.add(config.value);
  codes.delete('');
  return [...codes].map((code) => ({ code, label: dataTypeLabel(code, config.labels) }));
}
