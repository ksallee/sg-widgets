<script lang="ts">
	import type { EntityRef, EntityRow, PagingMode } from '@sg-widgets/core';
	import { cellValue, condition, createEntitySource, nextEnabledIndex, stateLine } from '@sg-widgets/core';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import {
		bindCollectionBody,
		COLLECTION_ROOT,
		createCollectionControl
	} from '$lib/registry/components/collection-control.svelte.js';
	import CollectionFooter from '$lib/registry/components/collection-footer.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';
	import { cn } from '$lib/utils.js';
	import { createDemoContext } from '../_shared/client';

	/** A line of this layout is one shot, so the row height is the line height. */
	const ROW_HEIGHT = 37;
	const PAGE_SIZES = [8, 16, 32];
	const SKELETONS = [0, 1, 2, 3, 4];
	const PAGING: Array<{ value: PagingMode; label: string }> = [
		{ value: 'pages', label: 'Pages' },
		{ value: 'more', label: 'Load more' },
		{ value: 'scroll', label: 'Scroll' }
	];

	const context = createDemoContext();

	// The mock's rows are one project's already; a real site's are not.
	const filters = context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null;

	const source = createEntitySource({
		client: context.client,
		entityType: 'Shot',
		fields: ['code', 'sg_status_list'],
		filters,
		mode: 'pages',
		pageSize: 8
	});
	void source.count();

	let paging = $state<PagingMode>('pages');
	let selected = $state<EntityRef[]>([]);

	const control = createCollectionControl({
		source: () => source,
		paging: () => paging,
		selection: {
			get: () => selected,
			set: (next) => (selected = next)
		}
	});

	const body = bindCollectionBody(control, {
		lines: () => control.rows.length,
		measured: () => control.rows.length,
		lineHeight: () => ROW_HEIGHT,
		overscan: 6,
		// One page of shots is short enough to draw whole; the virtualiser idles here.
		virtualizeAfter: () => 200,
		lineOfRow: (index) => index,
		lastRowOfLine: (line) => line,
		cursorTarget: (index) => listEl?.querySelector<HTMLElement>(`[data-index="${index}"]`)
	});

	let listEl = $state<HTMLDivElement | null>(null);

	const rows = $derived(control.rows);
	const snapshot = $derived(control.snapshot);
	const view = $derived(control.view(rows.length));
	const loadingText = $derived(control.loadingText);

	const codeOf = (row: EntityRow): string => String(cellValue(row, 'code') ?? '');
	const statusOf = (row: EntityRow): string => String(cellValue(row, 'sg_status_list') ?? '');

	function onKeydown(event: KeyboardEvent): void {
		const target = event.target as HTMLElement | null;
		if (!target || target !== target.closest('[data-index]')) return;
		const index = Number(target.dataset['index']);
		if (!Number.isInteger(index)) return;
		const row = rows[index];
		switch (event.key) {
			case 'ArrowDown':
				if (!body.askForPage(index + 1)) {
					body.focusRow(nextEnabledIndex(rows.length, index, 1, control.disabledAt));
				}
				break;
			case 'ArrowUp':
				body.focusRow(nextEnabledIndex(rows.length, index, -1, control.disabledAt));
				break;
			case ' ':
				if (row) control.toggle(row);
				break;
			default:
				return;
		}
		event.preventDefault();
	}

	const toggle =
		'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-sm shadow-xs ' +
		'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
		'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
		'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';
	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const head = 'flex min-w-0 items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium';
	const row =
		'flex min-w-0 items-center gap-2 px-3 py-2 text-sm outline-none transition-colors duration-150 ' +
		'hover:bg-accent/50 focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2';
</script>

