<script lang="ts">
	import type { FilterGroup } from '@sg-widgets/core';
	import { condition, group, toApi3Hash } from '@sg-widgets/core';
	import FilterEditor from '$lib/registry/components/filter-editor.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	/** A tree a person would build: one condition, then a nested any-of. */
	let value = $state<FilterGroup>(
		group('and', [
			condition('sg_status_list', 'in', ['rev', 'vwd']),
			condition('client_approved', 'is', true),
			group('or', [
				condition('code', 'contains', 'comp'),
				condition('created_at', 'in_last', [30, 'DAY'])
			])
		])
	);

	const hash = $derived(toApi3Hash(value));
</script>

<div class="flex flex-col gap-4">
	<FilterEditor entityType="Version" {client} bind:value hidePaths={['sg_task']} />

	<section class="flex flex-col gap-2">
		<h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">api3_hash</h4>
		<pre
			data-testid="filter-json"
			class="border-border bg-muted text-foreground max-h-64 overflow-auto rounded-lg border p-3 font-mono text-xs">{JSON.stringify(
				hash,
				null,
				2
			)}</pre>
	</section>
</div>
