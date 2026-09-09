<script lang="ts" module>
	export type EntityGridSize = 'sm' | 'md' | 'lg';

	/**
	 * Tile widths, which set the grid's own columns through `auto-fill`. The size is
	 * the tile's own as well, so a wider column gets the taller picture.
	 */
	const TILE: Record<EntityGridSize, number> = { sm: 160, md: 224, lg: 288 };
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { CollectionColumn, EntityRef, EntityRow, EntitySource, SgContext, StatusRecord } from '@sg-widgets/core';
	import { describePaging, rowKey } from '@sg-widgets/core';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import EntityCard from '$lib/registry/components/entity-card.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
		/** The rows and the paging behind them. Created with core's `createEntitySource`. */
		source: EntitySource;
		/** The widget context. Every tile reads its schema and its links through it. */
		context: SgContext;
		/** Field holding the thumbnail URL. `false` leaves every tile on the placeholder. */
		thumbnail?: string | false;
		/** Field shown as the tile's name. Defaults to the type's own display name. */
		labelField?: string | null;
		/** The left of the tile's metadata line: a path, or a resolved column so it renders by type. */
		subLabelField?: string | CollectionColumn | null;
		/** The caller's own sub-label. Wins over `subLabelField`. */
		subLabel?: (row: EntityRow) => string;
		/** The right of the tile's metadata line: a path, or a resolved column so it renders by type. */
		secondaryField?: string | CollectionColumn | null;
		/** The caller's own text on the right of the metadata line. Wins over `secondaryField`. */
		secondary?: (row: EntityRow) => string;
		/** Show the row's `code` beside the name when the two differ. */
		showCode?: boolean;
		/** `Status` rows by code, for the badge (probe 010). Read through the context when not given. */
		statuses?: Record<string, StatusRecord> | null;
		size?: EntityGridSize;
		selectable?: boolean;
		onSelectionChange?: (rows: EntityRef[]) => void;
		onSelect?: (row: EntityRow) => void;
		/** Rows per page offered in the footer. `pages` mode only. */
		pageSizes?: number[];
		/** Height of the scrolling body. In `infinite` mode, reaching its end asks for the next page. */
		maxHeight?: string;
		emptyLabel?: string;
	};

	let {
		source,
		context,
		thumbnail = 'image',
		labelField = null,
		subLabelField = null,
		subLabel,
		secondaryField = null,
		secondary,
		showCode = false,
		statuses = null,
		size = 'md',
		selectable = false,
		onSelectionChange,
		onSelect,
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
	// `false` still draws the media block; a path no row carries is the placeholder.
	const imagePath = $derived(thumbnail === false ? '' : thumbnail);

	let selected = $state<Record<string, boolean>>({});
	let pageDraft = $state('');
	$effect(() => {
		onSelectionChange?.(
			rows.filter((row) => selected[rowKey(row)]).map((row) => ({ type: row.type, id: row.id }))
		);
	});

	function toggle(row: EntityRow): void {
		const key = rowKey(row);
		selected = { ...selected, [key]: !selected[key] };
	}

	function goToPage(value: string): void {
		const wanted = Number(value);
		pageDraft = '';
		if (!Number.isFinite(wanted) || wanted < 1) return;
		void source.setPage(paging.pageCount === null ? wanted : Math.min(wanted, paging.pageCount));
	}

	/* keyboard ------------------------------------------------------------- */

	let listEl = $state<HTMLDivElement | null>(null);
	let cursor = $state(0);
	const active = $derived(Math.min(cursor, Math.max(rows.length - 1, 0)));

	function tiles(): HTMLElement[] {
		if (!listEl) return [];
		return [...listEl.querySelectorAll<HTMLElement>('[data-slot="entity-card"][data-variant="tile"]')];
	}

	/** How many tiles a row holds, read off the track list `auto-fill` resolved to. */
	function columnCount(): number {
		if (!listEl) return 1;
		const tracks = getComputedStyle(listEl).gridTemplateColumns.split(' ').filter((t) => t.length > 0);
		return Math.max(1, tracks.length);
	}

	function focusTile(index: number): void {
		const all = tiles();
		const next = Math.max(0, Math.min(index, all.length - 1));
		const el = all[next];
		if (!el) return;
		cursor = next;
		el.focus({ preventScroll: true });
		el.scrollIntoView({ block: 'nearest' });
	}

	function onKeydown(event: KeyboardEvent): void {
		const target = event.target as HTMLElement | null;
		// Chrome inside a tile, the checkbox, keeps its own keys.
		if (!target || target !== target.closest('[data-slot="entity-card"][data-variant="tile"]')) return;
		const index = tiles().indexOf(target);
		if (index < 0) return;
		const row = rows[index];
		switch (event.key) {
			case 'ArrowRight':
				focusTile(index + 1);
				break;
			case 'ArrowLeft':
				focusTile(index - 1);
				break;
			case 'ArrowDown':
				focusTile(index + columnCount());
				break;
			case 'ArrowUp':
				focusTile(index - columnCount());
				break;
			case 'Home':
				focusTile(0);
				break;
			case 'End':
				focusTile(tiles().length - 1);
				break;
			case ' ':
				if (selectable && row) toggle(row);
				break;
			case 'Enter':
				if (row) onSelect?.(row);
				break;
			default:
				return;
		}
		event.preventDefault();
	}

	function onTileClick(event: MouseEvent, row: EntityRow): void {
		const target = event.target as HTMLElement | null;
		if (target?.closest('[data-slot="entity-card-selection"],[data-slot="entity-card-actions"]')) return;
		onSelect?.(row);
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
	Rows as EntityCard tiles.

	The tile is the card's own `tile` variant, so a grid cell and a card show the
	same row the same way: thumbnail, the status over it, the name, and one
	metadata line from the row-anatomy props. A Version with media carries the play
	overlay, and a row with no picture, one still transcoding and one ready all
	render, the value of an `image` field being the only state marker there is
	(field_types/image).

	The grid owns the layout and the cursor: one tab stop moves into the tiles, the
	arrows walk them, and Space selects where Enter opens.

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
			<div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax({TILE[size]}px,1fr))">
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
				bind:this={listEl}
				role="listbox"
				aria-multiselectable={selectable ? 'true' : undefined}
				aria-label="Rows"
				tabindex={-1}
				class="grid gap-3"
				style="grid-template-columns:repeat(auto-fill,minmax({TILE[size]}px,1fr))"
				onkeydown={onKeydown}
			>
				{#each rows as row, index (rowKey(row))}
					{@const key = rowKey(row)}
					<EntityCard
						variant="tile"
						{context}
						{row}
						{imagePath}
						{labelField}
						{subLabelField}
						{subLabel}
						{secondaryField}
						{secondary}
						{showCode}
						{statuses}
						{selectable}
						{size}
						selected={selected[key] === true}
						onSelectedChange={() => toggle(row)}
						role="option"
						aria-selected={selected[key] === true}
						tabindex={index === active ? 0 : -1}
						data-row-key={key}
						onfocusin={() => (cursor = index)}
						onclick={(event) => onTileClick(event, row)}
					/>
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
