/**
 * The state and behaviour every collection shares.
 *
 * The table, the grid and the grouped list draw three different things over one
 * model: a source read through `collection-source`, a selection, a keyboard
 * cursor that skips disabled rows and asks for the next page at the end, a
 * virtualiser over the lines of that layout, and the scroll and load-more
 * triggers of the `paging` prop. That model lives here; a widget supplies its
 * layout and draws the markup.
 *
 * It is two calls, because a layout's lines are derived from the rows: the
 * control answers the source, the widget shapes its own lines out of the rows,
 * then the body wires the virtualiser and the cursor over them. A layout says
 * three things about its markup: how many lines it draws, which line a row sits
 * on, and which element takes the cursor.
 */
import { useEffect, useRef, useState } from 'react';
import type {
  EntityRef,
  EntityRow,
  EntitySource,
  PagingMode,
  RowDisabledFn,
  RowIdFn,
  SortSpec,
  SourceFilters,
} from 'sg-widgets-core';
import {
  collectionBottom,
  collectionView,
  describePaging,
  firstEnabledIndex,
  hasFailedPage,
  loadsOnArrowDown,
  rowIdOf,
  rowIsDisabled,
  rowKey,
  sameRefs,
  selectableRefs,
  selectionState,
  shouldLoadNext,
  stateLine,
  toggleRef,
} from 'sg-widgets-core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useCollectionSource, useLatest } from '@/registry/sg/components/collection-source';

export { useLatest };

/** The root box and the regions beside it, worn by every collection. */
export const COLLECTION_ROOT = 'flex w-full min-w-0 flex-col gap-2';
export const COLLECTION_REGION = 'flex w-full min-w-0 flex-wrap items-center gap-2';

export interface CollectionControlOptions {
  source: EntitySource;
  /** How the set is walked. The source follows it rather than the other way round. */
  paging: PagingMode;
  sort?: SortSpec[];
  onSortChange?: (sort: SortSpec[]) => void;
  filters?: SourceFilters;
  onFiltersChange?: (filters: SourceFilters) => void;
  /** The selected rows. Controlled, with the collection's own selection as the fallback. */
  selection?: EntityRef[];
  onSelectionChange?: (rows: EntityRef[]) => void;
  getRowId?: RowIdFn;
  isRowDisabled?: RowDisabledFn;
  loadingLabel?: string;
}

export function useCollectionControl(options: CollectionControlOptions) {
  const { source, paging, getRowId, isRowDisabled, onSelectionChange } = options;

  const bound = useCollectionSource({
    source,
    paging,
    sort: options.sort,
    onSortChange: options.onSortChange,
    filters: options.filters,
    onFiltersChange: options.onFiltersChange,
  });
  const snapshot = bound.snapshot;
  const rows = snapshot.rows;
  const pager = describePaging(snapshot);
  /** A page that failed under rows already loaded, which the bottom block reports. */
  const pageError = hasFailedPage(snapshot);
  const loadingText = stateLine('loading', { loadingLabel: options.loadingLabel });

  const rowId = (row: EntityRow): string => rowIdOf(row, getRowId);
  const rowDisabled = (row: EntityRow): boolean => rowIsDisabled(row, isRowDisabled);
  const disabledAt = (index: number): boolean => {
    const row = rows[index];
    return row === undefined || rowDisabled(row);
  };

  const [ownSelection, setOwnSelection] = useState<EntityRef[]>([]);
  const selection = options.selection ?? ownSelection;
  /** The selection as keys, so a row asks whether it is in it in constant time. */
  const chosenKeys = new Set(selection.map(rowKey));

  function setSelection(next: EntityRef[]): void {
    if (sameRefs(next, selection)) return;
    setOwnSelection(next);
    onSelectionChange?.(next);
  }

  return {
    source,
    paging,
    snapshot,
    rows,
    pager,
    pageError,
    loadingText,
    /** Which of the four things the body shows, over the lines the layout drew. */
    view: (lines: number) => collectionView(snapshot, lines),
    /** What sits under the last row: a failed page, a page on the way, a row or a sentinel. */
    bottom: collectionBottom(snapshot, paging),
    retry: bound.retry,
    rowId,
    rowDisabled,
    disabledAt,

    isSelected: (row: EntityRow): boolean => chosenKeys.has(rowKey(row)),
    /** Add or drop one row. A disabled row refuses. */
    toggle: (row: EntityRow): void => {
      if (rowDisabled(row)) return;
      setSelection(toggleRef(selection, { type: row.type, id: row.id }));
    },
    /** The tri-state a header checkbox reads. */
    allSelected: selectionState(rows, selection, isRowDisabled),
    /** Take or drop every loaded row that is not disabled. */
    toggleAll: (on: boolean): void => setSelection(on ? selectableRefs(rows, isRowDisabled) : []),
  };
}

export type CollectionControl = ReturnType<typeof useCollectionControl>;

/**
 * What a layout tells the base about its own markup.
 *
 * `lines` is what the virtualiser walks: rows for a table, lines of tiles for a
 * grid, headers and rows as one stream for a grouped list. The two maps carry a
 * row index to and from a line, so the base can scroll to a row and say which
 * row the viewport ends on without knowing what a line holds.
 */
