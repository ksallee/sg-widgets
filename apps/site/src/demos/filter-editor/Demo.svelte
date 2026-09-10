<script lang="ts">
	import type { FilterGroup } from '@sg-widgets/core';
	import { condition, group, toApi3Hash } from '@sg-widgets/core';
	import FilterEditor from '$lib/registry/components/filter-editor.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';
	import VersionResults from '../_shared/version-results.svelte';

	const context = createDemoContext();
	setDemoContext(context);

	/**
	 * A tree a person would build: a status list on the multi picker, two conditions
	 * reached through links, a duration and a nested any-of. The duration is typed
	 * `1h 30m` or `1:30` and goes out as the 90 minutes it stores.
	 *
	 * The link rows name the fixtures' own sequence and project, so a real site gets the
	 * status row alone and the reviewer builds the rest against rows that exist.
	 */
	function initial(live: boolean): FilterGroup {
		const status = condition('sg_status_list', 'in', ['rev', 'vwd', 'fin', 'cmpt', 'apr']);
		if (live) return group('and', [status]);
		return group('and', [
			status,
			condition('entity.Shot.sg_sequence', 'is', { type: 'Sequence', id: 100, name: 'sh010' }),
			condition('project.Project.sg_status', 'is', 'Active'),
			condition('entity.Shot.sg_working_duration', 'greater_than', 90),
			group('or', [
				condition('code', 'contains', 'comp'),
				condition('created_at', 'in_last', [3, 'MONTH']),
				condition('entity.Shot.sg_turnover_date', 'in_next', [2, 'WEEK'])
			])
		]);
	}

	let value = $state<FilterGroup>(initial(context.live));

	const hash = $derived(toApi3Hash(value));
</script>

<div class="flex min-w-0 flex-col gap-4">
	<FilterEditor entityType="Version" {context} bind:value hidePaths={['sg_task']} />

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

	<VersionResults {context} {value} />
</div>
