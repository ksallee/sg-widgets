import type * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { CollectionColumn, EntityRef, EntityRow, EntitySource, SgContext, StatusRecord } from '@sg-widgets/core';
import { cellValue, describePaging, displayNameOf, groupRows, rowKey, toColumn } from '@sg-widgets/core';
import { ChevronLeft, ChevronRight, CircleAlert, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FieldValue } from '@/registry/sg/components/field-value';
import { Thumbnail } from '@/registry/sg/components/thumbnail';

export type GroupedListDensity = 'compact' | 'default';

/** The list-row padding of `docs/design-rules.md`; compact halves the vertical half. */
const ROW: Record<GroupedListDensity, string> = { compact: 'px-2 py-1', default: 'px-2 py-1.5' };
/** Thumbnail sizes follow the ladder of `docs/design-rules.md`. */
const THUMB: Record<GroupedListDensity, 'sm' | 'md'> = { compact: 'sm', default: 'md' };

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
  subLabelField?: string | CollectionColumn | null;
  /** The caller's own sub-label. Wins over `subLabelField`. */
  subLabel?: (row: EntityRow) => string;
  /** The right-aligned value: a path, or a resolved column so it renders by type. */
  secondaryField?: string | CollectionColumn | null;
  /** The caller's own right-aligned text. Wins over `secondaryField`. */
  secondary?: (row: EntityRow) => string;
  /** Show the row's `code` beside the label when the two differ. */
  showCode?: boolean;
  /** Extra fields drawn under the label. The source must already read them. */
  fields?: CollectionColumn[];
  /** `Status` rows by code (probe 010). */
  statuses?: Record<string, StatusRecord> | null;
  /** The widget context. An entity value links to the row's page when this carries a site. */
  context?: SgContext;
  density?: GroupedListDensity;
  selectable?: boolean;
  onSelectionChange?: (rows: EntityRef[]) => void;
  onSelect?: (row: EntityRow) => void;
  /** Fixed-size leading slot, when `thumbnail` is not the one wanted: an avatar, a colour swatch. */
  leading?: (row: EntityRow) => React.ReactNode;
  /** Rows per page offered in the footer. `pages` mode only. */
  pageSizes?: number[];
  maxHeight?: string;
  emptyLabel?: string;
}

const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';

