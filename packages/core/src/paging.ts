/**
 * Paging rules.
 *
 * One vocabulary for every collection that pages: `pages` walks the set with a
 * page number, `more` appends on a load-more row, `scroll` appends when the
 * scroller reaches the last loaded row. A widget draws the rows and asks these
 * for the decisions: whether the set is exhausted, whether the next page may be
 * asked for now, and what the groups are after a page lands.
 *
 * A read carries no total and `links.next` is emitted forever, so the end of the
 * set is a short page and nothing else (006_pagination).
 */
import type { EntityRow } from './client.js';
import type { EntitySourceState, RowGroup, SourceMode } from './collection.js';
import { groupRows } from './collection.js';

/** How a collection walks a set: a page number, a load-more row, or the scroller. */
export type PagingMode = 'pages' | 'more' | 'scroll';

/** Rows before the last at which a scroller asks for the next page. */
export const SCROLL_THRESHOLD = 5;

/** The source mode a paging mode needs: `pages` shows one page, the other two append. */
export function sourceModeFor(paging: PagingMode): SourceMode {
  return paging === 'pages' ? 'pages' : 'infinite';
}

/**
 * True when every row the filter matches is loaded.
 *
 * A set that has never been read has not reached its end, however empty it is.
 */
export function reachedEnd(state: EntitySourceState): boolean {
  return state.status !== 'idle' && state.status !== 'loading' && !state.hasMore;
}

/** True when the next page may be asked for now. */
export function canLoadNext(state: EntitySourceState, paging: PagingMode): boolean {
  if (paging === 'pages' || !state.hasMore) return false;
  return state.status === 'ready' || state.status === 'error';
}

/** True when a read failed with rows already on screen: the error belongs under them, with a retry. */
export function hasFailedPage(state: EntitySourceState): boolean {
  return state.status === 'error' && state.rows.length > 0;
}

export interface LoadNextOptions {
  paging: PagingMode;
  /** Index of the last row the viewport reaches. -1 when none is. */
  lastVisible: number;
  /** Rows before the last at which the next page is asked for. Default `SCROLL_THRESHOLD`. */
  threshold?: number;
}

/**
 * True when the scroller has reached far enough down for the next page.
 *
 * A failed page is not retried here, only on the retry the error line carries:
 * a scroller that retried on its own would ask again on every pixel.
 */
export function shouldLoadNext(state: EntitySourceState, options: LoadNextOptions): boolean {
  if (options.paging !== 'scroll' || state.status !== 'ready' || !canLoadNext(state, options.paging)) return false;
  return options.lastVisible >= state.rows.length - 1 - (options.threshold ?? SCROLL_THRESHOLD);
}

/**
 * True when a cursor stepping to `index` runs past the loaded rows and should ask
 * for the next page instead of moving. The cursor stays where it is until the rows
 * arrive.
 */
export function loadsOnArrowDown(state: EntitySourceState, paging: PagingMode, index: number): boolean {
  return canLoadNext(state, paging) && index >= state.rows.length;
}

/** A contiguous run of rows sharing a value, under the key a collapsed group is named by. */
export interface KeyedRowGroup extends RowGroup {
  key: string;
}

/**
 * Contiguous runs with a stable key.
 *
 * The key is the run's position and its value, so a page whose first rows carry
 * the value the last run carries grows that run rather than opening a second one,
 * and a group shut before the page arrived is still shut after it.
 */
export function groupRowsKeyed(rows: readonly EntityRow[], path: string): KeyedRowGroup[] {
  return groupRows(rows, path).map((bucket, at) => ({
    ...bucket,
    key: `group:${at}:${JSON.stringify(bucket.value ?? null)}`,
  }));
}
