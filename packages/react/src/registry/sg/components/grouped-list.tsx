import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type {
  CollectionColumn,
  EntityRef,
  EntityRow,
  EntitySource,
  FieldSpec,
  PagingMode,
  RowDisabledFn,
  RowIdFn,
  SgContext,
  SortSpec,
  SourceFilters,
  StatusRecord,
} from '@sg-widgets/core';
import {
  cellValue,
  describePaging,
  displayNameOf,
  groupRowsKeyed,
  hasFailedPage,
  loadsOnArrowDown,
  nextEnabledIndex,
  NO_ROWS_LABEL,
  rowIdOf,
  rowIsDisabled,
  rowKey,
  sameFilters,
  sameSort,
  shouldLoadNext,
  sourceModeFor,
  stateLine,
  toColumn,
  toggleId,
} from '@sg-widgets/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronRight, CircleAlert, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { CollectionFooter } from '@/registry/sg/components/collection-footer';
import { FieldValue } from '@/registry/sg/components/field-value';
import { StateLine } from '@/registry/sg/components/state-line';
import { Thumbnail } from '@/registry/sg/components/thumbnail';

export type GroupedListDensity = 'compact' | 'default';

/** A stable empty list, so the default never changes what a memo depends on. */
const EMPTY_DETAILS: CollectionColumn[] = [];
export type GroupedListSize = 'sm' | 'md' | 'lg';

/** The list-row padding of `docs/design-rules.md`; compact halves the vertical half. */
const ROW: Record<GroupedListDensity, string> = { compact: 'px-2 py-1', default: 'px-2 py-1.5' };
/** Thumbnail sizes follow the ladder of `docs/design-rules.md`. */
const THUMB: Record<GroupedListSize, Record<GroupedListDensity, 'sm' | 'md' | 'lg'>> = {
  sm: { compact: 'sm', default: 'sm' },
  md: { compact: 'sm', default: 'md' },
  lg: { compact: 'md', default: 'lg' },
};
/** A row's text and glyphs, on the leaf ladder of `docs/design-rules.md`. */
const TEXT: Record<GroupedListSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
const GLYPH: Record<GroupedListSize, string> = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' };
/** Row heights per density, so a virtualised list can be measured before it is drawn. */
const ROW_HEIGHT: Record<GroupedListDensity, number> = { compact: 30, default: 34 };

/** What a `row` render prop is handed. It draws a row's contents, not the row's box. */
export interface GroupedListRowContext {
  row: EntityRow;
  /** The row's id, as `getRowId` derives it. */
  id: string;
  index: number;
  selected: boolean;
  disabled: boolean;
}

/** What a `groupHeader` render prop is handed. It draws the header's contents. */
export interface GroupedListGroupContext {
  /** The value the run shares. */
  value: unknown;
  column: CollectionColumn;
  /** Rows loaded under this header. */
  count: number;
  collapsed: boolean;
  /** The key the `collapsed` prop names this group by. */
  id: string;
}

