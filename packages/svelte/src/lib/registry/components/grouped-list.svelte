<script lang="ts" module>
	export type GroupedListDensity = 'compact' | 'default';

	/** The list-row padding of `docs/design-rules.md`; compact halves the vertical half. */
	const ROW: Record<GroupedListDensity, string> = { compact: 'px-2 py-1', default: 'px-2 py-1.5' };
	/** Thumbnail sizes follow the ladder of `docs/design-rules.md`. */
	const THUMB: Record<GroupedListDensity, 'sm' | 'md'> = { compact: 'sm', default: 'md' };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { CollectionColumn, EntityRef, EntityRow, EntitySource, SgContext, StatusRecord } from '@sg-widgets/core';
	import { cellValue, describePaging, displayNameOf, groupRows, rowKey, toColumn } from '@sg-widgets/core';
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
		subLabelField?: string | CollectionColumn | null;
		/** The caller's own sub-label. Wins over `subLabelField`. */
		subLabel?: (row: EntityRow) => string;
		/** The right-aligned value: a path, or a resolved column so it renders by type. */
		secondaryField?: string | CollectionColumn | null;
		/** The caller's own right-aligned text. Wins over `secondaryField`. */
		secondary?: (row: EntityRow) => string;
		/** Show the row's `code` beside the label when the two differ. */
		showCode?: boolean;
		/** Extra fields drawn under the label. The source must already read them. */
		fields?: CollectionColumn[];
		/** `Status` rows by code (probe 010). */
		statuses?: Record<string, StatusRecord> | null;
		/** The widget context. An entity value links to the row's page when this carries a site. */
		context?: SgContext;
		density?: GroupedListDensity;
		selectable?: boolean;
		onselectionchange?: (rows: EntityRef[]) => void;
		onselect?: (row: EntityRow) => void;
		/** Fixed-size leading slot, when `thumbnail` is not the one wanted: an avatar, a colour swatch. */
		leading?: Snippet<[EntityRow]>;
		/** Rows per page offered in the footer. `pages` mode only. */
		pageSizes?: number[];
		maxHeight?: string;
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
		fields = [],
		statuses = null,
		context,
		density = 'default',
		selectable = false,
		onselectionchange,
		onselect,
		leading,
		pageSizes = [25, 50, 100],
		maxHeight = '28rem',
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
	const paging = $derived(describePaging(snapshot));
	const rowClass = $derived(ROW[density]);
	const subColumn = $derived(subLabelField ? toColumn(subLabelField) : null);
	const secondaryColumn = $derived(secondaryField ? toColumn(secondaryField) : null);
	let collapsed = $state<Record<string, boolean>>({});
	let selected = $state<Record<string, boolean>>({});
	let pageDraft = $state('');

	const groups = $derived.by(() => {
		let run = 0;
		return groupRows(rows, groupBy.path).map((bucket) => ({
			key: `group:${run++}:${JSON.stringify(bucket.value ?? null)}`,
			value: bucket.value,
			rows: bucket.rows
		}));
	});

	$effect(() => {
		onselectionchange?.(
			rows.filter((row) => selected[rowKey(row)]).map((row) => ({ type: row.type, id: row.id }))
		);
	});

	function toggle(row: EntityRow): void {
		const key = rowKey(row);
		selected = { ...selected, [key]: !selected[key] };
	}

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

	function goToPage(value: string): void {
		const wanted = Number(value);
		pageDraft = '';
		if (!Number.isFinite(wanted) || wanted < 1) return;
		void source.setPage(paging.pageCount === null ? wanted : Math.min(wanted, paging.pageCount));
	}

	const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';
</script>

<!--
	Rows under collapsible group headers.

	Grouping a paged read is only honest over an order the server produced, so the
	source is sorted on the group path and the contiguous runs are the groups; a count
	is the rows loaded so far and grows as later pages arrive. Every row is one line:
	a fixed-size leading slot, a label, an optional sub-label under it, and an optional
	right-aligned secondary value, so text always starts at the same x.

	In `pages` mode the footer walks the set with an explicit page number and reads
	"n to m of N" once `_summarize` has counted it; a read carries no total of its own
	(006_pagination, 020_summarize).
