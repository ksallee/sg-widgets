<script lang="ts">
	import type { EntityRef } from 'sg-widgets-core';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import { createDemoContext } from '../_shared/client';

	const context = createDemoContext();

	/** A site to address rows on, so the link variant has somewhere to go. */
	const DEMO_SITE = context.siteUrl || 'https://demo.shotgunstudio.com';
	/** Three paths for the hover card, one of them dotted through a link with several valid types. */
	const PREVIEW = ['sg_status_list', 'user', 'entity.Shot.sg_sequence'];

	/** Types the glyph map covers, plus one it does not. */
	const TYPES = [
		'Shot',
		'Asset',
		'Sequence',
		'Version',
		'Task',
		'HumanUser',
		'Project',
		'Note',
		'PublishedFile',
		'CustomEntity07'
	];

	async function loadShots() {
		const shots = await context.client.search('Shot', { fields: ['code', 'image'], page: { size: 3 } });
		return shots.data.map((row) => ({
			entity: { type: row.type, id: row.id, name: String(row.attributes['code'] ?? '') },
			thumbnail: (row.attributes['image'] as string | null) ?? null
		}));
	}

	async function loadVersions() {
		const versions = await context.client.search('Version', { fields: ['code'], page: { size: 3 } });
		return versions.data.map((row) => ({
			type: row.type,
			id: row.id,
			name: String(row.attributes['code'] ?? '')
		}));
	}

	const shots = loadShots();
	const versions = loadVersions();
	let removed = $state<string[]>([]);

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const row = 'flex flex-wrap items-center gap-2';

	const removable: EntityRef[] = [
		{ type: 'Asset', id: 1226, name: 'charAda' },
		{ type: 'Asset', id: 1227, name: 'charBabbage' },
		{ type: 'Asset', id: 1228, name: 'envForest' }
	];
	const shown = $derived(removable.filter((e) => !removed.includes(`${e.type}:${e.id}`)));
</script>

<div class="flex flex-col gap-4">
	<section class={group}>
		<h4 class={label}>Sizes</h4>
		<div class={row}>
			<EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} size="sm" />
			<EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} size="md" />
			<EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} size="lg" />
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Variants</h4>
		<div class={row}>
			<EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} variant="chip" />
			<EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} variant="link" />
			<EntityChip entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }} variant="text" />
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Linked to a site</h4>
		<div class={row}>
			<EntityChip
				entity={{ type: 'Shot', id: 862, name: 'sh010_0010' }}
				siteUrl={DEMO_SITE}
				variant="chip"
			/>
			<EntityChip
				entity={{ type: 'Task', id: 5700, name: 'FX' }}
				siteUrl={DEMO_SITE}
				variant="link"
			/>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Hover card</h4>
		{#await versions}
			<p class="text-muted-foreground text-sm">Loading versions…</p>
		{:then entities}
			<div class={row}>
				{#each entities as entity (entity.id)}
					<EntityChip {entity} preview={PREVIEW} {context} siteUrl={DEMO_SITE} />
				{/each}
			</div>
		{:catch error}
			<p class="text-destructive text-sm">{error.message}</p>
		{/await}
	</section>

	<section class={group}>
		<h4 class={label}>Type glyphs</h4>
		<div class={row}>
			{#each TYPES as type (type)}
				<EntityChip entity={{ type, id: 1, name: type }} size="sm" />
			{/each}
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>With a thumbnail</h4>
		{#await shots}
			<p class="text-muted-foreground text-sm">Loading shots…</p>
		{:then chips}
			<div class={row}>
				{#each chips as chip (chip.entity.id)}
					<EntityChip entity={chip.entity} thumbnail={chip.thumbnail} />
				{/each}
			</div>
		{:catch error}
			<p class="text-destructive text-sm">{error.message}</p>
		{/await}
	</section>

	<section class={group}>
		<h4 class={label}>No name, link, button</h4>
		<div class={row}>
			<EntityChip entity={{ type: 'Version', id: 17055 }} />
			<EntityChip entity={{ type: 'Task', id: 5700, name: 'FX' }} href="#entity-chip" />
			<EntityChip
				entity={{ type: 'HumanUser', id: 20, name: 'Ada Lovelace' }}
				onclick={() => {}}
			/>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Removable</h4>
		<div class={row}>
			{#each shown as entity (entity.id)}
				<EntityChip
					{entity}
					removable
					onRemove={(e) => (removed = [...removed, `${e.type}:${e.id}`])}
				/>
			{/each}
			{#if shown.length === 0}
				<button
					type="button"
					class="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
					onclick={() => (removed = [])}
				>
					Put them back
				</button>
			{/if}
		</div>
	</section>
</div>
