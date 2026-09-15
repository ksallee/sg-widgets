import type * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  CollectionColumn,
  CollapseState,
  EditorPlacement,
  EntityRef,
  EntityRow,
  EntitySource,
  FieldSchema,
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
  collapseStateFrom,
  editorPlacementFor,
  expandAll,
  isCollapsed,
  isEditableType,
  nextEnabledIndex,
  NO_ROWS_LABEL,
  preferencesOf,
  sameCollapse,
  stateLine,
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
  tableFeatures,
  useTable,
} from '@tanstack/react-table';
import {
  ArrowDown,
  ArrowLeftToLine,
  ArrowUp,
  ArrowUpDown,
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
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import {
  COLLECTION_ROOT,
  useCollectionBody,
  useCollectionControl,
  useLatest,
} from '@/registry/sg/components/collection-control';
import { CollectionFooter } from '@/registry/sg/components/collection-footer';
import { FieldEditor } from '@/registry/sg/components/field-editor';
import { FieldValue } from '@/registry/sg/components/field-value';
import { PICKER_ICON_BUTTON } from '@/registry/sg/components/picker-classes';
import { StateLine } from '@/registry/sg/components/state-line';

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
  /**
   * Which group headers are shut. Controlled, with the table's own as the fallback. A bare
   * id list reads as the open mode with those ids shut; `collapseAll()` shuts the headers
   * a later page brings too.
   */
  collapsed?: string[] | CollapseState;
  onCollapsedChange?: (state: CollapseState) => void;
  /** The source's sort, so a SortPicker drops into the toolbar. */
  sort?: SortSpec[];
  onSortChange?: (sort: SortSpec[]) => void;
  /** The source's filter, so a FilterBar drops into the toolbar. */
  filters?: SourceFilters;
  onFiltersChange?: (filters: SourceFilters) => void;
  /** Opens an editor on a double-click or Enter in an editable cell. */
  editable?: boolean;
  editorFor?: EditorFor;
  /**
   * Where every cell editor opens. A column carrying its own `editorPlacement`
   * wins over it; with neither, the data type decides.
   */
  editorPlacement?: EditorPlacement;
  /** Show the programmatic field path beside the header's display name. */
  showCode?: boolean;
  /** A menu on every header: sort, hide and pin. Off unless a caller has a use for it. */
  columnMenu?: boolean;
  /** How the set is walked: a footer with a page number, a load-more row, or the scroller. */
  paging?: PagingMode;
  /** Rows per page offered in the footer. `pages` mode only. */
  pageSizes?: number[];
  /** Height of the scrolling body. */
  maxHeight?: string;
  /** Rows above which the body is virtualised. */
  virtualizeAfter?: number;
  /** Shown when the read returned nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
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

// Sorting, paging and the selection are held elsewhere, so none of their features is
// registered: this table owns sizing, resizing, ordering, pinning and grouping.
const features = tableFeatures({
  columnOrderingFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnPinningFeature,
  columnGroupingFeature,
  groupedRowModel: createGroupedRowModel(),
  rowExpandingFeature,
  expandedRowModel: createExpandedRowModel(),
});

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
 * `paging` says how the set is walked, and the source follows it. In `pages` the footer
 * walks with an explicit page number and reads "n to m of N" once `_summarize` has
 * counted it; a read carries no total of its own (006_pagination, 020_summarize). In
 * `more` a row at the bottom appends the next page, in `scroll` the scroller does, and
 * both count what is loaded in the footer. A page that fails leaves its rows and says
 * why at the bottom, with a retry.
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
  editorPlacement,
  showCode = false,
  columnMenu = false,
  paging = 'pages',
  pageSizes = [25, 50, 100],
  maxHeight = '28rem',
  virtualizeAfter = 100,
  emptyLabel = NO_ROWS_LABEL,
  loadingLabel,
  errorLabel,
  toolbarStart,
  toolbarEnd,
  row: rowRender,
  cell: cellRender,
  groupHeader,
  className,
  ...rest
}: EntityTableProps) {
  /* state ---------------------------------------------------------------- */

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
  const rows = control.rows;
  const sort = snapshot.sort;
  const loadingText = control.loadingText;
  const rowHeight = ROW_HEIGHT[density];
  const cellClass = cn(CELL[density], TEXT[size]);
  const byPath = useMemo(() => new Map(columns.map((column) => [column.path, column])), [columns]);

  const root = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState<{ key: string; path: string; placement: EditorPlacement } | null>(null);
  // Enter can arrive in the same tick as the change that produced the value, before a
  // re-render, so the committed value is read off a ref rather than off state.
  const draft = useRef<unknown>(null);
  const [draftValue, setDraftValue] = useState<unknown>(null);
  const [cellError, setCellError] = useState<{ key: string; path: string; message: string } | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

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
    getRowId: (row: EntityRow) => control.rowId(row),
    columnResizeMode: 'onChange',
  });

  /*
   * The shut group headers, controlled with the table's own as the fallback: one effect
   * out of the table and one into it, each reading the other side off a ref, so a change
   * travels once and the two never write to each other.
   */
  const [ownCollapsed, setOwnCollapsed] = useState<CollapseState>(expandAll);
  const collapsed = collapsedProp === undefined ? ownCollapsed : asCollapseState(collapsedProp);
  const collapsedLatest = useLatest(collapsed);
  const expansion = table.state.expanded;
  const groupHeaders = table.getRowModel().flatRows.filter((row) => row.getIsGrouped());
  const groupHeadersLatest = useLatest(groupHeaders);
  useEffect(() => {
    // The table answers which headers are shut, not which one was pressed, so the state
    // is read back under the mode in force and a later page still follows it.
    const drawn = groupHeadersLatest.current.map((row) => row.id);
    const shut = groupHeadersLatest.current.filter((row) => !row.getIsExpanded()).map((row) => row.id);
    const next = collapseStateFrom(collapsedLatest.current, shut, drawn);
    if (sameCollapse(next, collapsedLatest.current)) return;
    setOwnCollapsed(next);
    onCollapsedChange?.(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expansion, groupHeaders.length]);
  useEffect(() => {
    for (const row of groupHeadersLatest.current) {
      const shut = isCollapsed(collapsed, row.id);
      if (row.getIsExpanded() === shut) row.toggleExpanded(!shut);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collapsed, groupHeaders.length]);

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
  const view = control.view(modelRows.length);

  /** Rows under one group header, however deep. Render order is not the count. */
  function leafCount(row: (typeof modelRows)[number]): number {
    return row.subRows.reduce((n, child) => n + (child.subRows.length > 0 ? leafCount(child) : 1), 0);
  }

  /* the lines ------------------------------------------------------------ */

  const body = useCollectionBody(control, {
    lines: modelRows.length,
    measured: modelRows.length,
    lineHeight: rowHeight,
    overscan: 12,
    virtualizeAfter,
    lineOfRow: (_index, _row, id) => modelRows.findIndex((entry) => entry.id === id),
    // Lines below the window count group headers as well, so a header only ever makes
    // the scroller ask later.
    lastRowOfLine: (line) => rows.length - 1 - (modelRows.length - 1 - line),
    cursorTarget: (_index, _row, id, column) => {
      const tr = root.current?.querySelector<HTMLElement>(`tr[data-row-key="${CSS.escape(id)}"]`);
      const cell = column ? tr?.querySelector<HTMLElement>(`td[data-column="${CSS.escape(column)}"][tabindex]`) : null;
      return cell ?? tr?.querySelector<HTMLElement>('td[tabindex],button,input');
    },
  });

  const at = body.window;
  const window_ = !at
    ? { before: 0, after: 0, slice: modelRows }
    : at.to < at.from
      ? { before: 0, after: 0, slice: modelRows.slice(0, 20) }
      : { before: at.before, after: at.after, slice: modelRows.slice(at.from, at.to + 1) };

  /**
   * The arrows walk one column of the body. On the last loaded row they ask for the
   * next page instead, and the cursor stays where it is until those rows arrive.
   */
  function onRowsKeyDown(event: React.KeyboardEvent): void {
    if (editing !== null || (event.key !== 'ArrowDown' && event.key !== 'ArrowUp')) return;
    const target = event.target as HTMLElement | null;
    const tr = target?.closest<HTMLElement>('tr[data-row-key]');
    if (!tr) return;
    const from = rows.findIndex((row) => control.rowId(row) === tr.dataset['rowKey']);
    if (from < 0) return;
    const column = target?.closest<HTMLElement>('td[data-column]')?.dataset['column'] ?? null;
    event.preventDefault();
    if (event.key === 'ArrowDown' && body.askForPage(from + 1, column)) return;
    body.focusRow(nextEnabledIndex(rows.length, from, event.key === 'ArrowDown' ? 1 : -1, control.disabledAt), column);
  }

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
    if (!editable || !column.editable || control.rowDisabled(row)) return false;
    return Boolean(editorFor?.(column.dataType)) || isEditableType(column.dataType);
  }

  /** The column's own placement, then the table's, then the data type's. */
  function placementFor(column: CollectionColumn): EditorPlacement {
    return column.editorPlacement ?? editorPlacement ?? editorPlacementFor(column.dataType);
  }

  function openEditor(key: string, column: CollectionColumn, row: EntityRow, value: unknown): void {
    if (!canEditColumn(column, row)) return;
    setCellError(null);
    draft.current = value;
    setDraftValue(value);
    setEditing({ key, path: column.path, placement: placementFor(column) });
  }

  async function commit(row: EntityRow, column: CollectionColumn, value: unknown): Promise<void> {
    const key = control.rowId(row);
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
    openEditor(control.rowId(row), column, row, cellValue(row, column.path));
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

  /** A popover editor drives its own close and reports it; the cell commits what it holds. */
  function editorClosed(row: EntityRow, column: CollectionColumn, mode: 'display' | 'edit'): void {
    if (mode !== 'display' || placementFor(column) !== 'popover') return;
    releaseEditor();
    void commit(row, column, draft.current);
  }

  const isEditing = (key: string, path: string): boolean => editing?.key === key && editing.path === path;

  // A press outside the open cell commits it. A popover editor dismisses itself and
  // reports the close, so the cell listens only for the editor drawn in it.
  const outside = useRef<(event: PointerEvent) => void>(() => {});
  outside.current = (event: PointerEvent): void => {
    const open = editing;
    if (open === null || open.placement === 'popover') return;
    const target = event.target as Element | null;
    const cell = root.current?.querySelector<HTMLElement>(
      `tr[data-row-key="${CSS.escape(open.key)}"] td[data-column="${CSS.escape(open.path)}"]`,
    );
    if (target === null || cell?.contains(target) || target.closest(EDITOR_POPUP) !== null) return;
    releaseEditor();
    const row = rows.find((candidate) => control.rowId(candidate) === open.key);
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

  /** Sticky offset for a column pinned to the start; nothing for the rest. */
  function pinStyle(column: (typeof leafColumns)[number]): React.CSSProperties | undefined {
    return column.getIsPinned() === 'start'
      ? { position: 'sticky', insetInlineStart: `${column.getStart('start')}px`, zIndex: 3 }
      : undefined;
  }

  return (
    <div ref={root} data-slot="entity-table" className={cn(COLLECTION_ROOT, className)} {...rest}>
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
        ref={body.scrollRef}
        data-slot="entity-table-scroll"
        style={{ maxHeight }}
        className="border-border relative w-full overflow-auto rounded-lg border [&>[data-slot=table-container]]:overflow-visible"
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
                          checked={control.allSelected.all}
                          indeterminate={control.allSelected.some && !control.allSelected.all}
                          onCheckedChange={(value) => control.toggleAll(value === true)}
                        />
                      </span>
                    ) : column ? (
                      <>
                        {/* The head owns the room beside its menu, so nothing inside it carries a margin. */}
                        <div
                          data-slot="entity-table-head"
                          className={cn('flex w-full min-w-0 items-center', HEAD[size], columnMenu && 'pr-1')}
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
                          {columnMenu ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              aria-label={`${column.header} column menu`}
                              className={cn(
                                PICKER_ICON_BUTTON,
                                'text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground',
                              )}
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
                          ) : null}
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

          <TableBody
            onKeyDown={onRowsKeyDown}
            aria-busy={snapshot.status === 'loading' ? 'true' : undefined}
            aria-label={snapshot.status === 'loading' ? loadingText : undefined}
          >
            {view === 'loading' ? (
              Array.from({ length: 8 }, (_, index) => (
                <TableRow key={index}>
                  {leafColumns.map((column) => (
                    <TableCell key={column.id} className={cellClass}>
                      {/* A skeleton costs what a row costs: the 24px a cell's tallest value stands at. */}
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : view === 'error' ? (
              <TableRow>
                <TableCell colSpan={leafColumns.length}>
                  <StateLine
                    state="error"
                    pad="table"
                    icon={CircleAlert}
                    label={stateLine('error', { errorLabel }, snapshot.error?.message)}
                  />
                </TableCell>
              </TableRow>
            ) : view === 'empty' ? (
              <TableRow>
                <TableCell colSpan={leafColumns.length}>
                  <StateLine state="empty" pad="table" icon={Inbox} label={emptyLabel} />
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
                        style={body.virtualized ? { height: `${rowHeight}px` } : undefined}
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
                                    density={density}
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
                  const selected = control.isSelected(row);
                  const disabled = control.rowDisabled(row);
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
                      style={body.virtualized ? { height: `${rowHeight}px` } : undefined}
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
                                  onCheckedChange={() => control.toggle(row)}
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
                                    ref={placementFor(column) === 'inline' ? focusEditor : undefined}
                                    onKeyDown={(event) =>
                                      placementFor(column) === 'inline' && editorKeyDown(event, row, column)
                                    }
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
                                      onModeChange={(next) => editorClosed(row, column, next)}
                                      editorPlacement={placementFor(column)}
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
                                    density={density}
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
                {control.bottom === 'error' ? (
                  <TableRow data-slot="entity-table-page-error" className="hover:bg-transparent">
                    <TableCell colSpan={leafColumns.length} className="p-2">
                      <StateLine
                        state="error"
                        pad="none"
                        icon={CircleAlert}
                        label={stateLine('error', { errorLabel }, snapshot.error?.message)}
                      >
                        <Button variant="outline" onClick={() => control.retry()}>
                          Retry
                        </Button>
                      </StateLine>
                    </TableCell>
                  </TableRow>
                ) : control.bottom === 'loading' ? (
                  <TableRow
                    data-slot="entity-table-loading"
                    className="hover:bg-transparent"
                    aria-busy="true"
                    aria-label={loadingText}
                  >
                    <TableCell colSpan={leafColumns.length} className="p-2">
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  </TableRow>
                ) : control.bottom === 'more' ? (
                  <TableRow data-slot="entity-table-load-more" className="hover:bg-transparent">
                    <TableCell colSpan={leafColumns.length} className="p-2 text-center">
                      <Button variant="outline" onClick={() => void source.loadMore()}>
                        Load more
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : control.bottom === 'sentinel' ? (
                  <tr ref={body.setSentinel} data-slot="entity-table-sentinel" aria-hidden="true">
                    <td colSpan={leafColumns.length} />
                  </tr>
                ) : null}
              </>
            )}
          </TableBody>
        </Table>
      </div>

      <CollectionFooter
        source={source}
        pager={control.pager}
        pageSizes={pageSizes}
        loading={snapshot.status === 'loading'}
        slotName="entity-table"
      />
    </div>
  );
}
