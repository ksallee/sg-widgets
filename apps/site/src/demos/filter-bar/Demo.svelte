<script lang="ts">
	import type { FilterGroup } from '@sg-widgets/core';
	import { emptyFilter, toApi3Hash } from '@sg-widgets/core';
	import FilterBar from '$lib/registry/components/filter-bar.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	let value = $state<FilterGroup>(emptyFilter());

	// `_search` answers no total, so the demo counts the rows it read. The site has
	// 40 shots, well under one page.
	const matching = $derived(
		client
			.search('Shot', { filters: toApi3Hash(value), fields: ['code'], page: { size: 200 } })
			.then((result) => result.data.length)
	);
</script>

<div class="flex flex-col gap-4">
	<FilterBar
		entityType="Shot"
		{client}
		facets={['sg_status_list', 'sg_sequence', 'sg_shot_type']}
		bind:value
	/>

	<p class="text-muted-foreground text-sm" data-testid="matching">
		{#await matching}
			Counting shots…
		{:then count}
			{count} matching {count === 1 ? 'shot' : 'shots'}
		{:catch error}
			{error.message}
		{/await}
	</p>
</div>