/** The latest value, for an effect that must read it without depending on it. */
function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export interface GroupedListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  /** The rows and the order behind them. Created with core's `createEntitySource`. */
  source: EntitySource;
  /** Path the rows are grouped on. The source is sorted on it. */
  groupBy: CollectionColumn;
  /** Field holding the thumbnail URL. `false` leaves the leading slot to `leading`. */
  thumbnail?: string | false;
  /** Field shown as the row's label. Defaults to the type's own display name. */
  labelField?: string | null;
  /** The muted line under the label: a path, or a resolved column so it renders by type. */
  subLabelField?: FieldSpec | null;
  /** The caller's own sub-label. Wins over `subLabelField`. */
  subLabel?: (row: EntityRow) => string;
  /** The right-aligned value: a path, or a resolved column so it renders by type. */
  secondaryField?: FieldSpec | null;
  /** The caller's own right-aligned text. Wins over `secondaryField`. */
  secondary?: (row: EntityRow) => string;
  /** Show the row's `code` beside the label when the two differ. */
  showCode?: boolean;
  /** Extra values drawn under the label. The source must already read their paths. */
  details?: CollectionColumn[];
  /** `Status` rows by code (probe 010). */
  statuses?: Record<string, StatusRecord> | null;
  /** The widget context. Values render with its preferences. An entity value links to the row's page when it carries a site. */
  context?: SgContext;
  density?: GroupedListDensity;
  size?: GroupedListSize;
  selectable?: boolean;
  /** The selected rows. Controlled, with the list's own selection as the fallback. */
  selection?: EntityRef[];
  onSelectionChange?: (rows: EntityRef[]) => void;
  onSelect?: (row: EntityRow) => void;
  /** How a row is keyed, in the DOM and in the selection. Default `Type:id`. */
  getRowId?: RowIdFn;
  /** True for a row that cannot be selected or reached by the keyboard. */
  isRowDisabled?: RowDisabledFn;
  /** Keys of the groups that are shut. Controlled, with the list's own as the fallback. */
  collapsed?: string[];
  onCollapsedChange?: (keys: string[]) => void;
  /** The source's sort, so a SortPicker drops into the header. */
  sort?: SortSpec[];
  onSortChange?: (sort: SortSpec[]) => void;
  /** The source's filter, so a FilterBar drops into the header. */
  filters?: SourceFilters;
  onFiltersChange?: (filters: SourceFilters) => void;
  /** Fixed-size leading slot, when `thumbnail` is not the one wanted: an avatar, a colour swatch. */
  leading?: (row: EntityRow) => React.ReactNode;
  /** Draws a row's contents. Without it, the row-anatomy props draw them. */
  row?: (context: GroupedListRowContext) => React.ReactNode;
  /** Draws a group header's contents. */
  groupHeader?: (context: GroupedListGroupContext) => React.ReactNode;
  /** Region above the list. */
  header?: React.ReactNode;
  /** Region below the footer. */
  footer?: React.ReactNode;
  /** Rows per page offered in the footer. `pages` mode only. */
  pageSizes?: number[];
  /** How the set is walked: a footer with a page number, a load-more row, or the scroller. */
  paging?: PagingMode;
  maxHeight?: string;
  /** Rows and headers above which the list is virtualised. */
  virtualizeAfter?: number;
  /** Shown when the read returned nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
}

/**
 * Rows under collapsible group headers.
 *
 * Grouping a paged read is only honest over an order the server produced, so the
 * source is sorted on the group path and the contiguous runs are the groups; a count
 * is the rows loaded so far and grows as later pages arrive. Every row is one line:
 * a fixed-size leading slot, a label, an optional sub-label under it, and an optional
 * right-aligned secondary value, so text always starts at the same x.
 *
 * `paging` says how the set is walked, and the source follows it. In `pages` the footer
 * walks with an explicit page number and reads "n to m of N" once `_summarize` has
 * counted it; a read carries no total of its own (006_pagination, 020_summarize). In
 * `more` a row at the bottom appends the next page and in `scroll` the scroller does;
 * either way a page whose first rows continue the last group grows that group. A page
 * that fails leaves its rows and says why at the bottom, with a retry.
 */
