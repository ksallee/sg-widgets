<script lang="ts" module>
	import type { CollectionColumn, EntityRow } from '@sg-widgets/core';

	export type GroupedListDensity = 'compact' | 'default';
	export type GroupedListSize = 'sm' | 'md' | 'lg';

	/** What a `row` snippet is handed. It draws a row's contents, not the row's box. */
	export interface GroupedListRowContext {
		row: EntityRow;
		/** The row's id, as `getRowId` derives it. */
		id: string;
		index: number;
		selected: boolean;
		disabled: boolean;
	}

	/** What a `groupHeader` snippet is handed. It draws the header's contents. */
	export interface GroupedListGroupContext {
		/** The value the run shares. */
		value: unknown;
		column: CollectionColumn;
		/** Rows loaded under this header. */
		count: number;
		collapsed: boolean;
		/** The key the two-way `collapsed` names this group by. */
		id: string;
	}

	/** The list-row padding of `docs/design-rules.md`; compact halves the vertical half. */
	const ROW: Record<GroupedListDensity, string> = { compact: 'px-2 py-1', default: 'px-2 py-1.5' };
	/** Thumbnail sizes follow the ladder of `docs/design-rules.md`. A compact row takes the step below. */
	const THUMB: Record<GroupedListSize, Record<GroupedListDensity, 'sm' | 'md' | 'lg'>> = {
		sm: { compact: 'sm', default: 'sm' },
		md: { compact: 'sm', default: 'md' },
		lg: { compact: 'md', default: 'lg' }
	};
	/** A row's text and glyphs, on the leaf ladder of `docs/design-rules.md`. */
	const TEXT: Record<GroupedListSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
	const GLYPH: Record<GroupedListSize, string> = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' };
	/** Row heights per density, so a virtualised list can be measured before it is drawn. */
	const ROW_HEIGHT: Record<GroupedListDensity, number> = { compact: 30, default: 34 };
</script>

