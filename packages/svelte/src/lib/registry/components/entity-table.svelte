<script lang="ts" module>
	import type { Component } from 'svelte';
	import type { CollectionColumn, EntityRef, FieldSchema } from '@sg-widgets/core';

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
	export type EditorFor = (dataType: string) => Component<CellEditorProps> | null | undefined;

	/** Row heights per density, so a virtualised list can be measured before it is drawn. */
	const ROW_HEIGHT: Record<EntityTableDensity, number> = { compact: 33, default: 41 };
	const CELL: Record<EntityTableDensity, string> = { compact: 'px-3 py-1', default: 'px-3 py-2' };

	interface Item {
		key: string;
		group: { value: unknown; count: number; collapsed: boolean } | null;
		row: { key: string; ref: EntityRef; data: EntityRow } | null;
	}

	function columnKey(column: CollectionColumn): string {
		return column.path;
	}
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityRow, EntitySource, SortSpec, StatusRecord } from '@sg-widgets/core';
	import { cellValue, groupRows, rowKey } from '@sg-widgets/core';
	import {
		columnOrderingFeature,
		columnResizingFeature,
		columnSizingFeature,
		createTable,
		rowSelectionFeature,
		tableFeatures
	} from '@tanstack/svelte-table';
	import { Virtualizer, elementScroll, observeElementOffset, observeElementRect } from '@tanstack/virtual-core';
	import ArrowDown from '@lucide/svelte/icons/arrow-down';
	import ArrowUp from '@lucide/svelte/icons/arrow-up';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import FieldValue from '$lib/registry/components/field-value.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
		/** The rows, the filter and the sort behind them. Created with core's `createEntitySource`. */
		source: EntitySource;
		/** Columns in display order. Core's `resolveColumns` fills them in from the schema. */
		columns: CollectionColumn[];
		/** `Status` rows by code, for status cells (probe 010). */
		statuses?: Record<string, StatusRecord> | null;
		density?: EntityTableDensity;
		/** Draws a checkbox column and reports the selection. */
		selectable?: boolean;
		onselectionchange?: (rows: EntityRef[]) => void;
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
	};

	let {
		source,
		columns,
		statuses = null,
		density = 'default',
		selectable = false,
		onselectionchange,
		groupBy = null,
		editable = false,
		editorFor,
		maxHeight = '28rem',
		virtualizeAfter = 100,
		emptyLabel = 'No rows',
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
		// Grouping reads the contiguous runs of the order the server produced, so the group
		// path has to lead the sort. Setting it re-reads the first page.
		if (groupBy && snapshot.sort[0]?.path !== groupBy) {
			void source.setSort([{ path: groupBy, descending: false }, ...snapshot.sort.filter((k) => k.path !== groupBy)]);
		}
	});

	const rows = $derived(snapshot.rows);
	const sort = $derived(snapshot.sort);
	const rowHeight = $derived(ROW_HEIGHT[density]);
	const cellClass = $derived(CELL[density]);

	let collapsed = $state<Record<string, boolean>>({});
	let editing = $state<{ key: string; path: string } | null>(null);
	let cellError = $state<{ key: string; path: string; message: string } | null>(null);
	let dragging = $state<string | null>(null);
	let dropTarget = $state<string | null>(null);

	/* the table ------------------------------------------------------------ */

	// Sorting is the server's and grouping follows the order it produced, so neither
	// feature is registered here: this table owns sizing, ordering and selection.
	const features = tableFeatures({
		columnOrderingFeature,
		columnSizingFeature,
		columnResizingFeature,
		rowSelectionFeature
	});

	const columnDefs = $derived([
		...(selectable ? [{ id: '__select', size: 40, minSize: 40, maxSize: 40, enableResizing: false }] : []),
		...columns.map((column) => ({
			id: columnKey(column),
			accessorFn: (row: EntityRow) => cellValue(row, column.path),
			size: column.width ?? 180,
			minSize: 64
		}))
	]);

	const table = createTable<typeof features, EntityRow>({
		features,
		get data() {
			return rows;
		},
		get columns() {
			return columnDefs;
		},
		getRowId: (row: EntityRow) => rowKey(row),
		columnResizeMode: 'onChange',
		get enableRowSelection() {
			return selectable;
		}
	});

	const selection = $derived(table.atoms.rowSelection.get());
	const order = $derived(table.atoms.columnOrder.get());
	$effect(() => {
		void order;
		void selection;
		onselectionchange?.(
			table
				.getSelectedRowModel()
				.rows.map((row) => ({ type: row.original.type, id: row.original.id }))
		);
	});

	const leafColumns = $derived(table.getAllLeafColumns());
	const totalWidth = $derived(table.getTotalSize());

	/* rows, grouped or flat ------------------------------------------------ */

	const modelRows = $derived(table.getRowModel().rows);
	const byKey = $derived(new Map(modelRows.map((row) => [row.id, row])));

	const items = $derived.by((): Item[] => {
		const asItem = (row: EntityRow): Item => ({
			key: rowKey(row),
			group: null,
			row: { key: rowKey(row), ref: { type: row.type, id: row.id }, data: row }
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
	});

	/* virtual rows --------------------------------------------------------- */

	let scrollEl = $state<HTMLDivElement | null>(null);
	// The virtualizer notifies from inside an effect, so the counter it bumps is written
	// and never read there: `ticks += 1` would make the effect depend on its own write.
	let tickCount = 0;
	let ticks = $state(0);
	const virtualized = $derived(items.length > virtualizeAfter);

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
		const count = virtualized ? items.length : 0;
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
		if (!virtualized) return { before: 0, after: 0, slice: items };
		const virtualItems = virtualizer.getVirtualItems();
		const first = virtualItems[0];
		const last = virtualItems[virtualItems.length - 1];
		if (!first || !last) return { before: 0, after: 0, slice: items.slice(0, 20) };
		return {
			before: first.start,
			after: virtualizer.getTotalSize() - last.end,
			slice: items.slice(first.index, last.index + 1)
		};
	});

	/* sorting -------------------------------------------------------------- */

	function sortOf(path: string): SortSpec | undefined {
		return sort.find((key: SortSpec) => key.path === path);
	}

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
		dragging = null;
		dropTarget = null;
		if (!from || from === target) return;
		const ids: string[] = leafColumns.map((column) => column.id);
		const next = ids.filter((id) => id !== from);
		next.splice(next.indexOf(target), 0, from);
		table.setColumnOrder(next);
	}

	/* inline edit ---------------------------------------------------------- */

	function openEditor(key: string, column: CollectionColumn): void {
		if (!editable || !column.editable) return;
		cellError = null;
		editing = { key, path: column.path };
	}

	async function commit(item: NonNullable<Item['row']>, column: CollectionColumn, value: unknown): Promise<void> {
		const before = cellValue(item.data, column.path);
		editing = null;
		if (value === before) return;
		try {
			await source.updateRow(item.ref, { [column.path]: value });
			cellError = null;
		} catch (error) {
			// The write is refused, so the cell goes back to what the row still holds and
			// says why beside it.
			cellError = { key: item.key, path: column.path, message: error instanceof Error ? error.message : String(error) };
		}
	}

	function onCellKeydown(event: KeyboardEvent, key: string, column: CollectionColumn): void {
		// Only when the cell itself has focus. An editor's own Enter reaches this on the way
		// up, after the commit has already closed it, and must not open it again.
		if (event.key !== 'Enter' || editing || (event.target as HTMLElement).dataset['slot'] !== 'table-cell') return;
		event.preventDefault();
		openEditor(key, column);
	}

	function fallbackKeydown(event: KeyboardEvent, item: NonNullable<Item['row']>, column: CollectionColumn): void {
		// The input is read off `target`: a delegated handler does not own `currentTarget`.
		const input = event.target as HTMLInputElement;
		if (event.key === 'Enter') {
			event.preventDefault();
			void commit(item, column, input.value);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			editing = null;
		}
	}

	function isEditing(key: string, path: string): boolean {
		return editing?.key === key && editing.path === path;
	}

	const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';
