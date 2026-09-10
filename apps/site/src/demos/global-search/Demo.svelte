<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import GlobalSearch from '$lib/registry/components/global-search.svelte';
	import { createDemoContext } from '../_shared/client';

	const context = createDemoContext();

	const TYPES = ['Shot', 'Asset', 'Sequence', 'Task', 'Version', 'HumanUser', 'Project'];

	/* Prefilled so the palette has something to show before a word is typed. */
	let recents = $state<EntityRef[]>([
		{ type: 'Shot', id: 862, name: 'sh010_0010' },
		{ type: 'Asset', id: 1226, name: 'charAda' },
		{ type: 'Project', id: 70, name: 'Blue Moon Rising' }
	]);
	let picked = $state<EntityRef | null>(null);

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
</script>

<div class="flex flex-col gap-4">
	<section class={group}>
		<h4 class={label}>Palette, opened by the trigger or Cmd/Ctrl+K</h4>
		<GlobalSearch
			{context}
			entityTypes={TYPES}
			hotkey
			{recents}
			onRecentsChange={(next) => (recents = next)}
			onSelect={(entity) => (picked = entity)}
			label="Search the site"
		/>
	</section>

	<section class={group}>
		<h4 class={label}>Inline, scoped to one project</h4>
		<GlobalSearch
			{context}
			entityTypes={TYPES}
			projectId={context.projectId}
			inline
			onSelect={(entity) => (picked = entity)}
			placeholder="Search one project…"
		/>
	</section>

	<p data-demo="picked" class="text-muted-foreground text-sm">
		{#if picked}
			Selected <span class="text-foreground font-medium">{picked.type} {picked.id}</span>
			{picked.name}
		{:else}
			Nothing selected yet.
		{/if}
	</p>
</div>