<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type {
		EntityRef,
		EntitySource,
		FieldSpec,
		PagingMode,
		RowDisabledFn,
		RowIdFn,
		SgContext,
		SortSpec,
		SourceFilters,
		StatusRecord
	} from '@sg-widgets/core';
	import {
		cellValue,
		displayNameOf,
		groupRowsKeyed,
		nextEnabledIndex,
		NO_ROWS_LABEL,
		sameIds,
		stateLine,
		toColumn,
		toggleId
	} from '@sg-widgets/core';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import {
		bindCollectionBody,
		COLLECTION_REGION,
		COLLECTION_ROOT,
		createCollectionControl
	} from '$lib/registry/components/collection-control.svelte.js';
	import CollectionFooter from '$lib/registry/components/collection-footer.svelte';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
		/** The rows and the order behind them. Created with core's `createEntitySource`. */
		source: EntitySource;
		/** Path the rows are grouped on. The source is sorted on it. */
		groupBy: CollectionColumn;
		/** Field holding the thumbnail URL. `false` leaves the leading slot to `leading`. */
		thumbnail?: string | false;
		/** Field shown as the row's label. Defaults to the type's own display name. */
		labelField?: string | null;
		/** The muted line under the label: a path, or a resolved column so it renders by type. */
		subLabelField?: FieldSpec | null;
		/** The caller's own sub-label. Wins over `subLabelField`. */
		subLabel?: (row: EntityRow) => string;
		/** The right-aligned value: a path, or a resolved column so it renders by type. */
		secondaryField?: FieldSpec | null;
		/** The caller's own right-aligned text. Wins over `secondaryField`. */
		secondary?: (row: EntityRow) => string;
		/** Show the row's `code` beside the label when the two differ. */
		showCode?: boolean;
		/** Extra values drawn under the label. The source must already read their paths. */
		details?: CollectionColumn[];
		/** `Status` rows by code (probe 010). */
		statuses?: Record<string, StatusRecord> | null;
		/** The widget context. Values render with its preferences. An entity value links to the row's page when it carries a site. */
		context?: SgContext;
		density?: GroupedListDensity;
		size?: GroupedListSize;
		selectable?: boolean;
		/** The selected rows, two-way. */
		selection?: EntityRef[];
		onSelectionChange?: (rows: EntityRef[]) => void;
		onSelect?: (row: EntityRow) => void;
		/** How a row is keyed, in the DOM and in the selection. Default `Type:id`. */
		getRowId?: RowIdFn;
		/** True for a row that cannot be selected or reached by the keyboard. */
		isRowDisabled?: RowDisabledFn;
		/** Keys of the groups that are shut, two-way. */
		collapsed?: string[];
		onCollapsedChange?: (keys: string[]) => void;
		/** The source's sort, two-way, so a SortPicker drops into the header. */
		sort?: SortSpec[];
		onSortChange?: (sort: SortSpec[]) => void;
		/** The source's filter, two-way, so a FilterBar drops into the header. */
		filters?: SourceFilters;
		onFiltersChange?: (filters: SourceFilters) => void;
		/** Fixed-size leading slot, when `thumbnail` is not the one wanted: an avatar, a colour swatch. */
		leading?: Snippet<[EntityRow]>;
		/** Draws a row's contents. Without it, the row-anatomy props draw them. */
		row?: Snippet<[GroupedListRowContext]>;
		/** Draws a group header's contents. */
		groupHeader?: Snippet<[GroupedListGroupContext]>;
		/** Region above the list. */
		header?: Snippet;
		/** Region below the footer. */
		footer?: Snippet;
		/** How the set is walked: a footer with a page number, a load-more row, or the scroller. */
		paging?: PagingMode;
		/** Rows per page offered in the footer. `pages` mode only. */
		pageSizes?: number[];
		maxHeight?: string;
		/** Rows and headers above which the list is virtualised. */
		virtualizeAfter?: number;
		/** Shown when the read returned nothing. */
		emptyLabel?: string;
		/** The accessible name of the skeletons a read stands behind. */
		loadingLabel?: string;
		/** Shown in place of what the failed read said. */
		errorLabel?: string;
	};

	let {
		source,
		groupBy,
		thumbnail = false,
		labelField = null,
		subLabelField = null,
		subLabel,
		secondaryField = null,
		secondary,
		showCode = false,
		details = [],
		statuses = null,
		context,
		density = 'default',
		size = 'md',
		selectable = false,
		selection = $bindable([]),
		onSelectionChange,
		onSelect,
		getRowId,
		isRowDisabled,
		collapsed = $bindable([]),
		onCollapsedChange,
		sort = $bindable(),
		onSortChange,
		filters = $bindable(),
		onFiltersChange,
		leading,
		row: rowSnippet,
		groupHeader,
		header,
		footer,
		paging = 'more',
		pageSizes = [25, 50, 100],
		maxHeight = '28rem',
		virtualizeAfter = 100,
		emptyLabel = NO_ROWS_LABEL,
		loadingLabel,
		errorLabel,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

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
		if (snapshot.sort[0]?.path !== groupBy.path) {
			void source.setSort([
				{ path: groupBy.path, descending: false },
				...snapshot.sort.filter((key) => key.path !== groupBy.path)
			]);
		}
	});

	const rows = $derived(control.rows);
	const rowClass = $derived(ROW[density]);
	const subColumn = $derived(subLabelField ? toColumn(subLabelField) : null);
	const secondaryColumn = $derived(secondaryField ? toColumn(secondaryField) : null);

	/** The keys of the shut groups. The `collapsed` prop holds the same list. */
	let shutKeys = $state<string[]>([]);

	// A page whose first rows carry the value the last group carries grows that group
	// rather than opening a second one, and the key it is collapsed under stands.
	const groups = $derived(groupRowsKeyed(rows, groupBy.path));

	/*
	 * The collapsed keys, two-way: one effect out and one in, each reading the other
	 * side untracked, so a change travels once and the two never write to each other.
	 */
	$effect(() => {
		const keys = shutKeys;
		if (sameIds(keys, untrack(() => collapsed ?? []))) return;
		collapsed = [...keys];
		onCollapsedChange?.(collapsed);
	});
	$effect(() => {
		const keys = collapsed ?? [];
		if (sameIds(keys, untrack(() => shutKeys))) return;
		shutKeys = [...keys];
	});

	/* the lines ------------------------------------------------------------ */

	/** Headers and rows as one stream, which is what a virtualised list walks. */
	const flat = $derived.by(() => {
		const shut = new Set(shutKeys);
		const out: Array<{ group: (typeof groups)[number]; row: EntityRow | null }> = [];
		for (const group of groups) {
			out.push({ group, row: null });
			if (!shut.has(group.key)) for (const row of group.rows) out.push({ group, row });
		}
		return out;
	});

	const body = bindCollectionBody(control, {
		lines: () => flat.length,
		measured: () => flat.length,
		lineHeight: () => ROW_HEIGHT[density],
		overscan: 12,
		virtualizeAfter: () => virtualizeAfter,
		lineOfRow: (_index, _row, id) => flat.findIndex((item) => item.row !== null && control.rowId(item.row) === id),
		// Lines below the window count headers as well, so a header only ever makes the
		// scroller ask later.
		lastRowOfLine: (line) => rows.length - 1 - (flat.length - 1 - line),
		cursorTarget: (_index, _row, id) => rowLabel(id)
	});

	/** The one control a row's cursor lands on. */
	function rowLabel(id: string): HTMLElement | null | undefined {
		return ref?.querySelector<HTMLElement>(
			'li[data-row-key="' + CSS.escape(id) + '"] [data-slot="grouped-list-row-label"]'
		);
	}

	const window_ = $derived.by(() => {
		const at = body.window;
		if (!at) return { before: 0, after: 0, from: 0, slice: flat };
		if (at.to < at.from) return { before: 0, after: 0, from: 0, slice: flat.slice(0, 30) };
		return { before: at.before, after: at.after, from: at.from, slice: flat.slice(at.from, at.to + 1) };
	});

	/** The window as runs of one group, so a group still draws one box around its rows. */
	const blocks = $derived.by(() => {
		const out: Array<{ group: (typeof groups)[number]; header: boolean; rows: EntityRow[]; from: number }> = [];
		window_.slice.forEach((item, offset) => {
			let last = out[out.length - 1];
			if (!last || last.group.key !== item.group.key) {
				last = { group: item.group, header: false, rows: [], from: window_.from + offset };
				out.push(last);
			}
			if (item.row === null) last.header = true;
			else last.rows.push(item.row);
		});
		return out;
	});

	function labelOf(row: EntityRow): string {
		if (labelField) return String(cellValue(row, labelField) ?? '');
		return displayNameOf(row.attributes, `${row.type} #${row.id}`);
	}

	/** The programmatic name, when it says something the label does not. */
	function codeOf(row: EntityRow): string {
		if (!showCode) return '';
		const raw = cellValue(row, 'code');
		return typeof raw === 'string' && raw.length > 0 && raw !== labelOf(row) ? raw : '';
	}

	/**
	 * The arrows walk the rows. On the last loaded row ArrowDown asks for the next page
	 * instead, and the cursor stays where it is until those rows arrive.
	 */
	function onRowKeydown(event: KeyboardEvent, row: EntityRow): void {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		const key = control.rowId(row);
		const from = rows.findIndex((entry) => control.rowId(entry) === key);
		if (from < 0) return;
		event.preventDefault();
		if (event.key === 'ArrowDown' && body.askForPage(from + 1)) return;
		body.focusRow(nextEnabledIndex(rows.length, from, event.key === 'ArrowDown' ? 1 : -1, control.disabledAt));
	}

	const view = $derived(control.view(rows.length));
	const loadingText = $derived(stateLine('loading', { loadingLabel }));