<div class="flex w-full min-w-0 flex-col gap-4">
	<section class={group} data-demo-case="paging">
		<h4 class={label}>How the set is walked</h4>
		<div class="flex flex-wrap items-center gap-2">
			{#each PAGING as mode (mode.value)}
				<button
					type="button"
					class={toggle}
					aria-pressed={paging === mode.value}
					onclick={() => (paging = mode.value)}
				>
					{mode.label}
				</button>
			{/each}
			<span class="text-muted-foreground text-xs tabular-nums" data-demo="selection">
				{selected.length} selected
			</span>
		</div>
	</section>

	<div data-slot="review-queue" class={COLLECTION_ROOT} data-demo-case="collection">
		<div
			data-slot="review-queue-box"
			class="flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border"
		>
			<div data-slot="review-queue-head" class={head}>
				<Checkbox
					aria-label="Select all loaded rows"
					checked={control.allSelected.all}
					indeterminate={control.allSelected.some && !control.allSelected.all}
					onCheckedChange={(value) => control.toggleAll(value === true)}
					class="shrink-0"
				/>
				<span class="min-w-0 flex-1 truncate">Shot</span>
				<span class="text-muted-foreground shrink-0">Status</span>
			</div>
			<div
				{@attach (el: HTMLDivElement) => {
					body.setScroller(el);
					return () => body.setScroller(null);
				}}
				data-slot="review-queue-scroll"
				class="flex w-full min-w-0 flex-col overflow-auto"
				style="max-height:18rem"
			>
				{#if view === 'error'}
					<StateLine
						state="error"
						pad="table"
						icon={CircleAlert}
						label={stateLine('error', {}, snapshot.error?.message)}
					/>
				{:else if view === 'loading'}
					<div aria-busy="true" aria-label={loadingText} class="flex flex-col">
						{#each SKELETONS as line (line)}
							<div class="flex items-center gap-2 px-3 py-2">
								<Skeleton class="size-4 shrink-0" />
								<Skeleton class="h-4 w-40" />
							</div>
						{/each}
					</div>
				{:else if view === 'empty'}
					<StateLine state="empty" pad="table" icon={Inbox} label="No shots" />
				{:else}
					<div
						bind:this={listEl}
						data-slot="review-queue-rows"
						role="listbox"
						aria-multiselectable="true"
						aria-label="Shots"
						tabindex={-1}
						class="flex flex-col"
						onkeydown={onKeydown}
					>
						{#each rows as entry, index (control.rowId(entry))}
							{@const chosen = control.isSelected(entry)}
							<div
								data-slot="review-queue-row"
								role="option"
								aria-selected={chosen}
								data-row-key={control.rowId(entry)}
								data-index={index}
								tabindex={index === body.active ? 0 : -1}
								class={cn(row, chosen && 'bg-accent text-accent-foreground')}
								onfocus={() => body.setCursor(index)}
							>
								<Checkbox
									aria-label="Select {codeOf(entry)}"
									checked={chosen}
									onCheckedChange={() => control.toggle(entry)}
									class="shrink-0"
								/>
								<span class="min-w-0 flex-1 truncate" title={codeOf(entry)}>{codeOf(entry)}</span>
								<span class="text-muted-foreground shrink-0 text-xs">{statusOf(entry)}</span>
							</div>
						{/each}
					</div>
					{#if control.bottom === 'error'}
						<StateLine
							state="error"
							slotName="review-queue-page-error"
							pad="none"
							icon={CircleAlert}
							label={stateLine('error', {}, snapshot.error?.message)}
						>
							<Button variant="outline" size="sm" onclick={() => control.retry()}>Retry</Button>
						</StateLine>
					{:else if control.bottom === 'loading'}
						<div
							data-slot="review-queue-loading"
							aria-busy="true"
							aria-label={loadingText}
							class="px-3 py-2"
						>
							<Skeleton class="h-4 w-40" />
						</div>
					{:else if control.bottom === 'more'}
						<div data-slot="review-queue-load-more" class="flex justify-center p-2">
							<Button variant="outline" size="sm" onclick={() => void source.loadMore()}>Load more</Button>
						</div>
					{:else if control.bottom === 'sentinel'}
						<div
							{@attach (el: HTMLDivElement) => {
								body.setSentinel(el);
								return () => body.setSentinel(null);
							}}
							data-slot="review-queue-sentinel"
							aria-hidden="true"
							class="h-4"
						></div>
					{/if}
				{/if}
			</div>
		</div>
		<CollectionFooter
			{source}
			pager={control.pager}
			pageSizes={PAGE_SIZES}
			loading={snapshot.status === 'loading'}
			slotName="review-queue"
		/>
	</div>
</div>
