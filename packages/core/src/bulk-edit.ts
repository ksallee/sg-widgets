/**
 * Bulk edit.
 *
 * One cell's new value applied to the same column in every selected row, as Flow PT's own grid
 * does. The plan says which rows the edit reaches and why it leaves the others; a source writes it
 * and answers a result per row. A write is confirmed by the row read back, never by its status
 * (028_loud_and_silent).
 */
import type { EntityRow } from './client.js';
import { rowKey } from './collection.js';
import type { EntityRef } from './filter.js';

/** One row's write: the fields to set on it. */
export interface RowUpdate {
  ref: EntityRef;
  patch: Record<string, unknown>;
}

/** What one row's write did: the row as it reads now, or why it was refused. */
export type RowWriteResult =
  | { ref: EntityRef; ok: true; row: EntityRow }
  | { ref: EntityRef; ok: false; message: string };

/** A selected row the edit leaves, and why. */
export interface SkippedRow {
  row: EntityRow;
  reason: string;
}

/** One cell's value applied to a column over the selected rows. */
export interface BulkEdit {
  /** The column's path. */
  path: string;
  value: unknown;
  /** True when the edited row is one of two or more selected rows. */
  bulk: boolean;
  /** The rows the edit writes, the edited row first. */
  rows: EntityRow[];
  /** Selected rows on screen whose cell cannot be edited. */
  skipped: SkippedRow[];
  /** Selected rows not loaded, which the edit does not reach. */
  unloaded: number;
}

export interface BulkEditInput {
  /** The rows on screen, in their order. */
  rows: readonly EntityRow[];
  selection: readonly EntityRef[];
  /** The row whose cell was edited. */
  edited: EntityRow;
  path: string;
  value: unknown;
  /** Why a row's cell at `path` cannot be edited, or null when it can. */
  lockOf: (row: EntityRow) => string | null;
}

/**
 * The edit as it would land. It reaches the edited row alone unless that row is one of two or more
 * selected rows; then it reaches every selected row on screen whose cell can be edited, in row
 * order after the edited one.
 */
export function planBulkEdit(input: BulkEditInput): BulkEdit {
  const { edited, path, value } = input;
  const selected = new Set(input.selection.map(rowKey));
  const editedKey = rowKey(edited);
  if (!selected.has(editedKey) || selected.size < 2) {
    return { path, value, bulk: false, rows: [edited], skipped: [], unloaded: 0 };
  }
  const rows: EntityRow[] = [edited];
  const skipped: SkippedRow[] = [];
  const loaded = new Set<string>();
  for (const row of input.rows) {
    const key = rowKey(row);
    if (!selected.has(key) || loaded.has(key)) continue;
    loaded.add(key);
    if (key === editedKey) continue;
    const reason = input.lockOf(row);
    if (reason === null) rows.push(row);
    else skipped.push({ row, reason });
  }
  loaded.add(editedKey);
  const unloaded = [...selected].filter((key) => !loaded.has(key)).length;
  return { path, value, bulk: true, rows, skipped, unloaded };
}

/** The writes a plan makes: the same field set on each row it reaches. */
export function bulkUpdates(edit: BulkEdit): RowUpdate[] {
  return edit.rows.map((row) => ({ ref: { type: row.type, id: row.id }, patch: { [edit.path]: edit.value } }));
}

/** How many of the results landed and how many were refused. */
export function countResults(results: readonly RowWriteResult[]): { landed: number; refused: number } {
  const landed = results.filter((result) => result.ok).length;
  return { landed, refused: results.length - landed };
}

/** The message of an error, whatever was thrown. */
function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Write each update with `write`, one at a time, and answer a result per update in order. A
 * refusal is a result, not a throw, so one refused row never stops the rest.
 */
export async function writeEach(
  updates: readonly RowUpdate[],
  write: (update: RowUpdate) => Promise<EntityRow>,
): Promise<RowWriteResult[]> {
  const results: RowWriteResult[] = [];
  for (const update of updates) {
    try {
      results.push({ ref: update.ref, ok: true, row: await write(update) });
    } catch (error) {
      results.push({ ref: update.ref, ok: false, message: messageOf(error) });
    }
  }
  return results;
}
