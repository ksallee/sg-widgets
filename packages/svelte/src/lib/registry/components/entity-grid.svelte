<script lang="ts" module>
	export type EntityGridSize = 'sm' | 'md' | 'lg';

	/** Card widths, which set the grid's own columns through `auto-fill`. */
	const CARD: Record<EntityGridSize, number> = { sm: 160, md: 224, lg: 288 };
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { CollectionColumn, EntityRef, EntityRow, EntitySource, SgContext, StatusRecord } from '@sg-widgets/core';
	import { cellValue, describePaging, displayNameOf, rowKey, toColumn } from '@sg-widgets/core';
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
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
		/** The rows and the paging behind them. Created with core's `createEntitySource`. */
		source: EntitySource;
		/** Field holding the thumbnail URL. `false` draws a card with no picture. */
		thumbnail?: string | false;
		/** Field shown as the card's label. Defaults to the type's own display name. */
		labelField?: string | null;
		/** The muted line under the label: a path, or a resolved column so it renders by type. */
		subLabelField?: string | CollectionColumn | null;
		/** The caller's own sub-label. Wins over `subLabelField`. */
		subLabel?: (row: EntityRow) => string;
		/** The value shown beside the label: a path, or a resolved column so it renders by type. */
		secondaryField?: string | CollectionColumn | null;
		/** The caller's own text beside the label. Wins over `secondaryField`. */
		secondary?: (row: EntityRow) => string;
		/** Show the row's `code` beside the label when the two differ. */
		showCode?: boolean;
		/** Extra fields drawn on the card. The source must already read them. */
		fields?: CollectionColumn[];
		/** Path of the status field. Every type but Project uses `sg_status_list`. */
		statusPath?: string;
		/** The status field's schema, for a label out of `display_values`. */
		statusField?: CollectionColumn['field'];
		/** `Status` rows by code, for the badge (probe 010). */
		statuses?: Record<string, StatusRecord> | null;
		/** The widget context. An entity value links to the row's page when this carries a site. */
		context?: SgContext;
		size?: EntityGridSize;
		selectable?: boolean;
		onselectionchange?: (rows: EntityRef[]) => void;
		onselect?: (row: EntityRow) => void;
		/** Rows per page offered in the footer. `pages` mode only. */
		pageSizes?: number[];
		/** Height of the scrolling body. In `infinite` mode, reaching its end asks for the next page. */
		maxHeight?: string;
		emptyLabel?: string;
	};

	let {
		source,
		thumbnail = 'image',
		labelField = null,
		subLabelField = null,
		subLabel,
		secondaryField = null,
		secondary,
		showCode = false,
		fields = [],
		statusPath = 'sg_status_list',
		statusField = null,
		statuses = null,
		context,
		size = 'md',
		selectable = false,
		onselectionchange,
		onselect,
		pageSizes = [25, 50, 100],
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
	const paging = $derived(describePaging(snapshot));
	const subColumn = $derived(subLabelField ? toColumn(subLabelField) : null);
	const secondaryColumn = $derived(secondaryField ? toColumn(secondaryField) : null);

	let selected = $state<Record<string, boolean>>({});
	let pageDraft = $state('');
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

	/* infinite scroll ------------------------------------------------------ */

	let scrollEl = $state<HTMLDivElement | null>(null);
	let sentinel = $state<HTMLDivElement | null>(null);

	$effect(() => {
		const root = scrollEl;
		const target = sentinel;
		if (!root || !target || paging.mode !== 'infinite') return;
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

	In `infinite` mode scrolling to the end asks the source for the next page, and
	paging stops on a short page, never on a missing `links.next`, which the API emits
	forever (006_pagination). In `pages` mode the footer walks the set with an explicit
	page number and reads "n to m of N" once `_summarize` has counted it
	(020_summarize).
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
					{@const name = labelOf(row)}
					{@const code = codeOf(row)}
					{@const status = String(cellValue(row, statusPath) ?? '')}
					{@const sub = subLabel ? subLabel(row) : ''}
					{@const right = secondary ? secondary(row) : ''}
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
							{#if thumbnail}
								<Thumbnail
									src={cellValue(row, thumbnail) as string | null}
									alt=""
									playable={row.type === 'Version'}
									class="h-auto w-full"
								/>
							{/if}
							<span class="flex w-full min-w-0 items-center gap-1.5">
								<span class="min-w-0 truncate text-sm font-medium" title={name}>{name}</span>
								{#if code}
									<span class="text-muted-foreground shrink-0 font-mono text-xs">{code}</span>
								{/if}
								{#if right}
									<span class="text-muted-foreground ml-auto shrink-0 text-xs">{right}</span>
								{:else if secondaryColumn}
									<span class="ml-auto flex shrink-0 justify-end text-xs">
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
							{#if status}
								<StatusBadge code={status} status={statuses?.[status] ?? null} field={statusField} size="sm" />
							{/if}
							{#each fields as column (column.path)}
								<span class="text-muted-foreground flex w-full min-w-0 items-center gap-1.5 text-xs">
									<span class="shrink-0">{column.header}</span>
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
			{#if paging.mode === 'infinite'}
				<div bind:this={sentinel} aria-hidden="true" class="h-4"></div>
			{/if}
		{/if}
	</div>

	<div
		data-slot="entity-grid-footer"
		class="text-muted-foreground flex w-full min-w-0 flex-wrap items-center justify-between gap-2 text-xs"
	>
		{#if paging.mode === 'pages'}
			<div data-slot="entity-grid-page-size" class="flex items-center gap-2">
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
			<div data-slot="entity-grid-pager" class="flex items-center gap-2">
				<span data-slot="entity-grid-range" class="tabular-nums">{paging.rangeLabel}</span>
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
			<span data-slot="entity-grid-loaded" class="tabular-nums">{paging.loadedLabel}</span>
			{#if snapshot.status === 'loadingMore'}
				<span>Loading…</span>
			{/if}
		{/if}
	</div>
</div>
