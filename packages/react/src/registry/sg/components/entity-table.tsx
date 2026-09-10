import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type {
  CollectionColumn,
  EntityRef,
  EntityRow,
  EntitySource,
  FieldSchema,
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
  idsForRefs,
  isEditableType,
  preferencesOf,
  rowIdOf,
  rowIsDisabled,
  sameFilters,
  sameIds,
  sameRefs,
  sameSort,
} from '@sg-widgets/core';
import {
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  createExpandedRowModel,
  createGroupedRowModel,
  rowExpandingFeature,
  rowSelectionFeature,
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  ArrowDown,
  ArrowLeftToLine,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  CircleAlert,
  EllipsisVertical,
  EyeOff,
  Inbox,
  PinOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { FieldEditor } from '@/registry/sg/components/field-editor';
import { FieldValue } from '@/registry/sg/components/field-value';

export type EntityTableDensity = 'compact' | 'default';
export type EntityTableSize = 'sm' | 'md' | 'lg';

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
 * return the component to open in a cell. Anything it does not answer for opens
 * FieldEditor.
 */
export type EditorFor = (dataType: string) => React.ComponentType<CellEditorProps> | null | undefined;

/** Row heights per density, so a virtualised list can be measured before it is drawn. */
const ROW_HEIGHT: Record<EntityTableDensity, number> = { compact: 33, default: 41 };
const CELL: Record<EntityTableDensity, string> = { compact: 'px-3 py-1', default: 'px-3 py-2' };
/** A row's text and the head it sits under, on the ladder of `docs/design-rules.md`. */
const TEXT: Record<EntityTableSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
const HEAD: Record<EntityTableSize, string> = { sm: 'h-9', md: 'h-10', lg: 'h-11' };

/** The popups a cell editor opens. Each is portalled out of the table's own tree. */
const EDITOR_POPUP = '[data-slot="popover-content"],[data-slot="select-content"],[data-picker]';

/** The select column's id, which is never a field path. */
const SELECT = '__select';

/** Said on every editable cell, because nothing else on it says an edit is possible. */
const EDIT_HINT = 'Double-click or press Enter to edit';

/** What a `row` render prop is handed. It draws the cells of one row, not the row's box. */
export interface EntityTableRowContext {
  row: EntityRow;
  /** The row's id, as `getRowId` derives it. */
  id: string;
  index: number;
  selected: boolean;
  disabled: boolean;
  columns: CollectionColumn[];
}

/** What a `cell` render prop is handed. It draws a cell's contents, not the cell. */
export interface EntityTableCellContext {
  row: EntityRow;
  id: string;
  column: CollectionColumn;
  value: unknown;
  disabled: boolean;
}

/** What a `groupHeader` render prop is handed. It draws the header's contents. */
export interface EntityTableGroupContext {
  /** The value the run shares. */
  value: unknown;
  column: CollectionColumn | null;
  /** Rows loaded under this header. */
  count: number;
  expanded: boolean;
  id: string;
}

/** The latest value, for an effect that must read it without depending on it. */
function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export interface EntityTableProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The rows, the filter, the sort and the page behind them. Created with core's `createEntitySource`. */
  source: EntitySource;
  /** Columns in display order, from `resolveColumns`. Two-way: hiding a column writes the shorter list back. */
  columns: CollectionColumn[];
  onColumnsChange?: (columns: CollectionColumn[]) => void;
  /** `Status` rows by code, for status cells (probe 010). */
  statuses?: Record<string, StatusRecord> | null;
  /** The widget context. Cells render with its preferences, and a cell editor reads through it. */
  context?: SgContext;
  /** The project the columns were resolved with. Scopes a status, list or entity cell editor. */
  projectId?: number;
  /** Decimals a float cell keeps. */
  precision?: number;
  /** Shown before the value in a currency cell. */
  symbol?: string;
  density?: EntityTableDensity;
  size?: EntityTableSize;
  /** Draws a checkbox column and reports the selection. */
  selectable?: boolean;
  /** The selected rows. Controlled, with the table's own selection as the fallback. */
  selection?: EntityRef[];
  onSelectionChange?: (rows: EntityRef[]) => void;
  /** How a row is keyed, in the DOM and in the selection. Default `Type:id`. */
  getRowId?: RowIdFn;
  /** True for a row that cannot be selected, edited or reached by the keyboard. */
  isRowDisabled?: RowDisabledFn;
  /** Collapse rows under headers of a shared value at this path. */
  groupBy?: string | null;
  /** Ids of the group headers that are shut. Controlled, with the table's own as the fallback. */
  collapsed?: string[];
  onCollapsedChange?: (ids: string[]) => void;
  /** The source's sort, so a SortPicker drops into the toolbar. */
  sort?: SortSpec[];
  onSortChange?: (sort: SortSpec[]) => void;
  /** The source's filter, so a FilterBar drops into the toolbar. */
  filters?: SourceFilters;
  onFiltersChange?: (filters: SourceFilters) => void;
  /** Opens an editor on a double-click or Enter in an editable cell. */
  editable?: boolean;
  editorFor?: EditorFor;
  /** Show the programmatic field path beside the header's display name. */
  showCode?: boolean;
  /** Rows per page offered in the footer. `pages` mode only. */
  pageSizes?: number[];
  /** Height of the scrolling body. */
  maxHeight?: string;
  /** Rows above which the body is virtualised. */
  virtualizeAfter?: number;
  emptyLabel?: string;
  /** Left region of the toolbar above the table. */
  toolbarStart?: React.ReactNode;
  /** Right region of the toolbar above the table. */
  toolbarEnd?: React.ReactNode;
  /** Draws the cells of one row. Without it, the columns draw themselves. */
  row?: (context: EntityTableRowContext) => React.ReactNode;
  /** Draws one cell's contents. Ignored where `row` is given. */
  cell?: (context: EntityTableCellContext) => React.ReactNode;
  /** Draws a group header's contents. */
  groupHeader?: (context: EntityTableGroupContext) => React.ReactNode;
}

