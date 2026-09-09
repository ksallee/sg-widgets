<script lang="ts">
	import type { FilterGroup } from '@sg-widgets/core';
	import { condition, emptyFilter, group, toApi3Hash } from '@sg-widgets/core';
	import FilterDialog from '$lib/registry/components/filter-dialog.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	let empty = $state<FilterGroup>(emptyFilter());
	let applied = $state<FilterGroup>(
		group('and', [
			condition('sg_status_list', 'in', ['ip', 'fin']),
			condition('sg_turnover_date', 'in_next', [2, 'WEEK'])
		])
	);

	const group_ = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
</script>

<div class="flex flex-col gap-4">
	<section class={group_}>
		<h4 class={label}>No filters yet</h4>
		<FilterDialog entityType="Shot" {client} bind:value={empty} />
	</section>

	<section class={group_}>
		<h4 class={label}>Two applied</h4>
		<FilterDialog entityType="Shot" {client} bind:value={applied} />
		<pre
			data-testid="dialog-json"
			class="border-border bg-muted text-foreground max-h-48 overflow-auto rounded-lg border p-3 font-mono text-xs">{JSON.stringify(
				toApi3Hash(applied),
				null,
				2
			)}</pre>
	</section>
</div>
