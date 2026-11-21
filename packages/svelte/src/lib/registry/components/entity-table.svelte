<script lang="ts" module>
	import type { Component } from 'svelte';
	import type {
		BulkEdit,
		CellGesture,
		CollectionColumn,
		EditGesture,
		EditorPlacement,
		EntityRow,
		FieldSchema,
		RowWriteResult
	} from 'sg-widgets-core';

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
	 * The integration point for the per-type field editors: given a `data_type` and
	 * the column, return the component to open in a cell. Anything it does not answer
	 * for opens FieldEditor.
	 */
	export type EditorFor = (dataType: string, column: CollectionColumn) => Component<CellEditorProps> | null | undefined;

	/** Why one cell cannot be edited, or nothing when it can. */
	export type EditLockFn = (row: EntityRow, column: CollectionColumn) => string | null | undefined;

	/** Asked before a bulk edit writes. False leaves every row as it was. */
	export type BulkEditConfirm = (edit: BulkEdit) => boolean | Promise<boolean>;

	/** What an edit wrote: the plan, and a result per row it reached. */
	export interface EntityTableEditResult {
		edit: BulkEdit;
		results: RowWriteResult[];
	}

	/** Row heights per density, so a virtualised list can be measured before it is drawn. */
	const ROW_HEIGHT: Record<EntityTableDensity, number> = { compact: 33, default: 41 };
	const CELL: Record<EntityTableDensity, string> = { compact: 'px-3 py-1', default: 'px-3 py-2' };
	/** A row's text and the head it sits under, on the ladder of `docs/design-rules.md`. */
	const TEXT: Record<EntityTableSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
	const HEAD: Record<EntityTableSize, string> = { sm: 'h-9', md: 'h-10', lg: 'h-11' };
	/** The Columns trigger, on the control ladder beside the sort picker's. */
	const TRIGGER: Record<EntityTableSize, string> = { sm: 'h-7 px-2', md: 'h-8 px-3', lg: 'h-9 px-3' };

	/** What a `row` snippet is handed. It draws the cells of one row, not the row's box. */
	export interface EntityTableRowContext {
		row: EntityRow;
		/** The row's id, as `getRowId` derives it. */
		id: string;
		index: number;
		selected: boolean;
		disabled: boolean;
		columns: CollectionColumn[];
	}

	/** What a `cell` snippet is handed. It draws a cell's contents, not the cell. */
	export interface EntityTableCellContext {
		row: EntityRow;
		id: string;
		column: CollectionColumn;
		value: unknown;
		disabled: boolean;
	}

	/** What a `headerEnd` snippet is handed. It draws beside a header's label. */
	export interface EntityTableHeaderContext {
		column: CollectionColumn;
	}

	/** What a `groupHeader` snippet is handed. It draws the header's contents. */
	export interface EntityTableGroupContext {
		/** The value the run shares. */
		value: unknown;
		column: CollectionColumn | null;
		/** Rows loaded under this header. */
		count: number;
		expanded: boolean;
		id: string;
	}

	/** The select column's id, which is never a field path. */
	const SELECT = '__select';


	/** The key a cell's error and write state are held under. */
	const cellKey = (key: string, path: string): string => `${key}\u0000${path}`;

	/** Editors whose one pick is the whole edit: in the cell, the pick commits. */
	const PICK_KINDS = new Set(['checkbox', 'list', 'status_list', 'entity']);

	/** The popups a cell editor opens. Each is portalled out of the table's own tree. */
	const EDITOR_POPUP = '[data-slot="popover-content"],[data-slot="select-content"],[data-picker]';
</script>

