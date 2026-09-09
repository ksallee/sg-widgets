import type * as React from 'react';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { CollectionColumn, EntityRef, EntityRow, EntitySource, StatusRecord } from '@sg-widgets/core';
import { cellValue, displayNameOf, rowKey } from '@sg-widgets/core';
import { CircleAlert, Inbox } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
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
  /** Path of the `image` field. */
  imagePath?: string;
  /** Path of the status field. Every type but Project uses `sg_status_list`. */
  statusPath?: string;
  /** The status field's schema, for a label out of `display_values`. */
  statusField?: CollectionColumn['field'];
  /** Up to two fields shown under the name. */
  secondary?: CollectionColumn[];
  /** `Status` rows by code, for the badge (probe 010). */
  statuses?: Record<string, StatusRecord> | null;
  size?: EntityGridSize;
  selectable?: boolean;
  onSelectionChange?: (rows: EntityRef[]) => void;
  onSelect?: (row: EntityRow) => void;
  /** Height of the scrolling body. Reaching its end asks the source for the next page. */
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
 * Scrolling to the end asks the source for the next page. Paging stops on a short
 * page, never on a missing `links.next`, which the API emits forever (006_pagination).
 */
export function EntityGrid({
  source,
  imagePath = 'image',
  statusPath = 'sg_status_list',
  statusField = null,
  secondary = [],
  statuses = null,
  size = 'md',
  selectable = false,
  onSelectionChange,
  onSelect,
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
  const shown = secondary.slice(0, 2);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  useEffect(() => {
    onSelectionChange?.(rows.filter((row) => selected[rowKey(row)]).map((row) => ({ type: row.type, id: row.id })));
    // The callback is the caller's; the selection and the rows are what move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, rows]);

  function toggle(row: EntityRow): void {
    const key = rowKey(row);
    setSelected((was) => ({ ...was, [key]: !was[key] }));
  }

  /* infinite scroll ------------------------------------------------------ */

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    const target = sentinelRef.current;
    if (!root || !target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // `loadMore` is a no-op while a read is in flight or when the last page was short.
        if (entries.some((entry) => entry.isIntersecting)) void source.loadMore();
      },
      { root, rootMargin: '200px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [source, rows.length]);

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
                const name = displayNameOf(row.attributes, `${row.type} #${row.id}`);
                const code = String(cellValue(row, statusPath) ?? '');
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
                      <Thumbnail
                        src={cellValue(row, imagePath) as string | null}
                        alt=""
                        playable={row.type === 'Version'}
                        className="h-auto w-full"
                      />
                      <span className="w-full min-w-0 truncate text-sm font-medium" title={name}>
                        {name}
                      </span>
                      {code ? (
                        <StatusBadge code={code} status={statuses?.[code] ?? null} field={statusField} size="sm" />
                      ) : null}
                      {shown.map((column) => (
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
            <div ref={sentinelRef} aria-hidden="true" className="h-4" />
          </>
        )}
      </div>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="tabular-nums">{rows.length} loaded</span>
        {snapshot.count !== null ? <span className="tabular-nums">of {snapshot.count}</span> : null}
        {snapshot.status === 'loadingMore' ? <span>Loading…</span> : null}
      </div>
    </div>
  );
}
