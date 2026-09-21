import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type {
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
} from 'sg-widgets-core';
import { firstEnabledIndex, NO_ROWS_LABEL, nextEnabledIndex, stateLine } from 'sg-widgets-core';
import { CircleAlert, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  COLLECTION_REGION,
  COLLECTION_ROOT,
  useCollectionBody,
  useCollectionControl,
} from '@/registry/sg/components/collection-control';
import { CollectionFooter } from '@/registry/sg/components/collection-footer';
import { EntityCard } from '@/registry/sg/components/entity-card';
import { StateLine } from '@/registry/sg/components/state-line';

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

/** The inset of the tile's own body, so a skeleton costs what a tile costs. */
const TILE_BODY: Record<EntityGridSize, string> = { sm: 'p-3', md: 'p-3', lg: 'p-4' };

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
  /** How the set is walked: a footer with a page number, a load-more row, or the scroller. */
  paging?: PagingMode;
  /** Height of the scrolling body. In `scroll` mode, reaching its end asks for the next page. */
  maxHeight?: string;
  /** Rows above which the grid is virtualised. */
  virtualizeAfter?: number;
  /** Shown when the read returned nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
  /** Draws one grid cell. Without it, the row is an EntityCard tile. */
  card?: (context: EntityGridCardContext) => React.ReactNode;
  /** Region above the grid. */
  header?: React.ReactNode;
  /** Region below the footer. */
  footer?: React.ReactNode;
}

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
 * `paging` says how the set is walked, and the source follows it. In `scroll` reaching
 * the end of the body asks the source for the next page, in `more` a row under the
 * tiles does, and paging stops on a short page, never on a missing `links.next`, which
 * the API emits forever (006_pagination). In `pages` the footer walks the set with an
 * explicit page number and reads "n to m of N" once `_summarize` has counted it
 * (020_summarize). A page that fails leaves its tiles and says why at the bottom, with
 * a retry.
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
  paging = 'scroll',
  maxHeight = '32rem',
  virtualizeAfter = 100,
  emptyLabel = NO_ROWS_LABEL,
  loadingLabel,
  errorLabel,
  card,
  header,
  footer,
  className,
  ...rest
}: EntityGridProps) {
  const listRef = useRef<HTMLDivElement | null>(null);
  /** Tiles across, so a virtualised grid walks rows of tiles and not tiles. */
  const [cols, setCols] = useState(1);
  const across = Math.max(1, cols);

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
  const rows = control.rows;
  const view = control.view(rows.length);
  const loadingText = control.loadingText;
  // `false` still draws the media block; a path no row carries is the placeholder.
  const imagePath = thumbnail === false ? '' : thumbnail;

  const body = useCollectionBody(control, {
    // A line is one row of tiles, so the threshold is still measured in rows.
    lines: Math.ceil(rows.length / across),
    measured: rows.length,
    lineHeight: TILE_HEIGHT[size] + GAP_PX[density],
    overscan: 4,
    virtualizeAfter,
    lineOfRow: (index) => Math.floor(index / across),
    lastRowOfLine: (line) => (line + 1) * across - 1,
    cursorTarget: (index) => listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`),
  });

  /* keyboard ------------------------------------------------------------- */

  /** How many tiles a row holds, read off the track list `auto-fill` resolved to. */
  function columnCount(): number {
    const list = listRef.current;
    if (!list) return 1;
    const tracks = getComputedStyle(list).gridTemplateColumns.split(' ').filter((t) => t.length > 0);
    return Math.max(1, tracks.length);
  }

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

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement | null;
    // Chrome inside a tile, the checkbox, keeps its own keys.
    if (!target || target !== target.closest('[data-index]')) return;
    const index = Number(target.dataset['index']);
    if (!Number.isInteger(index)) return;
    const row = rows[index];
    const step = columnCount();
    const disabledAt = control.disabledAt;
    switch (event.key) {
      case 'ArrowRight':
        if (!body.askForPage(index + 1)) body.focusRow(nextEnabledIndex(rows.length, index, 1, disabledAt));
        break;
      case 'ArrowLeft':
        body.focusRow(nextEnabledIndex(rows.length, index, -1, disabledAt));
        break;
      case 'ArrowDown':
        if (!body.askForPage(index + step)) body.focusRow(nextEnabledIndex(rows.length, index, step, disabledAt));
        break;
      case 'ArrowUp':
        body.focusRow(nextEnabledIndex(rows.length, index, -step, disabledAt));
        break;
      case 'Home':
        body.focusRow(firstEnabledIndex(rows.length, 0, 1, disabledAt));
        break;
      case 'End':
        body.focusRow(firstEnabledIndex(rows.length, rows.length - 1, -1, disabledAt));
        break;
      case ' ':
        if (selectable && row) control.toggle(row);
        break;
      case 'Enter':
        if (row && !control.disabledAt(index)) onSelect?.(row);
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

  /** The tiles on screen, with the space the ones above and below take. */
  const at = body.window;
  const window_ = !at
    ? { before: 0, after: 0, from: 0, slice: rows }
    : at.to < at.from
      ? { before: 0, after: 0, from: 0, slice: rows.slice(0, across * 4) }
      : {
          before: at.before,
          after: at.after,
          from: at.from * across,
          slice: rows.slice(at.from * across, (at.to + 1) * across),
        };

  const columns = { gridTemplateColumns: `repeat(auto-fill,minmax(${TILE[size]}px,1fr))` };

  return (
    <div data-slot="entity-grid" className={cn(COLLECTION_ROOT, className)} {...rest}>
      {header ? (
        <div data-slot="entity-grid-header" className={COLLECTION_REGION}>
          {header}
        </div>
      ) : null}

      <div
        ref={body.scrollRef}
        data-slot="entity-grid-scroll"
        style={{ maxHeight }}
        className="border-border flex w-full flex-col gap-3 overflow-auto rounded-lg border p-3"
      >
        {view === 'error' ? (
          <StateLine
            state="error"
            pad="table"
            icon={CircleAlert}
            label={stateLine('error', { errorLabel }, snapshot.error?.message)}
          />
        ) : view === 'loading' ? (
          <div
            aria-busy="true"
            aria-label={loadingText}
            className={cn('grid', GAP[density])}
            style={columns}
          >
            {/* A skeleton stands in for a tile: the same surface, the same inset, the same height. */}
            {Array.from({ length: 8 }, (_, index) => (
              <div
                key={index}
                className="border-border bg-card flex min-w-0 flex-col overflow-hidden rounded-lg border"
              >
                <Skeleton className="aspect-video w-full rounded-none" />
                <div className={cn('flex min-w-0 flex-col gap-1.5', TILE_BODY[size])}>
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : view === 'empty' ? (
          <StateLine state="empty" pad="table" icon={Inbox} label={emptyLabel} />
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
                const key = control.rowId(row);
                const chosen = control.isSelected(row);
                const disabled = control.disabledAt(index);
                if (card) {
                  return (
                    <div
                      key={key}
                      data-slot="entity-grid-card"
                      role="option"
                      aria-selected={chosen}
                      aria-disabled={disabled ? 'true' : undefined}
                      data-disabled={disabled ? 'true' : undefined}
                      tabIndex={index === body.active ? 0 : -1}
                      data-row-key={key}
                      data-index={index}
                      className={cn('min-w-0 outline-none', disabled && 'pointer-events-none opacity-50 [&_img]:grayscale')}
                      onFocus={() => body.setCursor(index)}
                      onClick={(event) => onTileClick(event, row)}
                    >
                      {card({ row, id: key, index, selected: chosen, disabled, active: index === body.active })}
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
                    onSelectedChange={() => control.toggle(row)}
                    role="option"
                    aria-selected={chosen}
                    aria-disabled={disabled ? 'true' : undefined}
                    data-disabled={disabled ? 'true' : undefined}
                    tabIndex={index === body.active ? 0 : -1}
                    data-row-key={key}
                    data-index={index}
                    className={disabled ? 'pointer-events-none opacity-50 [&_img]:grayscale' : undefined}
                    onFocus={() => body.setCursor(index)}
                    onClick={(event) => onTileClick(event, row)}
                  />
                );
              })}
              {window_.after > 0 ? (
                <div aria-hidden="true" style={{ gridColumn: '1/-1', height: `${window_.after}px` }} />
              ) : null}
            </div>
            {control.bottom === 'error' ? (
              <StateLine
                state="error"
                slotName="entity-grid-page-error"
                pad="none"
                icon={CircleAlert}
                label={stateLine('error', { errorLabel }, snapshot.error?.message)}
              >
                <Button variant="outline" onClick={() => control.retry()}>
                  Retry
                </Button>
              </StateLine>
            ) : control.bottom === 'loading' ? (
              <div data-slot="entity-grid-loading" aria-busy="true" aria-label={loadingText}>
                <Skeleton className="h-4 w-full" />
              </div>
            ) : control.bottom === 'more' ? (
              <div data-slot="entity-grid-load-more" className="flex justify-center">
                <Button variant="outline" onClick={() => void source.loadMore()}>
                  Load more
                </Button>
              </div>
            ) : control.bottom === 'sentinel' ? (
              <div ref={body.setSentinel} data-slot="entity-grid-sentinel" aria-hidden="true" className="h-4" />
            ) : null}
          </>
        )}
      </div>

      <CollectionFooter
        source={source}
        pager={control.pager}
        pageSizes={pageSizes}
        loading={snapshot.status === 'loading'}
        slotName="entity-grid"
      />

      {footer ? (
        <div data-slot="entity-grid-footer-region" className={COLLECTION_REGION}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
