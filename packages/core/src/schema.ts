/**
 * Field schema, normalised.
 *
 * `GET /schema/<Type>/fields` wraps every property in `{value, editable}` where the
 * outer `editable` says whether you may change the property, not the field.
 * `data[field].editable.value` is the one that answers "can I write this".
 * With `project_id`, status and list fields gain `hidden_values`.
 */
import type { DataType, Operator } from './field-types.js';

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
  /**
   * The operators the API evaluates on this field, where they are fewer than the
   * vocabulary it advertises. Absent means the whole vocabulary.
   */
  operators?: Operator[];
  defaultValue?: unknown;
  description?: string;
}

/**
 * Fields the schema types one way and the API answers another, keyed
 * `<Type>.<field>`. `Note.read_by_current_user` holds the codes `unread` and
 * `read`, never a boolean, so every control derived from it is a list and not a
 * checkbox (067_notes_in_the_stream, entity_types/Note).
 *
 * An entry carries the whole field, because a site may leave it out of the schema
 * and still answer it on the row: `GET /schema/Note/fields` answers 33 fields and
 * no `read_by_current_user` among them, while `GET /schema/Note/fields/read_by_current_user`
 * answers 200 with `data: null`, which is what an undeclared field reads as and a
 * name that is nothing at all answers 404 (068_note_read_state). `normalizeFields`
 * adds what the schema left out.
 *
 * `operators` is the set the API evaluates, which is not always the set it
 * advertises. `read_by_current_user` names `is`, `is_not`, `in` and `not_in` in its
 * own `Valid relations`, and evaluates only the first two: `in`, `not_in` and an
 * `is` value outside the vocabulary all answer 200 with the caller's unread rows
 * whatever the list holds, in `_search` and in `_summarize`, under both body shapes
 * (068_note_read_state).
 *
 * The value is per person and an ApiUser has none: a script's own write answers 200
 * and stores nothing, so it is not editable (068_note_read_state).
 */
export const FIELD_SCHEMA_OVERRIDES: Readonly<Record<string, Readonly<Partial<FieldSchema>>>> = {
  'Note.read_by_current_user': {
    displayName: 'Read by Current User',
    dataType: 'list',
    validValues: ['unread', 'read'],
    operators: ['is', 'is_not'],
    editable: false,
    mandatory: false,
    unique: false,
  },
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

/**
 * Every field of a type, with the fields an override declares and the schema omitted.
 *
 * `entityType` is only needed for a response with no fields at all; otherwise the
 * fields name their own type.
 */
export function normalizeFields(response: RawFieldsResponse, entityType?: string): Record<string, FieldSchema> {
  const out: Record<string, FieldSchema> = {};
  for (const [name, raw] of Object.entries(response.data)) out[name] = normalizeField(name, raw);
  const type = entityType ?? Object.values(out)[0]?.entityType;
  if (!type) return out;
  for (const [key, patch] of Object.entries(FIELD_SCHEMA_OVERRIDES)) {
    const at = key.indexOf('.');
    const name = key.slice(at + 1);
    if (key.slice(0, at) !== type || out[name]) continue;
    out[name] = {
      name,
      displayName: name,
      entityType: type,
      dataType: 'text',
      editable: false,
      mandatory: false,
      unique: false,
      ...patch,
    };
  }
  return out;
}

/** The field name a type's own status lives under. Project's is a plain `list`. */
export function statusFieldNameFor(entityType: string): string {
  return entityType === 'Project' ? 'sg_status' : 'sg_status_list';
}

/**
 * The status field of an entity type. Every type but Project uses `sg_status_list`
 * (data type `status_list`); Project's is `sg_status`, a plain `list`. Prefer the
 * schema when you have it; the name guess is the fallback.
 *
 * The conventional name wins over any other `status_list` field on the type. A site
 * is free to add its own — a client status, a delivery status — and a schema read
 * answers them in no order the caller controls, so picking the first one found makes
 * a type's status whichever field the response happened to list first.
 */
export function statusFieldFor(entityType: string, fields?: Record<string, FieldSchema>): FieldSchema | string {
  const name = statusFieldNameFor(entityType);
  if (fields) {
    const own = fields[name];
    if (own) return own;
    const status = Object.values(fields).find((f) => f.dataType === 'status_list');
    if (status) return status;
  }
  return name;
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
