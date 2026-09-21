<script lang="ts">
	import type { FilterGroup } from 'sg-widgets-core';
	import { condition, emptyFilter, group, toApi3Hash } from 'sg-widgets-core';
	import { Button } from '$lib/components/ui/button/index.js';
	import FilterDialog, { type FilterDialogSize } from '$lib/registry/components/filter-dialog.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';
	import VersionResults from '../_shared/version-results.svelte';

	const context = createDemoContext();
	setDemoContext(context);

	let empty = $state<FilterGroup>(emptyFilter());
	let applied = $state<FilterGroup>(
		group('and', [
			condition('sg_status_list', 'in', ['rev', 'vwd', 'fin']),
			condition('created_at', 'in_last', [1, 'YEAR'])
		])
	);

	/** A Note, whose read-state field evaluates `is` and `is_not` and nothing else. */
	let note = $state<FilterGroup>(group('and', [condition('read_by_current_user', 'is', 'unread')]));
	let sized = $state<Record<FilterDialogSize, FilterGroup>>({ sm: emptyFilter(), md: emptyFilter(), lg: emptyFilter() });

	const SIZES: FilterDialogSize[] = ['sm', 'md', 'lg'];
	const group_ = 'flex min-w-0 flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
</script>

<div class="flex min-w-0 flex-col gap-4">
	<section class={group_}>
		<h4 class={label}>No filters yet, not wired to the table</h4>
		<FilterDialog entityType="Version" {context} bind:value={empty} />
	</section>

	<section class={group_}>
		<h4 class={label}>Two applied, drives the table below</h4>
		<FilterDialog entityType="Version" {context} bind:value={applied} />
		<pre
			data-testid="dialog-json"
			class="border-border bg-muted text-foreground max-h-48 overflow-auto rounded-lg border p-3 font-mono text-xs">{JSON.stringify(
				toApi3Hash(applied),
				null,
				2
			)}</pre>
	</section>

	<VersionResults {context} value={applied} heading="Versions matching the second launcher" />

	<section class={group_} data-demo="note">
		<h4 class={label}>Note, whose read-state field takes is and is not alone</h4>
		<FilterDialog entityType="Note" {context} bind:value={note} />
	</section>

	<section class={group_} data-demo="sizes">
		<h4 class={label}>Sizes, beside a button of the same size</h4>
		<div class="flex min-w-0 flex-col gap-3">
			{#each SIZES as size (size)}
				<div class="flex min-w-0 items-center gap-3" data-qa-widget="filter-dialog" data-qa-size={size}>
					<FilterDialog entityType="Version" {context} {size} bind:value={sized[size]} />
					<Button variant="outline" size={size === 'md' ? 'default' : size}>{size}</Button>
				</div>
			{/each}
		</div>
	</section>
</div>
