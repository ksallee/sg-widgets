/**
 * A `SchemaClient` that answers from memory, for tests and demos.
 *
 * It holds the fields it creates, and reads the rest from the client it is given,
 * a `MockClient` as a rule. That client does not learn of a write made here: read
 * the schema back through this one.
 *
 * ```ts
 * const schema = new MockSchemaClient({ client: new MockClient() });
 * const { name } = await schema.createField('Shot', { dataType: 'text', displayName: 'Plate Note' });
 * ```
 */
import type { SgClient } from './client.js';
import { SgApiError } from './client.js';
import type { FieldSchema, RawFieldSchema, RawProperty } from './schema.js';
import { undeclaredField } from './schema.js';
import type { CreatedField, CreateFieldInput, FieldReadResult, ReviveFieldResult, SchemaClient, SchemaProperties, SchemaProperty } from './schema-write.js';
import { fieldFromRaw, SchemaApiError, toSchemaProperties } from './schema-write.js';

export interface MockSchemaFailure {
  /** HTTP status. Default 500. */
  status?: number;
  /** `errors[0].title`. */
  message?: string;
}

export interface MockSchemaClientOptions {
  /** Where the fields this client did not create are read from. Without one, only its own fields exist. */
  client?: Pick<SgClient, 'fields'>;
  /** Arm a failure for the very first call. */
  failNext?: MockSchemaFailure | null;
}

/** The properties a custom field reads as editable (040_field_revive). */
const EDITABLE_PROPERTIES = new Set(['description', 'custom_metadata']);

function refusal(status: number, error: { title?: string; detail?: string; source?: unknown }): SchemaApiError {
  const first = { status, code: status === 404 ? 104 : 103, title: error.title ?? null, source: error.source ?? null, detail: error.detail ?? null, meta: null };
  return new SchemaApiError(status, { errors: [first] });
}

function missing(entityType: string, field: string): SchemaApiError {
  return refusal(404, { title: 'Not Found', detail: `Field '${entityType}.${field}' does not exist.` });
}

