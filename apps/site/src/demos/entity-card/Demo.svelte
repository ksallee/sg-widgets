<script lang="ts">
	import type { EntityRow, WireGroup } from '@sg-widgets/core';
	import { entityCardFields } from '@sg-widgets/core';
	import EntityCard from '$lib/registry/components/entity-card.svelte';
	import { createDemoContext } from '../_shared/client';

	const context = createDemoContext();

	/**
	 * Three paths, the first dotted through a link that accepts several types, so its
	 * label names the type it travels through.
	 */
	const FIELDS = ['entity.Shot.sg_sequence', 'user', 'description'];
	const SIZES = ['sm', 'md', 'lg'] as const;

	async function loadRow(): Promise<EntityRow> {
		// The mock's rows are one project's already; a real site's are not.
		const filters: WireGroup | null = context.live
			? {
					logical_operator: 'and',
					conditions: [['project', 'is', { type: 'Project', id: context.projectId }]]
				}
			: null;
		const found = await context.client.search('Version', {
			filters,
			fields: await entityCardFields(context, 'Version', { fields: FIELDS }),
			page: { size: 1 }
		});
		const row = found.data[0];
		if (!row) throw new Error('The site has no Version to show.');
		return row;
	}

	const first = loadRow();

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const box = 'rounded-lg border p-3';
</script>

<div class="flex flex-col gap-4">
	{#await first}
		<p class="text-muted-foreground text-sm">Loading a version…</p>
	{:then row}
		<section class={group}>
			<h4 class={label}>From a row</h4>
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
			<div class="flex flex-col gap-3">
				{#each SIZES as size (size)}
					<div class={box}>
						<EntityCard {context} entity={{ type: row.type, id: row.id }} fields={FIELDS} {size} />
					</div>
				{/each}
			</div>
		</section>
	{:catch error}
		<p class="text-destructive text-sm">{error.message}</p>
	{/await}
</div>
