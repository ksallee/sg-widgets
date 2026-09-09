/**
 * Status service.
 *
 * The site's Status table, read once and indexed by code. A Status carries the
 * colour and the icon; the codes a given field offers come from the field schema
 * instead (probe 009), so this answers "what does `apr` look like", never "may I
 * use `apr` here".
 *
 * Statuses are site-wide and keyed by code, not per entity type (probe 010).
 */
import type { SgClient } from './client.js';
import type { StatusRecord } from './status.js';

export interface StatusService {
  /** Every Status on the site. Fetched once. */
  all(): Promise<StatusRecord[]>;
  /** The table indexed by code. The first row wins when a code repeats. */
  byCode(): Promise<ReadonlyMap<string, StatusRecord>>;
  /** One status, or `undefined` for a code with no Status behind it, such as a plain `list` value. */
  record(code: string): Promise<StatusRecord | undefined>;
  invalidate(): void;
}

export function createStatusService(client: SgClient): StatusService {
  let table: Promise<ReadonlyMap<string, StatusRecord>> | null = null;

  function load(): Promise<ReadonlyMap<string, StatusRecord>> {
    if (table) return table;
    const pending = client.statuses().then(
      (records) => {
        const index = new Map<string, StatusRecord>();
        for (const record of records) if (!index.has(record.code)) index.set(record.code, record);
        return index as ReadonlyMap<string, StatusRecord>;
      },
      (error: unknown) => {
        // A failure is not remembered, so the next call retries.
        if (table === pending) table = null;
        throw error;
      },
    );
    table = pending;
    return pending;
  }

  return {
    async all(): Promise<StatusRecord[]> {
      return [...(await load()).values()];
    },
    byCode(): Promise<ReadonlyMap<string, StatusRecord>> {
      return load();
    },
    async record(code: string): Promise<StatusRecord | undefined> {
      return (await load()).get(code);
    },
    invalidate(): void {
      table = null;
    },
  };
}
