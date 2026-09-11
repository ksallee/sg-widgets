<script lang="ts">
	import type { CollectionColumn, EntityRef, EntityRow } from '@sg-widgets/core';
	import { cellValue, condition, createEntitySource, displayNameOf, resolveColumns } from '@sg-widgets/core';
	import EntityGrid from '$lib/registry/components/entity-grid.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';
	import { createDemoContext } from '../_shared/client';

	const ARTIST = 'user';
	const FIELDS = ['code', 'image', 'sg_status_list', ARTIST];

	const context = createDemoContext();

	// The mock's rows are one project's already; a real site's are not.
	const filters = context.live
		? condition('project', 'is', { type: 'Project', id: context.projectId })
		: null;

	const source = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: FIELDS,
		filters,
		pageSize: 12
	});

	const short = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: FIELDS,
		filters,
		pageSize: 6
	});

	let size = $state<'sm' | 'md' | 'lg'>('md');
	let selected = $state<EntityRef[]>([]);
	let opened = $state<EntityRow | null>(null);

	/** The demo holds every third card back, to show what a disabled card does. */
	const isRowDisabled = (row: EntityRow): boolean => row.id % 3 === 0;

	async function load(): Promise<CollectionColumn> {
		const [artist] = await resolveColumns(context.schema, 'Version', [ARTIST]);
		void source.count();
		return artist!;
	}

	const toggle =
		'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
		'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
		'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
		'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';
	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
</script>

{#await load()}
	<p class="text-muted-foreground text-sm">Loading the site…</p>
{:then artist}
	<div class="flex w-full min-w-0 flex-col gap-4">
		<section class={group} data-testid="grid-sizes">
			<h4 class={label}>Three sizes</h4>
			<div class="flex flex-wrap items-center gap-2">
				{#each ['sm', 'md', 'lg'] as const as option (option)}
					<button type="button" class={toggle} aria-pressed={size === option} onclick={() => (size = option)}>
						{option}
					</button>
				{/each}
				<span class="text-muted-foreground text-xs" data-testid="opened">
					{opened ? `opened ${opened.type} ${opened.id}` : 'Enter opens a tile'}
				</span>
			</div>
			<EntityGrid
				{source}
				{context}
				secondaryField={artist}
				{size}
				maxHeight="26rem"
				onSelect={(row) => (opened = row)}
			/>
		</section>

		<section class={group} data-testid="grid-selectable">
			<h4 class={label}>Selectable</h4>
			<span class="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
				{selected.length} selected
			</span>
			<EntityGrid
				source={short}
				{context}
				secondaryField={artist}
				size="sm"
				selectable
				maxHeight="18rem"
				onSelectionChange={(rows) => (selected = rows)}
			/>
		</section>

		<section class={group} data-testid="grid-no-image">
			<h4 class={label}>No image</h4>
			<EntityGrid source={short} {context} thumbnail={false} secondaryField={artist} size="sm" maxHeight="18rem" />
		</section>

		<section class={group} data-testid="grid-disabled">
			<h4 class={label}>Every third card disabled</h4>
			<EntityGrid source={short} {context} secondaryField={artist} size="sm" selectable maxHeight="18rem" {isRowDisabled} />
		</section>

		<section class={group} data-testid="grid-card">
			<h4 class={label}>A card of the caller's own</h4>
			<EntityGrid source={short} {context} size="sm" maxHeight="18rem">
				{#snippet card({ row })}
					<article
						class="border-border bg-card flex h-full flex-col gap-2 rounded-md border p-3 transition-colors duration-150 hover:bg-accent/50"
					>
						<Thumbnail src={cellValue(row, 'image') as string | null} alt="" size="lg" class="w-full" />
						<span class="truncate text-sm font-medium" title={displayNameOf(row.attributes, String(row.id))}>
							{displayNameOf(row.attributes, String(row.id))}
						</span>
						<span class="text-muted-foreground font-mono text-xs tabular-nums">{row.type} {row.id}</span>
					</article>
				{/snippet}
			</EntityGrid>
		</section>
	</div>
{:catch error}
	<p class="text-destructive text-sm">{error.message}</p>
{/await}