</script>

<!--
	A page of rows, one column per field path.

	Columns are schema-driven: the header is the field's display name and the cell
	rendering comes from its `data_type` through FieldValue. Sorting is the server's -
	a header click sets the source's sort and reads the first page again - because a
	sort applied to one loaded page would order the page and not the set, and because
	a sort on a field that cannot be sorted is a silent 200 no-op (026_result_order).
	Grouping follows that same order and collapses the contiguous runs, so a group's
	count is the rows loaded so far and grows as more arrive.

	An edit writes one field through `updateRow`, which follows the write with a
	re-read: the write's own answer is the whole record but resolves no dotted path
	(024_read_after_write). A refused write restores the value and shows the reason in
	the cell.
-->
<div bind:this={ref} data-slot="entity-table" class={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
	<div
		bind:this={scrollEl}
		data-slot="entity-table-scroll"
		style="max-height:{maxHeight}"
		class="border-border relative w-full overflow-auto rounded-md border [&>[data-slot=table-container]]:overflow-visible"
	>
		<Table.Root style="table-layout:fixed;width:{totalWidth}px">
			<colgroup>
				{#each leafColumns as column (column.id)}
					<col style="width:{column.getSize()}px" />
				{/each}
			</colgroup>
			<Table.Header class="bg-background sticky top-0 z-10">
				<Table.Row>
					{#each table.getHeaderGroups()[0]?.headers ?? [] as header (header.id)}
						{@const column = columns.find((c) => c.path === header.column.id)}
						<Table.Head
							data-column={header.column.id}
							class={cn('bg-background relative border-b p-0', column?.align === 'right' && 'text-right')}
						>
							{#if header.column.id === '__select'}
								<span class="flex h-10 items-center justify-center">
									<Checkbox
										aria-label="Select all loaded rows"
										checked={table.getIsAllRowsSelected()}
										indeterminate={table.getIsSomeRowsSelected() && !table.getIsAllRowsSelected()}
										onCheckedChange={(value) => table.toggleAllRowsSelected(value === true)}
									/>
								</span>
							{:else if column}
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
									onclick={() => toggleSort(column.path)}
									class={cn(
										'focus-visible:ring-ring focus-visible:ring-offset-background flex h-10 w-full min-w-0 items-center gap-1.5 px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
										'hover:bg-accent hover:text-accent-foreground',
										column.align === 'right' && 'justify-end',
										dropTarget === column.path && 'border-ring border-l-2',
										dragging === column.path && 'opacity-50'
									)}
								>
									<span class="truncate" title={column.header}>{column.header}</span>
									{#if sortOf(column.path)?.descending === false}
										<ArrowUp aria-hidden="true" class="size-4 shrink-0" />
									{:else if sortOf(column.path)?.descending === true}
										<ArrowDown aria-hidden="true" class="size-4 shrink-0" />
									{/if}
								</button>
								{#if header.column.getCanResize()}
									<span
										role="separator"
										aria-orientation="vertical"
										aria-label="Resize {column.header}"
										onpointerdown={header.getResizeHandler()}
										class={cn(
											'hover:bg-ring absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none',
											header.column.getIsResizing() && 'bg-ring'
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
							{#each leafColumns as column (column.id)}
								<Table.Cell class={cellClass}><Skeleton class="h-4 w-full" /></Table.Cell>
							{/each}
						</Table.Row>
					{/each}
				{:else if snapshot.status === 'error'}
					<Table.Row>
						<Table.Cell colspan={leafColumns.length}>
							<span class={cn(stateClass, 'text-destructive')}>
								<CircleAlert aria-hidden="true" class="size-4 shrink-0" />
								{snapshot.error?.message}
							</span>
						</Table.Cell>
					</Table.Row>
				{:else if items.length === 0}
					<Table.Row>
						<Table.Cell colspan={leafColumns.length}>
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
					{#each window_.slice as item (item.key)}
						{#if item.group}
							<Table.Row
								data-slot="entity-table-group"
								class="bg-muted/50 hover:bg-muted/50"
								style={virtualized ? `height:${rowHeight}px` : undefined}
							>
								<Table.Cell colspan={leafColumns.length} class="p-0">
									<button
										type="button"
										aria-expanded={!item.group.collapsed}
										onclick={() => (collapsed = { ...collapsed, [item.key]: !collapsed[item.key] })}
										class="focus-visible:ring-ring focus-visible:ring-offset-background flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
									>
										<ChevronRight
											aria-hidden="true"
											class={cn(
												'size-4 shrink-0 transition-transform duration-150 ease-out',
												!item.group.collapsed && 'rotate-90'
											)}
										/>
										<span class="truncate">
											<FieldValue
												value={item.group.value}
												dataType={columns.find((c) => c.path === groupBy)?.dataType ?? 'text'}
												field={columns.find((c) => c.path === groupBy)?.field}
												{statuses}
											/>
										</span>
										<span class="text-muted-foreground font-mono text-xs tabular-nums">{item.group.count}</span>
									</button>
								</Table.Cell>
							</Table.Row>
						{:else if item.row}
							{@const modelRow = byKey.get(item.row.key)}
							<Table.Row
								data-row-key={item.row.key}
								data-state={modelRow?.getIsSelected() ? 'selected' : undefined}
								class={modelRow?.getIsSelected() ? 'bg-accent text-accent-foreground' : undefined}
								style={virtualized ? `height:${rowHeight}px` : undefined}
							>
								{#if selectable}
									<Table.Cell class={cn(cellClass, 'text-center')}>
										<Checkbox
											aria-label="Select row"
											checked={modelRow?.getIsSelected() ?? false}
											onCheckedChange={(value) => modelRow?.toggleSelected(value === true)}
										/>
									</Table.Cell>
								{/if}
								{#each columns as column (column.path)}
									{@const canEdit = editable && column.editable}
									{@const Editor = editorFor?.(column.dataType) ?? null}
									<Table.Cell
										data-column={column.path}
										tabindex={canEdit ? 0 : undefined}
										ondblclick={() => openEditor(item.row!.key, column)}
										onkeydown={(event) => canEdit && onCellKeydown(event, item.row!.key, column)}
										class={cn(
											cellClass,
											'focus-visible:ring-ring focus-visible:ring-offset-background overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-inset',
											column.align === 'right' && 'text-right',
											canEdit && 'cursor-text'
										)}
									>
										{#if isEditing(item.row.key, column.path)}
											{#if Editor}
												<Editor
													value={cellValue(item.row.data, column.path)}
													dataType={column.dataType}
													field={column.field}
													commit={(value) => void commit(item.row!, column, value)}
													cancel={() => (editing = null)}
												/>
											{:else}
												<!-- No editor for this type: a plain input, which every text-like field takes. -->
												<Input
													value={String(cellValue(item.row.data, column.path) ?? '')}
													autofocus
													aria-label={column.header}
													onkeydown={(event) => fallbackKeydown(event, item.row!, column)}
													onblur={() => (editing = null)}
												/>
											{/if}
										{:else}
											<FieldValue
												value={cellValue(item.row.data, column.path)}
												dataType={column.dataType}
												field={column.field}
												{statuses}
											/>
											{#if cellError && cellError.key === item.row.key && cellError.path === column.path}
												<span class="text-destructive block truncate text-xs" title={cellError.message}>
													{cellError.message}
												</span>
											{/if}
										{/if}
									</Table.Cell>
								{/each}
							</Table.Row>
						{/if}
					{/each}
					{#if window_.after > 0}
						<tr aria-hidden="true" style="height:{window_.after}px"></tr>
					{/if}
				{/if}
			</Table.Body>
		</Table.Root>
	</div>

	<div class="text-muted-foreground flex items-center gap-2 text-xs">
		<span class="tabular-nums">{rows.length} loaded</span>
		{#if snapshot.count !== null}
			<span class="tabular-nums">of {snapshot.count}</span>
		{/if}
		{#if snapshot.hasMore}
			<button
				type="button"
				onclick={() => void source.loadMore()}
				disabled={snapshot.status === 'loadingMore'}
				class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background border-border h-8 rounded-md border px-2 outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-safe:active:scale-[0.98]"
			>
				{snapshot.status === 'loadingMore' ? 'Loading…' : 'Load more'}
			</button>
		{/if}
	</div>
</div>