export function GroupedList({
  source,
  groupBy,
  thumbnail = false,
  labelField = null,
  subLabelField = null,
  subLabel,
  secondaryField = null,
  secondary,
  showCode = false,
  details = EMPTY_DETAILS,
  statuses = null,
  context,
  density = 'default',
  size = 'md',
  selectable = false,
  selection: selectionProp,
  onSelectionChange,
  onSelect,
  getRowId,
  isRowDisabled,
  collapsed: collapsedProp,
  onCollapsedChange,
  sort: sortProp,
  onSortChange,
  filters: filtersProp,
  onFiltersChange,
  leading,
  row: rowRender,
  groupHeader,
  header,
  footer,
  pageSizes = [25, 50, 100],
  paging = 'more',
  maxHeight = '28rem',
  virtualizeAfter = 100,
  emptyLabel = NO_ROWS_LABEL,
  loadingLabel,
  errorLabel,
  className,
  ...rest
}: GroupedListProps) {
  const snapshot = useSyncExternalStore(
    useCallback((listener: () => void) => source.subscribe(listener), [source]),
    () => source.snapshot(),
    () => source.snapshot(),
  );
  useEffect(() => {
    if (source.status === 'idle') void source.load();
  }, [source]);
  useEffect(() => {
    // `paging` is the one prop a caller sets, so the source follows it rather than the
    // other way round. Setting a mode it already holds is a no-op.
    void source.setMode(sourceModeFor(paging));
  }, [source, paging]);
  useEffect(() => {
    // A group is only whole when the server put its rows together, so the group path
    // leads the sort. Setting it reads the first page again.
    if (snapshot.sort[0]?.path !== groupBy.path) {
      void source.setSort([
        { path: groupBy.path, descending: false },
        ...snapshot.sort.filter((key) => key.path !== groupBy.path),
      ]);
    }
  }, [source, groupBy.path, snapshot.sort]);

  const rows = snapshot.rows;
  const pager = describePaging(snapshot);
  const loadingText = stateLine('loading', { loadingLabel });
  /** A page that failed under rows already loaded, which the bottom line reports. */
  const pageError = hasFailedPage(snapshot);
  const rowClass = ROW[density];
  const subColumn = subLabelField ? toColumn(subLabelField) : null;
  const secondaryColumn = secondaryField ? toColumn(secondaryField) : null;
  const rowId = (row: EntityRow): string => rowIdOf(row, getRowId);
  const rowDisabled = (row: EntityRow): boolean => rowIsDisabled(row, isRowDisabled);
  const disabledAt = (index: number): boolean => {
    const row = rows[index];
    return row === undefined || rowDisabled(row);
  };

  // A page whose first rows carry the value the last group carries grows that group
  // rather than opening a second one, and the key it is collapsed under stands.
  const groups = useMemo(() => groupRowsKeyed(rows, groupBy.path), [rows, groupBy.path]);

  const [ownSelection, setOwnSelection] = useState<EntityRef[]>([]);
  const selection = selectionProp ?? ownSelection;
  /** The selection as keys, so a row asks whether it is in it in constant time. */
  const chosenKeys = new Set(selection.map(rowKey));

  const [ownCollapsed, setOwnCollapsed] = useState<string[]>([]);
  const collapsed = collapsedProp ?? ownCollapsed;

  function toggle(row: EntityRow): void {
    if (rowDisabled(row)) return;
    const key = rowKey(row);
    const next = chosenKeys.has(key)
      ? selection.filter((ref) => rowKey(ref) !== key)
      : [...selection, { type: row.type, id: row.id }];
    setOwnSelection(next);
    onSelectionChange?.(next);
  }

  function toggleGroup(key: string): void {
    const next = toggleId(collapsed, key);
    setOwnCollapsed(next);
    onCollapsedChange?.(next);
  }

  /*
   * The source's sort and filter, mirrored out as props so a toolbar control drops in.
   *
   * Each pair is one effect into the source and one out of it, and the out one reads the
   * prop off a ref, so a change travels once and the two never write to each other.
   */
  const sortLatest = useLatest(sortProp);
  useEffect(() => {
    if (sortProp === undefined || sameSort(sortProp, source.sort)) return;
    void source.setSort([...sortProp]);
  }, [source, sortProp]);
  useEffect(() => {
    if (sortLatest.current !== undefined && sameSort(snapshot.sort, sortLatest.current)) return;
    onSortChange?.([...snapshot.sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.sort]);

  const filtersLatest = useLatest(filtersProp);
  useEffect(() => {
    if (filtersProp === undefined || sameFilters(filtersProp, source.filters)) return;
    void source.setFilters(filtersProp);
  }, [source, filtersProp]);
  useEffect(() => {
    if (filtersLatest.current !== undefined && sameFilters(snapshot.filters, filtersLatest.current)) return;
    onFiltersChange?.(snapshot.filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.filters]);

  function labelOf(row: EntityRow): string {
    if (labelField) return String(cellValue(row, labelField) ?? '');
    return displayNameOf(row.attributes, `${row.type} #${row.id}`);
  }

  /** The programmatic name, when it says something the label does not. */
  function codeOf(row: EntityRow): string {
    if (!showCode) return '';
    const raw = cellValue(row, 'code');
    return typeof raw === 'string' && raw.length > 0 && raw !== labelOf(row) ? raw : '';
  }

  /* virtual rows --------------------------------------------------------- */

  /** Headers and rows as one stream, which is what a virtualised list walks. */
  const flat = useMemo(() => {
    const shut = new Set(collapsed);
    const out: Array<{ group: (typeof groups)[number]; row: EntityRow | null }> = [];
    for (const group of groups) {
      out.push({ group, row: null });
      if (!shut.has(group.key)) for (const row of group.rows) out.push({ group, row });
    }
    return out;
  }, [groups, collapsed]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualized = flat.length > virtualizeAfter;
  const virtualizer = useVirtualizer({
    count: virtualized ? flat.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT[density],
    overscan: 12,
  });

  const items = virtualizer.getVirtualItems();
  const firstItem = items[0];
  const lastItem = items[items.length - 1];
  const window_ = !virtualized
    ? { before: 0, after: 0, from: 0, slice: flat }
    : !firstItem || !lastItem
      ? { before: 0, after: 0, from: 0, slice: flat.slice(0, 30) }
      : {
          before: firstItem.start,
          after: virtualizer.getTotalSize() - lastItem.end,
          from: firstItem.index,
          slice: flat.slice(firstItem.index, lastItem.index + 1),
        };

  /* the cursor ----------------------------------------------------------- */

  /** The row a cursor is waiting on, until the page it asked for lands. */
  const [wantedRow, setWantedRow] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);

  /** Put the cursor on one row, drawing it first where it is outside the window. */
  function focusRow(index: number): void {
    const at = Math.max(0, Math.min(index, rows.length - 1));
    const row = rows[at];
    if (!row) return;
    const key = rowId(row);
    const put = (): void => {
      const label = root.current?.querySelector<HTMLElement>(
        `li[data-row-key="${CSS.escape(key)}"] [data-slot="grouped-list-row-label"]`,
      );
      if (!label) return;
      label.focus({ preventScroll: true });
      label.scrollIntoView({ block: 'nearest' });
    };
    if (virtualized) {
      const line = flat.findIndex((item) => item.row !== null && rowId(item.row) === key);
      if (line >= 0) virtualizer.scrollToIndex(line);
      requestAnimationFrame(put);
    } else put();
  }

  /**
   * The arrows walk the rows. On the last loaded row ArrowDown asks for the next page
   * instead, and the cursor stays where it is until those rows arrive.
   */
  function onRowKeyDown(event: React.KeyboardEvent, row: EntityRow): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const key = rowId(row);
    const from = rows.findIndex((entry) => rowId(entry) === key);
    if (from < 0) return;
    event.preventDefault();
    if (event.key === 'ArrowDown' && loadsOnArrowDown(snapshot, paging, from + 1)) {
      setWantedRow(from + 1);
      void source.loadMore();
      return;
    }
    focusRow(nextEnabledIndex(rows.length, from, event.key === 'ArrowDown' ? 1 : -1, disabledAt));
  }

  const focusLatest = useLatest(focusRow);
  useEffect(() => {
    if (wantedRow === null) return;
    if (snapshot.status === 'error') setWantedRow(null);
    else if (rows.length > wantedRow) {
      setWantedRow(null);
      focusLatest.current(wantedRow);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedRow, rows, snapshot.status]);

  /* scroll paging -------------------------------------------------------- */

  // The virtualiser walks headers and rows as one stream, so the lines below the window
  // count headers as well and a header only makes the scroller ask later.
  const below = lastItem ? flat.length - 1 - lastItem.index : -1;
  useEffect(() => {
    if (!virtualized || below < 0) return;
    if (shouldLoadNext(snapshot, { paging, lastVisible: rows.length - 1 - below })) void source.loadMore();
  }, [source, paging, virtualized, below, snapshot, rows.length]);

  // A list short enough not to be virtualised has no range to read, so the last row
  // carries a sentinel instead.
  // The element is held as state, not as a ref: a read that redraws the rows replaces the
  // sentinel, and the observer has to move to the one that is on the page now.
  const [sentinel, setSentinel] = useState<HTMLDivElement | null>(null);
  const showSentinel = paging === 'scroll' && snapshot.hasMore && !pageError && snapshot.status !== 'loadingMore';
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

  /** Read the page that failed again: the one a pager is on, or the one that was appended. */
  function retryPage(): void {
    if (paging === 'pages') void source.setPage(snapshot.page);
    else void source.loadMore();
  }

  /** The window as runs of one group, so a group still draws one box around its rows. */
  const blocks: Array<{ group: (typeof groups)[number]; header: boolean; rows: EntityRow[]; from: number }> = [];
  window_.slice.forEach((item, offset) => {
    let last = blocks[blocks.length - 1];
    if (!last || last.group.key !== item.group.key) {
      last = { group: item.group, header: false, rows: [], from: window_.from + offset };
      blocks.push(last);
    }
    if (item.row === null) last.header = true;
    else last.rows.push(item.row);
  });

  return (
    <div ref={root} data-slot="grouped-list" className={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
      {header ? (
        <div data-slot="grouped-list-header" className="flex w-full min-w-0 flex-wrap items-center gap-2">
          {header}
        </div>
      ) : null}

      <div
        ref={scrollRef}
        data-slot="grouped-list-scroll"
        style={{ maxHeight }}
        className="border-border w-full overflow-auto rounded-md border"
      >
        {snapshot.status === 'error' && !pageError ? (
          <StateLine
            state="error"
            pad="table"
            icon={CircleAlert}
            label={stateLine('error', { errorLabel }, snapshot.error?.message)}
          />
        ) : snapshot.status === 'loading' ? (
          <div className="flex flex-col gap-2 p-2" aria-busy="true" aria-label={loadingText}>
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <StateLine state="empty" pad="table" icon={Inbox} label={emptyLabel} />
        ) : (
          <>
            {window_.before > 0 ? <div aria-hidden="true" style={{ height: `${window_.before}px` }} /> : null}
            {blocks.map((block) => {
              const group = block.group;
              const shut = collapsed.includes(group.key);
              return (
                <div key={group.key} data-slot="grouped-list-group" data-group-key={group.key}>
                  {block.header ? (
                  <button
                    type="button"
                    aria-expanded={!shut}
                    onClick={() => toggleGroup(group.key)}
                    className={cn(
                      'bg-muted/50 focus-visible:ring-ring focus-visible:ring-offset-background border-border sticky top-0 z-10 flex w-full items-center gap-1.5 border-b px-2 py-1.5 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                      TEXT[size],
                    )}
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className={cn(
                        'shrink-0 transition-transform duration-150 ease-out',
                        GLYPH[size],
                        !shut && 'rotate-90',
                      )}
                    />
                    {groupHeader ? (
                      groupHeader({
                        value: group.value,
                        column: groupBy,
                        count: group.rows.length,
                        collapsed: shut,
                        id: group.key,
                      })
                    ) : (
                      <>
                        <span className="min-w-0 truncate">
                          <FieldValue
                            value={group.value}
                            dataType={groupBy.dataType}
                            field={groupBy.field}
                            statuses={statuses}
                            context={context}
                          />
                        </span>
                        <span className="text-muted-foreground font-mono text-xs tabular-nums">
                          {group.rows.length}
                        </span>
                      </>
                    )}
                  </button>
                  ) : null}
                  {block.rows.length > 0 ? (
                    <ul className="flex flex-col">
                      {block.rows.map((row, offset) => {
                        const key = rowId(row);
                        const index = block.from + offset;
                        const disabled = rowDisabled(row);
                        const chosen = chosenKeys.has(rowKey(row));
                        const label = labelOf(row);
                        const code = codeOf(row);
                        const sub = subLabel ? subLabel(row) : '';
                        const right = secondary ? secondary(row) : '';
                        return (
                          <li
                            key={key}
                            data-slot="grouped-list-row"
                            data-row-key={key}
                            data-state={chosen ? 'selected' : undefined}
                            data-disabled={disabled ? 'true' : undefined}
                            className={cn(
                              'border-border/50 flex items-center gap-2 border-b transition-colors duration-150 last:border-b-0',
                              rowClass,
                              chosen ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
                              disabled && 'pointer-events-none opacity-50',
                            )}
                          >
                            {rowRender ? (
                              rowRender({ row, id: key, index, selected: chosen, disabled })
                            ) : (
                              <>
                            {selectable ? (
                              <Checkbox
                                aria-label={`Select ${label}`}
                                checked={chosen}
                                disabled={disabled}
                                onCheckedChange={() => toggle(row)}
                                className="shrink-0"
                              />
                            ) : null}
                            {thumbnail ? (
                              <Thumbnail
                                src={cellValue(row, thumbnail) as string | null}
                                alt=""
                                size={THUMB[size][density]}
                                className="shrink-0"
                              />
                            ) : leading ? (
                              <span className="flex shrink-0 items-center">{leading(row)}</span>
                            ) : null}
                            <button
                              type="button"
                              data-slot="grouped-list-row-label"
                              disabled={disabled}
                              onClick={() => (selectable ? toggle(row) : onSelect?.(row))}
                              onKeyDown={(event) => onRowKeyDown(event, row)}
                              className="focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 flex-1 flex-col items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            >
                              <span className="flex w-full min-w-0 items-center gap-1.5">
                                <span className={cn('min-w-0 truncate', TEXT[size])} title={label}>
                                  {label}
                                </span>
                                {code ? (
                                  <span className="text-muted-foreground shrink-0 font-mono text-xs">{code}</span>
                                ) : null}
                              </span>
                              {sub ? (
                                <span className="text-muted-foreground w-full min-w-0 truncate text-xs" title={sub}>
                                  {sub}
                                </span>
                              ) : subColumn ? (
                                <span className="w-full min-w-0 truncate text-xs">
                                  <FieldValue
                                    value={cellValue(row, subColumn.path)}
                                    dataType={subColumn.dataType}
                                    field={subColumn.field}
                                    statuses={statuses}
                                    context={context}
                                    className="text-muted-foreground text-xs"
                                  />
                                </span>
                              ) : null}
                              {details.map((column) => (
                                <span key={column.path} className="flex w-full min-w-0 items-center gap-1.5 text-xs">
                                  <span className="text-muted-foreground shrink-0">{column.header}</span>
                                  <FieldValue
                                    value={cellValue(row, column.path)}
                                    dataType={column.dataType}
                                    field={column.field}
                                    statuses={statuses}
                                    context={context}
                                    className="min-w-0 text-xs"
                                  />
                                </span>
                              ))}
                            </button>
                            {right ? (
                              <span className="text-muted-foreground flex shrink-0 justify-end text-xs">{right}</span>
                            ) : secondaryColumn ? (
                              <span className="flex shrink-0 justify-end text-xs">
                                <FieldValue
                                  value={cellValue(row, secondaryColumn.path)}
                                  dataType={secondaryColumn.dataType}
                                  field={secondaryColumn.field}
                                  statuses={statuses}
                                  context={context}
                                  className="text-muted-foreground w-auto text-xs"
                                />
                              </span>
                            ) : null}
                              </>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
            {window_.after > 0 ? <div aria-hidden="true" style={{ height: `${window_.after}px` }} /> : null}
            {pageError ? (
              <StateLine
                state="error"
                slotName="grouped-list-page-error"
                pad="none"
                className="p-2"
                icon={CircleAlert}
                label={stateLine('error', { errorLabel }, snapshot.error?.message)}
              >
                <Button variant="outline" size="sm" onClick={retryPage}>
                  Retry
                </Button>
              </StateLine>
            ) : snapshot.status === 'loadingMore' ? (
              <div
                data-slot="grouped-list-loading"
                className="p-2"
                aria-busy="true"
                aria-label={loadingText}
              >
                <Skeleton className="h-4 w-full" />
              </div>
            ) : paging === 'more' && snapshot.hasMore ? (
              <div data-slot="grouped-list-load-more" className="flex justify-center p-2">
                <Button variant="outline" size="sm" onClick={() => void source.loadMore()}>
                  Load more
                </Button>
              </div>
            ) : showSentinel ? (
              <div ref={setSentinel} data-slot="grouped-list-sentinel" aria-hidden="true" className="h-4" />
            ) : null}
          </>
        )}
      </div>

      <CollectionFooter
        source={source}
        pager={pager}
        pageSizes={pageSizes}
        loading={snapshot.status === 'loading'}
        slotName="grouped-list"
      />

      {footer ? (
        <div data-slot="grouped-list-footer-region" className="flex w-full min-w-0 flex-wrap items-center gap-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