// Sorting and paging are the server's, so neither feature is registered: this table
// owns sizing, resizing, ordering, pinning, grouping and selection.
const features = tableFeatures({
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnPinningFeature,
  columnGroupingFeature,
  groupedRowModel: createGroupedRowModel(),
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
  rowSelectionFeature,
});

const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';

/**
 * A page of rows, one column per field path.
 *
 * Columns are schema-driven: the header is the field's display name and the cell
 * rendering comes from its `data_type` through FieldValue. Sizing, resizing,
 * ordering, pinning, grouping and selection are TanStack Table's; sorting and paging
 * are the server's - a header click sets the source's sort and reads the page again,
 * because a sort applied to one loaded page would order the page and not the set, and
 * because a sort on a field that cannot be sorted is a silent 200 no-op
 * (026_result_order).
 *
 * In `pages` mode the footer walks the set with an explicit page number and reads
 * "n to m of N" once `_summarize` has counted it; a read carries no total of its own
 * (006_pagination, 020_summarize). In `infinite` mode the last row loads the next
 * page and the footer counts what is loaded.
 *
 * An edit writes one field through `updateRow`, which follows the write with a
 * re-read: the write's own answer is the whole record but resolves no dotted path
 * (024_read_after_write). A refused write restores the value and shows the reason in
 * the cell.
 */
