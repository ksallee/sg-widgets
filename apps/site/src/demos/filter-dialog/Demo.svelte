<script lang="ts">
	import type { FilterGroup } from '@sg-widgets/core';
	import { condition, emptyFilter, group, toApi3Hash } from '@sg-widgets/core';
	import FilterDialog from '$lib/registry/components/filter-dialog.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoClient } from '../_shared/svelte';
	import VersionResults from '../_shared/version-results.svelte';

	const context = createDemoContext();
	const client = setDemoClient(context.client);

	let empty = $state<FilterGroup>(emptyFilter());
	let applied = $state<FilterGroup>(
		group('and', [
			condition('sg_status_list', 'in', ['rev', 'vwd', 'fin']),
			condition('created_at', 'greater_than', '2025-01-01T00:00:00Z')
		])
	);

	const group_ = 'flex min-w-0 flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
</script>

<div class="flex min-w-0 flex-col gap-4">
	<section class={group_}>
		<h4 class={label}>No filters yet</h4>
		<FilterDialog entityType="Version" {client} bind:value={empty} />
	</section>

	<section class={group_}>
		<h4 class={label}>Two applied</h4>
		<FilterDialog entityType="Version" {client} bind:value={applied} />
		<pre
			data-testid="dialog-json"
			class="border-border bg-muted text-foreground max-h-48 overflow-auto rounded-lg border p-3 font-mono text-xs">{JSON.stringify(
				toApi3Hash(applied),
				null,
				2
			)}</pre>
	</section>

	<VersionResults {context} value={applied} />
</div>