/**
 * Rows under collapsible group headers.
 *
 * Grouping a paged read is only honest over an order the server produced, so the
 * source is sorted on the group path and the contiguous runs are the groups; a count
 * is the rows loaded so far and grows as later pages arrive. Every row is one line:
 * a fixed-size leading slot, a label, an optional sub-label under it, and an optional
 * right-aligned secondary value, so text always starts at the same x.
 *
 * In `pages` mode the footer walks the set with an explicit page number and reads
 * "n to m of N" once `_summarize` has counted it; a read carries no total of its own
 * (006_pagination, 020_summarize).
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
  fields = [],
  statuses = null,
  context,
  density = 'default',
  selectable = false,
  onSelectionChange,
  onSelect,
  leading,
  pageSizes = [25, 50, 100],
  maxHeight = '28rem',
  emptyLabel = 'No rows',
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
  const paging = describePaging(snapshot);
  const rowClass = ROW[density];
  const subColumn = subLabelField ? toColumn(subLabelField) : null;
  const secondaryColumn = secondaryField ? toColumn(secondaryField) : null;
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pageDraft, setPageDraft] = useState('');

  const groups = useMemo(() => {
    let run = 0;
    return groupRows(rows, groupBy.path).map((bucket) => ({
      key: `group:${run++}:${JSON.stringify(bucket.value ?? null)}`,
      value: bucket.value,
      rows: bucket.rows,
    }));
  }, [rows, groupBy.path]);

  useEffect(() => {
    onSelectionChange?.(rows.filter((row) => selected[rowKey(row)]).map((row) => ({ type: row.type, id: row.id })));
    // The callback is the caller's; the selection and the rows are what move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, rows]);

  function toggle(row: EntityRow): void {
    const key = rowKey(row);
    setSelected((was) => ({ ...was, [key]: !was[key] }));
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

  function goToPage(value: string): void {
    const wanted = Number(value);
    setPageDraft('');
    if (!Number.isFinite(wanted) || wanted < 1) return;
    void source.setPage(paging.pageCount === null ? wanted : Math.min(wanted, paging.pageCount));
  }

  return (
    <div data-slot="grouped-list" className={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
      <div
        data-slot="grouped-list-scroll"
        style={{ maxHeight }}
        className="border-border w-full overflow-auto rounded-md border"
      >
        {snapshot.status === 'error' ? (
          <p className={cn(stateClass, 'text-destructive')}>
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {snapshot.error?.message}
          </p>
        ) : snapshot.status === 'loading' ? (
          <div className="flex flex-col gap-2 p-2">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className={stateClass}>
            <Inbox aria-hidden="true" className="size-4 shrink-0" />
            {emptyLabel}
          </p>
        ) : (
          <>
            {groups.map((group) => {
              const shut = collapsed[group.key] === true;
              return (
                <div key={group.key} data-slot="grouped-list-group" data-group-key={group.key}>
                  <button
                    type="button"
                    aria-expanded={!shut}
                    onClick={() => setCollapsed((was) => ({ ...was, [group.key]: !shut }))}
                    className="bg-muted/50 focus-visible:ring-ring focus-visible:ring-offset-background border-border sticky top-0 z-10 flex w-full items-center gap-1.5 border-b px-2 py-1.5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                  >
                    <ChevronRight
                      aria-hidden="true"
                      className={cn('size-4 shrink-0 transition-transform duration-150 ease-out', !shut && 'rotate-90')}
                    />
                    <span className="min-w-0 truncate">
                      <FieldValue
                        value={group.value}
                        dataType={groupBy.dataType}
                        field={groupBy.field}
                        statuses={statuses}
                        context={context}
                      />
                    </span>
                    <span className="text-muted-foreground font-mono text-xs tabular-nums">{group.rows.length}</span>
                  </button>
                  {!shut ? (
                    <ul className="flex flex-col">
                      {group.rows.map((row) => {
                        const key = rowKey(row);
                        const label = labelOf(row);
                        const code = codeOf(row);
                        const sub = subLabel ? subLabel(row) : '';
                        const right = secondary ? secondary(row) : '';
                        return (
                          <li
                            key={key}
                            data-slot="grouped-list-row"
                            data-row-key={key}
                            data-state={selected[key] ? 'selected' : undefined}
                            className={cn(
                              'border-border/50 flex items-center gap-2 border-b transition-colors duration-150 last:border-b-0',
                              rowClass,
                              selected[key] ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
                            )}
                          >
                            {selectable ? (
                              <Checkbox
                                aria-label={`Select ${label}`}
                                checked={selected[key] === true}
                                onCheckedChange={() => toggle(row)}
                                className="shrink-0"
                              />
                            ) : null}
                            {thumbnail ? (
                              <Thumbnail
                                src={cellValue(row, thumbnail) as string | null}
                                alt=""
                                size={THUMB[density]}
                                className="shrink-0"
                              />
                            ) : leading ? (
                              <span className="flex shrink-0 items-center">{leading(row)}</span>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => (selectable ? toggle(row) : onSelect?.(row))}
                              className="focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 flex-1 flex-col items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                            >
                              <span className="flex w-full min-w-0 items-center gap-1.5">
                                <span className="min-w-0 truncate text-sm" title={label}>
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
                              {fields.map((column) => (
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
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              );
            })}
            {paging.mode === 'infinite' && snapshot.hasMore ? (
              <div data-slot="grouped-list-load-more" className="flex justify-center p-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={snapshot.status === 'loadingMore'}
                  onClick={() => void source.loadMore()}
                >
                  {snapshot.status === 'loadingMore' ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>

      <div
        data-slot="grouped-list-footer"
        className="text-muted-foreground flex w-full min-w-0 flex-wrap items-center justify-between gap-2 text-xs"
      >
        {paging.mode === 'pages' ? (
          <>
            <div data-slot="grouped-list-page-size" className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select value={String(paging.pageSize)} onValueChange={(value) => void source.setPageSize(Number(value))}>
                <SelectTrigger aria-label="Rows per page" className="h-7 w-auto min-w-16">
                  <span data-slot="select-value" className="tabular-nums">
                    {paging.pageSize}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {pageSizes.map((option) => (
                    <SelectItem key={option} value={String(option)}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div data-slot="grouped-list-pager" className="flex items-center gap-2">
              <span data-slot="grouped-list-range" className="tabular-nums">
                {paging.rangeLabel}
              </span>
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Previous page"
                disabled={!paging.hasPrevious || snapshot.status === 'loading'}
                onClick={() => void source.setPage(paging.page - 1)}
              >
                <ChevronLeft aria-hidden="true" />
              </Button>
              <Input
                type="number"
                min="1"
                inputMode="numeric"
                aria-label="Page number"
                className="h-7 w-14 text-center tabular-nums"
                value={pageDraft === '' ? String(paging.page) : pageDraft}
                onChange={(event) => setPageDraft(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return;
                  event.preventDefault();
                  goToPage(event.currentTarget.value);
                }}
                onBlur={(event) => goToPage(event.currentTarget.value)}
              />
              {paging.pageCount !== null ? <span className="tabular-nums">of {paging.pageCount}</span> : null}
              <Button
                variant="outline"
                size="icon-sm"
                aria-label="Next page"
                disabled={!paging.hasNext || snapshot.status === 'loading'}
                onClick={() => void source.setPage(paging.page + 1)}
              >
                <ChevronRight aria-hidden="true" />
              </Button>
            </div>
          </>
        ) : (
          <>
            <span data-slot="grouped-list-loaded" className="tabular-nums">
              {paging.loadedLabel}
            </span>
            {snapshot.status === 'loadingMore' ? <span>Loading…</span> : null}
          </>
        )}
      </div>
    </div>
  );
}
