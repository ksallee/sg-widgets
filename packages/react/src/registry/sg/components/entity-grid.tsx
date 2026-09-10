import type * as React from 'react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type {
  EntityRef,
  EntityRow,
  EntitySource,
  FieldSpec,
  SgContext,
  StatusRecord,
} from '@sg-widgets/core';
import { describePaging, rowKey } from '@sg-widgets/core';
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

const TILE_SELECTOR = '[data-slot="entity-card"][data-variant="tile"]';

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
  // `false` still draws the media block; a path no row carries is the placeholder.
  const imagePath = thumbnail === false ? '' : thumbnail;

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

  function goToPage(value: string): void {
    const wanted = Number(value);
    setPageDraft('');
    if (!Number.isFinite(wanted) || wanted < 1) return;
    void source.setPage(paging.pageCount === null ? wanted : Math.min(wanted, paging.pageCount));
  }

  /* keyboard ------------------------------------------------------------- */

  const listRef = useRef<HTMLDivElement | null>(null);
  const [cursor, setCursor] = useState(0);
  const active = Math.min(cursor, Math.max(rows.length - 1, 0));

  function tiles(): HTMLElement[] {
    const list = listRef.current;
    return list ? [...list.querySelectorAll<HTMLElement>(TILE_SELECTOR)] : [];
  }

  /** How many tiles a row holds, read off the track list `auto-fill` resolved to. */
  function columnCount(): number {
    const list = listRef.current;
    if (!list) return 1;
    const tracks = getComputedStyle(list).gridTemplateColumns.split(' ').filter((t) => t.length > 0);
    return Math.max(1, tracks.length);
  }

  function focusTile(index: number): void {
    const all = tiles();
    const next = Math.max(0, Math.min(index, all.length - 1));
    const el = all[next];
    if (!el) return;
    setCursor(next);
    el.focus({ preventScroll: true });
    el.scrollIntoView({ block: 'nearest' });
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement | null;
    // Chrome inside a tile, the checkbox, keeps its own keys.
    if (!target || target !== target.closest(TILE_SELECTOR)) return;
    const index = tiles().indexOf(target);
    if (index < 0) return;
    const row = rows[index];
    switch (event.key) {
      case 'ArrowRight':
        focusTile(index + 1);
        break;
      case 'ArrowLeft':
        focusTile(index - 1);
        break;
      case 'ArrowDown':
        focusTile(index + columnCount());
        break;
      case 'ArrowUp':
        focusTile(index - columnCount());
        break;
      case 'Home':
        focusTile(0);
        break;
      case 'End':
        focusTile(tiles().length - 1);
        break;
      case ' ':
        if (selectable && row) toggle(row);
        break;
      case 'Enter':
        if (row) onSelect?.(row);
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

  const columns = { gridTemplateColumns: `repeat(auto-fill,minmax(${TILE[size]}px,1fr))` };

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
              {rows.map((row, index) => {
                const key = rowKey(row);
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
                    selected={selected[key] === true}
                    onSelectedChange={() => toggle(row)}
                    role="option"
                    aria-selected={selected[key] === true}
                    tabIndex={index === active ? 0 : -1}
                    data-row-key={key}
                    onFocus={() => setCursor(index)}
                    onClick={(event) => onTileClick(event, row)}
                  />
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
