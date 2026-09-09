import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { CollectionColumn, EntityRef, EntityRow, EntitySource, FieldSchema, SortSpec, StatusRecord } from '@sg-widgets/core';
import { cellValue, groupRows, rowKey } from '@sg-widgets/core';
import {
  columnOrderingFeature,
  columnResizingFeature,
  columnSizingFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { ArrowDown, ArrowUp, ChevronRight, CircleAlert, Inbox } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { FieldValue } from '@/registry/sg/components/field-value';

export type EntityTableDensity = 'compact' | 'default';

/** What an editor is handed when a cell opens one. */
export interface CellEditorProps {
  value: unknown;
  dataType: string;
  field: FieldSchema | null;
  /** Write this value through the source and close. */
  commit: (value: unknown) => void;
  /** Close without writing. */
  cancel: () => void;
}

/**
 * The integration point for the per-type field editors: given a `data_type`,
 * return the component to open in a cell. Anything it does not answer for falls
 * back to a plain text input.
 */
export type EditorFor = (dataType: string) => React.ComponentType<CellEditorProps> | null | undefined;

/** Row heights per density, so a virtualised list can be measured before it is drawn. */
const ROW_HEIGHT: Record<EntityTableDensity, number> = { compact: 33, default: 41 };
const CELL: Record<EntityTableDensity, string> = { compact: 'px-3 py-1', default: 'px-3 py-2' };

interface Item {
  key: string;
  group: { value: unknown; count: number; collapsed: boolean } | null;
  row: { key: string; ref: EntityRef; data: EntityRow } | null;
}

export interface EntityTableProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The rows, the filter and the sort behind them. Created with core's `createEntitySource`. */
  source: EntitySource;
  /** Columns in display order. Core's `resolveColumns` fills them in from the schema. */
  columns: CollectionColumn[];
  /** `Status` rows by code, for status cells (probe 010). */
  statuses?: Record<string, StatusRecord> | null;
  density?: EntityTableDensity;
  /** Draws a checkbox column and reports the selection. */
  selectable?: boolean;
  onSelectionChange?: (rows: EntityRef[]) => void;
  /** Collapse rows under headers of a shared value at this path. */
  groupBy?: string | null;
  /** Opens an editor on a double-click or Enter in an editable cell. */
  editable?: boolean;
  editorFor?: EditorFor;
  /** Height of the scrolling body. */
  maxHeight?: string;
  /** Rows above which the body is virtualised. */
  virtualizeAfter?: number;
  emptyLabel?: string;
}

// Sorting is the server's and grouping follows the order it produced, so neither
// feature is registered here: this table owns sizing, ordering and selection.
const features = tableFeatures({
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  rowSelectionFeature,
});

const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';

/**
 * A page of rows, one column per field path.
 *
 * Columns are schema-driven: the header is the field's display name and the cell
 * rendering comes from its `data_type` through FieldValue. Sorting is the server's -
 * a header click sets the source's sort and reads the first page again - because a
 * sort applied to one loaded page would order the page and not the set, and because
 * a sort on a field that cannot be sorted is a silent 200 no-op (026_result_order).
 * Grouping follows that same order and collapses the contiguous runs, so a group's
 * count is the rows loaded so far and grows as more arrive.
 *
 * An edit writes one field through `updateRow`, which follows the write with a
 * re-read: the write's own answer is the whole record but resolves no dotted path
 * (024_read_after_write). A refused write restores the value and shows the reason in
 * the cell.
 */
