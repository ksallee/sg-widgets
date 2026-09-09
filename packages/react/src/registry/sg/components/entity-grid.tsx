import type * as React from 'react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CollectionColumn, EntityRef, EntityRow, EntitySource, SgContext, StatusRecord } from '@sg-widgets/core';
import { cellValue, describePaging, displayNameOf, rowKey, toColumn } from '@sg-widgets/core';
import { ChevronLeft, ChevronRight, CircleAlert, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FieldValue } from '@/registry/sg/components/field-value';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { Thumbnail } from '@/registry/sg/components/thumbnail';

export type EntityGridSize = 'sm' | 'md' | 'lg';

/** Card widths, which set the grid's own columns through `auto-fill`. */
const CARD: Record<EntityGridSize, number> = { sm: 160, md: 224, lg: 288 };

export interface EntityGridProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  /** The rows and the paging behind them. Created with core's `createEntitySource`. */
  source: EntitySource;
  /** Field holding the thumbnail URL. `false` draws a card with no picture. */
  thumbnail?: string | false;
  /** Field shown as the card's label. Defaults to the type's own display name. */
  labelField?: string | null;
  /** The muted line under the label: a path, or a resolved column so it renders by type. */
  subLabelField?: string | CollectionColumn | null;
  /** The caller's own sub-label. Wins over `subLabelField`. */
  subLabel?: (row: EntityRow) => string;
  /** The value shown beside the label: a path, or a resolved column so it renders by type. */
  secondaryField?: string | CollectionColumn | null;
  /** The caller's own text beside the label. Wins over `secondaryField`. */
  secondary?: (row: EntityRow) => string;
  /** Show the row's `code` beside the label when the two differ. */
  showCode?: boolean;
  /** Extra fields drawn on the card. The source must already read them. */
  fields?: CollectionColumn[];
  /** Path of the status field. Every type but Project uses `sg_status_list`. */
  statusPath?: string;
  /** The status field's schema, for a label out of `display_values`. */
  statusField?: CollectionColumn['field'];
  /** `Status` rows by code, for the badge (probe 010). */
  statuses?: Record<string, StatusRecord> | null;
  /** The widget context. An entity value links to the row's page when this carries a site. */
  context?: SgContext;
  size?: EntityGridSize;
  selectable?: boolean;
  onSelectionChange?: (rows: EntityRef[]) => void;
  onSelect?: (row: EntityRow) => void;
  /** Rows per page offered in the footer. `pages` mode only. */
  pageSizes?: number[];
  /** Height of the scrolling body. In `infinite` mode, reaching its end asks for the next page. */
  maxHeight?: string;
  emptyLabel?: string;
}

const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';

/**
 * Rows as thumbnail cards.
 *
 * The value of an `image` field is the only state marker there is, so a row with no
 * picture, one still transcoding and one ready all render (field_types/image); a
 * Version card carries the play overlay the desktop tk-framework-qtwidgets label uses
 * for playable media. The name is `cached_display_name` when the row has one and the
 * type's own identity field otherwise, which is core's `displayNameOf`.
 *
 * In `infinite` mode scrolling to the end asks the source for the next page, and
 * paging stops on a short page, never on a missing `links.next`, which the API emits
 * forever (006_pagination). In `pages` mode the footer walks the set with an explicit
 * page number and reads "n to m of N" once `_summarize` has counted it
 * (020_summarize).
 */
