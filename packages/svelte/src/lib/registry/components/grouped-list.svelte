<script lang="ts" module>
	export type GroupedListDensity = 'compact' | 'default';

	/** The list-row padding of `docs/design-rules.md`; compact halves the vertical half. */
	const ROW: Record<GroupedListDensity, string> = { compact: 'px-2 py-1', default: 'px-2 py-1.5' };
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { CollectionColumn, EntityRef, EntityRow, EntitySource, StatusRecord } from '@sg-widgets/core';
	import { cellValue, displayNameOf, groupRows, rowKey } from '@sg-widgets/core';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import FieldValue from '$lib/registry/components/field-value.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
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
		onselectionchange?: (rows: EntityRef[]) => void;
		onselect?: (row: EntityRow) => void;
		/** Fixed-size leading slot: a thumbnail, an avatar, a colour swatch. */
		leading?: Snippet<[EntityRow]>;
		maxHeight?: string;
		emptyLabel?: string;
	};

	let {
		source,
		groupBy,
		labelPath = null,
		subLabel = null,
		secondary = null,
		statuses = null,
		density = 'default',
		selectable = false,
		onselectionchange,
		onselect,
		leading,
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
		// Grouping reads the contiguous runs of the order the server produced, so the group
		// path has to lead the sort. Setting it re-reads the first page.
		if (snapshot.sort[0]?.path !== groupBy.path) {
			void source.setSort([
				{ path: groupBy.path, descending: false },
				...snapshot.sort.filter((key) => key.path !== groupBy.path)
			]);
		}
	});

	const rows = $derived(snapshot.rows);
	const rowClass = $derived(ROW[density]);
	let collapsed = $state<Record<string, boolean>>({});
	let selected = $state<Record<string, boolean>>({});

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
		if (labelPath) return String(cellValue(row, labelPath) ?? '');
		return displayNameOf(row.attributes, `${row.type} #${row.id}`);
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
							<FieldValue value={group.value} dataType={groupBy.dataType} field={groupBy.field} {statuses} />
						</span>
						<span class="text-muted-foreground font-mono text-xs tabular-nums">{group.rows.length}</span>
					</button>
					{#if !shut}
						<ul class="flex flex-col">
							{#each group.rows as row (rowKey(row))}
								{@const key = rowKey(row)}
								{@const label = labelOf(row)}
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
									{#if leading}
										<span class="flex shrink-0 items-center">{@render leading(row)}</span>
									{/if}
									<button
										type="button"
										onclick={() => (selectable ? toggle(row) : onselect?.(row))}
										class="focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 flex-1 flex-col items-start rounded-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
									>
										<span class="w-full min-w-0 truncate text-sm" title={label}>{label}</span>
										{#if subLabel}
											<span class="w-full min-w-0 truncate text-xs">
												<FieldValue
													value={cellValue(row, subLabel.path)}
													dataType={subLabel.dataType}
													field={subLabel.field}
													{statuses}
													class="text-muted-foreground text-xs"
												/>
											</span>
										{/if}
									</button>
									{#if secondary}
										<span class="flex shrink-0 justify-end text-xs">
											<FieldValue
												value={cellValue(row, secondary.path)}
												dataType={secondary.dataType}
												field={secondary.field}
												{statuses}
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
		{/if}
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