export interface CollectionLayout {
  /** Lines the virtualiser walks. */
  lines: number;
  /** What `virtualizeAfter` is measured against: rows, where a line holds several. */
  measured: number;
  /** A line's height in pixels, before it is drawn. */
  lineHeight: number;
  /** Lines drawn outside the viewport. */
  overscan: number;
  /** Rows above which the body is virtualised. */
  virtualizeAfter: number;
  /** The line a row sits on. -1 when the row is not drawn. */
  lineOfRow: (index: number, row: EntityRow, id: string) => number;
  /** The last row the viewport reaches, given the last line it drew. */
  lastRowOfLine: (line: number) => number;
  /** The element the cursor lands on. `extra` is the table's column, if any. */
  cursorTarget: (index: number, row: EntityRow, id: string, extra: string | null) => HTMLElement | null | undefined;
}

/** The window the virtualiser leaves, in lines, with the space above and below it. */
export interface CollectionWindow {
  before: number;
  after: number;
  from: number;
  to: number;
}

/** The virtualiser, the cursor and the scroll trigger over one layout's lines. */
export function useCollectionBody(control: CollectionControl, layout: CollectionLayout) {
  const { source, paging, rows, snapshot } = control;

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualized = layout.measured > layout.virtualizeAfter;
  const virtualizer = useVirtualizer({
    count: virtualized ? layout.lines : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => layout.lineHeight,
    overscan: layout.overscan,
  });

  const items = virtualizer.getVirtualItems();
  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  /** The lines on screen, with the space the ones above and below take. */
  const window_: CollectionWindow | null = !virtualized
    ? null
    : !firstItem || !lastItem
      ? { before: 0, after: 0, from: 0, to: -1 }
      : {
          before: firstItem.start,
          after: virtualizer.getTotalSize() - lastItem.end,
          from: firstItem.index,
          to: lastItem.index,
        };

  /* the cursor ----------------------------------------------------------- */

  /** The one tab stop of a roving layout, which never lands on a disabled row. */
  const [cursor, setCursor] = useState(0);
  const active =
    rows.length === 0 ? -1 : firstEnabledIndex(rows.length, Math.min(cursor, rows.length - 1), 1, control.disabledAt);

  /** The row a cursor is waiting on, until the page it asked for lands. */
  const [wanted, setWanted] = useState<{ index: number; extra: string | null } | null>(null);

  /** Put the cursor on one row, drawing it first where it is outside the window. */
  function focusRow(index: number, extra: string | null = null): void {
    const at = Math.max(0, Math.min(index, rows.length - 1));
    const row = rows[at];
    if (!row) return;
    setCursor(at);
    const id = control.rowId(row);
    const put = (): void => {
      const target = layout.cursorTarget(at, row, id, extra);
      if (!target) return;
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: 'nearest' });
    };
    if (virtualized) {
      const line = layout.lineOfRow(at, row, id);
      if (line >= 0) virtualizer.scrollToIndex(line);
      requestAnimationFrame(put);
    } else put();
  }

  /**
   * Ask for the next page where the cursor has run past the loaded rows, and hold it
   * where it is until those rows arrive. False when the step is an ordinary move.
   */
  function askForPage(index: number, extra: string | null = null): boolean {
    if (!loadsOnArrowDown(snapshot, paging, index)) return false;
    setWanted({ index, extra });
    void source.loadMore();
    return true;
  }

  const focusLatest = useLatest(focusRow);
  useEffect(() => {
    if (!wanted) return;
    if (snapshot.status === 'error') setWanted(null);
    else if (rows.length > wanted.index) {
      setWanted(null);
      focusLatest.current(wanted.index, wanted.extra);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wanted, rows, snapshot.status]);

  /* scroll paging -------------------------------------------------------- */

  // The virtualiser's own range says which line the viewport ends on, and the layout
  // says which row that is: a group header only ever makes the scroller ask later.
  const lastVisible = lastItem ? layout.lastRowOfLine(lastItem.index) : -1;
  useEffect(() => {
    if (!virtualized || lastVisible < 0) return;
    if (shouldLoadNext(snapshot, { paging, lastVisible })) void source.loadMore();
  }, [source, paging, virtualized, lastVisible, snapshot]);

  // A body short enough not to be virtualised has no range to read, so the last row
  // carries a sentinel instead.
  // The element is held as state, not as a ref: a read that redraws the rows replaces
  // the sentinel, and the observer has to move to the one that is on the page now.
  const [sentinel, setSentinel] = useState<HTMLElement | null>(null);
  const snapshotLatest = useLatest(snapshot);
  useEffect(() => {
    const scroller = scrollRef.current;
    const target = sentinel;
    if (!scroller || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        const state = snapshotLatest.current;
        if (shouldLoadNext(state, { paging, lastVisible: state.rows.length - 1 })) void source.loadMore();
      },
      { root: scroller, rootMargin: '200px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, paging, sentinel]);

  return {
    virtualized,
    window: window_,
    active,
    setCursor,
    focusRow,
    askForPage,
    /** The scrolling body. The virtualiser and the sentinel both watch it. */
    scrollRef,
    /** The row a short body hangs its scroll trigger on. */
    setSentinel,
  };
}

export type CollectionBody = ReturnType<typeof useCollectionBody>;
