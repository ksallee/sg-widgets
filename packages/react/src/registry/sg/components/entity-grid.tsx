import type * as React from 'react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type {
  EntityRef,
  EntityRow,
  EntitySource,
  FieldSpec,
  RowDisabledFn,
  RowIdFn,
  SgContext,
  SortSpec,
  SourceFilters,
  StatusRecord,
} from '@sg-widgets/core';
import {
  describePaging,
  firstEnabledIndex,
  nextEnabledIndex,
  rowIdOf,
  rowIsDisabled,
  rowKey,
  sameFilters,
  sameSort,
} from '@sg-widgets/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ChevronLeft, ChevronRight, CircleAlert, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EntityCard } from '@/registry/sg/components/entity-card';

export type EntityGridSize = 'sm' | 'md' | 'lg';

/**
 * Tile widths, which set the grid's own columns through `auto-fill`. The size is
 * the tile's own as well, so a wider column gets the taller picture.
 */
const TILE: Record<EntityGridSize, number> = { sm: 160, md: 224, lg: 288 };

export type EntityGridDensity = 'compact' | 'default';

/** The gap between tiles; compact halves it, as it halves a row's padding elsewhere. */
const GAP: Record<EntityGridDensity, string> = { compact: 'gap-1.5', default: 'gap-3' };
const GAP_PX: Record<EntityGridDensity, number> = { compact: 6, default: 12 };

/** Tile heights, so a virtualised grid can be measured before it is drawn. */
const TILE_HEIGHT: Record<EntityGridSize, number> = { sm: 148, md: 190, lg: 232 };

/** What a `card` render prop is handed. It draws one grid cell in place of the tile. */
export interface EntityGridCardContext {
  row: EntityRow;
  /** The row's id, as `getRowId` derives it. */
  id: string;
  index: number;
  selected: boolean;
  disabled: boolean;
  /** True on the tile that owns the grid's one tab stop. */
  active: boolean;
}

/** The latest value, for an effect that must read it without depending on it. */
function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export interface EntityGridProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  /** The rows and the paging behind them. Created with core's `createEntitySource`. */
  source: EntitySource;
  /** The widget context. Every tile reads its schema and its links through it. */
  context: SgContext;
  /** Field holding the thumbnail URL. `false` leaves every tile on the placeholder. */
  thumbnail?: string | false;
  /** Field shown as the tile's name. Defaults to the type's own display name. */
  labelField?: string | null;
  /** The left of the tile's metadata line: a path, or a resolved column so it renders by type. */
  subLabelField?: FieldSpec | null;
  /** The caller's own sub-label. Wins over `subLabelField`. */
  subLabel?: (row: EntityRow) => string;
  /** The right of the tile's metadata line: a path, or a resolved column so it renders by type. */
  secondaryField?: FieldSpec | null;
  /** The caller's own text on the right of the metadata line. Wins over `secondaryField`. */
  secondary?: (row: EntityRow) => string;
  /** Show the row's `code` beside the name when the two differ. */
  showCode?: boolean;
  /** `Status` rows by code, for the badge (probe 010). Read through the context when not given. */
  statuses?: Record<string, StatusRecord> | null;
  size?: EntityGridSize;
  density?: EntityGridDensity;
  selectable?: boolean;
  /** The selected rows. Controlled, with the grid's own selection as the fallback. */
  selection?: EntityRef[];
  onSelectionChange?: (rows: EntityRef[]) => void;
  onSelect?: (row: EntityRow) => void;
  /** How a row is keyed, in the DOM and in the selection. Default `Type:id`. */
  getRowId?: RowIdFn;
  /** True for a row the arrows skip and the selection refuses. */
  isRowDisabled?: RowDisabledFn;
  /** The source's sort, so a SortPicker drops into the header. */
  sort?: SortSpec[];
  onSortChange?: (sort: SortSpec[]) => void;
  /** The source's filter, so a FilterBar drops into the header. */
  filters?: SourceFilters;
  onFiltersChange?: (filters: SourceFilters) => void;
  /** Rows per page offered in the footer. `pages` mode only. */
  pageSizes?: number[];
  /** Height of the scrolling body. In `infinite` mode, reaching its end asks for the next page. */
  maxHeight?: string;
  /** Rows above which the grid is virtualised. */
  virtualizeAfter?: number;
  emptyLabel?: string;
  /** Draws one grid cell. Without it, the row is an EntityCard tile. */
  card?: (context: EntityGridCardContext) => React.ReactNode;
  /** Region above the grid. */
  header?: React.ReactNode;
  /** Region below the footer. */
  footer?: React.ReactNode;
}

const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';

