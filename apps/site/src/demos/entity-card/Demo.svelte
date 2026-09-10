<script lang="ts">
	import type { EntityRef, EntityRow, WireGroup } from '@sg-widgets/core';
	import { entityCardFields } from '@sg-widgets/core';
	import EntityCard from '$lib/registry/components/entity-card.svelte';
	import EntityPicker from '$lib/registry/components/entity-picker.svelte';
	import { createDemoContext } from '../_shared/client';

	const context = createDemoContext();

	/**
	 * Three paths, the first dotted through a link that accepts several types, so its
	 * label names the type it travels through.
	 */
	const FIELDS = ['entity.Shot.sg_sequence', 'user', 'description'];
	const SIZES = ['sm', 'md', 'lg'] as const;

	// The mock's rows are one project's already; a real site's are not.
	const filters: WireGroup | null = context.live
		? {
				logical_operator: 'and',
				conditions: [['project', 'is', { type: 'Project', id: context.projectId }]]
			}
		: null;

	async function loadRows(): Promise<EntityRow[]> {
		const found = await context.client.search('Version', {
			filters,
			fields: await entityCardFields(context, 'Version', { fields: FIELDS }),
			page: { size: 3 }
		});
		if (found.data.length === 0) throw new Error('The site has no Version to show.');
		return found.data;
	}

	const rows = loadRows();

	let picked = $state<EntityRef | null>(null);
	let selected = $state(false);
	// A pick hands the card type and id only, so the card has to read the row.
	const reference = $derived(picked ? { type: picked.type, id: picked.id } : null);

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const caption = 'text-muted-foreground text-xs';
	const box = 'rounded-lg border p-3';
	const action =
		'inline-flex size-6 items-center justify-center rounded-md border border-border bg-background/80 text-muted-foreground shadow-sm outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
</script>

{#snippet tileActions()}
	<button type="button" class={action} aria-label="More">…</button>
{/snippet}

<div class="flex flex-col gap-4">
	{#await rows}
		<p class="text-muted-foreground text-sm">Loading a version…</p>
	{:then loaded}
		{@const row = loaded[0]!}
		<section class={group}>
			<h4 class={label}>From a row</h4>
			<p class={caption}>The caller already holds the row. The card reads nothing.</p>
			<div class="flex flex-col gap-3">
				{#each SIZES as size (size)}
					<div class={box}>
						<EntityCard {context} {row} fields={FIELDS} {size} />
					</div>
				{/each}
			</div>
		</section>

		<section class={group}>
			<h4 class={label}>From a reference</h4>
			<p class={caption}>Each pick hands the card a type and an id. The card reads the row itself.</p>
			<div class="flex max-w-sm flex-col gap-2">
				<EntityPicker
					client={context.client}
					entityTypes={['Version']}
					projectId={context.live ? context.projectId : undefined}
					placeholder="Search versions…"
					bind:value={picked}
					clearable
				/>
			</div>
			<div class={box}>
				{#if reference}
					<EntityCard {context} entity={reference} fields={FIELDS} />
				{:else}
					<p class="text-muted-foreground text-sm">Pick a version to read one.</p>
				{/if}
			</div>
		</section>

		<section class={group}>
			<h4 class={label}>As a tile</h4>
			<p class={caption}>
				The same row picture first: the status on the thumbnail, the name, then one metadata line.
			</p>
			<div class="grid gap-3" style="grid-template-columns:repeat(auto-fill,minmax(224px,1fr))">
				{#each SIZES as size, index (size)}
					<EntityCard
						{context}
						row={loaded[index % loaded.length]!}
						variant="tile"
						secondaryField="user"
						{size}
					/>
				{/each}
				<EntityCard
					{context}
					{row}
					variant="tile"
					secondaryField="user"
					actions={tileActions}
					selectable
					{selected}
					onSelectedChange={(value) => (selected = value)}
				/>
			</div>
		</section>
	{:catch error}
		<p class="text-destructive text-sm">{error.message}</p>
	{/await}
</div>