-->
<div bind:this={ref} data-slot="grouped-list" class={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
	<div
		data-slot="grouped-list-scroll"
		style="max-height:{maxHeight}"
		class="border-border w-full overflow-auto rounded-md border"
	>
		{#if snapshot.status === 'error'}
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
			{#each groups as group (group.key)}
				{@const shut = collapsed[group.key] === true}
				<div data-slot="grouped-list-group" data-group-key={group.key}>
					<button
						type="button"
						aria-expanded={!shut}
						onclick={() => (collapsed = { ...collapsed, [group.key]: !shut })}
						class="bg-muted/50 focus-visible:ring-ring focus-visible:ring-offset-background border-border sticky top-0 z-10 flex w-full items-center gap-1.5 border-b px-2 py-1.5 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
					>
						<ChevronRight
							aria-hidden="true"
							class={cn('size-4 shrink-0 transition-transform duration-150 ease-out', !shut && 'rotate-90')}
						/>
						<span class="min-w-0 truncate">
							<FieldValue value={group.value} dataType={groupBy.dataType} field={groupBy.field} {statuses} {context} />
						</span>
						<span class="text-muted-foreground font-mono text-xs tabular-nums">{group.rows.length}</span>
					</button>
					{#if !shut}
						<ul class="flex flex-col">
							{#each group.rows as row (rowKey(row))}
								{@const key = rowKey(row)}
								{@const label = labelOf(row)}
								{@const code = codeOf(row)}
								{@const sub = subLabel ? subLabel(row) : ''}
								{@const right = secondary ? secondary(row) : ''}
								<li
									data-slot="grouped-list-row"
									data-row-key={key}
									data-state={selected[key] ? 'selected' : undefined}
									class={cn(
										'border-border/50 flex items-center gap-2 border-b last:border-b-0 transition-colors duration-150',
										rowClass,
										selected[key] ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
									)}
								>
									{#if selectable}
										<Checkbox
											aria-label="Select {label}"
											checked={selected[key] === true}
											onCheckedChange={() => toggle(row)}
											class="shrink-0"
										/>
									{/if}
									{#if thumbnail}
										<Thumbnail
											src={cellValue(row, thumbnail) as string | null}
											alt=""
											size={THUMB[density]}
											class="shrink-0"
										/>
									{:else if leading}
										<span class="flex shrink-0 items-center">{@render leading(row)}</span>
									{/if}
									<button
										type="button"
										onclick={() => (selectable ? toggle(row) : onselect?.(row))}
										class="focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 flex-1 flex-col items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
									>
										<span class="flex w-full min-w-0 items-center gap-1.5">
											<span class="min-w-0 truncate text-sm" title={label}>{label}</span>
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
										{#each fields as column (column.path)}
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
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			{/each}
			{#if paging.mode === 'infinite' && snapshot.hasMore}
				<div data-slot="grouped-list-load-more" class="flex justify-center p-2">
					<Button
						variant="outline"
						size="sm"
						disabled={snapshot.status === 'loadingMore'}
						onclick={() => void source.loadMore()}
					>
						{snapshot.status === 'loadingMore' ? 'Loading…' : 'Load more'}
					</Button>
				</div>
			{/if}
		{/if}
	</div>

	<div
		data-slot="grouped-list-footer"
		class="text-muted-foreground flex w-full min-w-0 flex-wrap items-center justify-between gap-2 text-xs"
	>
		{#if paging.mode === 'pages'}
			<div data-slot="grouped-list-page-size" class="flex items-center gap-2">
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
			<div data-slot="grouped-list-pager" class="flex items-center gap-2">
				<span data-slot="grouped-list-range" class="tabular-nums">{paging.rangeLabel}</span>
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
			<span data-slot="grouped-list-loaded" class="tabular-nums">{paging.loadedLabel}</span>
			{#if snapshot.status === 'loadingMore'}
				<span>Loading…</span>
			{/if}
		{/if}
	</div>
</div>
