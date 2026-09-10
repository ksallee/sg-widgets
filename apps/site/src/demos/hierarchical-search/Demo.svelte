<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import HierarchicalSearch from '$lib/registry/components/hierarchical-search.svelte';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import { createDemoContext } from '../_shared/client';

	const context = createDemoContext();

	let picked = $state<{ leaf: EntityRef; path: EntityRef[] } | null>(null);
</script>

<div class="flex flex-col gap-4">
	<section class="flex flex-col gap-2">
		<h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
			Scoped to one project
		</h4>
		<HierarchicalSearch
			{context}
			rootPath={`/Project/${context.projectId}`}
			entityTypes={['Shot', 'Asset', 'Sequence', 'Task']}
			onSelect={(leaf, path) => (picked = { leaf, path })}
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
