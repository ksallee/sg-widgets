/**
 * Schema service.
 *
 * The one place a widget asks about types, fields, dotted paths and the statuses
 * a project offers. Every read goes through a `QueryCache`, so a type's fields
 * are fetched once however many widgets ask: `/schema/<Type>/fields` is 48KB and
 * ~330ms and must never be looped (probe 002).
 *
 * Field reads are site scope. `project_id` changes only `hidden_values`
 * (probe 009), so the project-scoped read is the single-field endpoint, 1.2KB
 * against 48KB.
 */
import type { EntityTypeInfo, SgClient } from './client.js';
import type { QueryCache } from './query.js';
import { createQueryCache } from './query.js';
import type { FieldSchema } from './schema.js';
import { statusFieldFor } from './schema.js';
import type { StatusOption } from './status.js';
import { intersectStatuses, usableStatuses } from './status.js';

/** One hour. Schema is site configuration; it does not move under a session. */
const DEFAULT_TTL_MS = 3_600_000;

export interface SchemaServiceOptions {
  /** How long a schema read stays fresh. Ignored when a `QueryCache` is passed in. Default one hour. */
  ttlMs?: number;
}

/** One step of a resolved dotted path. */
export interface PathSegment {
  /** Type this segment was read on. */
  entityType: string;
  /** Programmatic field name. */
  name: string;
  displayName: string;
  dataType: string;
  /** For a link that the path continues through: the type the next segment reads on. */
  through?: string;
  field: FieldSchema;
}

export interface SchemaService {
  /** Enabled types with their display names. */
  entityTypes(): Promise<EntityTypeInfo[]>;
  /** Every field of a type, at site scope. */
  fields(entityType: string): Promise<Record<string, FieldSchema>>;
  field(entityType: string, name: string): Promise<FieldSchema | undefined>;
  /** Codes the project hides on a list or status field. */
  hiddenValues(entityType: string, field: string, projectId: number): Promise<string[]>;
  /**
   * Statuses a picker may offer. Without `projectId` the site vocabulary, which hides nothing.
   * `field` names a list or status field other than the type's own status field.
   */
  statusOptions(entityType: string, projectId?: number, field?: string): Promise<StatusOption[]>;
  /** Statuses usable in every one of the projects. */
  statusOptionsForProjects(entityType: string, projectIds: number[], field?: string): Promise<StatusOption[]>;
  /** The type's status field, or its conventional name when the type has none. */
  statusField(entityType: string): Promise<FieldSchema | string>;
  /** Walk `entity.Shot.code` into its segments. Throws naming the whole path when a segment does not resolve. */
  resolvePath(rootType: string, dottedPath: string): Promise<PathSegment[]>;
  invalidate(): void;
}

function isQueryCache(client: SgClient | QueryCache): client is QueryCache {
  return typeof (client as QueryCache).invalidate === 'function';
}

export function createSchemaService(client: SgClient | QueryCache, options: SchemaServiceOptions = {}): SchemaService {
  const owned = !isQueryCache(client);
  const cache: QueryCache = owned ? createQueryCache(client, { ttlMs: options.ttlMs ?? DEFAULT_TTL_MS }) : client;

  async function fields(entityType: string): Promise<Record<string, FieldSchema>> {
    return cache.fields(entityType);
  }

  async function field(entityType: string, name: string): Promise<FieldSchema | undefined> {
    return (await fields(entityType))[name];
  }

  async function statusField(entityType: string): Promise<FieldSchema | string> {
    return statusFieldFor(entityType, await fields(entityType));
  }

  async function hiddenValues(entityType: string, name: string, projectId: number): Promise<string[]> {
    const scoped = await cache.fieldWithProject(entityType, name, projectId);
    return scoped.hiddenValues ?? [];
  }

  /** The status field's site vocabulary with the project's hidden codes attached. */
  async function scopedStatusField(entityType: string, projectId?: number, name?: string): Promise<FieldSchema | undefined> {
    const found = name === undefined ? await statusField(entityType) : (await fields(entityType))[name];
    if (found === undefined || typeof found === 'string') return undefined;
    if (projectId === undefined) return found;
    return { ...found, hiddenValues: await hiddenValues(entityType, found.name, projectId) };
  }

  return {
    entityTypes(): Promise<EntityTypeInfo[]> {
      return cache.entityTypes();
    },
    fields,
    field,
    hiddenValues,
    statusField,

    async statusOptions(entityType: string, projectId?: number, field?: string): Promise<StatusOption[]> {
      const found = await scopedStatusField(entityType, projectId, field);
      return found ? usableStatuses(found) : [];
    },

    async statusOptionsForProjects(entityType: string, projectIds: number[], field?: string): Promise<StatusOption[]> {
      if (projectIds.length === 0) return [];
      const scoped = await Promise.all(projectIds.map((id) => scopedStatusField(entityType, id, field)));
      const present = scoped.filter((f): f is FieldSchema => f !== undefined);
      return present.length === projectIds.length ? intersectStatuses(present) : [];
    },

    async resolvePath(rootType: string, dottedPath: string): Promise<PathSegment[]> {
      const parts = dottedPath.split('.').filter(Boolean);
      if (parts.length === 0) throw new Error(`Empty field path on ${rootType}.`);
      // A path is `field`, or `field.Type.field` repeated: every hop names the type it travels through.
      if (parts.length % 2 === 0) throw new Error(`${rootType}.${dottedPath} is not a field path: it ends on a type.`);
      const segments: PathSegment[] = [];
      let entityType = rootType;
      let i = 0;
      while (i < parts.length) {
        const name = parts[i] as string;
        const schema = (await fields(entityType))[name];
        if (!schema) throw new Error(`${rootType}.${dottedPath} does not exist: ${entityType} has no field '${name}'.`);
        const last = i === parts.length - 1;
        if (last) {
          segments.push({ entityType, name, displayName: schema.displayName, dataType: schema.dataType, field: schema });
          break;
        }
        // A dotted path names the type it travels through, and a projection checks that
        // middle segment against the field's `valid_types` (probe 059).
        const through = parts[i + 1] as string;
        if (!schema.validTypes?.includes(through)) {
          throw new Error(`${rootType}.${dottedPath} does not exist: ${entityType}.${name} does not link ${through}.`);
        }
        segments.push({ entityType, name, displayName: schema.displayName, dataType: schema.dataType, through, field: schema });
        entityType = through;
        i += 2;
      }
      return segments;
    },

    invalidate(): void {
      // A shared cache holds the caller's row reads too, so drop only the schema keys.
      if (owned) cache.invalidate();
      else for (const prefix of ['entityTypes', 'fields', 'fieldWithProject']) cache.invalidate(prefix);
    },
  };
}
