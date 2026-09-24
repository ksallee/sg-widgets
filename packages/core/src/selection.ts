/**
 * Multi-select over a collection's loaded rows.
 *
 * A press toggles a row and anchors on it; Shift carries a range from the anchor to
 * the row pressed, selecting or clearing it as the anchor went; the Shift arrows move
 * the far end of that range one row at a time. The range is laid over the selection
 * the anchor was set on, so a second Shift+press moves the far end rather than
 * adding to the first range, and picks outside the loaded rows are kept.
 *
 * Rows are keyed `Type:id`, as a selection is.
 */
import type { EntityRow } from './client.js';
import { rowKey } from './collection.js';
import type { RowDisabledFn } from './collection-state.js';
import { rowIsDisabled, sameRefs } from './collection-state.js';
import type { EntityRef } from './filter.js';

/** Where a range starts and what it is laid over. */
export interface SelectionAnchor {
  /** The row the range runs from, `Type:id`. */
  key: string;
  /** True when the range selects, false when it clears: what the anchor row became. */
  on: boolean;
  /** The selection the range is laid over. */
  base: EntityRef[];
  /** The selection the last step produced. One that no longer reads this has moved under the anchor. */
  last: EntityRef[];
}

/** A selection and the anchor the next Shift gesture ranges from. */
export interface SelectionStep {
  selection: EntityRef[];
  anchor: SelectionAnchor | null;
}

/** What a press on a row does: toggle it, or range to it. */
export type SelectionGesture = 'toggle' | 'range';

/** What a key does to the selection. */
export type SelectionKeyIntent = 'toggle' | 'extend-up' | 'extend-down' | 'all';

interface Modifiers {
  shiftKey?: boolean;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
}

const refOf = (row: EntityRow): EntityRef => ({ type: row.type, id: row.id });

/** Shift ranges; a plain press and Cmd or Ctrl both toggle. */
export function gestureOf(event: Modifiers): SelectionGesture {
  return event.shiftKey ? 'range' : 'toggle';
}

/** Space toggles, Shift+ArrowUp and Shift+ArrowDown extend, Cmd or Ctrl+A takes every loaded row. */
export function selectionKeyIntent(event: Modifiers & { key: string }): SelectionKeyIntent | null {
  const command = event.metaKey || event.ctrlKey;
  if (event.key === ' ' && !command && !event.altKey) return 'toggle';
  if (event.shiftKey && !command && !event.altKey) {
    if (event.key === 'ArrowDown') return 'extend-down';
    if (event.key === 'ArrowUp') return 'extend-up';
  }
  if (command && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'a') return 'all';
  return null;
}

/** `selection` with every ref of `refs` added, or every one of them dropped. */
export function setRefs(selection: readonly EntityRef[], refs: readonly EntityRef[], on: boolean): EntityRef[] {
  const named = new Set(refs.map(rowKey));
  if (!on) return selection.filter((entry) => !named.has(rowKey(entry)));
  const held = new Set(selection.map(rowKey));
  return [...selection, ...refs.filter((entry) => !held.has(rowKey(entry))).map((entry) => ({ ...entry }))];
}

/** Toggle the row at `index` and anchor on it. A disabled row refuses. */
export function toggleRow(
  selection: readonly EntityRef[],
  anchor: SelectionAnchor | null,
  rows: readonly EntityRow[],
  index: number,
  isRowDisabled?: RowDisabledFn | null,
): SelectionStep {
  const row = rows[index];
  if (!row || rowIsDisabled(row, isRowDisabled)) return { selection: [...selection], anchor };
  const key = rowKey(row);
  const on = !selection.some((entry) => rowKey(entry) === key);
  const next = setRefs(selection, [refOf(row)], on);
  return { selection: next, anchor: { key, on, base: next, last: next } };
}

/**
 * Range from the anchor to the row at `index`, skipping disabled rows.
 *
 * With no anchor among the rows, the row pressed is selected and becomes the anchor.
 */
export function extendRange(
  selection: readonly EntityRef[],
  anchor: SelectionAnchor | null,
  rows: readonly EntityRow[],
  index: number,
  isRowDisabled?: RowDisabledFn | null,
): SelectionStep {
  const row = rows[index];
  if (!row) return { selection: [...selection], anchor };
  const from = anchor ? rows.findIndex((entry) => rowKey(entry) === anchor.key) : -1;
  if (!anchor || from < 0) {
    if (rowIsDisabled(row, isRowDisabled)) return { selection: [...selection], anchor };
    const next = setRefs(selection, [refOf(row)], true);
    return { selection: next, anchor: { key: rowKey(row), on: true, base: next, last: next } };
  }
  // A selection the anchor did not produce moved under it: the header box, Cmd+A or the host.
  const base = sameRefs(selection, anchor.last) ? anchor.base : [...selection];
  const [lo, hi] = from <= index ? [from, index] : [index, from];
  const range = rows.slice(lo, hi + 1).filter((entry) => !rowIsDisabled(entry, isRowDisabled)).map(refOf);
  const next = setRefs(base, range, anchor.on);
  return { selection: next, anchor: { ...anchor, base, last: next } };
}

/**
 * Shift+arrow: move the far end of the range from row `from` to row `to`. With no
 * anchor among the rows, the row the cursor leaves becomes one, selecting.
 */
export function extendByStep(
  selection: readonly EntityRef[],
  anchor: SelectionAnchor | null,
  rows: readonly EntityRow[],
  from: number,
  to: number,
  isRowDisabled?: RowDisabledFn | null,
): SelectionStep {
  const start = rows[from];
  const anchored = anchor !== null && rows.some((entry) => rowKey(entry) === anchor.key);
  const held = anchored || !start ? anchor : { key: rowKey(start), on: true, base: [...selection], last: [...selection] };
  return extendRange(selection, held, rows, to, isRowDisabled);
}

/** What the line offering the whole set reads. */
export interface MatchingOffer {
  show: boolean;
  /** How many rows the set holds, when something counted it. */
  total: number | null;
}

/**
 * Whether to offer every row the filter matches: once every loaded row is picked and
 * the set holds more than is loaded, until the selection covers a counted set.
 */
export function matchingOffer(state: {
  allLoaded: boolean;
  loaded: number;
  selected: number;
  hasMore: boolean;
  total: number | null;
}): MatchingOffer {
  const { allLoaded, loaded, selected, hasMore, total } = state;
  const more = hasMore || (total !== null && total > loaded);
  const covered = total !== null && selected >= total;
  return { show: allLoaded && more && !covered, total };
}
