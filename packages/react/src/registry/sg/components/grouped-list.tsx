import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CollectionColumn,
  CollapseState,
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
  asCollapseState,
  cellValue,
  displayNameOf,
  expandAll,
  groupKeyText,
  groupRowsKeyed,
  isCollapsed,
  nextEnabledIndex,
  NO_ROWS_LABEL,
  stateLine,
  toColumn,
  toggleCollapsed,
} from '@sg-widgets/core';
import { ChevronRight, CircleAlert, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  COLLECTION_REGION,
  COLLECTION_ROOT,
  useCollectionBody,
  useCollectionControl,
} from '@/registry/sg/components/collection-control';
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
  /** The column the value was read from. `null` when the key is derived. */
  column: CollectionColumn | null;
  /** Rows loaded under this header. */
  count: number;
  collapsed: boolean;
  /** The key the `collapsed` prop names this group by. */
  id: string;
}

export interface GroupedListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  /** The rows and the order behind them. Created with core's `createEntitySource`. */
  source: EntitySource;
  /** Column the rows are grouped on. The source is sorted on it. Not read when `groupKey` is set. */
  groupBy?: CollectionColumn;
  /**
   * The value a row groups under, derived rather than read from a column: a
   * multi-entity field no site sorts on, or a value that comes from one field on one
   * type and another on another. The source's sort is left as the caller set it, so the
   * caller orders the rows so the runs come out whole. Two values are one run when their
   * JSON text is the same, so the caller answers a stable shape. One of `groupBy` and
   * this is required.
   */
  groupKey?: (row: EntityRow) => unknown;
  /** The header's text for a derived key; not read with `groupBy`. Without it the key reads as its own display name. */
  groupLabel?: (value: unknown) => string;
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
  /**
   * Which groups are shut. Controlled, with the list's own as the fallback. A bare key
   * list reads as the open mode with those keys shut; `collapseAll()` shuts the groups
   * a later page brings too.
   */
  collapsed?: string[] | CollapseState;
  onCollapsedChange?: (state: CollapseState) => void;
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