export function EntityGrid({
  source,
  thumbnail = 'image',
  labelField = null,
  subLabelField = null,
  subLabel,
  secondaryField = null,
  secondary,
  showCode = false,
  fields = [],
  statusPath = 'sg_status_list',
  statusField = null,
  statuses = null,
  context,
  size = 'md',
  selectable = false,
  onSelectionChange,
  onSelect,
  pageSizes = [25, 50, 100],
  maxHeight = '32rem',
  emptyLabel = 'No rows',
  className,
  ...rest
}: EntityGridProps) {
  const snapshot = useSyncExternalStore(
    useCallback((listener: () => void) => source.subscribe(listener), [source]),
    () => source.snapshot(),
    () => source.snapshot(),
  );
  useEffect(() => {
    if (source.status === 'idle') void source.load();
  }, [source]);

  const rows = snapshot.rows;
  const paging = describePaging(snapshot);
  const subColumn = subLabelField ? toColumn(subLabelField) : null;
  const secondaryColumn = secondaryField ? toColumn(secondaryField) : null;

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [pageDraft, setPageDraft] = useState('');
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

  /* infinite scroll ------------------------------------------------------ */

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const mode = paging.mode;

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target || mode !== 'infinite') return;
    const observer = new IntersectionObserver(
      (entries) => {
        // `loadMore` is a no-op while a read is in flight or when the last page was short.
        if (entries.some((entry) => entry.isIntersecting)) void source.loadMore();
      },
      { root, rootMargin: '200px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [source, mode, rows.length]);

  const columns = { gridTemplateColumns: `repeat(auto-fill,minmax(${CARD[size]}px,1fr))` };

  return (
    <div data-slot="entity-grid" className={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
      <div
        ref={scrollRef}
        data-slot="entity-grid-scroll"
        style={{ maxHeight }}
        className="border-border w-full overflow-auto rounded-md border p-3"
      >
        {snapshot.status === 'error' ? (
          <p className={cn(stateClass, 'text-destructive')}>
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {snapshot.error?.message}
          </p>
        ) : snapshot.status === 'loading' ? (
          <div className="grid gap-3" style={columns}>
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="flex flex-col gap-2">
                <Skeleton className="aspect-video w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className={stateClass}>
            <Inbox aria-hidden="true" className="size-4 shrink-0" />
            {emptyLabel}
          </p>
        ) : (
          <>
            <div
              role="listbox"
              aria-multiselectable={selectable ? true : undefined}
              aria-label="Rows"
              className="grid gap-3"
              style={columns}
            >
              {rows.map((row) => {
                const key = rowKey(row);
                const name = labelOf(row);
                const code = codeOf(row);
                const status = String(cellValue(row, statusPath) ?? '');
                const sub = subLabel ? subLabel(row) : '';
                const right = secondary ? secondary(row) : '';
                return (
                  <div
                    key={key}
                    data-slot="entity-grid-card"
                    data-row-key={key}
                    data-state={selected[key] ? 'selected' : undefined}
                    className={cn(
                      'border-border bg-card relative rounded-md border transition-colors duration-150',
                      selected[key] && 'bg-accent text-accent-foreground',
                    )}
                  >
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected[key] === true}
                      onClick={() => (selectable ? toggle(row) : onSelect?.(row))}
                      className="focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 flex-col items-start gap-2 rounded-md p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                    >
                      {thumbnail ? (
                        <Thumbnail
                          src={cellValue(row, thumbnail) as string | null}
                          alt=""
                          playable={row.type === 'Version'}
                          className="h-auto w-full"
                        />
                      ) : null}
                      <span className="flex w-full min-w-0 items-center gap-1.5">
                        <span className="min-w-0 truncate text-sm font-medium" title={name}>
                          {name}
                        </span>
                        {code ? (
                          <span className="text-muted-foreground shrink-0 font-mono text-xs">{code}</span>
                        ) : null}
                        {right ? (
                          <span className="text-muted-foreground ml-auto shrink-0 text-xs">{right}</span>
                        ) : secondaryColumn ? (
                          <span className="ml-auto flex shrink-0 justify-end text-xs">
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
                      {status ? (
                        <StatusBadge code={status} status={statuses?.[status] ?? null} field={statusField} size="sm" />
                      ) : null}
                      {fields.map((column) => (
                        <span
                          key={column.path}
                          className="text-muted-foreground flex w-full min-w-0 items-center gap-1.5 text-xs"
                        >
                          <span className="shrink-0">{column.header}</span>
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
                    {selectable ? (
                      <span className="absolute top-3 left-3 z-10">
                        <Checkbox
                          aria-label={`Select ${name}`}
                          checked={selected[key] === true}
                          onCheckedChange={() => toggle(row)}
                          className="bg-background/80"
                        />
                      </span>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {paging.mode === 'infinite' ? <div ref={sentinelRef} aria-hidden="true" className="h-4" /> : null}
          </>
        )}
      </div>

      <div
        data-slot="entity-grid-footer"
        className="text-muted-foreground flex w-full min-w-0 flex-wrap items-center justify-between gap-2 text-xs"
      >
        {paging.mode === 'pages' ? (
          <>
            <div data-slot="entity-grid-page-size" className="flex items-center gap-2">
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
            <div data-slot="entity-grid-pager" className="flex items-center gap-2">
              <span data-slot="entity-grid-range" className="tabular-nums">
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
            <span data-slot="entity-grid-loaded" className="tabular-nums">
              {paging.loadedLabel}
            </span>
            {snapshot.status === 'loadingMore' ? <span>Loading…</span> : null}
          </>
        )}
      </div>
    </div>
  );
}
