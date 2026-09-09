<script lang="ts">
	import type { SortKey } from '@sg-widgets/core';
	import { toSortString } from '@sg-widgets/core';
	import SortPicker from '$lib/registry/components/sort-picker.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	let value = $state<SortKey[]>([
		{ field: 'sg_status_list', direction: 'asc' },
		{ field: 'code', direction: 'desc' }
	]);

	const sort = $derived(toSortString(value));
	const rows = $derived(
		client
			.search('Shot', { fields: ['code', 'sg_status_list'], sort, page: { size: 6 } })
			.then((result) => result.data)
	);
</script>

<div class="flex flex-col gap-4">
	<SortPicker entityType="Shot" {client} bind:value />

	<section class="flex flex-col gap-2">
		<h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">sort</h4>
		<pre
			data-testid="sort-string"
			class="border-border bg-muted text-foreground overflow-auto rounded-lg border p-3 font-mono text-xs">{sort ||
				'(none)'}</pre>
	</section>

	<section class="flex flex-col gap-2">
		<h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">First six shots</h4>
		{#await rows}
			<p class="text-muted-foreground text-sm">Loading shots…</p>
		{:then found}
			<ul class="flex flex-col gap-2">
				{#each found as row (row.id)}
					<li class="flex min-w-0 items-center gap-2 text-sm">
						<span class="min-w-0 flex-1 truncate">{row.attributes['code']}</span>
						<span class="text-muted-foreground font-mono text-xs">{row.attributes['sg_status_list']}</span>
					</li>
				{/each}
			</ul>
		{:catch error}
			<p class="text-destructive text-sm">{error.message}</p>
		{/await}
	</section>
</div>
