<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import HierarchicalSearch from '$lib/registry/components/hierarchical-search.svelte';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	let picked = $state<{ leaf: EntityRef; path: EntityRef[] } | null>(null);
</script>

<div class="flex flex-col gap-4">
	<section class="flex flex-col gap-2">
		<h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
			Scoped to Blue Moon Rising
		</h4>
		<HierarchicalSearch
			{client}
			rootPath="/Project/70"
			entityTypes={['Shot', 'Asset', 'Sequence', 'Task']}
			onselect={(leaf, path) => (picked = { leaf, path })}
		/>
	</section>

	<div data-demo="picked" class="flex flex-wrap items-center gap-2">
		{#if picked}
			{#each picked.path as step (`${step.type}:${step.id}`)}
				<EntityChip entity={step} size="sm" />
			{/each}
			<span class="text-muted-foreground text-sm">
				leaf {picked.leaf.type} {picked.leaf.id}
			</span>
		{:else}
			<span class="text-muted-foreground text-sm">Nothing selected yet.</span>
		{/if}
	</div>
</div>