</script>

<!--
	Rows under collapsible group headers.

	Grouping a paged read is only honest over an order the server produced, so the
	source is sorted on the group path and the contiguous runs are the groups; a count
	is the rows loaded so far and grows as later pages arrive. Every row is one line:
	a fixed-size leading slot, a label, an optional sub-label under it, and an optional
	right-aligned secondary value, so text always starts at the same x.

	`paging` says how the set is walked, and the source follows it. In `pages` the footer
	walks with an explicit page number and reads "n to m of N" once `_summarize` has
	counted it; a read carries no total of its own (006_pagination, 020_summarize). In
	`more` a row at the bottom appends the next page and in `scroll` the scroller does;
	either way a page whose first rows continue the last group grows that group. A page
	that fails leaves its rows and says why at the bottom, with a retry.
-->
<div bind:this={ref} data-slot="grouped-list" class={cn(COLLECTION_ROOT, className)} {...rest}>
	{#if header}
		<div data-slot="grouped-list-header" class={COLLECTION_REGION}>
			{@render header()}
		</div>
	{/if}

	<div
		{@attach (el: HTMLDivElement) => {
			body.setScroller(el);
			return () => body.setScroller(null);
		}}
		data-slot="grouped-list-scroll"
		style="max-height:{maxHeight}"
		class="border-border w-full overflow-auto rounded-lg border"
	>
		{#if view === 'error'}
			<StateLine
				state="error"
				pad="table"
				icon={CircleAlert}
				label={stateLine('error', { errorLabel }, snapshot.error?.message)}
			/>
		{:else if view === 'loading'}
			<div class="flex flex-col" aria-busy="true" aria-label={loadingText}>
				{#each { length: 8 } as _, index (index)}
					<div class={cn('border-border/50 flex items-center border-b last:border-b-0', rowClass)}>
						<Skeleton class="h-5 w-full" />
					</div>
				{/each}
			</div>
		{:else if view === 'empty'}
			<StateLine state="empty" pad="table" icon={Inbox} label={emptyLabel} />
		{:else}
			{#if window_.before > 0}
				<div aria-hidden="true" style="height:{window_.before}px"></div>
			{/if}
			{#each blocks as block (block.group.key)}
				{@const group = block.group}
				{@const shut = shutKeys.includes(group.key)}
				<div data-slot="grouped-list-group" data-group-key={group.key}>
					{#if block.header}
						<button
							type="button"
							aria-expanded={!shut}
							onclick={() => (shutKeys = toggleId(shutKeys, group.key))}
							class={cn(
								'bg-muted/50 focus-visible:ring-ring focus-visible:ring-offset-background border-border sticky top-0 z-10 flex w-full items-center gap-1.5 border-b px-2 py-1.5 text-left font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
								TEXT[size]
							)}
						>
							<ChevronRight
								aria-hidden="true"
								class={cn(
									'shrink-0 transition-transform duration-150 ease-out',
									GLYPH[size],
									!shut && 'rotate-90'
								)}
							/>
							{#if groupHeader}
								{@render groupHeader({
									value: group.value,
									column: groupBy,
									count: group.rows.length,
									collapsed: shut,
									id: group.key
								})}
							{:else}
								<span class="min-w-0 truncate">
									<FieldValue value={group.value} dataType={groupBy.dataType} field={groupBy.field} {statuses} {context} />
								</span>
								<span class="text-muted-foreground font-mono text-xs tabular-nums">{group.rows.length}</span>
							{/if}
						</button>
					{/if}
					{#if block.rows.length > 0}
						<ul class="flex flex-col">
							{#each block.rows as row, offset (control.rowId(row))}
								{@const key = control.rowId(row)}
								{@const index = block.from + offset}
								{@const disabled = control.rowDisabled(row)}
								{@const label = labelOf(row)}
								{@const code = codeOf(row)}
								{@const sub = subLabel ? subLabel(row) : ''}
								{@const right = secondary ? secondary(row) : ''}
								{@const chosen = control.isSelected(row)}
								<li
									data-slot="grouped-list-row"
									data-row-key={key}
									data-state={chosen ? 'selected' : undefined}
									data-disabled={disabled ? 'true' : undefined}
									class={cn(
										'border-border/50 flex items-center gap-2 border-b last:border-b-0 transition-colors duration-150',
										rowClass,
										chosen ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
										disabled && 'pointer-events-none opacity-50'
									)}
								>
									{#if rowSnippet}
										{@render rowSnippet({ row, id: key, index, selected: chosen, disabled })}
									{:else}
										{#if selectable}
											<Checkbox
												aria-label="Select {label}"
												checked={chosen}
												{disabled}
												onCheckedChange={() => control.toggle(row)}
												class="shrink-0"
											/>
										{/if}
										{#if thumbnail}
											<Thumbnail
												src={cellValue(row, thumbnail) as string | null}
												alt=""
												size={THUMB[size][density]}
												class="shrink-0"
											/>
										{:else if leading}
											<span class="flex shrink-0 items-center">{@render leading(row)}</span>
										{/if}
										<button
											type="button"
											data-slot="grouped-list-row-label"
											{disabled}
											onclick={() => (selectable ? control.toggle(row) : onSelect?.(row))}
											onkeydown={(event) => onRowKeydown(event, row)}
											class="focus-visible:ring-ring focus-visible:ring-offset-background relative flex min-w-0 focus-visible:z-10 flex-1 flex-col items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
										>
											<span class="flex w-full min-w-0 items-center gap-1.5">
												<span class={cn('min-w-0 truncate', TEXT[size])} title={label}>{label}</span>
												{#if code}
													<span class="text-muted-foreground shrink-0 font-mono text-xs">{code}</span>
												{/if}
											</span>
											{#if sub}
												<span class="text-muted-foreground w-full min-w-0 truncate text-xs" title={sub}>{sub}</span>
											{:else if subColumn}
												<span class="w-full min-w-0 truncate text-xs">
													<FieldValue
														value={cellValue(row, subColumn.path)}
														dataType={subColumn.dataType}
														field={subColumn.field}
														{statuses}
														{context}
														class="text-muted-foreground text-xs"
													/>
												</span>
											{/if}
											{#each details as column (column.path)}
												<span class="flex w-full min-w-0 items-center gap-1.5 text-xs">
													<span class="text-muted-foreground shrink-0">{column.header}</span>
													<FieldValue
														value={cellValue(row, column.path)}
														dataType={column.dataType}
														field={column.field}
														{statuses}
														{context}
														class="min-w-0 text-xs"
													/>
												</span>
											{/each}
										</button>
										{#if right}
											<span class="text-muted-foreground flex shrink-0 justify-end text-xs">{right}</span>
										{:else if secondaryColumn}
											<span class="flex shrink-0 justify-end text-xs">
												<FieldValue
													value={cellValue(row, secondaryColumn.path)}
													dataType={secondaryColumn.dataType}
													field={secondaryColumn.field}
													{statuses}
													{context}
													class="text-muted-foreground w-auto text-xs"
												/>
											</span>
										{/if}
									{/if}
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}
			{#if window_.after > 0}
				<div aria-hidden="true" style="height:{window_.after}px"></div>
			{/if}
			{#if control.bottom === 'error'}
				<StateLine
					state="error"
					slotName="grouped-list-page-error"
					pad="none"
					class="p-2"
					icon={CircleAlert}
					label={stateLine('error', { errorLabel }, snapshot.error?.message)}
				>
					<Button variant="outline" size="sm" onclick={() => control.retry()}>Retry</Button>
				</StateLine>
			{:else if control.bottom === 'loading'}
				<div data-slot="grouped-list-loading" class="p-2" aria-busy="true" aria-label={loadingText}>
					<Skeleton class="h-4 w-full" />
				</div>
			{:else if control.bottom === 'more'}
				<div data-slot="grouped-list-load-more" class="flex justify-center p-2">
					<Button variant="outline" size="sm" onclick={() => void source.loadMore()}>Load more</Button>
				</div>
			{:else if control.bottom === 'sentinel'}
				<div
					{@attach (el: HTMLDivElement) => {
						body.setSentinel(el);
						return () => body.setSentinel(null);
					}}
					data-slot="grouped-list-sentinel"
					aria-hidden="true"
					class="h-4"
				></div>
			{/if}
		{/if}
	</div>

	<CollectionFooter
		{source}
		pager={control.pager}
		{pageSizes}
		loading={snapshot.status === 'loading'}
		slotName="grouped-list"
	/>

	{#if footer}
		<div data-slot="grouped-list-footer-region" class={COLLECTION_REGION}>
			{@render footer()}
		</div>
	{/if}
</div>