/**
 * Rows as EntityCard tiles.
 *
 * The tile is the card's own `tile` variant, so a grid cell and a card show the
 * same row the same way: thumbnail, the status over it, the name, and one
 * metadata line from the row-anatomy props. A Version with media carries the play
 * overlay, and a row with no picture, one still transcoding and one ready all
 * render, the value of an `image` field being the only state marker there is
 * (field_types/image).
 *
 * The grid owns the layout and the cursor: one tab stop moves into the tiles, the
 * arrows walk them, and Space selects where Enter opens.
 *
 * In `infinite` mode scrolling to the end asks the source for the next page, and
 * paging stops on a short page, never on a missing `links.next`, which the API emits
 * forever (006_pagination). In `pages` mode the footer walks the set with an explicit
 * page number and reads "n to m of N" once `_summarize` has counted it
 * (020_summarize).
 */
export function EntityGrid({
  source,
  context,
  thumbnail = 'image',
  labelField = null,
  subLabelField = null,
  subLabel,
  secondaryField = null,
  secondary,
  showCode = false,
  statuses = null,
  size = 'md',
  density = 'default',
  selectable = false,
  selection: selectionProp,
  onSelectionChange,
  onSelect,
  getRowId,
  isRowDisabled,
  sort: sortProp,
  onSortChange,
  filters: filtersProp,
  onFiltersChange,
  pageSizes = [25, 50, 100],
  maxHeight = '32rem',
  virtualizeAfter = 100,
  emptyLabel = 'No rows',
  card,
  header,
  footer,
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
  // `false` still draws the media block; a path no row carries is the placeholder.
  const imagePath = thumbnail === false ? '' : thumbnail;

  const [pageDraft, setPageDraft] = useState('');
  const rowId = (row: EntityRow): string => rowIdOf(row, getRowId);
  const disabledAt = (index: number): boolean => {
    const row = rows[index];
    return row === undefined || rowIsDisabled(row, isRowDisabled);
  };

  const [ownSelection, setOwnSelection] = useState<EntityRef[]>([]);
  const selection = selectionProp ?? ownSelection;
  /** The selection as keys, so a row asks whether it is in it in constant time. */
  const chosenKeys = new Set(selection.map(rowKey));

  function toggle(row: EntityRow): void {
    if (rowIsDisabled(row, isRowDisabled)) return;
    const key = rowKey(row);
    const next = chosenKeys.has(key)
      ? selection.filter((ref) => rowKey(ref) !== key)
      : [...selection, { type: row.type, id: row.id }];
    setOwnSelection(next);
    onSelectionChange?.(next);
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

  function goToPage(value: string): void {
    const wanted = Number(value);
    setPageDraft('');
    if (!Number.isFinite(wanted) || wanted < 1) return;
    void source.setPage(paging.pageCount === null ? wanted : Math.min(wanted, paging.pageCount));
  }

  /* keyboard ------------------------------------------------------------- */

  const listRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState(0);
  /** The one tab stop, which never lands on a disabled row. */
  const active =
    rows.length === 0 ? -1 : firstEnabledIndex(rows.length, Math.min(cursor, rows.length - 1), 1, disabledAt);

  /** How many tiles a row holds, read off the track list `auto-fill` resolved to. */
  function columnCount(): number {
    const list = listRef.current;
    if (!list) return 1;
    const tracks = getComputedStyle(list).gridTemplateColumns.split(' ').filter((t) => t.length > 0);
    return Math.max(1, tracks.length);
  }

  function focusTile(index: number): void {
    const next = Math.max(0, Math.min(index, rows.length - 1));
    setCursor(next);
    const put = (): void => {
      const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${next}"]`);
      if (!el) return;
      el.focus({ preventScroll: true });
      el.scrollIntoView({ block: 'nearest' });
    };
    // A tile outside the virtual window has to be drawn before it can take focus.
    if (virtualized) {
      virtualizer.scrollToIndex(Math.floor(next / Math.max(1, cols)));
      requestAnimationFrame(put);
    } else put();
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement | null;
    // Chrome inside a tile, the checkbox, keeps its own keys.
    if (!target || target !== target.closest('[data-index]')) return;
    const index = Number(target.dataset['index']);
    if (!Number.isInteger(index)) return;
    const row = rows[index];
    const step = columnCount();
    switch (event.key) {
      case 'ArrowRight':
        focusTile(nextEnabledIndex(rows.length, index, 1, disabledAt));
        break;
      case 'ArrowLeft':
        focusTile(nextEnabledIndex(rows.length, index, -1, disabledAt));
        break;
      case 'ArrowDown':
        focusTile(nextEnabledIndex(rows.length, index, step, disabledAt));
        break;
      case 'ArrowUp':
        focusTile(nextEnabledIndex(rows.length, index, -step, disabledAt));
        break;
      case 'Home':
        focusTile(firstEnabledIndex(rows.length, 0, 1, disabledAt));
        break;
      case 'End':
        focusTile(firstEnabledIndex(rows.length, rows.length - 1, -1, disabledAt));
        break;
      case ' ':
        if (selectable && row) toggle(row);
        break;
      case 'Enter':
        if (row && !disabledAt(index)) onSelect?.(row);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  function onTileClick(event: React.MouseEvent<HTMLDivElement>, row: EntityRow): void {
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-slot="entity-card-selection"],[data-slot="entity-card-actions"]')) return;
    onSelect?.(row);
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

  /* virtual rows --------------------------------------------------------- */

  /** Tiles across, so a virtualised grid walks rows of tiles and not tiles. */
  const [cols, setCols] = useState(1);
  const virtualized = rows.length > virtualizeAfter;
  const lineHeight = TILE_HEIGHT[size] + GAP_PX[density];

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = (): void => {
      setCols(
        Math.max(1, getComputedStyle(list).gridTemplateColumns.split(' ').filter((track) => track.length > 0).length),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    return () => observer.disconnect();
  }, [rows.length, size, density]);

  const virtualizer = useVirtualizer({
    count: virtualized ? Math.ceil(rows.length / Math.max(1, cols)) : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => lineHeight,
    overscan: 4,
  });

  const lines = virtualizer.getVirtualItems();
  const firstLine = lines[0];
  const lastLine = lines[lines.length - 1];
  const across = Math.max(1, cols);
  const window_ = !virtualized
    ? { before: 0, after: 0, from: 0, slice: rows }
    : !firstLine || !lastLine
      ? { before: 0, after: 0, from: 0, slice: rows.slice(0, across * 4) }
      : {
          before: firstLine.start,
          after: virtualizer.getTotalSize() - lastLine.end,
          from: firstLine.index * across,
          slice: rows.slice(firstLine.index * across, (lastLine.index + 1) * across),
        };

  const columns = { gridTemplateColumns: `repeat(auto-fill,minmax(${TILE[size]}px,1fr))` };

  return (
    <div data-slot="entity-grid" className={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
      {header ? (
        <div data-slot="entity-grid-header" className="flex w-full min-w-0 flex-wrap items-center gap-2">
          {header}
        </div>
      ) : null}

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
          <div className={cn('grid', GAP[density])} style={columns}>
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
              ref={listRef}
              role="listbox"
              aria-multiselectable={selectable ? true : undefined}
              aria-label="Rows"
              tabIndex={-1}
              className={cn('grid', GAP[density])}
              style={columns}
              onKeyDown={onKeyDown}
            >
              {window_.before > 0 ? (
                <div aria-hidden="true" style={{ gridColumn: '1/-1', height: `${window_.before}px` }} />
              ) : null}
              {window_.slice.map((row, offset) => {
                const index = window_.from + offset;
                const key = rowId(row);
                const chosen = chosenKeys.has(rowKey(row));
                const disabled = disabledAt(index);
                if (card) {
                  return (
                    <div
                      key={key}
                      data-slot="entity-grid-card"
                      role="option"
                      aria-selected={chosen}
                      aria-disabled={disabled ? 'true' : undefined}
                      data-disabled={disabled ? 'true' : undefined}
                      tabIndex={index === active ? 0 : -1}
                      data-row-key={key}
                      data-index={index}
                      className={cn('min-w-0 outline-none', disabled && 'pointer-events-none opacity-50')}
                      onFocus={() => setCursor(index)}
                      onClick={(event) => onTileClick(event, row)}
                    >
                      {card({ row, id: key, index, selected: chosen, disabled, active: index === active })}
                    </div>
                  );
                }
                return (
                  <EntityCard
                    key={key}
                    variant="tile"
                    context={context}
                    row={row}
                    imagePath={imagePath}
                    labelField={labelField}
                    subLabelField={subLabelField}
                    subLabel={subLabel}
                    secondaryField={secondaryField}
                    secondary={secondary}
                    showCode={showCode}
                    statuses={statuses}
                    selectable={selectable}
                    size={size}
                    selected={chosen}
                    onSelectedChange={() => toggle(row)}
                    role="option"
                    aria-selected={chosen}
                    aria-disabled={disabled ? 'true' : undefined}
                    data-disabled={disabled ? 'true' : undefined}
                    tabIndex={index === active ? 0 : -1}
                    data-row-key={key}
                    data-index={index}
                    className={disabled ? 'pointer-events-none opacity-50' : undefined}
                    onFocus={() => setCursor(index)}
                    onClick={(event) => onTileClick(event, row)}
                  />
                );
              })}
              {window_.after > 0 ? (
                <div aria-hidden="true" style={{ gridColumn: '1/-1', height: `${window_.after}px` }} />
              ) : null}
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

      {footer ? (
        <div data-slot="entity-grid-footer-region" className="flex w-full min-w-0 flex-wrap items-center gap-2">
          {footer}
        </div>
      ) : null}
    </div>
  );
}
