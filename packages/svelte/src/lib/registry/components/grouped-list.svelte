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
		describePaging,
		displayNameOf,
		groupRowsKeyed,
		hasFailedPage,
		loadsOnArrowDown,
		nextEnabledIndex,
		rowIdOf,
		rowIsDisabled,
		rowKey,
		sameFilters,
		sameIds,
		sameSort,
		shouldLoadNext,
		sourceModeFor,
		toColumn,
		toggleId
	} from '@sg-widgets/core';
	import { Virtualizer, elementScroll, observeElementOffset, observeElementRect } from '@tanstack/virtual-core';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import FieldValue from '$lib/registry/components/field-value.svelte';
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
		emptyLabel?: string;
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
		emptyLabel = 'No rows',
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// svelte-ignore state_referenced_locally
	let snapshot = $state(source.snapshot());
	$effect(() => source.subscribe(() => (snapshot = source.snapshot())));
	$effect(() => {
		if (source.status === 'idle') void source.load();
	});
	$effect(() => {
		// `paging` is the one prop a caller sets, so the source follows it rather than the
		// other way round. Setting a mode it already holds is a no-op.
		void source.setMode(sourceModeFor(paging));
	});
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

	const rows = $derived(snapshot.rows);
	const pager = $derived(describePaging(snapshot));
	/** A page that failed under rows already loaded, which the bottom line reports. */
	const pageError = $derived(hasFailedPage(snapshot));
	const rowClass = $derived(ROW[density]);
	const subColumn = $derived(subLabelField ? toColumn(subLabelField) : null);
	const secondaryColumn = $derived(secondaryField ? toColumn(secondaryField) : null);

	const rowId = (row: EntityRow): string => rowIdOf(row, getRowId);
	const rowDisabled = (row: EntityRow): boolean => rowIsDisabled(row, isRowDisabled);
	const disabledAt = (index: number): boolean => {
		const row = rows[index];
		return row === undefined || rowDisabled(row);
	};

	/** The selection as keys, so a row asks whether it is in it in constant time. */
	const chosenKeys = $derived(new Set((selection ?? []).map(rowKey)));
	/** The keys of the shut groups. The `collapsed` prop holds the same list. */
	let shutKeys = $state<string[]>([]);
	let pageDraft = $state('');

	// A page whose first rows carry the value the last group carries grows that group
	// rather than opening a second one, and the key it is collapsed under stands.
	const groups = $derived(groupRowsKeyed(rows, groupBy.path));

	/*
	 * Two-way state.
	 *
	 * Each pair is one effect out and one in, each reading the other side untracked, so
	 * a change travels once and the two never write to each other.
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

	$effect(() => {
		const wanted = sort;
		if (wanted === undefined || sameSort(wanted, untrack(() => snapshot.sort))) return;
		void source.setSort([...wanted]);
	});
	$effect(() => {
		const current = snapshot.sort;
		if (sameSort(current, untrack(() => sort ?? []))) return;
		sort = [...current];
		onSortChange?.(sort);
	});

	$effect(() => {
		const wanted = filters;
		if (wanted === undefined || sameFilters(wanted, untrack(() => snapshot.filters))) return;
		void source.setFilters(wanted);
	});
	$effect(() => {
		const current = snapshot.filters;
		if (sameFilters(current, untrack(() => filters ?? null))) return;
		filters = current;
		onFiltersChange?.(current);
	});

	function toggle(row: EntityRow): void {
		if (rowDisabled(row)) return;
		const key = rowKey(row);
		const next = chosenKeys.has(key)
			? (selection ?? []).filter((ref) => rowKey(ref) !== key)
			: [...(selection ?? []), { type: row.type, id: row.id }];
		selection = next;
		onSelectionChange?.(next);
	}

	/* virtual rows --------------------------------------------------------- */

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

	let scrollEl = $state<HTMLDivElement | null>(null);
	let sentinel = $state<HTMLDivElement | null>(null);
	// The virtualizer notifies from inside an effect, so the counter it bumps is written
	// and never read there.
	let tickCount = 0;
	let ticks = $state(0);
	const virtualized = $derived(flat.length > virtualizeAfter);
	const lineHeight = $derived(ROW_HEIGHT[density]);

	function bump(): void {
		tickCount += 1;
		ticks = tickCount;
	}

	const virtualizer = new Virtualizer<HTMLDivElement, HTMLElement>({
		count: 0,
		getScrollElement: () => scrollEl,
		estimateSize: () => lineHeight,
		overscan: 12,
		observeElementRect,
		observeElementOffset,
		scrollToFn: elementScroll,
		onChange: bump
	});

	$effect(() => virtualizer._didMount());
	$effect(() => {
		// Read every dependency before the call, so the effect tracks the count and the
		// height and not the tick the virtualizer's own notification writes.
		const count = virtualized ? flat.length : 0;
		const size_ = lineHeight;
		const element = scrollEl;
		virtualizer.setOptions({
			count,
			getScrollElement: () => element,
			estimateSize: () => size_,
			overscan: 12,
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			onChange: bump
		});
		virtualizer._willUpdate();
		virtualizer.measure();
	});

	const window_ = $derived.by(() => {
		void ticks;
		if (!virtualized) return { before: 0, after: 0, from: 0, slice: flat };
		const items = virtualizer.getVirtualItems();
		const first = items[0];
		const last = items[items.length - 1];
		if (!first || !last) return { before: 0, after: 0, from: 0, slice: flat.slice(0, 30) };
		return {
			before: first.start,
			after: virtualizer.getTotalSize() - last.end,
			from: first.index,
			slice: flat.slice(first.index, last.index + 1)
		};
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

	/* the cursor ----------------------------------------------------------- */

	/** The row a cursor is waiting on, until the page it asked for lands. */
	let wanted = $state<number | null>(null);

	/** Put the cursor on one row, drawing it first where it is outside the window. */
	function focusRow(index: number): void {
		const at = Math.max(0, Math.min(index, rows.length - 1));
		const row = rows[at];
		if (!row) return;
		const key = rowId(row);
		const put = (): void => {
			const label = ref?.querySelector<HTMLElement>(
				`li[data-row-key="${CSS.escape(key)}"] [data-slot="grouped-list-row-label"]`
			);
			if (!label) return;
			label.focus({ preventScroll: true });
			label.scrollIntoView({ block: 'nearest' });
		};
		if (virtualized) {
			const line = flat.findIndex((item) => item.row !== null && rowId(item.row) === key);
			if (line >= 0) virtualizer.scrollToIndex(line);
			requestAnimationFrame(put);
		} else put();
	}

	/**
	 * The arrows walk the rows. On the last loaded row ArrowDown asks for the next page
	 * instead, and the cursor stays where it is until those rows arrive.
	 */
	function onRowKeydown(event: KeyboardEvent, row: EntityRow): void {
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		const key = rowId(row);
		const from = rows.findIndex((entry) => rowId(entry) === key);
		if (from < 0) return;
		event.preventDefault();
		if (event.key === 'ArrowDown' && loadsOnArrowDown(snapshot, paging, from + 1)) {
			wanted = from + 1;
			void source.loadMore();
			return;
		}
		focusRow(nextEnabledIndex(rows.length, from, event.key === 'ArrowDown' ? 1 : -1, disabledAt));
	}

	$effect(() => {
		const held = wanted;
		if (held === null) return;
		if (snapshot.status === 'error') wanted = null;
		else if (rows.length > held) {
			wanted = null;
			untrack(() => focusRow(held));
		}
	});

	/* scroll paging -------------------------------------------------------- */

	$effect(() => {
		// The virtualiser walks headers and rows as one stream, so the lines below the
		// window count headers as well and a header only makes the scroller ask later.
		void ticks;
		if (!virtualized || paging !== 'scroll') return;
		const items = virtualizer.getVirtualItems();
		const last = items[items.length - 1];
		if (!last) return;
		const below = flat.length - 1 - last.index;
		if (shouldLoadNext(snapshot, { paging, lastVisible: rows.length - 1 - below })) void source.loadMore();
	});

	$effect(() => {
		// A list short enough not to be virtualised has no range to read, so the last row
		// carries a sentinel instead.
		const root = scrollEl;
		const target = sentinel;
		if (!root || !target || paging !== 'scroll') return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries.some((entry) => entry.isIntersecting)) return;
				if (shouldLoadNext(snapshot, { paging, lastVisible: rows.length - 1 })) void source.loadMore();
			},
			{ root, rootMargin: '200px' }
		);
		observer.observe(target);
		return () => observer.disconnect();
	});

	/** Read the page that failed again: the one a pager is on, or the one that was appended. */
	function retryPage(): void {
		if (paging === 'pages') void source.setPage(snapshot.page);
		else void source.loadMore();
	}

	function goToPage(value: string): void {
		const wanted = Number(value);
		pageDraft = '';
		if (!Number.isFinite(wanted) || wanted < 1) return;
		void source.setPage(pager.pageCount === null ? wanted : Math.min(wanted, pager.pageCount));
	}

	const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';
	/** The same anatomy under the rows, at a row's height rather than a body's. */
	const errorLineClass = 'text-destructive flex items-center justify-center gap-2 text-sm';
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
<div bind:this={ref} data-slot="grouped-list" class={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
	<div
		bind:this={scrollEl}
		data-slot="grouped-list-scroll"
		style="max-height:{maxHeight}"
		class="border-border w-full overflow-auto rounded-md border"
	>
		{#if snapshot.status === 'error' && !pageError}
			<p class={cn(stateClass, 'text-destructive')}>
				<CircleAlert aria-hidden="true" class="size-4 shrink-0" />
				{snapshot.error?.message}
			</p>
		{:else if snapshot.status === 'loading'}
			<div class="flex flex-col gap-2 p-2">
				{#each { length: 8 } as _, index (index)}
					<Skeleton class="h-6 w-full" />
				{/each}
			</div>
		{:else if rows.length === 0}
			<p class={stateClass}>
				<Inbox aria-hidden="true" class="size-4 shrink-0" />
				{emptyLabel}
			</p>
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
							{#each block.rows as row, offset (rowId(row))}
								{@const key = rowId(row)}
								{@const index = block.from + offset}
								{@const disabled = rowDisabled(row)}
								{@const label = labelOf(row)}
								{@const code = codeOf(row)}
								{@const sub = subLabel ? subLabel(row) : ''}
								{@const right = secondary ? secondary(row) : ''}
								{@const chosen = chosenKeys.has(rowKey(row))}
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
												onCheckedChange={() => toggle(row)}
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
											onclick={() => (selectable ? toggle(row) : onSelect?.(row))}
											onkeydown={(event) => onRowKeydown(event, row)}
											class="focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 flex-1 flex-col items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
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
			{#if pageError}
				<p data-slot="grouped-list-page-error" class={cn(errorLineClass, 'p-2')}>
					<CircleAlert aria-hidden="true" class="size-4 shrink-0" />
					<span class="min-w-0 truncate" title={snapshot.error?.message}>{snapshot.error?.message}</span>
					<Button variant="outline" size="sm" onclick={retryPage}>Retry</Button>
				</p>
			{:else if snapshot.status === 'loadingMore'}
				<div data-slot="grouped-list-loading" class="p-2">
					<Skeleton class="h-4 w-full" />
				</div>
			{:else if paging === 'more' && snapshot.hasMore}
				<div data-slot="grouped-list-load-more" class="flex justify-center p-2">
					<Button variant="outline" size="sm" onclick={() => void source.loadMore()}>Load more</Button>
				</div>
			{:else if paging === 'scroll' && snapshot.hasMore}
				<div bind:this={sentinel} data-slot="grouped-list-sentinel" aria-hidden="true" class="h-4"></div>
			{/if}
		{/if}
	</div>

	<div
		data-slot="grouped-list-footer"
		class="text-muted-foreground flex w-full min-w-0 flex-wrap items-center justify-between gap-2 text-xs"
	>
		{#if pager.mode === 'pages'}
			<div data-slot="grouped-list-page-size" class="flex items-center gap-2">
				<span>Rows per page</span>
				<Select.Root
					type="single"
					value={String(pager.pageSize)}
					onValueChange={(value) => void source.setPageSize(Number(value))}
				>
					<Select.Trigger aria-label="Rows per page" class="h-7 w-auto min-w-16">
						<span data-slot="select-value" class="tabular-nums">{pager.pageSize}</span>
					</Select.Trigger>
					<Select.Content>
						{#each pageSizes as option (option)}
							<Select.Item value={String(option)} label={String(option)} />
						{/each}
					</Select.Content>
				</Select.Root>
			</div>
			<div data-slot="grouped-list-pager" class="flex items-center gap-2">
				<span data-slot="grouped-list-range" class="tabular-nums">{pager.rangeLabel}</span>
				<Button
					variant="outline"
					size="icon-sm"
					aria-label="Previous page"
					disabled={!pager.hasPrevious || snapshot.status === 'loading'}
					onclick={() => void source.setPage(pager.page - 1)}
				>
					<ChevronLeft aria-hidden="true" />
				</Button>
				<Input
					type="number"
					min="1"
					inputmode="numeric"
					aria-label="Page number"
					class="h-7 w-14 text-center tabular-nums"
					value={pageDraft === '' ? String(pager.page) : pageDraft}
					oninput={(event) => (pageDraft = event.currentTarget.value)}
					onkeydown={(event) => {
						if (event.key !== 'Enter') return;
						event.preventDefault();
						goToPage(event.currentTarget.value);
					}}
					onblur={(event) => goToPage(event.currentTarget.value)}
				/>
				{#if pager.pageCount !== null}
					<span class="tabular-nums">of {pager.pageCount}</span>
				{/if}
				<Button
					variant="outline"
					size="icon-sm"
					aria-label="Next page"
					disabled={!pager.hasNext || snapshot.status === 'loading'}
					onclick={() => void source.setPage(pager.page + 1)}
				>
					<ChevronRight aria-hidden="true" />
				</Button>
			</div>
		{:else}
			<span data-slot="grouped-list-loaded" class="tabular-nums">{pager.loadedLabel}</span>
		{/if}
	</div>

	{#if footer}
		<div data-slot="grouped-list-footer-region" class="flex w-full min-w-0 flex-wrap items-center gap-2">
			{@render footer()}
		</div>
	{/if}
</div>
