/**
 * Widget context.
 *
 * One object an app builds once and hands to every widget: a cached client, the
 * schema service and the status table. Widgets never construct a client or a
 * cache of their own, so two widgets on a page asking for the same type's fields
 * cost one request.
 */
import type { SgClient } from './client.js';
import type { QueryCache } from './query.js';
import { createQueryCache } from './query.js';
import type { SchemaService } from './schema-service.js';
import { createSchemaService } from './schema-service.js';
import type { StatusService } from './status-service.js';
import { createStatusService } from './status-service.js';
import { normalizeSiteUrl } from './presentation.js';

export interface SgContextOptions {
  client: SgClient;
  /** How long a row read stays fresh. Schema keeps its own hour-long cache. Default 30000. */
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
  /** Drop everything cached. Call it after a write. */
  invalidate(): void;
}

export function createSgContext(options: SgContextOptions): SgContext {
  const cache = createQueryCache(options.client, options.ttlMs === undefined ? {} : { ttlMs: options.ttlMs });
  // Schema is site configuration and does not move under a session, so it keeps a
  // longer cache than the row reads: `/schema/<Type>/fields` is 48KB and ~330ms (probe 002).
  const schema = createSchemaService(options.client);
  const statuses = createStatusService(options.client);
  return {
    client: cache,
    schema,
    statuses,
    siteUrl: normalizeSiteUrl(options.siteUrl),
    invalidate(): void {
      cache.invalidate();
      schema.invalidate();
      statuses.invalidate();
    },
  };
}
