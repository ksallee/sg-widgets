/**
 * Widget context.
 *
 * One object an app builds once and hands to every widget: a cached client, the
 * schema service, the status table and the site preferences the render layer
 * needs. Widgets never construct a client or a cache of their own, so two
 * widgets on a page asking for the same type's fields cost one request.
 */
import type { SgClient } from './client.js';
import type { QueryCache } from './query.js';
import { createQueryCache } from './query.js';
import type { FieldTextOptions } from './render.js';
import type { SchemaService } from './schema-service.js';
import { createSchemaService } from './schema-service.js';
import type { StatusService } from './status-service.js';
import { createStatusService } from './status-service.js';
import { normalizeSiteUrl } from './presentation.js';

/** One hour. Schema and the Status table are site configuration; they do not move under a session. */
const SITE_TTL_MS = 3_600_000;

/**
 * What the site decides about display. None of it is on a field: the unit behind
 * a duration is `hours_per_day` from `GET /preferences` (field_types/duration),
 * and nothing at all names the frame rate behind a timecode
 * (field_types/timecode), so the app supplies that one.
 */
export interface SitePreferences {
  /** The site's `hours_per_day`; a duration then renders in days. */
  hoursPerDay?: number;
  locale?: string;
  /** IANA zone a `date_time` is shown in. Defaults to the runtime's. */
  timeZone?: string;
  /** Frames a second, for a timecode. Given, a timecode gains its frame digits. */
  frameRate?: number;
}

export interface SgContextOptions extends SitePreferences {
  client: SgClient;
  /** How long a row read stays fresh. Schema and statuses keep their own hour-long cache. Default 30000. */
  ttlMs?: number;
  /** The web app this data comes from, so widgets can link a row to its page. */
  siteUrl?: string;
}

export interface SgContext {
  /** The cached client. Widgets read rows through this, not through the one passed in. */
  client: QueryCache;
  schema: SchemaService;
  statuses: StatusService;
  /** The web app this data comes from, without its trailing slash. Empty when the app named none. */
  siteUrl: string;
  /** What the site decides about display. Empty when the app named nothing. */
  preferences: SitePreferences;
  /** Drop everything cached. Call it after a write. */
  invalidate(): void;
}

export function createSgContext(options: SgContextOptions): SgContext {
  const rows = createQueryCache(options.client, options.ttlMs === undefined ? {} : { ttlMs: options.ttlMs });
  // Schema and the Status table share a cache of their own, longer than the row reads:
  // `/schema/<Type>/fields` is 48KB and ~330ms (probe 002), and the Status table is one
  // read for the whole site (probe 010).
  const site = createQueryCache(options.client, { ttlMs: SITE_TTL_MS });
  const schema = createSchemaService(site);
  const statuses = createStatusService(site);
  return {
    client: rows,
    schema,
    statuses,
    siteUrl: normalizeSiteUrl(options.siteUrl),
    preferences: preferencesFrom(options),
    invalidate(): void {
      rows.invalidate();
      schema.invalidate();
      statuses.invalidate();
    },
  };
}

const byClient = new WeakMap<SgClient, SgContext>();

/**
 * The context for a bare client, built once. A widget given a client and no
 * context calls this, and every widget on the page handed that client shares its
 * caches. The options are read on the first call for a client; a later call
 * returns what that one built.
 */
export function contextFromClient(client: SgClient, options: Omit<SgContextOptions, 'client'> = {}): SgContext {
  const built = byClient.get(client);
  if (built) return built;
  const context = createSgContext({ ...options, client });
  byClient.set(client, context);
  return context;
}

/** The site preferences a formatter takes, ready to spread into `fieldText`. */
export function preferencesOf(context?: { preferences?: SitePreferences } | null): FieldTextOptions {
  return preferencesFrom(context?.preferences ?? {});
}

function preferencesFrom(source: SitePreferences): SitePreferences {
  return {
    ...(source.hoursPerDay === undefined ? {} : { hoursPerDay: source.hoursPerDay }),
    ...(source.locale === undefined ? {} : { locale: source.locale }),
    ...(source.timeZone === undefined ? {} : { timeZone: source.timeZone }),
    ...(source.frameRate === undefined ? {} : { frameRate: source.frameRate }),
  };
}
