<script lang="ts" module>
	import type { Component } from 'svelte';
	import type { CollectionColumn, FieldSchema } from '@sg-widgets/core';

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
	export type EditorFor = (dataType: string) => Component<CellEditorProps> | null | undefined;

	/** Row heights per density, so a virtualised list can be measured before it is drawn. */
	const ROW_HEIGHT: Record<EntityTableDensity, number> = { compact: 33, default: 41 };
	const CELL: Record<EntityTableDensity, string> = { compact: 'px-3 py-1', default: 'px-3 py-2' };
	/** A row's text and the head it sits under, on the ladder of `docs/design-rules.md`. */
	const TEXT: Record<EntityTableSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
	const HEAD: Record<EntityTableSize, string> = { sm: 'h-9', md: 'h-10', lg: 'h-11' };

	/** The select column's id, which is never a field path. */
	const SELECT = '__select';

	/** The popups a cell editor opens. Each is portalled out of the table's own tree. */
	const EDITOR_POPUP = '[data-slot="popover-content"],[data-slot="select-content"],[data-picker]';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityRef, EntityRow, EntitySource, SgContext, SortSpec, StatusRecord } from '@sg-widgets/core';
	import { cellValue, describePaging, isEditableType, preferencesOf, rowKey } from '@sg-widgets/core';
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
		rowSelectionFeature,
		tableFeatures
	} from '@tanstack/svelte-table';
	import { Virtualizer, elementScroll, observeElementOffset, observeElementRect } from '@tanstack/virtual-core';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowLeftToLine from '@lucide/svelte/icons/arrow-left-to-line';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDown from '@lucide/svelte/icons/arrow-up-down';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import EllipsisVertical from '@lucide/svelte/icons/ellipsis-vertical';
	import EyeOff from '@lucide/svelte/icons/eye-off';
	import Inbox from '@lucide/svelte/icons/inbox';
	import PinOff from '@lucide/svelte/icons/pin-off';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as DropdownMenu from '$lib/components/ui/dropdown-menu/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import FieldEditor from '$lib/registry/components/field-editor.svelte';
	import FieldValue from '$lib/registry/components/field-value.svelte';

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
		onSelectionChange?: (rows: EntityRef[]) => void;
		/** Collapse rows under headers of a shared value at this path. */
		groupBy?: string | null;
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
		toolbarStart?: Snippet;
		/** Right region of the toolbar above the table. */
		toolbarEnd?: Snippet;
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
		onSelectionChange,
		groupBy = null,
		editable = false,
		editorFor,
		showCode = false,
		pageSizes = [25, 50, 100],
		maxHeight = '28rem',
		virtualizeAfter = 100,
		emptyLabel = 'No rows',
		toolbarStart,
		toolbarEnd,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	/* state ---------------------------------------------------------------- */

	// The source is the store; the snapshot is the value a template reads.
	// svelte-ignore state_referenced_locally
	let snapshot = $state(source.snapshot());
	$effect(() => source.subscribe(() => (snapshot = source.snapshot())));
	$effect(() => {
		if (source.status === 'idle') void source.load();
	});
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
	const rows = $derived(snapshot.rows);
	const sort = $derived(snapshot.sort);
	const paging = $derived(describePaging(snapshot));
	const rowHeight = $derived(ROW_HEIGHT[density]);
	const cellClass = $derived(cn(CELL[density], TEXT[size]));
	const byPath = $derived(new Map(columns.map((column) => [column.path, column])));

	let editing = $state<{ key: string; path: string } | null>(null);
	let draft = $state<unknown>(null);
	let cellError = $state<{ key: string; path: string; message: string } | null>(null);
	let dragging = $state<string | null>(null);
	let dropTarget = $state<string | null>(null);
	let pageDraft = $state('');

	/* the table ------------------------------------------------------------ */

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
		rowSelectionFeature
	});

	const columnDefs = $derived([
		...(selectable
			? [{ id: SELECT, size: 40, minSize: 40, maxSize: 40, enableResizing: false, enablePinning: false, enableGrouping: false }]
			: []),
		...columns.map((column) => ({
			id: column.path,
			accessorFn: (row: EntityRow) => cellValue(row, column.path),
			size: column.width ?? 180,
			minSize: 64
		}))
	]);

	const grouping = $derived(groupBy && byPath.has(groupBy) ? [groupBy] : []);

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
		getRowId: (row: EntityRow) => rowKey(row),
		columnResizeMode: 'onChange',
		get enableRowSelection() {
			return selectable;
		}
	});

	const selection = $derived(table.atoms.rowSelection.get());
	const order = $derived(table.atoms.columnOrder.get());
	const pinning = $derived(table.atoms.columnPinning.get());
	const sizing = $derived(table.atoms.columnSizing.get());
	const expansion = $derived(table.atoms.expanded.get());
	$effect(() => {
		void selection;
		onSelectionChange?.(
			table
				.getSelectedRowModel()
				.flatRows.filter((row) => !row.getIsGrouped())
				.map((row) => ({ type: row.original.type, id: row.original.id }))
		);
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
		const ordered = [...table.getAllLeafColumns()].sort(
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
	const totalWidth = $derived.by(() => {
		void sizing;
		return table.getTotalSize();
	});
	const allSelected = $derived.by(() => {
		void selection;
		return { all: table.getIsAllRowsSelected(), some: table.getIsSomeRowsSelected() };
	});

	/* rows, grouped or flat ------------------------------------------------ */

	const modelRows = $derived(table.getRowModel().rows);

	/** Rows under one group header, however deep. Render order is not the count. */
	function leafCount(row: (typeof modelRows)[number]): number {
		return row.subRows.reduce((n, child) => n + (child.subRows.length > 0 ? leafCount(child) : 1), 0);
	}

	/* virtual rows --------------------------------------------------------- */

	let scrollEl = $state<HTMLDivElement | null>(null);
	// The virtualizer notifies from inside an effect, so the counter it bumps is written
	// and never read there: `ticks += 1` would make the effect depend on its own write.
	let tickCount = 0;
	let ticks = $state(0);
	const virtualized = $derived(modelRows.length > virtualizeAfter);

	function bump(): void {
		tickCount += 1;
		ticks = tickCount;
	}

	const virtualizer = new Virtualizer<HTMLDivElement, HTMLTableRowElement>({
		count: 0,
		getScrollElement: () => scrollEl,
		estimateSize: () => rowHeight,
		overscan: 12,
		observeElementRect,
		observeElementOffset,
		scrollToFn: elementScroll,
		onChange: bump
	});

	$effect(() => virtualizer._didMount());
	$effect(() => {
		// Read every dependency before the call, so the effect tracks the row count and
		// the height and not the tick the virtualizer's own notification writes.
		const count = virtualized ? modelRows.length : 0;
		const size = rowHeight;
		const element = scrollEl;
		virtualizer.setOptions({
			count,
			getScrollElement: () => element,
			estimateSize: () => size,
			overscan: 12,
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			onChange: bump
		});
		// The observers attach to whichever element `getScrollElement` now answers; without
		// this the virtualizer keeps the one it had when it mounted, which was none.
		virtualizer._willUpdate();
		virtualizer.measure();
	});

	const window_ = $derived.by(() => {
		void ticks;
		if (!virtualized) return { before: 0, after: 0, slice: modelRows };
		const virtualItems = virtualizer.getVirtualItems();
		const first = virtualItems[0];
		const last = virtualItems[virtualItems.length - 1];
		if (!first || !last) return { before: 0, after: 0, slice: modelRows.slice(0, 20) };
		return {
			before: first.start,
			after: virtualizer.getTotalSize() - last.end,
			slice: modelRows.slice(first.index, last.index + 1)
		};
	});

	/** The rows on screen, read once, for the same reason the layout is. */
	const items = $derived.by(() => {
		void selection;
		void expansion;
		return window_.slice.map((row) => {
			const grouped = row.getIsGrouped();
			return {
				row,
				id: row.id,
				grouped,
				expanded: grouped && row.getIsExpanded(),
				selected: !grouped && row.getIsSelected(),
				count: grouped ? leafCount(row) : 0,
				groupColumnId: row.groupingColumnId ?? '',
				groupValue: row.groupingValue,
				data: row.original
			};
		});
	});

	/* sorting -------------------------------------------------------------- */

	function sortOf(path: string): SortSpec | undefined {
		return sort.find((key: SortSpec) => key.path === path);
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

	/* column menu ---------------------------------------------------------- */

	function hideColumn(path: string): void {
		const next = columns.filter((column) => column.path !== path);
		columns = next;
		onColumnsChange?.(next);
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

	function canEditColumn(column: CollectionColumn): boolean {
		return editable && column.editable && (Boolean(editorFor?.(column.dataType)) || isEditableType(column.dataType));
	}

	function openEditor(key: string, column: CollectionColumn, value: unknown): void {
		if (!canEditColumn(column)) return;
		cellError = null;
		draft = value;
		editing = { key, path: column.path };
	}

	async function commit(row: EntityRow, column: CollectionColumn, value: unknown): Promise<void> {
		const key = rowKey(row);
		const before = cellValue(row, column.path);
		editing = null;
		if (value === before) return;
		try {
			await source.updateRow({ type: row.type, id: row.id }, { [column.path]: value });
			cellError = null;
		} catch (error) {
			// The write is refused, so the cell goes back to what the row still holds and
			// says why beside it.
			cellError = { key, path: column.path, message: error instanceof Error ? error.message : String(error) };
		}
	}

	function onCellKeydown(event: KeyboardEvent, row: EntityRow, column: CollectionColumn): void {
		// Only when the cell itself has focus. An editor's own Enter reaches this on the way
		// up, after the commit has already closed it, and must not open it again.
		if (event.key !== 'Enter' || editing || (event.target as HTMLElement).dataset['slot'] !== 'table-cell') return;
		event.preventDefault();
		openEditor(rowKey(row), column, cellValue(row, column.path));
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

	function editorKeydown(event: KeyboardEvent, row: EntityRow, column: CollectionColumn): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			releaseEditor();
			void commit(row, column, draft);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			releaseEditor();
			editing = null;
		}
	}

	function isEditing(key: string, path: string): boolean {
		return editing?.key === key && editing.path === path;
	}

	// A press outside the open cell commits it.
	$effect(() => {
		const open = editing;
		if (open === null) return;
		const onOutside = (event: PointerEvent): void => {
			const target = event.target as Element | null;
			const cell = ref?.querySelector<HTMLElement>(
				`tr[data-row-key="${CSS.escape(open.key)}"] td[data-column="${CSS.escape(open.path)}"]`
			);
			if (target === null || cell?.contains(target) || target.closest(EDITOR_POPUP) !== null) return;
			releaseEditor();
			const row = rows.find((candidate) => rowKey(candidate) === open.key);
			const column = byPath.get(open.path);
			if (row && column) void commit(row, column, draft);
			else editing = null;
		};
		document.addEventListener('pointerdown', onOutside, true);
		return () => document.removeEventListener('pointerdown', onOutside, true);
	});

	/* paging --------------------------------------------------------------- */

	function goToPage(value: string): void {
		const wanted = Number(value);
		pageDraft = '';
		if (!Number.isFinite(wanted) || wanted < 1) return;
		void source.setPage(paging.pageCount === null ? wanted : Math.min(wanted, paging.pageCount));
	}

	const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';
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

	In `pages` mode the footer walks the set with an explicit page number and reads
	"n to m of N" once `_summarize` has counted it; a read carries no total of its own
	(006_pagination, 020_summarize). In `infinite` mode the last row loads the next
	page and the footer counts what is loaded.

	An edit writes one field through `updateRow`, which follows the write with a
	re-read: the write's own answer is the whole record but resolves no dotted path
	(024_read_after_write). A refused write restores the value and shows the reason in
	the cell.
-->
<div bind:this={ref} data-slot="entity-table" class={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
	{#if toolbarStart || toolbarEnd}
		<div data-slot="entity-table-toolbar" class="flex w-full min-w-0 flex-wrap items-center justify-between gap-2">
			<div data-slot="entity-table-toolbar-start" class="flex min-w-0 flex-wrap items-center gap-2">
				{#if toolbarStart}{@render toolbarStart()}{/if}
			</div>
			<div data-slot="entity-table-toolbar-end" class="flex min-w-0 flex-wrap items-center gap-2">
				{#if toolbarEnd}{@render toolbarEnd()}{/if}
			</div>
		</div>
	{/if}

	<div
		bind:this={scrollEl}
		data-slot="entity-table-scroll"
		style="max-height:{maxHeight}"
		class="border-border relative w-full overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible"
	>
		<Table.Root style="table-layout:fixed;width:{totalWidth}px">
			<colgroup>
				{#each layout as entry (entry.id)}
					<col style="width:{entry.size}px" />
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
										checked={allSelected.all}
										indeterminate={allSelected.some && !allSelected.all}
										onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
									/>
								</span>
							{:else if column}
								<div
									data-slot="entity-table-head"
									class={cn('flex w-full min-w-0 items-center', HEAD[size])}
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
									<DropdownMenu.Root>
										<DropdownMenu.Trigger
											aria-label="{column.header} column menu"
											class="text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background data-[state=open]:bg-accent data-[state=open]:text-accent-foreground mr-1 flex size-6 shrink-0 items-center justify-center rounded-md outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2"
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

			<Table.Body>
				{#if snapshot.status === 'loading'}
					{#each { length: 8 } as _, index (index)}
						<Table.Row>
							{#each layout as entry (entry.id)}
								<Table.Cell class={cellClass}><Skeleton class="h-4 w-full" /></Table.Cell>
							{/each}
						</Table.Row>
					{/each}
				{:else if snapshot.status === 'error'}
					<Table.Row>
						<Table.Cell colspan={layout.length}>
							<span class={cn(stateClass, 'text-destructive')}>
								<CircleAlert aria-hidden="true" class="size-4 shrink-0" />
								{snapshot.error?.message}
							</span>
						</Table.Cell>
					</Table.Row>
				{:else if modelRows.length === 0}
					<Table.Row>
						<Table.Cell colspan={layout.length}>
							<span class={stateClass}>
								<Inbox aria-hidden="true" class="size-4 shrink-0" />
								{emptyLabel}
							</span>
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
								class="bg-muted/50 hover:bg-muted/50"
								style={virtualized ? `height:${rowHeight}px` : undefined}
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
										<span class="truncate">
											<FieldValue
												value={item.groupValue}
												dataType={groupColumn?.dataType ?? 'text'}
												field={groupColumn?.field}
												{statuses}
												{context}
											/>
										</span>
										<span class="text-muted-foreground font-mono text-xs tabular-nums">{item.count}</span>
									</button>
								</Table.Cell>
							</Table.Row>
						{:else}
							{@const row = item.data}
							{@const key = item.id}
							{@const selected = item.selected}
							<Table.Row
								data-row-key={key}
								data-state={selected ? 'selected' : undefined}
								class={selected ? 'bg-accent text-accent-foreground' : 'bg-background'}
								style={virtualized ? `height:${rowHeight}px` : undefined}
							>
								{#each layout as entry (entry.id)}
									{@const pinned = entry.pinned}
									{#if entry.id === SELECT}
										<Table.Cell
											data-pinned={pinned ? 'start' : undefined}
											style={entry.style}
											class={cn(cellClass, 'bg-inherit text-center')}
										>
											<Checkbox
												aria-label="Select row"
												checked={selected}
												onCheckedChange={(value) => item.row.toggleSelected(value === true)}
											/>
										</Table.Cell>
									{:else}
										{@const column = byPath.get(entry.id)}
										{#if column}
											{@const canEdit = canEditColumn(column)}
											{@const Editor = editorFor?.(column.dataType) ?? null}
											<Table.Cell
												data-column={column.path}
												data-pinned={pinned ? 'start' : undefined}
												style={entry.style}
												tabindex={canEdit ? 0 : undefined}
												ondblclick={() => openEditor(key, column, cellValue(row, column.path))}
												onkeydown={(event) => canEdit && onCellKeydown(event, row, column)}
												class={cn(
													cellClass,
													'focus-visible:ring-ring focus-visible:ring-offset-background bg-inherit overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset',
													column.align === 'right' && 'text-right',
													canEdit && 'cursor-text'
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
														<div
															data-slot="entity-table-editor"
															role="presentation"
															onkeydown={(event) => editorKeydown(event, row, column)}
															{@attach (el: HTMLElement) =>
																el.querySelector<HTMLElement>('input,textarea,button')?.focus({ preventScroll: true })}
														>
															<FieldEditor
																value={draft}
																onValueChange={(next) => (draft = next)}
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
																size="sm"
															/>
														</div>
													{/if}
												{:else}
													<FieldValue
														value={cellValue(row, column.path)}
														dataType={column.dataType}
														field={column.field}
														{statuses}
														{context}
													/>
													{#if cellError && cellError.key === key && cellError.path === column.path}
														<span class="text-destructive block truncate text-xs" title={cellError.message}>
															{cellError.message}
														</span>
													{/if}
												{/if}
											</Table.Cell>
										{/if}
									{/if}
								{/each}
							</Table.Row>
						{/if}
					{/each}
					{#if window_.after > 0}
						<tr aria-hidden="true" style="height:{window_.after}px"></tr>
					{/if}
					{#if paging.mode === 'infinite' && snapshot.hasMore}
						<Table.Row data-slot="entity-table-load-more" class="hover:bg-transparent">
							<Table.Cell colspan={layout.length} class="p-2 text-center">
								<Button
									variant="outline"
									size="sm"
									disabled={snapshot.status === 'loadingMore'}
									onclick={() => void source.loadMore()}
								>
									{snapshot.status === 'loadingMore' ? 'Loading…' : 'Load more'}
								</Button>
							</Table.Cell>
						</Table.Row>
					{/if}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<div
		data-slot="entity-table-footer"
		class="text-muted-foreground flex w-full min-w-0 flex-wrap items-center justify-between gap-2 text-xs"
	>
		{#if paging.mode === 'pages'}
			<div data-slot="entity-table-page-size" class="flex items-center gap-2">
				<span>Rows per page</span>
				<Select.Root
					type="single"
					value={String(paging.pageSize)}
					onValueChange={(value) => void source.setPageSize(Number(value))}
				>
					<Select.Trigger aria-label="Rows per page" class="h-7 w-auto min-w-16">
						<span data-slot="select-value" class="tabular-nums">{paging.pageSize}</span>
					</Select.Trigger>
					<Select.Content>
						{#each pageSizes as option (option)}
							<Select.Item value={String(option)} label={String(option)} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div data-slot="entity-table-pager" class="flex items-center gap-2">
				<span data-slot="entity-table-range" class="tabular-nums">{paging.rangeLabel}</span>
				<Button
					variant="outline"
					size="icon-sm"
					aria-label="Previous page"
					disabled={!paging.hasPrevious || snapshot.status === 'loading'}
					onclick={() => void source.setPage(paging.page - 1)}
				>
					<ChevronLeft aria-hidden="true" />
				</Button>
				<Input
					type="number"
					min="1"
					inputmode="numeric"
					aria-label="Page number"
					class="h-7 w-14 text-center tabular-nums"
					value={pageDraft === '' ? String(paging.page) : pageDraft}
					oninput={(event) => (pageDraft = event.currentTarget.value)}
					onkeydown={(event) => {
						if (event.key !== 'Enter') return;
						event.preventDefault();
						goToPage(event.currentTarget.value);
					}}
					onblur={(event) => goToPage(event.currentTarget.value)}
				/>
				{#if paging.pageCount !== null}
					<span class="tabular-nums">of {paging.pageCount}</span>
				{/if}
				<Button
					variant="outline"
					size="icon-sm"
					aria-label="Next page"
					disabled={!paging.hasNext || snapshot.status === 'loading'}
					onclick={() => void source.setPage(paging.page + 1)}
				>
					<ChevronRight aria-hidden="true" />
				</Button>
			</div>
		{:else}
			<span data-slot="entity-table-loaded" class="tabular-nums">{paging.loadedLabel}</span>
			{#if snapshot.status === 'loadingMore'}
				<span>Loading…</span>
			{/if}
		{/if}
	</div>
</div>