export function EntityTable({
  source,
  columns,
  statuses = null,
  density = 'default',
  selectable = false,
  onSelectionChange,
  groupBy = null,
  editable = false,
  editorFor,
  maxHeight = '28rem',
  virtualizeAfter = 100,
  emptyLabel = 'No rows',
  className,
  ...rest
}: EntityTableProps) {
  /* state ---------------------------------------------------------------- */

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
    if (groupBy && snapshot.sort[0]?.path !== groupBy) {
      void source.setSort([{ path: groupBy, descending: false }, ...snapshot.sort.filter((k) => k.path !== groupBy)]);
    }
  }, [source, groupBy, snapshot.sort]);

  const rows = snapshot.rows;
  const sort = snapshot.sort;
  const rowHeight = ROW_HEIGHT[density];
  const cellClass = CELL[density];

  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<{ key: string; path: string } | null>(null);
  const [cellError, setCellError] = useState<{ key: string; path: string; message: string } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  /* the table ------------------------------------------------------------ */

  const columnDefs = useMemo(
    () => [
      ...(selectable ? [{ id: '__select', size: 40, minSize: 40, maxSize: 40, enableResizing: false }] : []),
      ...columns.map((column) => ({
        id: column.path,
        accessorFn: (row: EntityRow) => cellValue(row, column.path),
        size: column.width ?? 180,
        minSize: 64,
      })),
    ],
    [columns, selectable],
  );

  const table = useTable<typeof features, EntityRow>({
    features,
    data: rows,
    columns: columnDefs,
    getRowId: (row: EntityRow) => rowKey(row),
    columnResizeMode: 'onChange',
    enableRowSelection: selectable,
  });

  const selection = table.state.rowSelection;
  const order = table.state.columnOrder;
  useEffect(() => {
    void order;
    void selection;
    onSelectionChange?.(table.getSelectedRowModel().rows.map((row) => ({ type: row.original.type, id: row.original.id })));
    // The table instance is stable; the selection and the order are what move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, order]);

  const leafColumns = table.getAllLeafColumns();
  const totalWidth = table.getTotalSize();

  /* rows, grouped or flat ------------------------------------------------ */

  const modelRows = table.getRowModel().rows;
  const byKey = useMemo(() => new Map(modelRows.map((row) => [row.id, row])), [modelRows]);

  const items = useMemo((): Item[] => {
    const asItem = (row: EntityRow): Item => ({
      key: rowKey(row),
      group: null,
      row: { key: rowKey(row), ref: { type: row.type, id: row.id }, data: row },
    });
    if (!groupBy) return rows.map(asItem);
    const out: Item[] = [];
    // The run index keeps the key unique while a page whose order does not yet lead with
    // the group path is on screen.
    let run = 0;
    for (const bucket of groupRows(rows, groupBy)) {
      const key = `group:${run++}:${JSON.stringify(bucket.value ?? null)}`;
      const shut = collapsed[key] === true;
      out.push({ key, group: { value: bucket.value, count: bucket.rows.length, collapsed: shut }, row: null });
      if (!shut) out.push(...bucket.rows.map(asItem));
    }
    return out;
  }, [rows, groupBy, collapsed]);

  /* virtual rows --------------------------------------------------------- */

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualized = items.length > virtualizeAfter;
  const virtualizer = useVirtualizer({
    count: virtualized ? items.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];
  const window_ = !virtualized
    ? { before: 0, after: 0, slice: items }
    : !first || !last
      ? { before: 0, after: 0, slice: items.slice(0, 20) }
      : {
          before: first.start,
          after: virtualizer.getTotalSize() - last.end,
          slice: items.slice(first.index, last.index + 1),
        };

  /* sorting -------------------------------------------------------------- */

  const sortOf = (path: string): SortSpec | undefined => sort.find((key) => key.path === path);

  /** Ascending, then descending, then unsorted, which is the server's id ascending. */
  function toggleSort(path: string): void {
    const current = sortOf(path);
    const next: SortSpec[] =
      current === undefined ? [{ path, descending: false }] : current.descending ? [] : [{ path, descending: true }];
    // Grouping only reads as grouping over an order the server produced, so the group
    // path stays the first sort key.
    void source.setSort(groupBy && next[0]?.path !== groupBy ? [{ path: groupBy, descending: false }, ...next] : next);
  }

  /* column reorder ------------------------------------------------------- */

  function onDrop(target: string): void {
    const from = dragging;
    setDragging(null);
    setDropTarget(null);
    if (!from || from === target) return;
    const ids = leafColumns.map((column) => column.id);
    const next = ids.filter((id) => id !== from);
    next.splice(next.indexOf(target), 0, from);
    table.setColumnOrder(next);
  }

  /* inline edit ---------------------------------------------------------- */

  function openEditor(key: string, column: CollectionColumn): void {
    if (!editable || !column.editable) return;
    setCellError(null);
    setEditing({ key, path: column.path });
  }

  async function commit(item: NonNullable<Item['row']>, column: CollectionColumn, value: unknown): Promise<void> {
    const before = cellValue(item.data, column.path);
    setEditing(null);
    if (value === before) return;
    try {
      await source.updateRow(item.ref, { [column.path]: value });
      setCellError(null);
    } catch (error) {
      // The write is refused, so the cell goes back to what the row still holds and
      // says why beside it.
      setCellError({ key: item.key, path: column.path, message: error instanceof Error ? error.message : String(error) });
    }
  }

  function onCellKeyDown(event: React.KeyboardEvent, key: string, column: CollectionColumn): void {
    // Only when the cell itself has focus. An editor's own Enter reaches this on the way
    // up, after the commit has already closed it, and must not open it again.
    if (event.key !== 'Enter' || editing || (event.target as HTMLElement).dataset['slot'] !== 'table-cell') return;
    event.preventDefault();
    openEditor(key, column);
  }

  function fallbackKeyDown(event: React.KeyboardEvent<HTMLInputElement>, item: NonNullable<Item['row']>, column: CollectionColumn): void {
    // The input is read off `target`: a delegated handler does not own `currentTarget`.
    const input = event.target as HTMLInputElement;
    if (event.key === 'Enter') {
      event.preventDefault();
      void commit(item, column, input.value);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      setEditing(null);
    }
  }

  const isEditing = (key: string, path: string): boolean => editing?.key === key && editing.path === path;
  const groupColumn = columns.find((c) => c.path === groupBy);

  return (
    <div data-slot="entity-table" className={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
      <div
        ref={scrollRef}
        data-slot="entity-table-scroll"
        style={{ maxHeight }}
        className="border-border relative w-full overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible"
      >
        <Table style={{ tableLayout: 'fixed', width: `${totalWidth}px` }}>
          <colgroup>
            {leafColumns.map((column) => (
              <col key={column.id} style={{ width: `${column.getSize()}px` }} />
            ))}
          </colgroup>
          <TableHeader className="bg-background sticky top-0 z-10">
            <TableRow>
              {(table.getHeaderGroups()[0]?.headers ?? []).map((header) => {
                const column = columns.find((c) => c.path === header.column.id);
                return (
                  <TableHead
                    key={header.id}
                    data-column={header.column.id}
                    className={cn('bg-background relative border-b p-0', column?.align === 'right' && 'text-right')}
                  >
                    {header.column.id === '__select' ? (
                      <span className="flex h-10 items-center justify-center">
                        <Checkbox
                          aria-label="Select all loaded rows"
                          checked={table.getIsAllRowsSelected()}
                          indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
                          onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
                        />
                      </span>
                    ) : column ? (
                      <>
                        <button
                          type="button"
                          draggable
                          aria-label={`Sort by ${column.header}`}
                          onDragStart={() => setDragging(column.path)}
                          onDragOver={(event) => {
                            event.preventDefault();
                            setDropTarget(column.path);
                          }}
                          onDragLeave={() => setDropTarget(null)}
                          onDrop={(event) => {
                            event.preventDefault();
                            onDrop(column.path);
                          }}
                          onClick={() => toggleSort(column.path)}
                          className={cn(
                            'focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 w-full min-w-0 items-center gap-1.5 px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
                            'hover:bg-accent hover:text-accent-foreground',
                            column.align === 'right' && 'justify-end',
                            dropTarget === column.path && 'border-ring border-l-2',
                            dragging === column.path && 'opacity-50',
                          )}
                        >
                          <span className="truncate" title={column.header}>
                            {column.header}
                          </span>
                          {sortOf(column.path)?.descending === false ? (
                            <ArrowUp aria-hidden="true" className="size-4 shrink-0" />
                          ) : sortOf(column.path)?.descending === true ? (
                            <ArrowDown aria-hidden="true" className="size-4 shrink-0" />
                          ) : null}
                        </button>
                        {header.column.getCanResize() ? (
                          <span
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Resize ${column.header}`}
                            onPointerDown={header.getResizeHandler()}
                            className={cn(
                              'hover:bg-ring absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none',
                              header.column.getIsResizing() && 'bg-ring',
                            )}
                          />
                        ) : null}
                      </>
                    ) : null}
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>

          <TableBody>
            {snapshot.status === 'loading' ? (
              Array.from({ length: 8 }, (_, index) => (
                <TableRow key={index}>
                  {leafColumns.map((column) => (
                    <TableCell key={column.id} className={cellClass}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : snapshot.status === 'error' ? (
              <TableRow>
                <TableCell colSpan={leafColumns.length}>
                  <span className={cn(stateClass, 'text-destructive')}>
                    <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
                    {snapshot.error?.message}
                  </span>
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={leafColumns.length}>
                  <span className={stateClass}>
                    <Inbox aria-hidden="true" className="size-4 shrink-0" />
                    {emptyLabel}
                  </span>
                </TableCell>
              </TableRow>
            ) : (
              <>
                {window_.before > 0 ? <tr aria-hidden="true" style={{ height: `${window_.before}px` }} /> : null}
                {window_.slice.map((item) =>
                  item.group ? (
                    <TableRow
                      key={item.key}
                      data-slot="entity-table-group"
                      className="bg-muted/50 hover:bg-muted/50"
                      style={virtualized ? { height: `${rowHeight}px` } : undefined}
                    >
                      <TableCell colSpan={leafColumns.length} className="p-0">
                        <button
                          type="button"
                          aria-expanded={!item.group.collapsed}
                          onClick={() => setCollapsed((was) => ({ ...was, [item.key]: !was[item.key] }))}
                          className="focus-visible:ring-ring focus-visible:ring-offset-background flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                        >
                          <ChevronRight
                            aria-hidden="true"
                            className={cn(
                              'size-4 shrink-0 transition-transform duration-150 ease-out',
                              !item.group.collapsed && 'rotate-90',
                            )}
                          />
                          <span className="truncate">
                            <FieldValue
                              value={item.group.value}
                              dataType={groupColumn?.dataType ?? 'text'}
                              field={groupColumn?.field}
                              statuses={statuses}
                            />
                          </span>
                          <span className="text-muted-foreground font-mono text-xs tabular-nums">{item.group.count}</span>
                        </button>
                      </TableCell>
                    </TableRow>
                  ) : item.row ? (
                    (() => {
                      const entry = item.row;
                      const modelRow = byKey.get(entry.key);
                      return (
                        <TableRow
                          key={item.key}
                          data-row-key={entry.key}
                          data-state={modelRow?.getIsSelected() ? 'selected' : undefined}
                          className={modelRow?.getIsSelected() ? 'bg-accent text-accent-foreground' : undefined}
                          style={virtualized ? { height: `${rowHeight}px` } : undefined}
                        >
                          {selectable ? (
                            <TableCell className={cn(cellClass, 'text-center')}>
                              <Checkbox
                                aria-label="Select row"
                                checked={modelRow?.getIsSelected() ?? false}
                                onCheckedChange={(value) => modelRow?.toggleSelected(value === true)}
                              />
                            </TableCell>
                          ) : null}
                          {columns.map((column) => {
                            const canEdit = editable && column.editable;
                            const Editor = editorFor?.(column.dataType) ?? null;
                            return (
                              <TableCell
                                key={column.path}
                                data-column={column.path}
                                tabIndex={canEdit ? 0 : undefined}
                                onDoubleClick={() => openEditor(entry.key, column)}
                                onKeyDown={(event) => canEdit && onCellKeyDown(event, entry.key, column)}
                                className={cn(
                                  cellClass,
                                  'focus-visible:ring-ring focus-visible:ring-offset-background overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset',
                                  column.align === 'right' && 'text-right',
                                  canEdit && 'cursor-text',
                                )}
                              >
                                {isEditing(entry.key, column.path) ? (
                                  Editor ? (
                                    <Editor
                                      value={cellValue(entry.data, column.path)}
                                      dataType={column.dataType}
                                      field={column.field}
                                      commit={(value) => void commit(entry, column, value)}
                                      cancel={() => setEditing(null)}
                                    />
                                  ) : (
                                    // No editor for this type: a plain input, which every text-like field takes.
                                    <Input
                                      defaultValue={String(cellValue(entry.data, column.path) ?? '')}
                                      autoFocus
                                      aria-label={column.header}
                                      onKeyDown={(event) => fallbackKeyDown(event, entry, column)}
                                      onBlur={() => setEditing(null)}
                                    />
                                  )
                                ) : (
                                  <>
                                    <FieldValue
                                      value={cellValue(entry.data, column.path)}
                                      dataType={column.dataType}
                                      field={column.field}
                                      statuses={statuses}
                                    />
                                    {cellError && cellError.key === entry.key && cellError.path === column.path ? (
                                      <span className="text-destructive block truncate text-xs" title={cellError.message}>
                                        {cellError.message}
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })()
                  ) : null,
                )}
                {window_.after > 0 ? <tr aria-hidden="true" style={{ height: `${window_.after}px` }} /> : null}
              </>
            )}
          </TableBody>
        </Table>
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
