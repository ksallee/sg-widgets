<script lang="ts">
	import type { FilterGroup } from '@sg-widgets/core';
	import { condition, group, toApi3Hash } from '@sg-widgets/core';
	import FilterEditor from '$lib/registry/components/filter-editor.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	/**
	 * A tree a person would build: a status list on the multi picker, two conditions
	 * reached through links, a duration and a nested any-of. The duration is typed
	 * `1h 30m` or `1:30` and goes out as the 90 minutes it stores.
	 */
	let value = $state<FilterGroup>(
		group('and', [
			condition('sg_status_list', 'in', ['rev', 'vwd']),
			condition('entity.Shot.sg_sequence', 'is', { type: 'Sequence', id: 100, name: 'sh010' }),
			condition('project.Project.sg_status', 'is', 'Active'),
			condition('entity.Shot.sg_working_duration', 'greater_than', 90),
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