export function EntityTable({
  source,
  columns,
  onColumnsChange,
  statuses = null,
  context,
  projectId,
  precision,
  symbol,
  density = 'default',
  size = 'md',
  selectable = false,
  selection: selectionProp,
  onSelectionChange,
  getRowId,
  isRowDisabled,
  groupBy = null,
  collapsed: collapsedProp,
  onCollapsedChange,
  sort: sortProp,
  onSortChange,
  filters: filtersProp,
  onFiltersChange,
  editable = false,
  editorFor,
  showCode = false,
  pageSizes = [25, 50, 100],
  maxHeight = '28rem',
  virtualizeAfter = 100,
  emptyLabel = 'No rows',
  toolbarStart,
  toolbarEnd,
  row: rowRender,
  cell: cellRender,
  groupHeader,
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
    // A group is only whole when the server put its rows together, so the group path
    // leads the sort. Setting it reads the first page again.
    if (groupBy && snapshot.sort[0]?.path !== groupBy) {
      void source.setSort([{ path: groupBy, descending: false }, ...snapshot.sort.filter((k) => k.path !== groupBy)]);
    }
  }, [source, groupBy, snapshot.sort]);

  // The site's preferences, so a duration, a date-time and a timecode are edited the
  // way the site reads them.
  const prefs = preferencesOf(context);
  const rows = snapshot.rows;
  const sort = snapshot.sort;
  const paging = describePaging(snapshot);
  const rowHeight = ROW_HEIGHT[density];
  const cellClass = cn(CELL[density], TEXT[size]);
  const byPath = useMemo(() => new Map(columns.map((column) => [column.path, column])), [columns]);

  const rowId = (row: EntityRow): string => rowIdOf(row, getRowId);
  const rowDisabled = (row: EntityRow): boolean => rowIsDisabled(row, isRowDisabled);

  const root = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{ key: string; path: string } | null>(null);
  // Enter can arrive in the same tick as the change that produced the value, before a
  // re-render, so the committed value is read off a ref rather than off state.
  const draft = useRef<unknown>(null);
  const [draftValue, setDraftValue] = useState<unknown>(null);
  const [cellError, setCellError] = useState<{ key: string; path: string; message: string } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [pageDraft, setPageDraft] = useState('');

  /* the table ------------------------------------------------------------ */

  const columnDefs = useMemo(
    () => [
      ...(selectable
        ? [{ id: SELECT, size: 40, minSize: 40, maxSize: 40, enableResizing: false, enablePinning: false, enableGrouping: false }]
        : []),
      ...columns.map((column) => ({
        id: column.path,
        accessorFn: (row: EntityRow) => cellValue(row, column.path),
        size: column.width ?? 180,
        minSize: 64,
      })),
    ],
    [columns, selectable],
  );

  const grouping = useMemo(() => (groupBy && byPath.has(groupBy) ? [groupBy] : []), [groupBy, byPath]);

  const table = useTable<typeof features, EntityRow>({
    features,
    data: rows,
    columns: columnDefs,
    state: { grouping },
    // A group draws its own full-width header row, so the grouped column stays where
    // the caller put it.
    groupedColumnMode: false,
    initialState: { expanded: true },
    getRowId: (row: EntityRow) => rowIdOf(row, getRowId),
    columnResizeMode: 'onChange',
    // A disabled row refuses its own box and is left out of the header's select-all.
    enableRowSelection: selectable && ((row: { original: EntityRow }) => !rowIsDisabled(row.original, isRowDisabled)),
  });

  /*
   * Controlled state, each with the table's own as the fallback.
   *
   * Each pair is one effect out of the table and one into it, and each reads the other
   * side off a ref, so a change travels once and the two never write to each other.
   */
  const [ownSelection, setOwnSelection] = useState<EntityRef[]>([]);
  const selection = selectionProp ?? ownSelection;
  const selectionLatest = useLatest(selection);
  const picked = table.state.rowSelection;
  useEffect(() => {
    const refs = table
      .getSelectedRowModel()
      .flatRows.filter((row) => !row.getIsGrouped())
      .map((row) => ({ type: row.original.type, id: row.original.id }));
    if (sameRefs(refs, selectionLatest.current)) return;
    setOwnSelection(refs);
    onSelectionChange?.(refs);
    // The table instance is stable; the selection is what moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picked]);
  useEffect(() => {
    const wanted = idsForRefs(rows, selection, getRowId);
    if (sameIds(wanted, Object.keys(table.state.rowSelection))) return;
    table.setRowSelection(Object.fromEntries(wanted.map((id) => [id, true])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, rows]);

  const [ownCollapsed, setOwnCollapsed] = useState<string[]>([]);
  const collapsed = collapsedProp ?? ownCollapsed;
  const collapsedLatest = useLatest(collapsed);
  const expansion = table.state.expanded;
  const groupHeaders = table.getRowModel().flatRows.filter((row) => row.getIsGrouped());
  const groupHeadersLatest = useLatest(groupHeaders);
  useEffect(() => {
    const shut = groupHeadersLatest.current.filter((row) => !row.getIsExpanded()).map((row) => row.id);
    if (sameIds(shut, collapsedLatest.current)) return;
    setOwnCollapsed(shut);
    onCollapsedChange?.(shut);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expansion]);
  useEffect(() => {
    const shut = new Set(collapsed);
    for (const row of groupHeadersLatest.current) {
      if (row.getIsExpanded() === shut.has(row.id)) row.toggleExpanded(!shut.has(row.id));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed]);

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

  /** Leaf columns in render order: pinned to the start first, the rest as ordered. */
  const rank = (id: string, pinned: false | 'start' | 'end'): number =>
    id === SELECT ? -1 : pinned === 'start' ? 0 : 1;
  const leafColumns = [...table.getAllLeafColumns()].sort(
    (a, b) => rank(a.id, a.getIsPinned()) - rank(b.id, b.getIsPinned()),
  );
  const headersById = new Map((table.getHeaderGroups()[0]?.headers ?? []).map((header) => [header.column.id, header]));
  const totalWidth = table.getTotalSize();

  /* rows, grouped or flat ------------------------------------------------ */

  const modelRows = table.getRowModel().rows;

  /** Rows under one group header, however deep. Render order is not the count. */
  function leafCount(row: (typeof modelRows)[number]): number {
    return row.subRows.reduce((n, child) => n + (child.subRows.length > 0 ? leafCount(child) : 1), 0);
  }

  /* virtual rows --------------------------------------------------------- */

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const virtualized = modelRows.length > virtualizeAfter;
  const virtualizer = useVirtualizer({
    count: virtualized ? modelRows.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => rowHeight,
    overscan: 12,
  });

  const virtualItems = virtualizer.getVirtualItems();
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];
  const window_ = !virtualized
    ? { before: 0, after: 0, slice: modelRows }
    : !first || !last
      ? { before: 0, after: 0, slice: modelRows.slice(0, 20) }
      : {
          before: first.start,
          after: virtualizer.getTotalSize() - last.end,
          slice: modelRows.slice(first.index, last.index + 1),
        };

  /* sorting -------------------------------------------------------------- */

  const sortOf = (path: string): SortSpec | undefined => sort.find((key) => key.path === path);

  /** The group path stays the first sort key: a split group is not a group. */
  function applySort(next: SortSpec[]): void {
    void source.setSort(groupBy && next[0]?.path !== groupBy ? [{ path: groupBy, descending: false }, ...next] : next);
  }

  /** Ascending, then descending, then unsorted, which is the server's id ascending. */
  function toggleSort(path: string): void {
    const current = sortOf(path);
    applySort(
      current === undefined ? [{ path, descending: false }] : current.descending ? [] : [{ path, descending: true }],
    );
  }

  /* column menu ---------------------------------------------------------- */

  function hideColumn(path: string): void {
    onColumnsChange?.(columns.filter((column) => column.path !== path));
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

  function canEditColumn(column: CollectionColumn, row: EntityRow): boolean {
    if (!editable || !column.editable || rowDisabled(row)) return false;
    return Boolean(editorFor?.(column.dataType)) || isEditableType(column.dataType);
  }

  function openEditor(key: string, column: CollectionColumn, row: EntityRow, value: unknown): void {
    if (!canEditColumn(column, row)) return;
    setCellError(null);
    draft.current = value;
    setDraftValue(value);
    setEditing({ key, path: column.path });
  }

  async function commit(row: EntityRow, column: CollectionColumn, value: unknown): Promise<void> {
    const key = rowId(row);
    const before = cellValue(row, column.path);
    setEditing(null);
    if (value === before) return;
    try {
      await source.updateRow({ type: row.type, id: row.id }, { [column.path]: value });
      setCellError(null);
    } catch (error) {
      // The write is refused, so the cell goes back to what the row still holds and
      // says why beside it.
      setCellError({ key, path: column.path, message: error instanceof Error ? error.message : String(error) });
    }
  }

  function onCellKeyDown(event: React.KeyboardEvent, row: EntityRow, column: CollectionColumn): void {
    // Only when the cell itself has focus. An editor's own Enter reaches this on the way
    // up, after the commit has already closed it, and must not open it again.
    if (event.key !== 'Enter' || editing || (event.target as HTMLElement).dataset['slot'] !== 'table-cell') return;
    event.preventDefault();
    openEditor(rowId(row), column, row, cellValue(row, column.path));
  }

  /**
   * Take focus off the control before the cell closes. Its own blur handler commits
   * what it holds, and it runs on an editor that is still on the page, so the commit is
   * never on the teardown path.
   */
  function releaseEditor(): void {
    const active = document.activeElement;
    if (active instanceof HTMLElement && root.current?.contains(active)) active.blur();
  }

  function editorKeyDown(event: React.KeyboardEvent, row: EntityRow, column: CollectionColumn): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      releaseEditor();
      void commit(row, column, draft.current);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      releaseEditor();
      setEditing(null);
    }
  }

  const focusEditor = (element: HTMLDivElement | null): void => {
    element?.querySelector<HTMLElement>('input,textarea,button')?.focus({ preventScroll: true });
  };

  const isEditing = (key: string, path: string): boolean => editing?.key === key && editing.path === path;

  // A press outside the open cell commits it.
  const outside = useRef<(event: PointerEvent) => void>(() => {});
  outside.current = (event: PointerEvent): void => {
    const open = editing;
    if (open === null) return;
    const target = event.target as Element | null;
    const cell = root.current?.querySelector<HTMLElement>(
      `tr[data-row-key="${CSS.escape(open.key)}"] td[data-column="${CSS.escape(open.path)}"]`,
    );
    if (target === null || cell?.contains(target) || target.closest(EDITOR_POPUP) !== null) return;
    releaseEditor();
    const row = rows.find((candidate) => rowId(candidate) === open.key);
    const column = byPath.get(open.path);
    if (row && column) void commit(row, column, draft.current);
    else setEditing(null);
  };
  useEffect(() => {
    if (editing === null) return;
    const listener = (event: PointerEvent): void => outside.current(event);
    document.addEventListener('pointerdown', listener, true);
    return () => document.removeEventListener('pointerdown', listener, true);
  }, [editing]);

  /* paging --------------------------------------------------------------- */

  function goToPage(value: string): void {
    const wanted = Number(value);
    setPageDraft('');
    if (!Number.isFinite(wanted) || wanted < 1) return;
    void source.setPage(paging.pageCount === null ? wanted : Math.min(wanted, paging.pageCount));
  }

  /** Sticky offset for a column pinned to the start; nothing for the rest. */
  function pinStyle(column: (typeof leafColumns)[number]): React.CSSProperties | undefined {
    return column.getIsPinned() === 'start'
      ? { position: 'sticky', insetInlineStart: `${column.getStart('start')}px`, zIndex: 3 }
      : undefined;
  }

  return (
    <div ref={root} data-slot="entity-table" className={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
      {toolbarStart || toolbarEnd ? (
        <div data-slot="entity-table-toolbar" className="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
          <div data-slot="entity-table-toolbar-start" className="flex min-w-0 flex-wrap items-center gap-2">
            {toolbarStart}
          </div>
          <div data-slot="entity-table-toolbar-end" className="flex min-w-0 flex-wrap items-center gap-2">
            {toolbarEnd}
          </div>
        </div>
      ) : null}

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
              {leafColumns.map((leaf) => {
                const header = headersById.get(leaf.id);
                const column = byPath.get(leaf.id);
                const pinned = leaf.getIsPinned() === 'start';
                return (
                  <TableHead
                    key={leaf.id}
                    data-column={leaf.id}
                    data-pinned={pinned ? 'start' : undefined}
                    style={pinStyle(leaf)}
                    className={cn('bg-background relative border-b p-0', column?.align === 'right' && 'text-right')}
                  >
                    {leaf.id === SELECT ? (
                      <span className={cn('flex items-center justify-center', HEAD[size])}>
                        <Checkbox
                          aria-label="Select all loaded rows"
                          checked={table.getIsAllRowsSelected()}
                          indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
                          onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
                        />
                      </span>
                    ) : column ? (
                      <>
                        <div
                          data-slot="entity-table-head"
                          className={cn('flex w-full min-w-0 items-center', HEAD[size])}
                        >
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
                            onClick={() => column.sortable && toggleSort(column.path)}
                            aria-disabled={column.sortable ? undefined : 'true'}
                            data-sortable={column.sortable ? 'true' : 'false'}
                            title={column.sortable ? undefined : `${column.header} cannot be sorted`}
                            className={cn(
                              'focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 flex-1 items-center gap-1.5 px-3 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
                              HEAD[size],
                              TEXT[size],
                              column.sortable ? 'hover:bg-accent hover:text-accent-foreground' : 'cursor-default',
                              column.align === 'right' && 'justify-end',
                            )}
                          >
                            <span className="truncate" title={column.header}>
                              {column.header}
                            </span>
                            {showCode && column.path !== column.header ? (
                              <span className="text-muted-foreground truncate font-mono text-xs">{column.path}</span>
                            ) : null}
                            {sortOf(column.path)?.descending === false ? (
                              <ArrowUp aria-hidden="true" className="size-4 shrink-0" />
                            ) : sortOf(column.path)?.descending === true ? (
                              <ArrowDown aria-hidden="true" className="size-4 shrink-0" />
                            ) : column.sortable ? (
                              <ChevronsUpDown aria-hidden="true" className="size-4 shrink-0 opacity-50" />
                            ) : null}
                          </button>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`${column.header} column menu`}
                              className="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background data-[state=open]:bg-accent data-[state=open]:text-accent-foreground mr-1 flex size-6 shrink-0 items-center justify-center rounded-md outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2"
                            >
                              <EllipsisVertical aria-hidden="true" className="size-4" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44">
                              <DropdownMenuItem
                                disabled={!column.sortable}
                                onClick={() => applySort([{ path: column.path, descending: false }])}
                              >
                                <ArrowUp aria-hidden="true" />
                                Sort ascending
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!column.sortable}
                                onClick={() => applySort([{ path: column.path, descending: true }])}
                              >
                                <ArrowDown aria-hidden="true" />
                                Sort descending
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                disabled={!column.sortable || sortOf(column.path) === undefined}
                                onClick={() => applySort([])}
                              >
                                <ArrowUpDown aria-hidden="true" />
                                Clear sort
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => hideColumn(column.path)}>
                                <EyeOff aria-hidden="true" />
                                Hide column
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => leaf.pin(pinned ? false : 'start')}>
                                {pinned ? (
                                  <>
                                    <PinOff aria-hidden="true" />
                                    Unpin
                                  </>
                                ) : (
                                  <>
                                    <ArrowLeftToLine aria-hidden="true" />
                                    Pin left
                                  </>
                                )}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                        {header && header.column.getCanResize() ? (
                          <span
                            role="separator"
                            aria-orientation="vertical"
                            aria-label={`Resize ${column.header}`}
                            onPointerDown={header.getResizeHandler()}
                            className={cn(
                              'hover:bg-ring absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none',
                              header.column.getIsResizing() && 'bg-ring',
                              dropTarget === column.path && 'bg-ring',
                              dragging === column.path && 'opacity-50',
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
            ) : modelRows.length === 0 ? (
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
                {window_.slice.map((modelRow, index) => {
                  if (modelRow.getIsGrouped()) {
                    const groupColumn = byPath.get(modelRow.groupingColumnId ?? '');
                    return (
                      <TableRow
                        key={modelRow.id}
                        data-slot="entity-table-group"
                        className="bg-muted/50 hover:bg-muted/50"
                        style={virtualized ? { height: `${rowHeight}px` } : undefined}
                      >
                        <TableCell colSpan={leafColumns.length} className="p-0">
                          <button
                            type="button"
                            aria-expanded={modelRow.getIsExpanded()}
                            onClick={() => modelRow.toggleExpanded()}
                            className={cn(
                              'focus-visible:ring-ring focus-visible:ring-offset-background flex w-full items-center gap-1.5 px-3 py-1.5 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
                              TEXT[size],
                            )}
                          >
                            <ChevronRight
                              aria-hidden="true"
                              className={cn(
                                'size-4 shrink-0 transition-transform duration-150 ease-out',
                                modelRow.getIsExpanded() && 'rotate-90',
                              )}
                            />
                            {groupHeader ? (
                              groupHeader({
                                value: modelRow.groupingValue,
                                column: groupColumn ?? null,
                                count: leafCount(modelRow),
                                expanded: modelRow.getIsExpanded(),
                                id: modelRow.id,
                              })
                            ) : (
                              <>
                                <span className="truncate">
                                  <FieldValue
                                    value={modelRow.groupingValue}
                                    dataType={groupColumn?.dataType ?? 'text'}
                                    field={groupColumn?.field}
                                    statuses={statuses}
                                    context={context}
                                  />
                                </span>
                                <span className="text-muted-foreground font-mono text-xs tabular-nums">
                                  {leafCount(modelRow)}
                                </span>
                              </>
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                    );
                  }
                  const row = modelRow.original;
                  const key = modelRow.id;
                  const selected = modelRow.getIsSelected();
                  const disabled = rowDisabled(row);
                  return (
                    <TableRow
                      key={key}
                      data-row-key={key}
                      data-state={selected ? 'selected' : undefined}
                      data-disabled={disabled ? 'true' : undefined}
                      aria-disabled={disabled ? 'true' : undefined}
                      className={cn(
                        selected ? 'bg-accent text-accent-foreground' : 'bg-background',
                        disabled && 'pointer-events-none opacity-50',
                      )}
                      style={virtualized ? { height: `${rowHeight}px` } : undefined}
                    >
                      {rowRender
                        ? rowRender({ row, id: key, index, selected, disabled, columns })
                        : leafColumns.map((leaf) => {
                          const pinned = leaf.getIsPinned() === 'start';
                          if (leaf.id === SELECT) {
                            return (
                              <TableCell
                                key={leaf.id}
                                data-pinned={pinned ? 'start' : undefined}
                                style={pinStyle(leaf)}
                                className={cn(cellClass, 'bg-inherit text-center')}
                              >
                                <Checkbox
                                  aria-label="Select row"
                                  checked={selected}
                                  disabled={disabled}
                                  onCheckedChange={(value) => modelRow.toggleSelected(value === true)}
                                />
                              </TableCell>
                            );
                          }
                          const column = byPath.get(leaf.id);
                          if (!column) return null;
                          const canEdit = canEditColumn(column, row);
                          const Editor = editorFor?.(column.dataType) ?? null;
                          return (
                            <TableCell
                              key={leaf.id}
                              data-column={column.path}
                              data-pinned={pinned ? 'start' : undefined}
                              data-editable={canEdit ? 'true' : undefined}
                              style={pinStyle(leaf)}
                              tabIndex={canEdit ? 0 : undefined}
                              title={canEdit ? EDIT_HINT : undefined}
                              onDoubleClick={() => openEditor(key, column, row, cellValue(row, column.path))}
                              onKeyDown={(event) => canEdit && onCellKeyDown(event, row, column)}
                              className={cn(
                                cellClass,
                                'focus-visible:ring-ring focus-visible:ring-offset-background bg-inherit overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset',
                                column.align === 'right' && 'text-right',
                                // Nothing else on a cell says it can be edited, so hover and focus say it.
                                canEdit && 'hover:bg-accent/50 focus-visible:bg-accent/50 cursor-text transition-colors duration-150',
                              )}
                            >
                              {isEditing(key, column.path) ? (
                                Editor ? (
                                  <Editor
                                    value={cellValue(row, column.path)}
                                    dataType={column.dataType}
                                    field={column.field}
                                    commit={(value) => void commit(row, column, value)}
                                    cancel={() => setEditing(null)}
                                  />
                                ) : (
                                  // The default editor is the type's own control from the field-editor item.
                                  <div
                                    data-slot="entity-table-editor"
                                    role="presentation"
                                    ref={focusEditor}
                                    onKeyDown={(event) => editorKeyDown(event, row, column)}
                                  >
                                    <FieldEditor
                                      value={draftValue}
                                      onValueChange={(next) => {
                                        draft.current = next;
                                        setDraftValue(next);
                                      }}
                                      dataType={column.dataType}
                                      field={column.field}
                                      statuses={statuses}
                                      context={context}
                                      projectId={projectId}
                                      precision={precision}
                                      symbol={symbol ?? '$'}
                                      hoursPerDay={prefs.hoursPerDay}
                                      locale={prefs.locale}
                                      timeZone={prefs.timeZone}
                                      frameRate={prefs.frameRate}
                                      mode="edit"
                                      size="sm"
                                    />
                                  </div>
                                )
                              ) : cellRender ? (
                                cellRender({ row, id: key, column, value: cellValue(row, column.path), disabled })
                              ) : (
                                <>
                                  <FieldValue
                                    value={cellValue(row, column.path)}
                                    dataType={column.dataType}
                                    field={column.field}
                                    statuses={statuses}
                                    context={context}
                                  />
                                  {cellError && cellError.key === key && cellError.path === column.path ? (
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
                })}
                {window_.after > 0 ? <tr aria-hidden="true" style={{ height: `${window_.after}px` }} /> : null}
                {paging.mode === 'infinite' && snapshot.hasMore ? (
                  <TableRow data-slot="entity-table-load-more" className="hover:bg-transparent">
                    <TableCell colSpan={leafColumns.length} className="p-2 text-center">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={snapshot.status === 'loadingMore'}
                        onClick={() => void source.loadMore()}
                      >
                        {snapshot.status === 'loadingMore' ? 'Loading…' : 'Load more'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : null}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <div
        data-slot="entity-table-footer"
        className="text-muted-foreground flex w-full min-w-0 flex-wrap items-center justify-between gap-2 text-xs"
      >
        {paging.mode === 'pages' ? (
          <>
            <div data-slot="entity-table-page-size" className="flex items-center gap-2">
              <span>Rows per page</span>
              <Select
                value={String(paging.pageSize)}
                onValueChange={(value) => void source.setPageSize(Number(value))}
              >
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
            <div data-slot="entity-table-pager" className="flex items-center gap-2">
              <span data-slot="entity-table-range" className="tabular-nums">
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
            <span data-slot="entity-table-loaded" className="tabular-nums">
              {paging.loadedLabel}
            </span>
            {snapshot.status === 'loadingMore' ? <span>Loading…</span> : null}
          </>
        )}
      </div>
    </div>
  );
}
