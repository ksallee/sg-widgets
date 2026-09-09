<script lang="ts" module>
	export type EntityGridSize = 'sm' | 'md' | 'lg';

	/** Card widths, which set the grid's own columns through `auto-fill`. */
	const CARD: Record<EntityGridSize, number> = { sm: 160, md: 224, lg: 288 };
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { CollectionColumn, EntityRef, EntityRow, EntitySource, StatusRecord } from '@sg-widgets/core';
	import { cellValue, displayNameOf, rowKey } from '@sg-widgets/core';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
		/** The rows and the paging behind them. Created with core's `createEntitySource`. */
		source: EntitySource;
		/** Path of the `image` field. */
		imagePath?: string;
		/** Path of the status field. Every type but Project uses `sg_status_list`. */
		statusPath?: string;
		/** The status field's schema, for a label out of `display_values`. */
		statusField?: CollectionColumn['field'];
		/** Up to two fields shown under the name. */
		secondary?: CollectionColumn[];
		/** `Status` rows by code, for the badge (probe 010). */
		statuses?: Record<string, StatusRecord> | null;
		size?: EntityGridSize;
		selectable?: boolean;
		onselectionchange?: (rows: EntityRef[]) => void;
		onselect?: (row: EntityRow) => void;
		/** Height of the scrolling body. Reaching its end asks the source for the next page. */
		maxHeight?: string;
		emptyLabel?: string;
	};

	let {
		source,
		imagePath = 'image',
		statusPath = 'sg_status_list',
		statusField = null,
		secondary = [],
		statuses = null,
		size = 'md',
		selectable = false,
		onselectionchange,
		onselect,
		maxHeight = '32rem',
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

	const rows = $derived(snapshot.rows);
	const shown = $derived(secondary.slice(0, 2));

	let selected = $state<Record<string, boolean>>({});
	$effect(() => {
		onselectionchange?.(
			rows.filter((row) => selected[rowKey(row)]).map((row) => ({ type: row.type, id: row.id }))
		);
	});

	function toggle(row: EntityRow): void {
		const key = rowKey(row);
		selected = { ...selected, [key]: !selected[key] };
	}

	/* infinite scroll ------------------------------------------------------ */

	let scrollEl = $state<HTMLDivElement | null>(null);
	let sentinel = $state<HTMLDivElement | null>(null);

	$effect(() => {
		const root = scrollEl;
		const target = sentinel;
		if (!root || !target) return;
		const observer = new IntersectionObserver(
			(entries) => {
				// `loadMore` is a no-op while a read is in flight or when the last page was short.
				if (entries.some((entry) => entry.isIntersecting)) void source.loadMore();
			},
			{ root, rootMargin: '200px' }
		);
		observer.observe(target);
		return () => observer.disconnect();
	});

	const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';
</script>

<!--
	Rows as thumbnail cards.

	The value of an `image` field is the only state marker there is, so a row with no
	picture, one still transcoding and one ready all render (field_types/image); a
	Version card carries the play overlay the desktop tk-framework-qtwidgets label uses
	for playable media. The name is `cached_display_name` when the row has one and the
	type's own identity field otherwise, which is core's `displayNameOf`.

	Scrolling to the end asks the source for the next page. Paging stops on a short
	page, never on a missing `links.next`, which the API emits forever (006_pagination).
-->
<div bind:this={ref} data-slot="entity-grid" class={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
	<div
		bind:this={scrollEl}
		data-slot="entity-grid-scroll"
		style="max-height:{maxHeight}"
		class="border-border w-full overflow-auto rounded-md border p-3"
	>
		{#if snapshot.status === 'error'}
			<p class={cn(stateClass, 'text-destructive')}>
				<CircleAlert aria-hidden="true" class="size-4 shrink-0" />
				{snapshot.error?.message}
			</p>
		{:else if snapshot.status === 'loading'}
			<div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax({CARD[size]}px,1fr))">
				{#each { length: 8 } as _, index (index)}
					<div class="flex flex-col gap-2">
						<Skeleton class="aspect-video w-full" />
						<Skeleton class="h-4 w-3/4" />
						<Skeleton class="h-3 w-1/2" />
					</div>
				{/each}
			</div>
		{:else if rows.length === 0}
			<p class={stateClass}>
				<Inbox aria-hidden="true" class="size-4 shrink-0" />
				{emptyLabel}
			</p>
		{:else}
			<div
				role="listbox"
				aria-multiselectable={selectable ? 'true' : undefined}
				aria-label="Rows"
				class="grid gap-3"
				style="grid-template-columns:repeat(auto-fill,minmax({CARD[size]}px,1fr))"
			>
				{#each rows as row (rowKey(row))}
					{@const key = rowKey(row)}
					{@const name = displayNameOf(row.attributes, `${row.type} #${row.id}`)}
					{@const code = String(cellValue(row, statusPath) ?? '')}
					<div
						data-slot="entity-grid-card"
						data-row-key={key}
						data-state={selected[key] ? 'selected' : undefined}
						class={cn(
							'border-border bg-card relative rounded-md border transition-colors duration-150',
							selected[key] && 'bg-accent text-accent-foreground'
						)}
					>
						<button
							type="button"
							role="option"
							aria-selected={selected[key] === true}
							onclick={() => (selectable ? toggle(row) : onselect?.(row))}
							class="focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 flex-col items-start gap-2 rounded-md p-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
						>
							<Thumbnail
								src={cellValue(row, imagePath) as string | null}
								alt=""
								playable={row.type === 'Version'}
								class="h-auto w-full"
							/>
							<span class="w-full min-w-0 truncate text-sm font-medium" title={name}>{name}</span>
							{#if code}
								<StatusBadge {code} status={statuses?.[code] ?? null} field={statusField} size="sm" />
							{/if}
							{#each shown as column (column.path)}
								<span class="text-muted-foreground flex w-full min-w-0 items-center gap-1.5 text-xs">
									<span class="shrink-0">{column.header}</span>
									<FieldValue
										value={cellValue(row, column.path)}
										dataType={column.dataType}
										field={column.field}
										{statuses}
										class="min-w-0 text-xs"
									/>
								</span>
							{/each}
						</button>
						{#if selectable}
							<span class="absolute top-3 left-3 z-10">
								<Checkbox
									aria-label="Select {name}"
									checked={selected[key] === true}
									onCheckedChange={() => toggle(row)}
									class="bg-background/80"
								/>
							</span>
						{/if}
					</div>
				{/each}
			</div>
			<div bind:this={sentinel} aria-hidden="true" class="h-4"></div>
		{/if}
	</div>

	<div class="text-muted-foreground flex items-center gap-2 text-xs">
		<span class="tabular-nums">{rows.length} loaded</span>
		{#if snapshot.count !== null}
			<span class="tabular-nums">of {snapshot.count}</span>
		{/if}
		{#if snapshot.status === 'loadingMore'}
			<span>Loading…</span>
		{/if}
	</div>
</div>
