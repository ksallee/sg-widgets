/**
 * The chrome a popup list wears: what its live region says, and how far its edges
 * have more content past them.
 *
 * Both registries draw the same row and read the same variables, so the wording and
 * the arithmetic are settled here rather than twice in the UI packages.
 */

import type { StateLabels } from './state.js';
import { stateLine } from './state.js';

/** A read is on its way and the list is standing by. */
export const SEARCHING_LABEL = 'Searching…';

/** What the live row says about a list that answered. */
export function countLine(count: number): string {
  return count === 1 ? '1 result' : `${count} results`;
}

/** What the live row is told about the list under it. */
export interface ListStatusState {
  /** A read is in flight. */
  loading: boolean;
  /** Rows on show. */
  count: number;
  /** What the failed read said, or null. */
  error?: string | null;
  /** Nothing is announced until something has been asked for. */
  asked?: boolean;
}

/**
 * The one line a list's live region carries.
 *
 * A failure wins, then a read in flight, then what the read answered. Nothing is
 * announced before anything has been asked for, so an idle list stays silent.
 */
export function listStatus(state: ListStatusState, labels: StateLabels = {}): string {
  if (state.error !== null && state.error !== undefined && state.error !== '') {
    return stateLine('error', labels, state.error);
  }
  if (state.loading) return SEARCHING_LABEL;
  if (state.asked === false) return '';
  if (state.count === 0) return stateLine('empty', labels);
  return countLine(state.count);
}

/** How far a scroller has more content past each of its edges, in pixels. */
export interface OverflowEdges {
  start: number;
  end: number;
}

/** The room above and below what a scroller shows. */
export function overflowEdges(scrollTop: number, scrollHeight: number, clientHeight: number): OverflowEdges {
  const start = Math.max(0, Math.round(scrollTop));
  const end = Math.max(0, Math.round(scrollHeight - clientHeight - scrollTop));
  return { start, end };
}

/** The variables the fade reads. The names are Base UI's, so one class string serves both registries. */
export const OVERFLOW_START_VAR = '--scroll-area-overflow-y-start';
export const OVERFLOW_END_VAR = '--scroll-area-overflow-y-end';

/** Write a scroller's overflow onto itself, so the fade on each edge follows what is past it. */
export function markOverflow(list: HTMLElement | null | undefined): boolean {
  if (!list) return false;
  const { start, end } = overflowEdges(list.scrollTop, list.scrollHeight, list.clientHeight);
  list.style.setProperty(OVERFLOW_START_VAR, `${start}px`);
  list.style.setProperty(OVERFLOW_END_VAR, `${end}px`);
  if (start + end > 0) list.setAttribute('data-has-overflow-y', '');
  else list.removeAttribute('data-has-overflow-y');
  return true;
}

/**
 * Keep a scroller's overflow variables current while it is on screen.
 *
 * The measurement follows a scroll, a resize of the scroller and a change to what it
 * holds, which is every way the room past an edge can move. Returns the teardown.
 */
export function watchOverflow(list: HTMLElement | null | undefined): () => void {
  if (!list) return () => {};
  const read = (): void => {
    markOverflow(list);
  };
  read();
  list.addEventListener('scroll', read, { passive: true });
  const resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(read);
  resize?.observe(list);
  const mutation = typeof MutationObserver === 'undefined' ? null : new MutationObserver(read);
  mutation?.observe(list, { childList: true, subtree: true, characterData: true });
  return () => {
    list.removeEventListener('scroll', read);
    resize?.disconnect();
    mutation?.disconnect();
  };
}