/** What a list given nothing to group on says. */
const GROUPING_REQUIRED = 'GroupedList needs groupBy or groupKey.';

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
  groupKey,
  groupLabel,
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
  if (!groupBy && !groupKey) throw new Error(GROUPING_REQUIRED);
  const root = useRef<HTMLDivElement>(null);

  const control = useCollectionControl({
    source,
    paging,
    getRowId,
    isRowDisabled,
    loadingLabel,
    sort: sortProp,
    onSortChange,
    filters: filtersProp,
    onFiltersChange,
    selection: selectionProp,
    onSelectionChange,
  });
  const snapshot = control.snapshot;
  // A derived key has no path to sort on, and the order is then the caller's to set.
  const groupPath = groupKey ? undefined : groupBy?.path;
  useEffect(() => {
    // A group is only whole when the server put its rows together, so the group path
    // leads the sort. Setting it reads the first page again.
    if (groupPath !== undefined && snapshot.sort[0]?.path !== groupPath) {
      void source.setSort([
        { path: groupPath, descending: false },
        ...snapshot.sort.filter((key) => key.path !== groupPath),
      ]);
    }
  }, [source, groupPath, snapshot.sort]);

  const rows = control.rows;
  const view = control.view(rows.length);
  const loadingText = control.loadingText;
  const rowClass = ROW[density];
  const subColumn = subLabelField ? toColumn(subLabelField) : null;
  const secondaryColumn = secondaryField ? toColumn(secondaryField) : null;

  // A page whose first rows carry the value the last group carries grows that group
  // rather than opening a second one, and the key it is collapsed under stands.
  const groups = useMemo(
    () => groupRowsKeyed(rows, groupKey ?? groupPath ?? ''),
    [rows, groupKey, groupPath],
  );

  const [ownCollapsed, setOwnCollapsed] = useState<CollapseState>(expandAll);
  const collapsed = collapsedProp === undefined ? ownCollapsed : asCollapseState(collapsedProp);

  function toggleGroup(key: string): void {
    const next = toggleCollapsed(collapsed, key);
    setOwnCollapsed(next);
    onCollapsedChange?.(next);
  }

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

  /* the lines ------------------------------------------------------------ */

  /** Headers and rows as one stream, which is what a virtualised list walks. */
  const flat = useMemo(() => {
    const out: Array<{ group: (typeof groups)[number]; row: EntityRow | null }> = [];
    for (const group of groups) {
      out.push({ group, row: null });
      if (!isCollapsed(collapsed, group.key)) for (const row of group.rows) out.push({ group, row });
    }
    return out;
  }, [groups, collapsed]);

  /** The one control a row's cursor lands on. */
  function rowLabel(id: string): HTMLElement | null | undefined {
    return root.current?.querySelector<HTMLElement>(
      `li[data-row-key="${CSS.escape(id)}"] [data-slot="grouped-list-row-label"]`,
    );
  }

  const body = useCollectionBody(control, {
    lines: flat.length,
    measured: flat.length,
    lineHeight: ROW_HEIGHT[density],
    overscan: 12,
    virtualizeAfter,
    lineOfRow: (_index, _row, id) => flat.findIndex((item) => item.row !== null && control.rowId(item.row) === id),
    // Lines below the window count headers as well, so a header only ever makes the
    // scroller ask later.
    lastRowOfLine: (line) => rows.length - 1 - (flat.length - 1 - line),
    cursorTarget: (_index, _row, id) => rowLabel(id),
  });

  const at = body.window;
  const window_ = !at
    ? { before: 0, after: 0, from: 0, slice: flat }
    : at.to < at.from
      ? { before: 0, after: 0, from: 0, slice: flat.slice(0, 30) }
      : { before: at.before, after: at.after, from: at.from, slice: flat.slice(at.from, at.to + 1) };

  /**
   * The arrows walk the rows. On the last loaded row ArrowDown asks for the next page
   * instead, and the cursor stays where it is until those rows arrive.
   */
  function onRowKeyDown(event: React.KeyboardEvent, row: EntityRow): void {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    const key = control.rowId(row);
    const from = rows.findIndex((entry) => control.rowId(entry) === key);
    if (from < 0) return;
    event.preventDefault();
    if (event.key === 'ArrowDown' && body.askForPage(from + 1)) return;
    body.focusRow(nextEnabledIndex(rows.length, from, event.key === 'ArrowDown' ? 1 : -1, control.disabledAt));
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
    <div ref={root} data-slot="grouped-list" className={cn(COLLECTION_ROOT, className)} {...rest}>
      {header ? (
        <div data-slot="grouped-list-header" className={COLLECTION_REGION}>
          {header}
        </div>
      ) : null}

      <div
        ref={body.scrollRef}
        data-slot="grouped-list-scroll"
        style={{ maxHeight }}
        className="border-border w-full overflow-auto rounded-lg border"
      >
        {view === 'error' ? (
          <StateLine
            state="error"
            pad="table"
            icon={CircleAlert}
            label={stateLine('error', { errorLabel }, snapshot.error?.message)}
          />
        ) : view === 'loading' ? (
          <div className="flex flex-col" aria-busy="true" aria-label={loadingText}>
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className={cn('border-border/50 flex items-center border-b last:border-b-0', rowClass)}>
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        ) : view === 'empty' ? (
          <StateLine state="empty" pad="table" icon={Inbox} label={emptyLabel} />
        ) : (
          <>
            {window_.before > 0 ? <div aria-hidden="true" style={{ height: `${window_.before}px` }} /> : null}
            {blocks.map((block) => {
              const group = block.group;
              const shut = isCollapsed(collapsed, group.key);
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
                        column: groupKey ? null : (groupBy ?? null),
                        count: group.rows.length,
                        collapsed: shut,
                        id: group.key,
                      })
                    ) : (
                      <>
                        <span className="min-w-0 truncate">
                          {groupBy && !groupKey ? (
                            <FieldValue
                              value={group.value}
                              dataType={groupBy.dataType}
                              field={groupBy.field}
                              statuses={statuses}
                              context={context}
                              density={density}
                            />
                          ) : groupLabel ? (
                            groupLabel(group.value)
                          ) : (
                            groupKeyText(group.value)
                          )}
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
                        const key = control.rowId(row);
                        const index = block.from + offset;
                        const disabled = control.rowDisabled(row);
                        const chosen = control.isSelected(row);
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
                                onCheckedChange={() => control.toggle(row)}
                                className="shrink-0"
                              />
                            ) : null}
                            {thumbnail ? (
                              <Thumbnail
                                src={cellValue(row, thumbnail) as string | null}
                                alt=""
                                size={THUMB[size][density]}
                                entityType={row.type}
                                className="shrink-0"
                              />
                            ) : leading ? (
                              <span className="flex shrink-0 items-center">{leading(row)}</span>
                            ) : null}
                            <button
                              type="button"
                              data-slot="grouped-list-row-label"
                              disabled={disabled}
                              onClick={() => (selectable ? control.toggle(row) : onSelect?.(row))}
                              onKeyDown={(event) => onRowKeyDown(event, row)}
                              className="focus-visible:ring-ring focus-visible:ring-offset-background relative flex min-w-0 focus-visible:z-10 flex-1 flex-col items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
                                    density={density}
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
                                    density={density}
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
                                  density={density}
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
            {control.bottom === 'error' ? (
              <StateLine
                state="error"
                slotName="grouped-list-page-error"
                pad="none"
                className="p-2"
                icon={CircleAlert}
                label={stateLine('error', { errorLabel }, snapshot.error?.message)}
              >
                <Button variant="outline" onClick={() => control.retry()}>
                  Retry
                </Button>
              </StateLine>
            ) : control.bottom === 'loading' ? (
              <div
                data-slot="grouped-list-loading"
                className="p-2"
                aria-busy="true"
                aria-label={loadingText}
              >
                <Skeleton className="h-4 w-full" />
              </div>
            ) : control.bottom === 'more' ? (
              <div data-slot="grouped-list-load-more" className="flex justify-center p-2">
                <Button variant="outline" onClick={() => void source.loadMore()}>
                  Load more
                </Button>
              </div>
            ) : control.bottom === 'sentinel' ? (
              <div ref={body.setSentinel} data-slot="grouped-list-sentinel" aria-hidden="true" className="h-4" />
            ) : null}
          </>
        )}
      </div>

      <CollectionFooter
        source={source}
        pager={control.pager}
        pageSizes={pageSizes}
        loading={snapshot.status === 'loading'}
        slotName="grouped-list"
      />

      {footer ? (
        <div data-slot="grouped-list-footer-region" className={COLLECTION_REGION}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