/** `sg_`, lower case, and `_` for whatever is not a letter or a digit (019_create_fields). */
function programmaticName(displayName: string): string {
  return `sg_${displayName.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
}

function wrap<T>(value: T, editable = false): RawProperty<T> {
  return { value, editable };
}

/** A normalised field back in the wrapped shape the API answers. */
function rawFromField(field: FieldSchema): RawFieldSchema {
  const properties: Record<string, RawProperty<unknown>> = {};
  if (field.defaultValue !== undefined) properties['default_value'] = wrap(field.defaultValue);
  if (field.validValues) properties['valid_values'] = wrap(field.validValues);
  if (field.validTypes) properties['valid_types'] = wrap(field.validTypes);
  if (field.displayValues) properties['display_values'] = wrap(field.displayValues);
  if (field.hiddenValues) properties['hidden_values'] = wrap(field.hiddenValues);
  if (field.description) properties['description'] = wrap(field.description, true);
  return {
    name: wrap(field.displayName, true),
    entity_type: wrap(field.entityType),
    data_type: wrap(String(field.dataType)),
    editable: wrap(field.editable),
    mandatory: wrap(field.mandatory),
    unique: wrap(field.unique),
    visible: wrap(true, field.hideable ?? false),
    properties,
  };
}

function apply(raw: RawFieldSchema, changes: readonly SchemaProperty[]): RawFieldSchema {
  const next: RawFieldSchema = structuredClone(raw);
  for (const { property_name: key, value } of changes) {
    if (key === 'name') next.name = wrap(String(value), true);
    else if (key === 'visible') next.visible = wrap(Boolean(value), next.visible?.editable ?? true);
    else next.properties[key] = wrap(value, next.properties[key]?.editable ?? EDITABLE_PROPERTIES.has(key));
  }
  return next;
}

export class MockSchemaClient implements SchemaClient {
  private readonly base: Pick<SgClient, 'fields'> | null;
  /** Fields this client created or wrote, by `Type.field`. */
  private readonly live = new Map<string, RawFieldSchema>();
  /** Retired fields. The name stays taken and no read lists it (040_field_revive). */
  private readonly retired = new Map<string, RawFieldSchema>();
  /** Writes made at a project's scope, by `Type.field@project`. */
  private readonly scoped = new Map<string, SchemaProperty[]>();
  private pendingFailure: MockSchemaFailure | null;

  constructor(options: MockSchemaClientOptions = {}) {
    this.base = options.client ?? null;
    this.pendingFailure = options.failNext ?? null;
  }

  /** Make the next call reject with a `SchemaApiError`. Pass `null` to disarm. */
  failNext(failure: MockSchemaFailure | null = {}): void {
    this.pendingFailure = failure;
  }

  private gate(): void {
    const failure = this.pendingFailure;
    this.pendingFailure = null;
    if (failure) throw refusal(failure.status ?? 500, { title: failure.message ?? `Flow PT API error ${failure.status ?? 500}` });
  }

  /** The base client's fields of a type; an unknown type is its 404. */
  private async baseFields(entityType: string, projectId?: number): Promise<Record<string, FieldSchema>> {
    if (!this.base) return {};
    try {
      return await this.base.fields(entityType, projectId);
    } catch (error) {
      if (error instanceof SgApiError && !(error instanceof SchemaApiError)) {
        throw refusal(error.status, error.status === 404 ? { title: 'Not Found', detail: error.message } : { title: error.message });
      }
      throw error;
    }
  }

  /** Every live record of a type at a scope, this client's writes over the base client's fields. */
  private async records(entityType: string, projectId?: number): Promise<Record<string, RawFieldSchema>> {
    const out: Record<string, RawFieldSchema> = {};
    for (const [name, field] of Object.entries(await this.baseFields(entityType, projectId))) {
      const key = `${entityType}.${name}`;
      if (this.retired.has(key)) continue;
      const written = this.live.get(key);
      if (!written) {
        out[name] = rawFromField(field);
        continue;
      }
      // `hidden_values` is the one thing a project adds to a read (009_status_lists).
      const record = structuredClone(written);
      if (field.hiddenValues) record.properties['hidden_values'] = wrap(field.hiddenValues);
      else delete record.properties['hidden_values'];
      out[name] = record;
    }
    for (const [key, record] of this.live) {
      const name = key.slice(entityType.length + 1);
      if (key.startsWith(`${entityType}.`) && !out[name]) out[name] = structuredClone(record);
    }
    if (projectId !== undefined) {
      for (const [name, record] of Object.entries(out)) {
        const changes = this.scoped.get(`${entityType}.${name}@${projectId}`);
        if (changes) out[name] = apply(record, changes);
      }
    }
    return out;
  }

  async readField(entityType: string, field: string, projectId?: number): Promise<FieldReadResult> {
    this.gate();
    const raw = (await this.records(entityType, projectId))[field];
    if (raw) return { status: 'found', field: fieldFromRaw(entityType, field, raw), raw };
    // A field the row answers and the schema leaves out reads `data: null` (068_note_read_state).
    if (undeclaredField(entityType, field)) return { status: 'undeclared' };
    return { status: 'missing', message: missing(entityType, field).message };
  }

  async readRawFields(entityType: string, projectId?: number): Promise<Record<string, RawFieldSchema>> {
    this.gate();
    return this.records(entityType, projectId);
  }

  async createField(entityType: string, input: CreateFieldInput): Promise<CreatedField> {
    this.gate();
    const existing = await this.records(entityType);
    const given = toSchemaProperties(input.properties);
    const valueOf = (key: string): unknown => given.find((p) => p.property_name === key)?.value;
    const type = input.dataType;

    // What each data type needs, and the three that are refused (019_create_fields).
    if (type === 'color' || type === 'image') throw refusal(400, { title: 'Request Parameters invalid.', source: { data_type: ['data_type is not valid'] } });
    if (type === 'calculated') throw refusal(500, { title: 'NoMethodError' });
    if (type === 'checkbox' && typeof valueOf('default_value') !== 'boolean') throw refusal(500, { title: 'Only true or false allowed in checkbox' });
    if (type === 'entity' || type === 'multi_entity') {
      const validTypes = valueOf('valid_types');
      if (validTypes === undefined) throw refusal(400, { title: "missing required 'properties'" });
      if (!Array.isArray(validTypes) || validTypes.length !== 1) throw refusal(400, { title: "'valid_types' value expected Array with one element" });
    }

    // A name in use is suffixed at 201; a name a retired field holds is refused (reports/006, 040_field_revive).
    const wanted = programmaticName(input.displayName);
    let name = wanted;
    for (let n = 1; existing[name]; n += 1) name = `${wanted}_${n}`;
    if (this.retired.has(`${entityType}.${name}`)) {
      throw refusal(400, {
        title: `API schema_field_create() failed, there is a retired field with the same field_name: ${name}. Delete the retired field forever from the Trash Page in Shotgun and try again.`,
      });
    }

    const record = apply(
      {
        name: wrap(input.displayName, true),
        entity_type: wrap(entityType),
        data_type: wrap(type),
        editable: wrap(true),
        mandatory: wrap(false),
        unique: wrap(false),
        visible: wrap(true, true),
        properties: { default_value: wrap(null) },
      },
      given,
    );
    this.live.set(`${entityType}.${name}`, record);
    return { name, self: `/api/v1/schema/${entityType}/fields/${name}`, raw: structuredClone(record) as unknown as Record<string, unknown> };
  }

  async updateField(entityType: string, field: string, properties: SchemaProperties, projectId?: number): Promise<RawFieldSchema | null> {
    this.gate();
    const key = `${entityType}.${field}`;
    const current = (await this.records(entityType))[field];
    // The answer for a field that is not there is not measured; this is the 404 its delete answers.
    if (!current) throw missing(entityType, field);
    const changes = toSchemaProperties(properties);
    // The two properties measured as refused by name (040_field_revive, 114_schema_admin_recheck).
    for (const { property_name: name } of changes) {
      if (name === 'data_type') throw refusal(400, { title: "API schema_field_update() invalid property 'data_type'" });
      if (name === 'hidden_values') {
        throw refusal(400, {
          title: `API schema_field_update() invalid property 'hidden_values': Valid property names: ["name", "visible", "description", "summary_default", "default_value", "valid_values", "custom_metadata"]`,
        });
      }
    }
    if (projectId === undefined) {
      this.live.set(key, apply(current, changes));
    } else {
      // What a project-scoped write changes is not measured. It is kept to that project here.
      const scope = `${key}@${projectId}`;
      this.scoped.set(scope, [...(this.scoped.get(scope) ?? []), ...changes]);
    }
    return (await this.records(entityType, projectId))[field] ?? null;
  }

  async retireField(entityType: string, field: string): Promise<void> {
    this.gate();
    const current = (await this.records(entityType))[field];
    // A field already in the trash answers the same 404 as a name never used (114_schema_admin_recheck).
    if (!current) throw missing(entityType, field);
    const key = `${entityType}.${field}`;
    this.live.delete(key);
    this.retired.set(key, current);
  }

  async reviveField(entityType: string, field: string): Promise<ReviveFieldResult> {
    this.gate();
    const key = `${entityType}.${field}`;
    const record = this.retired.get(key);
    if (!record) {
      // The answer for a name with nothing retired is not measured; a 404 stands in for it.
      const error = missing(entityType, field);
      return { revived: false, status: error.status, message: error.message };
    }
    // It comes back as it was, at the data type it was created at (040_field_revive).
    this.retired.delete(key);
    this.live.set(key, record);
    return { revived: true };
  }
}
