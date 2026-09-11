<script lang="ts" module>
	import type { EntityRow } from '@sg-widgets/core';

	export type EntityGridSize = 'sm' | 'md' | 'lg';

	/** What a `card` snippet is handed. It draws one grid cell in place of the tile. */
	export interface EntityGridCardContext {
		row: EntityRow;
		/** The row's id, as `getRowId` derives it. */
		id: string;
		index: number;
		selected: boolean;
		disabled: boolean;
		/** True on the tile that owns the grid's one tab stop. */
		active: boolean;
	}

	/**
	 * Tile widths, which set the grid's own columns through `auto-fill`. The size is
	 * the tile's own as well, so a wider column gets the taller picture.
	 */
	const TILE: Record<EntityGridSize, number> = { sm: 160, md: 224, lg: 288 };

	export type EntityGridDensity = 'compact' | 'default';

	/** The gap between tiles; compact halves it, as it halves a row's padding elsewhere. */
	const GAP: Record<EntityGridDensity, string> = { compact: 'gap-1.5', default: 'gap-3' };
	const GAP_PX: Record<EntityGridDensity, number> = { compact: 6, default: 12 };

	/** Tile heights, so a virtualised grid can be measured before it is drawn. */
	const TILE_HEIGHT: Record<EntityGridSize, number> = { sm: 148, md: 190, lg: 232 };
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
		describePaging,
		firstEnabledIndex,
		NO_ROWS_LABEL,
		hasFailedPage,
		loadsOnArrowDown,
		nextEnabledIndex,
		rowIdOf,
		rowIsDisabled,
		rowKey,
		shouldLoadNext,
		stateLine
	} from '@sg-widgets/core';
	import { Virtualizer, elementScroll, observeElementOffset, observeElementRect } from '@tanstack/virtual-core';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { bindSource } from '$lib/registry/components/collection-source.svelte.js';
	import CollectionFooter from '$lib/registry/components/collection-footer.svelte';
	import EntityCard from '$lib/registry/components/entity-card.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';

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
		subLabelField?: FieldSpec | null;
		/** The caller's own sub-label. Wins over `subLabelField`. */
		subLabel?: (row: EntityRow) => string;
		/** The right of the tile's metadata line: a path, or a resolved column so it renders by type. */
		secondaryField?: FieldSpec | null;
		/** The caller's own text on the right of the metadata line. Wins over `secondaryField`. */
		secondary?: (row: EntityRow) => string;
		/** Show the row's `code` beside the name when the two differ. */
		showCode?: boolean;
		/** `Status` rows by code, for the badge (probe 010). Read through the context when not given. */
		statuses?: Record<string, StatusRecord> | null;
		size?: EntityGridSize;
		density?: EntityGridDensity;
		selectable?: boolean;
		/** The selected rows, two-way. */
		selection?: EntityRef[];
		onSelectionChange?: (rows: EntityRef[]) => void;
		onSelect?: (row: EntityRow) => void;
		/** How a row is keyed, in the DOM and in the selection. Default `Type:id`. */
		getRowId?: RowIdFn;
		/** True for a row the arrows skip and the selection refuses. */
		isRowDisabled?: RowDisabledFn;
		/** The source's sort, two-way, so a SortPicker drops into the header. */
		sort?: SortSpec[];
		onSortChange?: (sort: SortSpec[]) => void;
		/** The source's filter, two-way, so a FilterBar drops into the header. */
		filters?: SourceFilters;
		onFiltersChange?: (filters: SourceFilters) => void;
		/** How the set is walked: a footer with a page number, a load-more row, or the scroller. */
		paging?: PagingMode;
		/** Rows per page offered in the footer. `pages` mode only. */
		pageSizes?: number[];
		/** Height of the scrolling body. In `scroll` mode, reaching its end asks for the next page. */
		maxHeight?: string;
		/** Rows above which the grid is virtualised. */
		virtualizeAfter?: number;
		/** Shown when the read returned nothing. */
		emptyLabel?: string;
		/** The accessible name of the skeletons a read stands behind. */
		loadingLabel?: string;
		/** Shown in place of what the failed read said. */
		errorLabel?: string;
		/** Draws one grid cell. Without it, the row is an EntityCard tile. */
		card?: Snippet<[EntityGridCardContext]>;
		/** Region above the grid. */
		header?: Snippet;
		/** Region below the footer. */
		footer?: Snippet;
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
		density = 'default',
		selectable = false,
		selection = $bindable([]),
		onSelectionChange,
		onSelect,
		getRowId,
		isRowDisabled,
		sort = $bindable(),
		onSortChange,
		filters = $bindable(),
		onFiltersChange,
		paging = 'scroll',
		pageSizes = [25, 50, 100],
		maxHeight = '32rem',
		virtualizeAfter = 100,
		emptyLabel = NO_ROWS_LABEL,
		loadingLabel,
		errorLabel,
		card,
		header,
		footer,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const bound = bindSource({
		source: () => source,
		paging: () => paging,
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
		}
	});
	const snapshot = $derived(bound.snapshot);

	const rows = $derived(snapshot.rows);
	const pager = $derived(describePaging(snapshot));
	/** A page that failed under tiles already loaded, which the bottom line reports. */
	const pageError = $derived(hasFailedPage(snapshot));
	// `false` still draws the media block; a path no row carries is the placeholder.
	const imagePath = $derived(thumbnail === false ? '' : thumbnail);

	const rowId = (row: EntityRow): string => rowIdOf(row, getRowId);
	const disabledAt = (index: number): boolean => {
		const row = rows[index];
		return row === undefined || rowIsDisabled(row, isRowDisabled);
	};


	/** The selection as keys, so a row asks whether it is in it in constant time. */
	const chosenKeys = $derived(new Set((selection ?? []).map(rowKey)));

	function toggle(row: EntityRow): void {
		if (rowIsDisabled(row, isRowDisabled)) return;
		const key = rowKey(row);
		const next = chosenKeys.has(key)
			? (selection ?? []).filter((ref) => rowKey(ref) !== key)
			: [...(selection ?? []), { type: row.type, id: row.id }];
		selection = next;
		onSelectionChange?.(next);
	}

	/* keyboard ------------------------------------------------------------- */

	let listEl = $state<HTMLDivElement | null>(null);
	let cursor = $state(0);
	/** The one tab stop, which never lands on a disabled row. */
	const active = $derived(
		rows.length === 0 ? -1 : firstEnabledIndex(rows.length, Math.min(cursor, rows.length - 1), 1, disabledAt)
	);

	/** How many tiles a row holds, read off the track list `auto-fill` resolved to. */
	function columnCount(): number {
		if (!listEl) return 1;
		const tracks = getComputedStyle(listEl).gridTemplateColumns.split(' ').filter((t) => t.length > 0);
		return Math.max(1, tracks.length);
	}

	function focusTile(index: number): void {
		const next = Math.max(0, Math.min(index, rows.length - 1));
		cursor = next;
		const put = (): void => {
			const el = listEl?.querySelector<HTMLElement>(`[data-index="${next}"]`);
			if (!el) return;
			el.focus({ preventScroll: true });
			el.scrollIntoView({ block: 'nearest' });
		};
		// A tile outside the virtual window has to be drawn before it can take focus.
		if (virtualized) {
			virtualizer.scrollToIndex(Math.floor(next / Math.max(1, cols)));
			requestAnimationFrame(put);
		} else put();
	}

	/** The tile a cursor is waiting on, until the page it asked for lands. */
	let wanted = $state<number | null>(null);

	/** Ask for the next page and hold the cursor where it is until those tiles arrive. */
	function askForPage(to: number): boolean {
		if (!loadsOnArrowDown(snapshot, paging, to)) return false;
		wanted = to;
		void source.loadMore();
		return true;
	}

	$effect(() => {
		const held = wanted;
		if (held === null) return;
		if (snapshot.status === 'error') wanted = null;
		else if (rows.length > held) {
			wanted = null;
			untrack(() => focusTile(held));
		}
	});

	function onKeydown(event: KeyboardEvent): void {
		const target = event.target as HTMLElement | null;
		// Chrome inside a tile, the checkbox, keeps its own keys.
		if (!target || target !== target.closest('[data-index]')) return;
		const index = Number(target.dataset['index']);
		if (!Number.isInteger(index)) return;
		const row = rows[index];
		const step = columnCount();
		switch (event.key) {
			case 'ArrowRight':
				if (!askForPage(index + 1)) focusTile(nextEnabledIndex(rows.length, index, 1, disabledAt));
				break;
			case 'ArrowLeft':
				focusTile(nextEnabledIndex(rows.length, index, -1, disabledAt));
				break;
			case 'ArrowDown':
				if (!askForPage(index + step)) focusTile(nextEnabledIndex(rows.length, index, step, disabledAt));
				break;
			case 'ArrowUp':
				focusTile(nextEnabledIndex(rows.length, index, -step, disabledAt));
				break;
			case 'Home':
				focusTile(firstEnabledIndex(rows.length, 0, 1, disabledAt));
				break;
			case 'End':
				focusTile(firstEnabledIndex(rows.length, rows.length - 1, -1, disabledAt));
				break;
			case ' ':
				if (selectable && row) toggle(row);
				break;
			case 'Enter':
				if (row && !disabledAt(index)) onSelect?.(row);
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

	let scrollEl = $state<HTMLDivElement | null>(null);
	let sentinel = $state<HTMLDivElement | null>(null);

	/* virtual rows --------------------------------------------------------- */

	/** Tiles across, so a virtualised grid walks rows of tiles and not tiles. */
	let cols = $state(1);
	// The virtualizer notifies from inside an effect, so the counter it bumps is written
	// and never read there.
	let tickCount = 0;
	let ticks = $state(0);
	const virtualized = $derived(rows.length > virtualizeAfter);
	const lineHeight = $derived(TILE_HEIGHT[size] + GAP_PX[density]);

	function bump(): void {
		tickCount += 1;
		ticks = tickCount;
	}

	const virtualizer = new Virtualizer<HTMLDivElement, HTMLDivElement>({
		count: 0,
		getScrollElement: () => scrollEl,
		estimateSize: () => lineHeight,
		overscan: 4,
		observeElementRect,
		observeElementOffset,
		scrollToFn: elementScroll,
		onChange: bump
	});

	$effect(() => virtualizer._didMount());
	$effect(() => {
		const list = listEl;
		if (!list) return;
		const measure = (): void => {
			cols = Math.max(
				1,
				getComputedStyle(list).gridTemplateColumns.split(' ').filter((track) => track.length > 0).length
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(list);
		return () => observer.disconnect();
	});
	$effect(() => {
		// Read every dependency before the call, so the effect tracks the counts and the
		// height and not the tick the virtualizer's own notification writes.
		const count = virtualized ? Math.ceil(rows.length / Math.max(1, cols)) : 0;
		const size_ = lineHeight;
		const element = scrollEl;
		virtualizer.setOptions({
			count,
			getScrollElement: () => element,
			estimateSize: () => size_,
			overscan: 4,
			observeElementRect,
			observeElementOffset,
			scrollToFn: elementScroll,
			onChange: bump
		});
		virtualizer._willUpdate();
		virtualizer.measure();
	});

	/** The rows on screen, with the space the ones above and below take. */
	const window_ = $derived.by(() => {
		void ticks;
		if (!virtualized) return { before: 0, after: 0, from: 0, slice: rows };
		const items = virtualizer.getVirtualItems();
		const first = items[0];
		const last = items[items.length - 1];
		const across = Math.max(1, cols);
		if (!first || !last) return { before: 0, after: 0, from: 0, slice: rows.slice(0, across * 4) };
		return {
			before: first.start,
			after: virtualizer.getTotalSize() - last.end,
			from: first.index * across,
			slice: rows.slice(first.index * across, (last.index + 1) * across)
		};
	});

	/* scroll paging -------------------------------------------------------- */

	$effect(() => {
		// The virtualiser walks lines of tiles, so the row the viewport ends on is the
		// last tile of the last line it drew.
		void ticks;
		if (!virtualized || paging !== 'scroll') return;
		const items = virtualizer.getVirtualItems();
		const last = items[items.length - 1];
		if (!last) return;
		const lastVisible = (last.index + 1) * Math.max(1, cols) - 1;
		if (shouldLoadNext(snapshot, { paging, lastVisible })) void source.loadMore();
	});

	$effect(() => {
		// A grid short enough not to be virtualised has no range to read, so the last line
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

	const loadingText = $derived(stateLine('loading', { loadingLabel }));
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

	`paging` says how the set is walked, and the source follows it. In `scroll` reaching
	the end of the body asks for the next page, in `more` a row under the tiles does, and
	paging stops on a short page, never on a missing `links.next`, which the API emits
	forever (006_pagination). In `pages` the footer walks the set with an explicit page
	number and reads "n to m of N" once `_summarize` has counted it (020_summarize). A
	page that fails leaves its tiles and says why at the bottom, with a retry.
-->
<div bind:this={ref} data-slot="entity-grid" class={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
	{#if header}
		<div data-slot="entity-grid-header" class="flex w-full min-w-0 flex-wrap items-center gap-2">
			{@render header()}
		</div>
	{/if}

	<div
		bind:this={scrollEl}
		data-slot="entity-grid-scroll"
		style="max-height:{maxHeight}"
		class="border-border flex w-full flex-col gap-3 overflow-auto rounded-lg border p-3"
	>
		{#if snapshot.status === 'error' && !pageError}
			<StateLine
				state="error"
				pad="table"
				icon={CircleAlert}
				label={stateLine('error', { errorLabel }, snapshot.error?.message)}
			/>
		{:else if snapshot.status === 'loading'}
			<div
				aria-busy="true"
				aria-label={loadingText}
				class={cn('grid', GAP[density])}
				style="grid-template-columns:repeat(auto-fill,minmax({TILE[size]}px,1fr))"
			>
				{#each { length: 8 } as _, index (index)}
					<div class="flex flex-col gap-2">
						<Skeleton class="aspect-video w-full" />
						<Skeleton class="h-4 w-3/4" />
						<Skeleton class="h-3 w-1/2" />
					</div>
				{/each}
			</div>
		{:else if rows.length === 0}
			<StateLine state="empty" pad="table" icon={Inbox} label={emptyLabel} />
		{:else}
			<div
				bind:this={listEl}
				role="listbox"
				aria-multiselectable={selectable ? 'true' : undefined}
				aria-label="Rows"
				tabindex={-1}
				class={cn('grid', GAP[density])}
				style="grid-template-columns:repeat(auto-fill,minmax({TILE[size]}px,1fr))"
				onkeydown={onKeydown}
			>
				{#if window_.before > 0}
					<div aria-hidden="true" style="grid-column:1/-1;height:{window_.before}px"></div>
				{/if}
				{#each window_.slice as row, offset (rowId(row))}
					{@const index = window_.from + offset}
					{@const key = rowId(row)}
					{@const chosen = chosenKeys.has(rowKey(row))}
					{@const disabled = disabledAt(index)}
					{#if card}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							data-slot="entity-grid-card"
							role="option"
							aria-selected={chosen}
							aria-disabled={disabled ? 'true' : undefined}
							data-disabled={disabled ? 'true' : undefined}
							tabindex={index === active ? 0 : -1}
							data-row-key={key}
							data-index={index}
							class={cn('min-w-0 outline-none', disabled && 'pointer-events-none opacity-50 [&_img]:grayscale')}
							onfocusin={() => (cursor = index)}
							onclick={(event) => onTileClick(event, row)}
						>
							{@render card({ row, id: key, index, selected: chosen, disabled, active: index === active })}
						</div>
					{:else}
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
							selected={chosen}
							onSelectedChange={() => toggle(row)}
							role="option"
							aria-selected={chosen}
							aria-disabled={disabled ? 'true' : undefined}
							data-disabled={disabled ? 'true' : undefined}
							tabindex={index === active ? 0 : -1}
							data-row-key={key}
							data-index={index}
							class={disabled ? 'pointer-events-none opacity-50 [&_img]:grayscale' : undefined}
							onfocusin={() => (cursor = index)}
							onclick={(event) => onTileClick(event, row)}
						/>
					{/if}
				{/each}
				{#if window_.after > 0}
					<div aria-hidden="true" style="grid-column:1/-1;height:{window_.after}px"></div>
				{/if}
			</div>
			{#if pageError}
				<StateLine
					state="error"
					slotName="entity-grid-page-error"
					pad="none"
					icon={CircleAlert}
					label={stateLine('error', { errorLabel }, snapshot.error?.message)}
				>
					<Button variant="outline" size="sm" onclick={() => bound.retry()}>Retry</Button>
				</StateLine>
			{:else if snapshot.status === 'loadingMore'}
				<div data-slot="entity-grid-loading" aria-busy="true" aria-label={loadingText}>
					<Skeleton class="h-4 w-full" />
				</div>
			{:else if paging === 'more' && snapshot.hasMore}
				<div data-slot="entity-grid-load-more" class="flex justify-center">
					<Button variant="outline" size="sm" onclick={() => void source.loadMore()}>Load more</Button>
				</div>
			{:else if paging === 'scroll' && snapshot.hasMore}
				<div bind:this={sentinel} data-slot="entity-grid-sentinel" aria-hidden="true" class="h-4"></div>
			{/if}
		{/if}
	</div>

	<CollectionFooter
		{source}
		{pager}
		{pageSizes}
		loading={snapshot.status === 'loading'}
		slotName="entity-grid"
	/>

	{#if footer}
		<div data-slot="entity-grid-footer-region" class="flex w-full min-w-0 flex-wrap items-center gap-2">
			{@render footer()}
		</div>
	{/if}
</div>
