import type * as React from 'react';
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { CollectionColumn, EntityRef, EntityRow, EntitySource, StatusRecord } from '@sg-widgets/core';
import { cellValue, displayNameOf, groupRows, rowKey } from '@sg-widgets/core';
import { ChevronRight, CircleAlert, Inbox } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FieldValue } from '@/registry/sg/components/field-value';

export type GroupedListDensity = 'compact' | 'default';

/** The list-row padding of `docs/design-rules.md`; compact halves the vertical half. */
const ROW: Record<GroupedListDensity, string> = { compact: 'px-2 py-1', default: 'px-2 py-1.5' };

export interface GroupedListProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  /** The rows and the order behind them. Created with core's `createEntitySource`. */
  source: EntitySource;
  /** Path the rows are grouped on. The source is sorted on it. */
  groupBy: CollectionColumn;
  /** Path of the row's label. Defaults to the type's own display name. */
  labelPath?: string | null;
  /** Path shown under the label. */
  subLabel?: CollectionColumn | null;
  /** Path shown right-aligned at the end of the row. */
  secondary?: CollectionColumn | null;
  /** `Status` rows by code (probe 010). */
  statuses?: Record<string, StatusRecord> | null;
  density?: GroupedListDensity;
  selectable?: boolean;
  onSelectionChange?: (rows: EntityRef[]) => void;
  onSelect?: (row: EntityRow) => void;
  /** Fixed-size leading slot: a thumbnail, an avatar, a colour swatch. */
  leading?: (row: EntityRow) => React.ReactNode;
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
 */
export function GroupedList({
  source,
  groupBy,
  labelPath = null,
  subLabel = null,
  secondary = null,
  statuses = null,
  density = 'default',
  selectable = false,
  onSelectionChange,
  onSelect,
  leading,
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
    // Grouping reads the contiguous runs of the order the server produced, so the group
    // path has to lead the sort. Setting it re-reads the first page.
    if (snapshot.sort[0]?.path !== groupBy.path) {
      void source.setSort([
        { path: groupBy.path, descending: false },
        ...snapshot.sort.filter((key) => key.path !== groupBy.path),
      ]);
    }
  }, [source, groupBy.path, snapshot.sort]);

  const rows = snapshot.rows;
  const rowClass = ROW[density];
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<Record<string, boolean>>({});

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
    if (labelPath) return String(cellValue(row, labelPath) ?? '');
    return displayNameOf(row.attributes, `${row.type} #${row.id}`);
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
          groups.map((group) => {
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
                    />
                  </span>
                  <span className="text-muted-foreground font-mono text-xs tabular-nums">{group.rows.length}</span>
                </button>
                {!shut ? (
                  <ul className="flex flex-col">
                    {group.rows.map((row) => {
                      const key = rowKey(row);
                      const label = labelOf(row);
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
                          {leading ? <span className="flex shrink-0 items-center">{leading(row)}</span> : null}
                          <button
                            type="button"
                            onClick={() => (selectable ? toggle(row) : onSelect?.(row))}
                            className="focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 flex-1 flex-col items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                          >
                            <span className="w-full min-w-0 truncate text-sm" title={label}>
                              {label}
                            </span>
                            {subLabel ? (
                              <span className="w-full min-w-0 truncate text-xs">
                                <FieldValue
                                  value={cellValue(row, subLabel.path)}
                                  dataType={subLabel.dataType}
                                  field={subLabel.field}
                                  statuses={statuses}
                                  className="text-muted-foreground text-xs"
                                />
                              </span>
                            ) : null}
                          </button>
                          {secondary ? (
                            <span className="flex shrink-0 justify-end text-xs">
                              <FieldValue
                                value={cellValue(row, secondary.path)}
                                dataType={secondary.dataType}
                                field={secondary.field}
                                statuses={statuses}
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
          })
        )}
      </div>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <span className="tabular-nums">{rows.length} loaded</span>
        {snapshot.count !== null ? <span className="tabular-nums">of {snapshot.count}</span> : null}
        {snapshot.hasMore ? (
          <button
            type="button"
            onClick={() => void source.loadMore()}
            disabled={snapshot.status === 'loadingMore'}
            className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background border-border h-8 rounded-md border px-2 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-safe:active:scale-[0.98]"
          >
            {snapshot.status === 'loadingMore' ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
      </div>
    </div>
  );
}
