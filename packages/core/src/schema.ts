/**
 * Field schema, normalised.
 *
 * `GET /schema/<Type>/fields` wraps every property in `{value, editable}` where the
 * outer `editable` says whether you may change the property, not the field.
 * `data[field].editable.value` is the one that answers "can I write this".
 * With `project_id`, status and list fields gain `hidden_values`.
 */
import type { DataType } from './field-types.js';

/** One property as the API returns it. */
export interface RawProperty<T = unknown> {
  value: T;
  editable: boolean;
}

export interface RawFieldSchema {
  name: RawProperty<string>;
  entity_type: RawProperty<string>;
  data_type: RawProperty<string>;
  editable: RawProperty<boolean>;
  mandatory: RawProperty<boolean>;
  unique: RawProperty<boolean>;
  properties: Record<string, RawProperty<unknown>>;
}

export type RawFieldsResponse = { data: Record<string, RawFieldSchema> };

export interface FieldSchema {
  /** Programmatic name, e.g. `sg_status_list`. */
  name: string;
  /** Human label, e.g. `Status`. */
  displayName: string;
  entityType: string;
  dataType: DataType | string;
  editable: boolean;
  mandatory: boolean;
  unique: boolean;
  /** For `entity` and `multi_entity`: the types the field may link to. Advisory on most fields. */
  validTypes?: string[];
  /** For `list` and `status_list`: the site-wide vocabulary of codes. */
  validValues?: string[];
  /** For `status_list`: code to label map. Absent when labels equal codes. */
  displayValues?: Record<string, string>;
  /** For `list` and `status_list`, only when read with `project_id`. May contain codes outside `validValues`. */
  hiddenValues?: string[];
  defaultValue?: unknown;
  description?: string;
}

/**
 * Fields the schema types one way and the API answers another, keyed
 * `<Type>.<field>`. `Note.read_by_current_user` holds the codes `unread` and
 * `read`, never a boolean, so every control derived from it is a list and not a
 * checkbox (067_notes_in_the_stream, entity_types/Note).
 */
export const FIELD_SCHEMA_OVERRIDES: Readonly<Record<string, Readonly<Partial<FieldSchema>>>> = {
  'Note.read_by_current_user': { dataType: 'list', validValues: ['unread', 'read'] },
};

/** What a field's schema has to be corrected to, when it is one of those. */
export function fieldSchemaOverride(entityType: string, name: string): Readonly<Partial<FieldSchema>> | undefined {
  return FIELD_SCHEMA_OVERRIDES[`${entityType}.${name}`];
}

function prop<T>(props: Record<string, RawProperty<unknown>> | undefined, key: string): T | undefined {
  const p = props?.[key];
  return p ? (p.value as T) : undefined;
}

export function normalizeField(name: string, raw: RawFieldSchema): FieldSchema {
  const props = raw.properties;
  const field: FieldSchema = {
    name,
    displayName: raw.name.value,
    entityType: raw.entity_type.value,
    dataType: raw.data_type.value,
    editable: raw.editable.value,
    mandatory: raw.mandatory.value,
    unique: raw.unique.value,
  };
  const validTypes = prop<string[]>(props, 'valid_types');
  if (validTypes) field.validTypes = validTypes;
  const validValues = prop<string[]>(props, 'valid_values');
  if (validValues) field.validValues = validValues;
  const displayValues = prop<Record<string, string>>(props, 'display_values');
  if (displayValues) field.displayValues = displayValues;
  const hiddenValues = prop<string[]>(props, 'hidden_values');
  if (hiddenValues) field.hiddenValues = hiddenValues;
  const defaultValue = prop<unknown>(props, 'default_value');
  if (defaultValue !== undefined) field.defaultValue = defaultValue;
  const description = prop<string>(props, 'description');
  if (description) field.description = description;
  return { ...field, ...fieldSchemaOverride(field.entityType, name) };
}

export function normalizeFields(response: RawFieldsResponse): Record<string, FieldSchema> {
  const out: Record<string, FieldSchema> = {};
  for (const [name, raw] of Object.entries(response.data)) out[name] = normalizeField(name, raw);
  return out;
}

/**
 * The status field of an entity type. Every type but Project uses `sg_status_list`
 * (data type `status_list`); Project's is `sg_status`, a plain `list`. Prefer the
 * schema when you have it; the name guess is the fallback.
 */
export function statusFieldFor(entityType: string, fields?: Record<string, FieldSchema>): FieldSchema | string {
  if (fields) {
    const status = Object.values(fields).find((f) => f.dataType === 'status_list');
    if (status) return status;
    if (entityType === 'Project' && fields['sg_status']) return fields['sg_status'];
  }
  return entityType === 'Project' ? 'sg_status' : 'sg_status_list';
}

/**
 * The fields Flow PT conventionally uses as a row's human label, in order.
 * `cached_display_name` is the server's own copy and wins when present.
 */
export const DISPLAY_NAME_FIELDS = ['cached_display_name', 'code', 'name', 'title', 'content', 'subject'] as const;

export function displayNameOf(attributes: Record<string, unknown> | null | undefined, fallback = ''): string {
  if (!attributes) return fallback;
  for (const key of DISPLAY_NAME_FIELDS) {
    const v = attributes[key];
    if (typeof v === 'string' && v.length > 0) return v;
  }
  return fallback;
}