<script lang="ts">
	import { tick, untrack, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type {
		CollapseState,
		EntityRef,
		EntitySource,
		PagingMode,
		RowDisabledFn,
		RowIdFn,
		SgContext,
		SortSpec,
		SourceFilters,
		StatusRecord
	} from 'sg-widgets-core';
	import {
		arrangeColumns,
		cellValue,
		columnPaths,
		columnsStorageKey,
		NO_ROWS_LABEL,
		parseColumnChoice,
		resolveColumnChoice,
		sameColumnPaths,
		serializeColumnChoice,
		unreadPaths,
		editorKindFor,
		editorPlacementFor,
		errorText,
		isEditableType,
		nextEnabledIndex,
		preferencesOf,
		asCollapseState,
		bulkUpdates,
		cellEditHint,
		cellEditorShape,
		cellGestureAction,
		editorFocusIndex,
		collapseStateFrom,
		planBulkEdit,
		rowKey,
		writeEach,
		expandAll,
		isCollapsed,
		matchingOffer,
		sameCollapse,
		selectionKeyIntent,
		stateLine,
		fillWidths,
		tableGrouping
	} from 'sg-widgets-core';
	import {
		columnGroupingFeature,
		columnOrderingFeature,
		columnPinningFeature,
		columnResizingFeature,
		columnSizingFeature,
		createExpandedRowModel,
		createGroupedRowModel,
		createTable,
		rowExpandingFeature,
		tableFeatures
	} from '@tanstack/svelte-table';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowLeftToLine from '@lucide/svelte/icons/arrow-left-to-line';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Inbox from '@lucide/svelte/icons/inbox';
	import PinOff from '@lucide/svelte/icons/pin-off';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import {
		bindCollectionBody,
		COLLECTION_ROOT,
		createCollectionControl
	} from '$lib/registry/components/collection-control.svelte.js';
	import CollectionFooter from '$lib/registry/components/collection-footer.svelte';
	import ColumnPicker from '$lib/registry/components/column-picker.svelte';
	import FieldEditor from '$lib/registry/components/field-editor.svelte';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import { PICKER_ICON_BUTTON } from '$lib/registry/components/picker-classes.js';
	import StateLine from '$lib/registry/components/state-line.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
		/** The rows, the filter, the sort and the page behind them. Created with core's `createEntitySource`. */
		source: EntitySource;
		/** Columns in display order. Core's `resolveColumns` fills them in from the schema. Two-way: hiding a column writes the shorter list back. */
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
		/** The selected rows, two-way. */
		selection?: EntityRef[];
		onSelectionChange?: (rows: EntityRef[]) => void;
		/**
		 * Offers every row the filter matches once every loaded row is selected and the
		 * set holds more. The host reads the set and writes the selection; the table never
		 * reads past its own pages.
		 */
		onSelectAllMatching?: () => void | Promise<void>;
		/** How a row is keyed, in the DOM and in the selection. Default `Type:id`. */
		getRowId?: RowIdFn;
		/** True for a row that cannot be selected, edited or reached by the keyboard. */
		isRowDisabled?: RowDisabledFn;
		/** Collapse rows under headers of a shared value at this path. */
		groupBy?: string | null;
		/**
		 * Which group headers are shut, two-way. A bare id list reads as the open mode with
		 * those ids shut; `collapseAll()` shuts the headers a later page brings too.
		 */
		collapsed?: string[] | CollapseState;
		onCollapsedChange?: (state: CollapseState) => void;
		/** The source's sort, two-way, so a SortPicker drops into the toolbar. */
		sort?: SortSpec[];
		onSortChange?: (sort: SortSpec[]) => void;
		/** The source's filter, two-way, so a FilterBar drops into the toolbar. */
		filters?: SourceFilters;
		onFiltersChange?: (filters: SourceFilters) => void;
		/** Opens an editor on the `editOn` gesture or Enter in an editable cell. */
		editable?: boolean;
		/**
		 * The pointer gesture that opens a cell's editor. `click` is the spreadsheet feel: a
		 * plain click edits and leaves the selection. A checkbox flips on one click either way.
		 */
		editOn?: EditGesture;
		editorFor?: EditorFor;
		/** Why one cell cannot be edited, or nothing when it can. The reason is the cell's tooltip. */
		editLock?: EditLockFn;
		/**
		 * An edit in a selected row reaches every selected row on screen whose cell can be
		 * edited. Needs `selectable` and `editable`.
		 */
		bulkEdit?: boolean;
		/** Asked before a bulk edit writes, with the rows it reaches and the ones it leaves. */
		confirmBulkEdit?: BulkEditConfirm;
		/** Called once an edit has written, with a result per row. */
		onEditResult?: (result: EntityTableEditResult) => void;
		/**
		 * Where every cell editor opens. A column carrying its own `editorPlacement`
		 * wins over it; with neither, the data type decides.
		 */
		editorPlacement?: EditorPlacement;
		/** Show the programmatic field path beside the header's display name. */
		showCode?: boolean;
		/** A menu on every header: sort, hide and pin. Off unless a caller has a use for it. */
		columnMenu?: boolean;
		/**
		 * A Columns button at the end of the toolbar: the user adds, removes and reorders
		 * the entity type's fields, and the choice is kept in this browser. The columns
		 * first passed are the defaults Reset puts back. Needs `context`.
		 */
		columnPicker?: boolean;
		/** Where the column choice is kept in localStorage. Default one key per entity type. */
		columnsKey?: string;
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
		toolbarStart?: Snippet;
		/** Right region of the toolbar above the table. */
		toolbarEnd?: Snippet;
		/** Draws the cells of one row. Without it, the columns draw themselves. */
		row?: Snippet<[EntityTableRowContext]>;
		/** Draws one cell's contents. Ignored where `row` is given. */
		cell?: Snippet<[EntityTableCellContext]>;
		/** Draws a group header's contents. */
		groupHeader?: Snippet<[EntityTableGroupContext]>;
		/** Draws beside a column's header label, outside its sort button: a mark or a note. */
		headerEnd?: Snippet<[EntityTableHeaderContext]>;
	};

	let {
		source,
		columns = $bindable([]),
		onColumnsChange,
		statuses = null,
		context,
		projectId,
		precision,
		symbol,
		density = 'default',
		size = 'md',
		selectable = false,
		selection = $bindable([]),
		onSelectionChange,
		onSelectAllMatching,
		getRowId,
		isRowDisabled,
		groupBy = null,
		collapsed = $bindable(expandAll()),
		onCollapsedChange,
		sort = $bindable(),
		onSortChange,
		filters = $bindable(),
		onFiltersChange,
		editable = false,
		editOn = 'dblclick',
		editorFor,
		editLock,
		bulkEdit = false,
		confirmBulkEdit,
		onEditResult,
		editorPlacement,
		showCode = false,
		columnMenu = false,
		columnPicker = false,
		columnsKey,
		paging = 'pages',
		pageSizes = [25, 50, 100],
		maxHeight = '28rem',
		virtualizeAfter = 100,
		emptyLabel = NO_ROWS_LABEL,
		loadingLabel,
		errorLabel,
		toolbarStart,
		toolbarEnd,
		row: rowSnippet,
		cell: cellSnippet,
		groupHeader,
		headerEnd,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	/* state ---------------------------------------------------------------- */

	const control = createCollectionControl({
		source: () => source,
		paging: () => paging,
		getRowId: () => getRowId,
		isRowDisabled: () => isRowDisabled,
		loadingLabel: () => loadingLabel,
		sort: {
			get: () => sort,
			set: (next) => {
				sort = next;
				onSortChange?.(next);
			}
		},
		filters: {
			get: () => filters,
			set: (next) => {
				filters = next;
				onFiltersChange?.(next);
			}
		},
		selection: {
			get: () => selection,
			set: (next) => {
				selection = next;
				onSelectionChange?.(next);
			}
		}
	});
	const snapshot = $derived(control.snapshot);
	$effect(() => {
		// A group is only whole when the server put its rows together, so the group path
		// leads the sort. Setting it reads the first page again.
		if (groupBy && snapshot.sort[0]?.path !== groupBy) {
			void source.setSort([{ path: groupBy, descending: false }, ...snapshot.sort.filter((k) => k.path !== groupBy)]);
		}
	});

	// The site's preferences, so a duration, a date-time and a timecode are edited the
	// way the site reads them.
	const prefs = $derived(preferencesOf(context));
	const rows = $derived(control.rows);
	const sortKeys = $derived(snapshot.sort);
	const rowHeight = $derived(ROW_HEIGHT[density]);
	const cellClass = $derived(cn(CELL[density], TEXT[size]));
	const byPath = $derived(new Map(columns.map((column) => [column.path, column])));

	let editing = $state<{ key: string; path: string; placement: EditorPlacement } | null>(null);
	let draft = $state<unknown>(null);
	/** Why the last write to a cell was refused, by `cellKey`. */
	let cellErrors = $state.raw<ReadonlyMap<string, string>>(new Map());
	/** The cells a write is on its way to. Their value changes only once the row is read back. */
	let writing = $state.raw<ReadonlySet<string>>(new Set());
	let dragging = $state<string | null>(null);
	let dropTarget = $state<string | null>(null);

	/* the table ------------------------------------------------------------ */

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
		expandedRowModel: createExpandedRowModel()
	});

	const groupPlan = $derived(tableGrouping(groupBy, columnPaths(columns)));
	const grouping = $derived(groupPlan.grouping);
	const groupOnly = $derived(groupPlan.groupOnly);

	const columnDefs = $derived([
		...(selectable
			? [{ id: SELECT, size: 40, minSize: 40, maxSize: 40, enableResizing: false, enablePinning: false, enableGrouping: false }]
			: []),
		...columns.map((column) => ({
			id: column.path,
			accessorFn: (row: EntityRow) => cellValue(row, column.path),
			size: column.width ?? 180,
			minSize: 64
		})),
		// A group path no column shows is carried last, at no width, and never drawn.
		...(groupOnly
			? [{
					id: groupOnly,
					accessorFn: (row: EntityRow) => cellValue(row, groupOnly),
					size: 0,
					minSize: 0,
					maxSize: 0,
					enableResizing: false,
					enablePinning: false
				}]
			: [])
	]);

	const table = createTable<typeof features, EntityRow>({
		features,
		get data() {
			return rows;
		},
		get columns() {
			return columnDefs;
		},
		get state() {
			return { grouping };
		},
		// A group draws its own full-width header row, so the grouped column stays where
		// the caller put it.
		groupedColumnMode: false,
		initialState: { expanded: true },
		// A page is a data change, and the mode in force says what its headers do; the
		// table's own reset would open every one.
		autoResetExpanded: false,
		getRowId: (row: EntityRow) => control.rowId(row),
		columnResizeMode: 'onChange'
	});

	const order = $derived(table.atoms.columnOrder.get());
	const pinning = $derived(table.atoms.columnPinning.get());
	const sizing = $derived(table.atoms.columnSizing.get());
	const expansion = $derived(table.atoms.expanded.get());

	/*
	 * The shut group headers, two-way. The mode is written into the table when it or
	 * the drawn headers change, and read back out of it when a header is pressed; each
	 * effect answers one direction and reads the other side untracked, and neither runs
	 * while no header is drawn, so a mode a host passed before the rows landed survives
	 * the mount and a reload.
	 */
	/** The group headers, which the two-way `collapsed` names by id. */
	const groupHeaders = $derived.by(() => {
		void expansion;
		return table.getRowModel().flatRows.filter((row) => row.getIsGrouped());
	});
	const headerIds = $derived(groupHeaders.map((row) => row.id).join('\n'));
	$effect(() => {
		const state = asCollapseState(collapsed);
		void headerIds;
		untrack(() => {
			if (groupHeaders.length === 0) return;
			if (groupHeaders.every((row) => row.getIsExpanded() === !isCollapsed(state, row.id))) return;
			// One write for every header, so the read-back never sees a half-applied mode.
			table.setExpanded(
				Object.fromEntries(groupHeaders.filter((row) => !isCollapsed(state, row.id)).map((row) => [row.id, true]))
			);
		});
	});
	$effect(() => {
		// The table answers which headers are shut, not which one was pressed, so the state
		// is read back under the mode in force and a later page still follows it.
		void expansion;
		untrack(() => {
			if (groupHeaders.length === 0) return;
			const drawn = groupHeaders.map((row) => row.id);
			const shut = groupHeaders.filter((row) => !row.getIsExpanded()).map((row) => row.id);
			const held = asCollapseState(collapsed);
			const next = collapseStateFrom(held, shut, drawn);
			if (sameCollapse(next, held)) return;
			collapsed = next;
			onCollapsedChange?.(next);
		});
	});

	/**
	 * Every read of the table instance happens here, in one derived.
	 *
	 * A column's builder methods are memoised on the column, and the adapter binds each
	 * memo to whichever effect first ran it. Called from inside an `{#each}` those memos
	 * outlive their block, so the whole layout is read once and the template draws plain
	 * values. Columns pinned to the start come first, then the rest in their order.
	 */
	const layout = $derived.by(() => {
		void order;
		void pinning;
		void sizing;
		const headers = new Map(
			(table.getHeaderGroups()[0]?.headers ?? []).map((header) => [header.column.id, header])
		);
		const rank = (id: string, pinned: false | 'start' | 'end'): number =>
			id === SELECT ? -1 : pinned === 'start' ? 0 : 1;
		const ordered = table.getAllLeafColumns().filter((leaf) => leaf.id !== groupOnly).sort(
			(a, b) => rank(a.id, a.getIsPinned()) - rank(b.id, b.getIsPinned())
		);
		return ordered.map((leaf) => {
			const header = headers.get(leaf.id);
			const pinned = leaf.getIsPinned() === 'start';
			return {
				id: leaf.id,
				column: leaf,
				size: leaf.getSize(),
				pinned,
				// A pinned column sticks at the width of the pinned columns before it.
				style: pinned ? `position:sticky;inset-inline-start:${leaf.getStart('start')}px;z-index:3` : undefined,
				resizable: header?.column.getCanResize() ?? false,
				resizing: header?.column.getIsResizing() ?? false,
				onResize: header?.getResizeHandler()
			};
		});
	});
	/** The scrolling box's inner width: the last column takes what the others leave of it. */
	let room = $state(0);
	const widths = $derived(fillWidths(layout.map((entry) => entry.size), room));
	const totalWidth = $derived.by(() => {
		void sizing;
		return Math.max(table.getTotalSize(), widths.reduce((sum, width) => sum + width, 0));
	});

	/* rows, grouped or flat ------------------------------------------------ */

	const modelRows = $derived(table.getRowModel().rows);

	/** Rows under one group header, however deep. Render order is not the count. */
	function leafCount(row: (typeof modelRows)[number]): number {
		return row.subRows.reduce((n, child) => n + (child.subRows.length > 0 ? leafCount(child) : 1), 0);
	}

	/* the lines ------------------------------------------------------------ */

	const body = bindCollectionBody(control, {
		lines: () => modelRows.length,
		measured: () => modelRows.length,
		lineHeight: () => rowHeight,
		overscan: 12,
		virtualizeAfter: () => virtualizeAfter,
		lineOfRow: (_index, _row, id) => modelRows.findIndex((entry) => entry.id === id),
		// Lines below the window count group headers as well, so a header only ever makes
		// the scroller ask later.
		lastRowOfLine: (line) => rows.length - 1 - (modelRows.length - 1 - line),
		cursorTarget: (_index, _row, id, column) => {
			const tr = ref?.querySelector<HTMLElement>('tr[data-row-key="' + CSS.escape(id) + '"]');
			const cell = column
				? tr?.querySelector<HTMLElement>('td[data-column="' + CSS.escape(column) + '"][tabindex]')
				: null;
			return cell ?? tr?.querySelector<HTMLElement>('td[tabindex],button,input');
		}
	});

	const window_ = $derived.by(() => {
		const at = body.window;
		if (!at) return { before: 0, after: 0, slice: modelRows };
		if (at.to < at.from) return { before: 0, after: 0, slice: modelRows.slice(0, 20) };
		return { before: at.before, after: at.after, slice: modelRows.slice(at.from, at.to + 1) };
	});

	/** The rows on screen, read once, for the same reason the layout is. */
	const items = $derived.by(() => {
		void expansion;
		return window_.slice.map((row, index) => {
			const grouped = row.getIsGrouped();
			return {
				row,
				id: row.id,
				index,
				grouped,
				expanded: grouped && row.getIsExpanded(),
				selected: !grouped && control.isSelected(row.original),
				disabled: !grouped && control.rowDisabled(row.original),
				count: grouped ? leafCount(row) : 0,
				groupColumnId: row.groupingColumnId ?? '',
				groupValue: row.groupingValue,
				data: row.original
			};
		});
	});

	/* sorting -------------------------------------------------------------- */

	function sortOf(path: string): SortSpec | undefined {
		return sortKeys.find((key: SortSpec) => key.path === path);
	}

	/** The group path stays the first sort key: a split group is not a group. */
	function applySort(next: SortSpec[]): void {
		void source.setSort(groupBy && next[0]?.path !== groupBy ? [{ path: groupBy, descending: false }, ...next] : next);
	}

	/** Ascending, then descending, then unsorted, which is the server's id ascending. */
	function toggleSort(path: string): void {
		const current = sortOf(path);
		applySort(current === undefined ? [{ path, descending: false }] : current.descending ? [] : [{ path, descending: true }]);
	}

	/* column choice -------------------------------------------------------- */

	const storageKey = $derived(columnsStorageKey(source.entityType, columnsKey));
	/** The columns the host passed first under this key, which Reset puts back. */
	let defaults = $state.raw<{ key: string; columns: CollectionColumn[] } | null>(null);
	let pickerOpen = $state(false);
	let pickerContent = $state<HTMLElement | null>(null);
	/** Each choice carries a ticket, so a slow resolve never lands over a later one. */
	let ticket = 0;

	$effect(() => {
		const key = storageKey;
		const shown = columns;
		untrack(() => {
			if (shown.length > 0 && defaults?.key !== key) defaults = { key, columns: shown };
		});
	});

	function readChoice(key: string): string[] | null {
		try {
			return parseColumnChoice(localStorage.getItem(key));
		} catch {
			return null;
		}
	}

	/** Keep a choice, or forget it when it is the defaults. Storage may refuse; the table still shows it. */
	function keepChoice(paths: string[] | null): void {
		try {
			if (paths === null) localStorage.removeItem(storageKey);
			else localStorage.setItem(storageKey, serializeColumnChoice(paths));
		} catch {
			// Private mode or a full quota: the choice lasts for the page.
		}
	}

	function writeColumns(next: CollectionColumn[]): void {
		columns = next;
		onColumnsChange?.(next);
		// A column the source does not read yet reads the loaded rows again with it.
		const unread = unreadPaths(source.fields, columnPaths(next));
		if (unread.length > 0) void source.addFields(unread);
	}

	function remember(next: CollectionColumn[]): void {
		if (!columnPicker || !defaults) return;
		const paths = columnPaths(next);
		keepChoice(sameColumnPaths(paths, columnPaths(defaults.columns)) ? null : paths);
	}

	async function choose(paths: string[], keep = true): Promise<void> {
		const mine = ++ticket;
		const known = [...columns, ...(defaults?.columns ?? [])];
		const next = context
			? await resolveColumnChoice(context.schema, source.entityType, paths, known)
			: arrangeColumns(paths, known);
		if (mine !== ticket) return;
		writeColumns(next);
		if (keep) remember(next);
	}

	// A kept choice replaces the defaults once they are known, and again when the key moves.
	$effect(() => {
		const held = defaults;
		if (!columnPicker || !held) return;
		const paths = readChoice(held.key);
		untrack(() => {
			if (paths && !sameColumnPaths(paths, columnPaths(columns))) void choose(paths, false);
		});
	});

	const customised = $derived(
		defaults !== null && !sameColumnPaths(columnPaths(columns), columnPaths(defaults.columns))
	);

	function resetColumns(): void {
		if (!defaults) return;
		ticket += 1;
		writeColumns(defaults.columns);
		keepChoice(null);
	}

	/* column menu ---------------------------------------------------------- */

	function hideColumn(path: string): void {
		const next = columns.filter((column) => column.path !== path);
		columns = next;
		onColumnsChange?.(next);
		remember(next);
	}

	/* column reorder ------------------------------------------------------- */

	function onDrop(target: string): void {
		const from = dragging;
		dragging = null;
		dropTarget = null;
		if (!from || from === target) return;
		const ids: string[] = layout.map((entry) => entry.id);
		const next = ids.filter((id) => id !== from);
		next.splice(next.indexOf(target), 0, from);
		table.setColumnOrder(next);
	}

	/* inline edit ---------------------------------------------------------- */

	/** Why a cell cannot be edited: a disabled row, a column that cannot, or the host's reason. */
	function lockOf(column: CollectionColumn, row: EntityRow): string | null {
		if (control.rowDisabled(row)) return 'This row cannot be edited.';
		if (!column.editable || !(editorFor?.(column.dataType, column) || isEditableType(column.dataType))) {
			return `${column.header} cannot be edited.`;
		}
		return editLock?.(row, column) || null;
	}

	/** The host's reason a cell cannot be edited, shown on it. A column that cannot be edited says nothing. */
	function lockReason(column: CollectionColumn, row: EntityRow): string | null {
		if (!editable || !column.editable || control.rowDisabled(row)) return null;
		return editLock?.(row, column) || null;
	}

	function commitsOnPick(dataType: string): boolean {
		return PICK_KINDS.has(editorKindFor(dataType));
	}

	function canEditColumn(column: CollectionColumn, row: EntityRow): boolean {
		return editable && lockOf(column, row) === null;
	}

	/** Selected rows an edit in a selected row reaches, when that is more than one. */
	const bulkCount = $derived(bulkEdit && selectable && editable && selection.length > 1 ? selection.length : 0);

	/** The column's own placement, then the table's, then the data type's. */
	function placementFor(column: CollectionColumn): EditorPlacement {
		return column.editorPlacement ?? editorPlacement ?? editorPlacementFor(column.dataType);
	}

	function openEditor(key: string, column: CollectionColumn, row: EntityRow, value: unknown): void {
		if (!canEditColumn(column, row)) return;
		// Another cell still open commits first: a popover may report its close after this.
		const open = editing;
		if (open !== null && !(open.key === key && open.path === column.path)) {
			const openRow = rows.find((candidate) => control.rowId(candidate) === open.key);
			const openColumn = byPath.get(open.path);
			releaseEditor();
			if (openRow && openColumn) void commit(openRow, openColumn, draft);
		}
		draft = value;
		editing = { key, path: column.path, placement: placementFor(column) };
	}

	/**
	 * Write a cell's value. In a selected row with `bulkEdit`, the value goes to every selected
	 * row on screen whose cell can be edited, after the host's confirm. Each row's value changes
	 * only once it is read back; a refused row keeps its value and says why in its cell.
	 */
	async function commit(row: EntityRow, column: CollectionColumn, value: unknown): Promise<void> {
		if (isEditing(control.rowId(row), column.path)) editing = null;
		const edit = planBulkEdit({
			rows,
			selection: bulkEdit && selectable ? selection : [],
			edited: row,
			path: column.path,
			value,
			lockOf: (candidate) => lockOf(column, candidate)
		});
		if (!edit.bulk && value === cellValue(row, column.path)) return;
		if (edit.bulk && confirmBulkEdit && !(await confirmBulkEdit(edit))) return;
		const keys = edit.rows.map((target) => cellKey(control.rowId(target), column.path));
		writing = new Set([...writing, ...keys]);
		const updates = bulkUpdates(edit);
		const one = (update: (typeof updates)[number]) => source.updateRow(update.ref, update.patch);
		let results: RowWriteResult[];
		try {
			results = edit.bulk && source.updateRows ? await source.updateRows(updates) : await writeEach(updates, one);
		} catch (error) {
			results = updates.map((update) => ({ ref: update.ref, ok: false as const, message: errorText(error) }));
		}
		const ids = new Map(edit.rows.map((target) => [rowKey(target), control.rowId(target)]));
		const errors = new Map(cellErrors);
		for (const result of results) {
			const id = ids.get(rowKey(result.ref));
			if (id === undefined) continue;
			if (result.ok) errors.delete(cellKey(id, column.path));
			else errors.set(cellKey(id, column.path), result.message);
		}
		cellErrors = errors;
		writing = new Set([...writing].filter((key) => !keys.includes(key)));
		onEditResult?.({ edit, results });
	}

	function onCellKeydown(event: KeyboardEvent, row: EntityRow, column: CollectionColumn): void {
		if (event.key === ' ' && !ownsKeys(event.target as HTMLElement | null)) {
			// Space on a checkbox cell flips it; anywhere else it stays with the row.
			if (onCellGesture(event, 'space', row, column)) event.preventDefault();
			return;
		}
		// Only when the cell itself has focus. An editor's own Enter reaches this on the way
		// up, after the commit has already closed it, and must not open it again.
		if (event.key !== 'Enter' || editing || (event.target as HTMLElement).dataset['slot'] !== 'table-cell') return;
		event.preventDefault();
		openEditor(control.rowId(row), column, row, cellValue(row, column.path));
	}

	/** A checkbox the table flips itself, with no editor: one the host's `editorFor` leaves alone. */
	function togglesInCell(column: CollectionColumn): boolean {
		return editorKindFor(column.dataType) === 'checkbox' && !editorFor?.(column.dataType, column);
	}

	/**
	 * A press on a cell, as core reads it. An edit or a flip keeps the press from the row,
	 * so it leaves the selection; anything else goes on to the row. True when the cell took it.
	 */
	function onCellGesture(
		event: MouseEvent | KeyboardEvent,
		gesture: CellGesture,
		row: EntityRow,
		column: CollectionColumn
	): boolean {
		const key = control.rowId(row);
		const action = cellGestureAction({
			gesture,
			editOn,
			modified: event.shiftKey || event.ctrlKey || event.metaKey,
			editable: canEditColumn(column, row),
			toggles: togglesInCell(column),
			open: isEditing(key, column.path)
		});
		if (action === 'select' || action === 'none') return false;
		event.stopPropagation();
		// A flip on its way keeps the cell until it is read back, so a second press waits for it.
		if (action === 'edit') openEditor(key, column, row, cellValue(row, column.path));
		else if (!writing.has(cellKey(key, column.path))) void commit(row, column, cellValue(row, column.path) !== true);
		return true;
	}

	/**
	 * Focus an inline editor's field, not a button drawn before it, and select a number's text.
	 * Focus already inside is left where it is.
	 */
	function focusEditor(el: HTMLElement, column: CollectionColumn): void {
		if (el.contains(document.activeElement)) return;
		const controls = [...el.querySelectorAll<HTMLElement>('input,textarea,button')];
		const target = controls[editorFocusIndex(controls.map((entry) => entry.tagName))];
		target?.focus({ preventScroll: true });
		if (target instanceof HTMLInputElement && cellEditorShape(column.dataType, 'inline').selectText) target.select();
	}

	/**
	 * Take focus off the control before the cell closes. Its own blur handler commits
	 * what it holds, and it runs on an editor that is still on the page, so the commit is
	 * never on the teardown path.
	 */
	function releaseEditor(): void {
		const active = document.activeElement;
		if (active instanceof HTMLElement && ref?.contains(active)) active.blur();
	}

	/** Focus the editable cell after `path` in the row, or the one before it. */
	async function focusBeside(key: string, path: string, step: 1 | -1): Promise<void> {
		await tick();
		const cells = [
			...(ref?.querySelectorAll<HTMLElement>(`tr[data-row-key="${CSS.escape(key)}"] td[data-editable]`) ?? [])
		];
		const at = cells.findIndex((cell) => cell.dataset['column'] === path);
		(cells[at + step] ?? cells[at])?.focus({ preventScroll: true });
	}

	function editorKeydown(event: KeyboardEvent, row: EntityRow, column: CollectionColumn): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			releaseEditor();
			void commit(row, column, draft);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			releaseEditor();
			editing = null;
		} else if (event.key === 'Tab') {
			// Tab commits and moves along the row, as a spreadsheet does.
			event.preventDefault();
			const key = control.rowId(row);
			releaseEditor();
			void commit(row, column, draft);
			void focusBeside(key, column.path, event.shiftKey ? -1 : 1);
		}
	}

	/** A popover editor drives its own close and reports it; the cell commits what it holds. */
	function editorClosed(row: EntityRow, column: CollectionColumn, mode: 'display' | 'edit'): void {
		// A cell another press already closed has committed.
		if (mode !== 'display' || placementFor(column) !== 'popover' || !isEditing(control.rowId(row), column.path)) return;
		releaseEditor();
		void commit(row, column, draft);
	}

	function isEditing(key: string, path: string): boolean {
		return editing?.key === key && editing.path === path;
	}

	// A press outside the open cell commits it. A popover editor dismisses itself and
	// reports the close, so the cell listens only for the editor drawn in it.
	$effect(() => {
		const open = editing;
		if (open === null || open.placement === 'popover') return;
		const onOutside = (event: PointerEvent): void => {
			const target = event.target as Element | null;
			const cell = ref?.querySelector<HTMLElement>(
				`tr[data-row-key="${CSS.escape(open.key)}"] td[data-column="${CSS.escape(open.path)}"]`
			);
			if (target === null || cell?.contains(target) || target.closest(EDITOR_POPUP) !== null) return;
			releaseEditor();
			const row = rows.find((candidate) => control.rowId(candidate) === open.key);
			const column = byPath.get(open.path);
			if (row && column) void commit(row, column, draft);
			else editing = null;
		};
		document.addEventListener('pointerdown', onOutside, true);
		return () => document.removeEventListener('pointerdown', onOutside, true);
	});

	/**
	 * The arrows walk one column of the body. On the last loaded row they ask for the
	 * next page instead, and the cursor stays where it is until those rows arrive.
	 */
	function onRowsKeydown(event: KeyboardEvent): void {
		const target = event.target as HTMLElement | null;
		if (editing !== null || ownsKeys(target)) return;
		const tr = target?.closest<HTMLElement>('tr[data-row-key]');
		if (!tr) return;
		const from = rows.findIndex((row) => control.rowId(row) === tr.dataset['rowKey']);
		if (from < 0) return;
		const column = target?.closest<HTMLElement>('td[data-column]')?.dataset['column'] ?? null;
		if (selectionKeys(event, from, column)) return;
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		event.preventDefault();
		if (event.key === 'ArrowDown' && body.askForPage(from + 1, column)) return;
		body.focusRow(nextEnabledIndex(rows.length, from, event.key === 'ArrowDown' ? 1 : -1, control.disabledAt), column);
	}

	/* selection gestures --------------------------------------------------- */

	/** What a press inside a row leaves to the element it landed on. */
	const OWN_PRESS = 'a,button:not([data-slot="checkbox"]),input,textarea,select,[contenteditable],[data-slot="entity-table-editor"]';

	/** A press on a row, or on its checkbox: Shift ranges from the anchor, anything else toggles. */
	function onRowPress(event: MouseEvent, row: EntityRow): void {
		if (!selectable || event.button !== 0) return;
		const target = event.target as HTMLElement | null;
		if (editing !== null || target?.closest(OWN_PRESS)) return;
		control.press(row, event);
	}

	/** Shift+press would otherwise select the text between the two rows. */
	function onRowPointerDown(event: MouseEvent): void {
		if (selectable && event.shiftKey) event.preventDefault();
	}

	/** True where a key belongs to a control inside the table rather than to the rows. */
	function ownsKeys(target: HTMLElement | null): boolean {
		return Boolean(target?.closest('input,textarea,select,[contenteditable],[data-slot="entity-table-editor"]'));
	}

	/** Cmd or Ctrl+A anywhere in the table takes every loaded row. */
	function onTableKeydown(event: KeyboardEvent): void {
		if (!selectable || editing !== null || ownsKeys(event.target as HTMLElement | null)) return;
		if (selectionKeyIntent(event) !== 'all') return;
		event.preventDefault();
		control.toggleAll(true);
	}

	/** Space toggles the row the cursor is on; Shift and an arrow carry the range. */
	function selectionKeys(event: KeyboardEvent, from: number, column: string | null): boolean {
		const intent = selectable && editing === null ? selectionKeyIntent(event) : null;
		const row = rows[from];
		if (!row || intent === null || intent === 'all') return false;
		event.preventDefault();
		if (intent === 'toggle') {
			control.toggle(row);
			return true;
		}
		const to = nextEnabledIndex(rows.length, from, intent === 'extend-down' ? 1 : -1, control.disabledAt);
		if (to !== from && to >= 0) {
			control.extend(from, to);
			body.focusRow(to, column);
		}
		return true;
	}

	let selectingAll = $state(false);
	const offer = $derived(
		matchingOffer({
			allLoaded: control.allSelected.all,
			loaded: rows.length,
			selected: selection.length,
			hasMore: snapshot.hasMore,
			total: snapshot.total
		})
	);
	const loadedCount = $derived(rows.filter((row) => !control.rowDisabled(row)).length);

	async function selectAllMatching(): Promise<void> {
		selectingAll = true;
		try {
			await onSelectAllMatching?.();
		} finally {
			selectingAll = false;
		}
	}

	const view = $derived(control.view(modelRows.length));
	const loadingText = $derived(control.loadingText);
</script>

<!--
	A page of rows, one column per field path.

	Columns are schema-driven: the header is the field's display name and the cell
	rendering comes from its `data_type` through FieldValue. Sizing, resizing,
	ordering, pinning, grouping and selection are TanStack Table's; sorting and paging
	are the server's - a header click sets the source's sort and reads the page again,
	because a sort applied to one loaded page would order the page and not the set, and
	because a sort on a field that cannot be sorted is a silent 200 no-op
	(026_result_order).

	`paging` says how the set is walked, and the source follows it. In `pages` the footer
	walks with an explicit page number and reads "n to m of N" once `_summarize` has
	counted it; a read carries no total of its own (006_pagination, 020_summarize). In
	`more` a row at the bottom appends the next page, in `scroll` the scroller does, and
	both count what is loaded in the footer. A page that fails leaves its rows and says
	why at the bottom, with a retry.

	An edit writes one field through `updateRow`, which follows the write with a
	re-read: the write's own answer is the whole record but resolves no dotted path
	(024_read_after_write). A refused write restores the value and shows the reason in
	the cell.
-->
<div bind:this={ref} data-slot="entity-table" class={cn(COLLECTION_ROOT, className)} {...rest}>
	{#if toolbarStart || toolbarEnd || (columnPicker && context)}
		<div data-slot="entity-table-toolbar" class="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
			<div data-slot="entity-table-toolbar-start" class="flex min-w-0 flex-wrap items-center gap-2">
				{#if toolbarStart}{@render toolbarStart()}{/if}
			</div>
			<div data-slot="entity-table-toolbar-end" class="flex min-w-0 flex-wrap items-center gap-2">
				{#if toolbarEnd}{@render toolbarEnd()}{/if}
				{#if columnPicker && context}
					<Popover.Root bind:open={() => pickerOpen, (next) => (pickerOpen = next)}>
						<Popover.Trigger
							data-slot="entity-table-columns"
							class={cn(
								'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex min-w-0 items-center gap-1.5 rounded-lg border text-sm font-medium shadow-xs outline-none focus-visible:ring-3',
								TRIGGER[size]
							)}
						>
							<Columns3 aria-hidden="true" class={cn('shrink-0', size === 'lg' ? 'size-5' : 'size-4')} />
							<span>Columns</span>
						</Popover.Trigger>
						<Popover.Content
							strategy="fixed"
							data-picker="columns"
							class="flex w-80 flex-col gap-3 p-3"
							align="end"
							bind:ref={pickerContent}
							onOpenAutoFocus={(event) => {
								event.preventDefault();
								pickerContent?.querySelector<HTMLElement>('input')?.focus({ preventScroll: true });
							}}
						>
							<ColumnPicker
								{context}
								entityType={source.entityType}
								size="sm"
								value={columnPaths(columns)}
								onValueChange={(paths) => void choose(paths)}
							/>
							{#if customised}
								<Button variant="ghost" size="sm" class="self-start" data-slot="entity-table-columns-reset" onclick={resetColumns}>
									<RotateCcw aria-hidden="true" />
									Reset columns
								</Button>
							{/if}
						</Popover.Content>
					</Popover.Root>
				{/if}
			</div>
		</div>
	{/if}

	{#if selectable && onSelectAllMatching && offer.show}
		<div
			data-slot="entity-table-select-all"
			class="bg-muted flex w-full min-w-0 flex-wrap items-center justify-center gap-2 rounded-lg px-3 py-1.5 text-sm"
		>
			<span class="text-muted-foreground">
				All {loadedCount} {paging === 'pages' ? 'rows on this page' : 'loaded rows'} are selected.
			</span>
			<Button variant="link" size="sm" class="h-auto p-0" disabled={selectingAll} onclick={() => void selectAllMatching()}>
				{selectingAll ? 'Selecting…' : offer.total === null ? 'Select all matching' : `Select all ${offer.total} matching`}
			</Button>
		</div>
	{/if}

	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		{@attach (el: HTMLDivElement) => {
			body.setScroller(el);
			const observer = new ResizeObserver(() => (room = el.clientWidth));
			observer.observe(el);
			room = el.clientWidth;
			return () => {
				observer.disconnect();
				body.setScroller(null);
			};
		}}
		onkeydown={onTableKeydown}
		data-slot="entity-table-scroll"
		style="max-height:{maxHeight}"
		class="border-border relative w-full overflow-auto rounded-lg border [&>[data-slot=table-container]]:overflow-visible"
	>
		<Table.Root style="table-layout:fixed;width:{totalWidth}px">
			<colgroup>
				{#each layout as entry, i (entry.id)}
					<col style="width:{widths[i] ?? entry.size}px" />
				{/each}
			</colgroup>
			<Table.Header class="bg-background sticky top-0 z-10">
				<Table.Row>
					{#each layout as entry (entry.id)}
						{@const column = byPath.get(entry.id)}
						{@const pinned = entry.pinned}
						<Table.Head
							data-column={entry.id}
							data-pinned={pinned ? 'start' : undefined}
							style={entry.style}
							class={cn('bg-background relative border-b p-0', column?.align === 'right' && 'text-right')}
						>
							{#if entry.id === SELECT}
								<span class={cn('flex items-center justify-center', HEAD[size])}>
									<Checkbox
										aria-label="Select all loaded rows"
										checked={control.allSelected.all}
										indeterminate={control.allSelected.some && !control.allSelected.all}
										onCheckedChange={(value) => control.toggleAll(value === true)}
									/>
								</span>
							{:else if column}
								<!-- The head owns the room beside its menu, so nothing inside it carries a margin. -->
								<div
									data-slot="entity-table-head"
									class={cn('flex w-full min-w-0 items-center', HEAD[size], columnMenu && 'pr-1')}
								>
									<button
										type="button"
										draggable="true"
										aria-label="Sort by {column.header}"
										ondragstart={() => (dragging = column.path)}
										ondragover={(event) => {
											event.preventDefault();
											dropTarget = column.path;
										}}
										ondragleave={() => (dropTarget = null)}
										ondrop={(event) => {
											event.preventDefault();
											onDrop(column.path);
										}}
										onclick={() => column.sortable && toggleSort(column.path)}
										aria-disabled={column.sortable ? undefined : 'true'}
										data-sortable={column.sortable ? 'true' : 'false'}
										title={column.sortable ? undefined : `${column.header} cannot be sorted`}
										class={cn(
											'focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 flex-1 items-center gap-1.5 px-3 font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
											HEAD[size],
											TEXT[size],
											column.sortable ? 'hover:bg-accent hover:text-accent-foreground' : 'cursor-default',
											column.align === 'right' && 'justify-end'
										)}
									>
										<span class="truncate" title={column.header}>{column.header}</span>
										{#if showCode && column.path !== column.header}
											<span class="text-muted-foreground truncate font-mono text-xs">{column.path}</span>
										{/if}
										{#if sortOf(column.path)?.descending === false}
											<ArrowUp aria-hidden="true" class="size-4 shrink-0" />
										{:else if sortOf(column.path)?.descending === true}
											<ArrowDown aria-hidden="true" class="size-4 shrink-0" />
										{:else if column.sortable}
											<ChevronsUpDown aria-hidden="true" class="size-4 shrink-0 opacity-50" />
										{/if}
									</button>
									{#if headerEnd}{@render headerEnd({ column })}{/if}
									{#if columnMenu}
									<DropdownMenu.Root>
										<DropdownMenu.Trigger
											aria-label="{column.header} column menu"
											class={cn(
												PICKER_ICON_BUTTON,
												'text-muted-foreground data-[state=open]:bg-accent data-[state=open]:text-accent-foreground'
											)}
										>
											<EllipsisVertical aria-hidden="true" class="size-4" />
										</DropdownMenu.Trigger>
										<DropdownMenu.Content align="start" class="w-44">
											<DropdownMenu.Item
												disabled={!column.sortable}
												onSelect={() => applySort([{ path: column.path, descending: false }])}
											>
												<ArrowUp aria-hidden="true" />
												Sort ascending
											</DropdownMenu.Item>
											<DropdownMenu.Item
												disabled={!column.sortable}
												onSelect={() => applySort([{ path: column.path, descending: true }])}
											>
												<ArrowDown aria-hidden="true" />
												Sort descending
											</DropdownMenu.Item>
											<DropdownMenu.Item
												disabled={!column.sortable || sortOf(column.path) === undefined}
												onSelect={() => applySort([])}
											>
												<ArrowUpDown aria-hidden="true" />
												Clear sort
											</DropdownMenu.Item>
											<DropdownMenu.Separator />
											<DropdownMenu.Item onSelect={() => hideColumn(column.path)}>
												<EyeOff aria-hidden="true" />
												Hide column
											</DropdownMenu.Item>
											<DropdownMenu.Item onSelect={() => entry.column.pin(pinned ? false : 'start')}>
												{#if pinned}
													<PinOff aria-hidden="true" />
													Unpin
												{:else}
													<ArrowLeftToLine aria-hidden="true" />
													Pin left
												{/if}
											</DropdownMenu.Item>
										</DropdownMenu.Content>
									</DropdownMenu.Root>
									{/if}
								</div>
								{#if entry.resizable}
									<span
										role="separator"
										aria-orientation="vertical"
										aria-label="Resize {column.header}"
										onpointerdown={entry.onResize}
										class={cn(
											'hover:bg-ring absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none',
											entry.resizing && 'bg-ring',
											dropTarget === column.path && 'bg-ring',
											dragging === column.path && 'opacity-50'
										)}
									></span>
								{/if}
							{/if}
						</Table.Head>
					{/each}
				</Table.Row>
			</Table.Header>

			<Table.Body
				onkeydown={onRowsKeydown}
				aria-busy={snapshot.status === 'loading' ? 'true' : undefined}
				aria-label={snapshot.status === 'loading' ? loadingText : undefined}
			>
				{#if view === 'loading'}
					{#each { length: 8 } as _, index (index)}
						<Table.Row>
							{#each layout as entry (entry.id)}
								<!-- A skeleton costs what a row costs: the 24px a cell's tallest value stands at. -->
								<Table.Cell class={cellClass}><Skeleton class="h-6 w-full" /></Table.Cell>
							{/each}
						</Table.Row>
					{/each}
				{:else if view === 'error'}
					<Table.Row>
						<Table.Cell colspan={layout.length}>
							<StateLine
								state="error"
								pad="table"
								icon={CircleAlert}
								label={stateLine('error', { errorLabel }, snapshot.error?.message)}
							/>
						</Table.Cell>
					</Table.Row>
				{:else if view === 'empty'}
					<Table.Row>
						<Table.Cell colspan={layout.length}>
							<StateLine state="empty" pad="table" icon={Inbox} label={emptyLabel} />
						</Table.Cell>
					</Table.Row>
				{:else}
					{#if window_.before > 0}
						<tr aria-hidden="true" style="height:{window_.before}px"></tr>
					{/if}
					{#each items as item (item.id)}
						{#if item.grouped}
							{@const groupColumn = byPath.get(item.groupColumnId)}
							<Table.Row
								data-slot="entity-table-group"
								class="bg-muted hover:bg-muted"
								style={body.virtualized ? `height:${rowHeight}px` : undefined}
							>
								<Table.Cell colspan={layout.length} class="p-0">
									<button
										type="button"
										aria-expanded={item.expanded}
										onclick={() => item.row.toggleExpanded()}
										class={cn(
											'focus-visible:ring-ring focus-visible:ring-offset-background flex w-full items-center gap-1.5 px-3 py-1.5 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
											TEXT[size]
										)}
									>
										<ChevronRight
											aria-hidden="true"
											class={cn(
												'size-4 shrink-0 transition-transform duration-150 ease-out',
												item.expanded && 'rotate-90'
											)}
										/>
										{#if groupHeader}
											{@render groupHeader({
												value: item.groupValue,
												column: groupColumn ?? null,
												count: item.count,
												expanded: item.expanded,
												id: item.id
											})}
										{:else}
											<span class="truncate">
												<FieldValue
													value={item.groupValue}
													dataType={groupColumn?.dataType ?? 'text'}
													field={groupColumn?.field}
													{statuses}
													{context}
													{density}
												/>
											</span>
											<span class="text-muted-foreground font-mono text-xs tabular-nums">{item.count}</span>
										{/if}
									</button>
								</Table.Cell>
							</Table.Row>
						{:else}
							{@const row = item.data}
							{@const key = item.id}
							{@const selected = item.selected}
							{@const disabled = item.disabled}
							<Table.Row
								data-row-key={key}
								onclick={(event: MouseEvent) => onRowPress(event, row)}
								onmousedown={onRowPointerDown}
								data-state={selected ? 'selected' : undefined}
								data-disabled={disabled ? 'true' : undefined}
								aria-disabled={disabled ? 'true' : undefined}
								class={cn(
									selected ? 'bg-accent text-accent-foreground' : 'bg-background',
									disabled && 'pointer-events-none opacity-50'
								)}
								style={body.virtualized ? `height:${rowHeight}px` : undefined}
							>
								{#if rowSnippet}
									{@render rowSnippet({ row, id: key, index: item.index, selected, disabled, columns })}
								{:else}
									{#each layout as entry (entry.id)}
										{@const pinned = entry.pinned}
										{#if entry.id === SELECT}
											<Table.Cell
												data-pinned={pinned ? 'start' : undefined}
												style={entry.style}
												class={cn(cellClass, 'bg-inherit text-center')}
											>
												<!-- A press and Space reach the row, which reads their modifiers; the box shows the state. -->
												<Checkbox
													aria-label="Select row"
													checked={selected}
													{disabled}
													onclick={(event: MouseEvent) => event.preventDefault()}
													onkeydown={(event: KeyboardEvent) => event.key === ' ' && event.preventDefault()}
												/>
											</Table.Cell>
										{:else}
											{@const column = byPath.get(entry.id)}
											{#if column}
												{@const canEdit = canEditColumn(column, row)}
												{@const lock = lockReason(column, row)}
												{@const Editor = editorFor?.(column.dataType, column) ?? null}
												{@const error = cellErrors.get(cellKey(key, column.path))}
												{@const busy = writing.has(cellKey(key, column.path))}
												{@const toggles = canEdit && togglesInCell(column)}
												<Table.Cell
													data-column={column.path}
													data-pinned={pinned ? 'start' : undefined}
													style={entry.style}
													tabindex={canEdit || lock ? 0 : undefined}
													title={canEdit ? cellEditHint({ editOn, toggles, bulkCount: selected ? bulkCount : 0 }) : (lock ?? undefined)}
													data-editable={canEdit ? 'true' : undefined}
													data-locked={lock ? 'true' : undefined}
													data-writing={busy ? 'true' : undefined}
													aria-busy={busy ? 'true' : undefined}
													onclick={(event: MouseEvent) => onCellGesture(event, 'click', row, column)}
													ondblclick={(event: MouseEvent) => onCellGesture(event, 'dblclick', row, column)}
													onkeydown={(event) => canEdit && onCellKeydown(event, row, column)}
													class={cn(
														cellClass,
														'focus-visible:ring-ring focus-visible:ring-offset-background bg-inherit overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset',
														column.align === 'right' && 'text-right',
														// Nothing else on a cell says it can be edited, so hover and focus say it.
														canEdit && 'hover:bg-accent/50 focus-visible:bg-accent/50 transition-colors duration-150',
														canEdit && (toggles ? 'cursor-pointer' : 'cursor-text'),
														lock && 'cursor-not-allowed',
														busy && 'opacity-60'
													)}
												>
													{#if isEditing(key, column.path)}
														{#if Editor}
															<Editor
																value={cellValue(row, column.path)}
																dataType={column.dataType}
																field={column.field}
																commit={(value) => void commit(row, column, value)}
																cancel={() => (editing = null)}
															/>
														{:else}
															<!-- The default editor is the type's own control from the field-editor item. -->
															{@const placement = placementFor(column)}
															{@const shape = cellEditorShape(column.dataType, placement)}
															<div
																data-slot="entity-table-editor"
																role="presentation"
																onkeydown={(event) => placement === 'inline' && editorKeydown(event, row, column)}
																{@attach (el: HTMLElement) => (placement === 'inline' ? focusEditor(el, column) : undefined)}
															>
																<FieldEditor
																	value={draft}
																	onValueChange={(next) => {
																		draft = next;
																		// A single pick in the cell is the edit itself, as a checkbox press is.
																		if (placement === 'inline' && commitsOnPick(column.dataType)) {
																			releaseEditor();
																			void commit(row, column, next);
																		}
																	}}
																	dataType={column.dataType}
																	field={column.field}
																	{statuses}
																	{context}
																	{projectId}
																	{precision}
																	symbol={symbol ?? '$'}
																	hoursPerDay={prefs.hoursPerDay}
																	locale={prefs.locale}
																	timeZone={prefs.timeZone}
																	frameRate={prefs.frameRate}
																	mode="edit"
																	onModeChange={(next) => editorClosed(row, column, next)}
																	editorPlacement={placement}
																	steppers={shape.steppers}
																	align={column.align}
																	size="sm"
																/>
															</div>
														{/if}
													{:else if toggles && !cellSnippet}
														<!-- The cell takes the press and Space, so the box only shows the value. -->
														<Checkbox
															aria-label={column.header}
															checked={cellValue(row, column.path) === true}
															tabindex={-1}
															onclick={(event: MouseEvent) => event.preventDefault()}
														/>
													{:else if cellSnippet}
														{@render cellSnippet({
															row,
															id: key,
															column,
															value: cellValue(row, column.path),
															disabled
														})}
													{:else}
														<FieldValue
															value={cellValue(row, column.path)}
															dataType={column.dataType}
															field={column.field}
															{statuses}
															{context}
															{density}
														/>
													{/if}
													{#if lock}<span class="sr-only">{lock}</span>{/if}
													{#if error && !isEditing(key, column.path)}
														<span data-slot="entity-table-cell-error" class="text-destructive block truncate text-xs" title={error}>
															{error}
														</span>
													{/if}
												</Table.Cell>
											{/if}
										{/if}
									{/each}
								{/if}
							</Table.Row>
						{/if}
					{/each}
					{#if window_.after > 0}
						<tr aria-hidden="true" style="height:{window_.after}px"></tr>
					{/if}
					{#if control.bottom === 'error'}
						<Table.Row data-slot="entity-table-page-error" class="hover:bg-transparent">
							<Table.Cell colspan={layout.length} class="p-2">
								<StateLine
									state="error"
									pad="none"
									icon={CircleAlert}
									label={stateLine('error', { errorLabel }, snapshot.error?.message)}
								>
									<Button variant="outline" onclick={() => control.retry()}>Retry</Button>
								</StateLine>
							</Table.Cell>
						</Table.Row>
					{:else if control.bottom === 'loading'}
						<Table.Row
							data-slot="entity-table-loading"
							class="hover:bg-transparent"
							aria-busy="true"
							aria-label={loadingText}
						>
							<Table.Cell colspan={layout.length} class="p-2">
								<Skeleton class="h-4 w-full" />
							</Table.Cell>
						</Table.Row>
					{:else if control.bottom === 'more'}
						<Table.Row data-slot="entity-table-load-more" class="hover:bg-transparent">
							<Table.Cell colspan={layout.length} class="p-2 text-center">
								<Button variant="outline" onclick={() => void source.loadMore()}>Load more</Button>
							</Table.Cell>
						</Table.Row>
					{:else if control.bottom === 'sentinel'}
						<tr
							{@attach (el: HTMLTableRowElement) => {
								body.setSentinel(el);
								return () => body.setSentinel(null);
							}}
							data-slot="entity-table-sentinel"
							aria-hidden="true"
						>
							<td colspan={layout.length}></td>
						</tr>
					{/if}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<CollectionFooter
		{source}
		pager={control.pager}
		{pageSizes}
		loading={snapshot.status === 'loading'}
		slotName="entity-table"
	/>
</div>
