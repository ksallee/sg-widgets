<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import ProjectPicker from '$lib/registry/components/project-picker.svelte';
	import ProjectMultiPicker from '$lib/registry/components/project-multi-picker.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	let one = $state<EntityRef | null>(null);
	let several = $state<EntityRef[]>([]);
	let archived = $state<EntityRef | null>(null);
	// A bare reference: type and id, no name. Resolved on mount.
	let bare = $state<EntityRef | null>({ type: 'Project', id: 71 });
	const preset: EntityRef = { type: 'Project', id: 70, name: 'Blue Moon Rising' };

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const field = 'flex max-w-sm flex-col gap-2';
</script>

<div class="flex flex-col gap-4">
	<section class={group} data-demo-case="single">
		<h4 class={label}>One project</h4>
		<div class={field}>
			<ProjectPicker {client} bind:value={one} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="multi">
		<h4 class={label}>Several, with checkbox rows</h4>
		<div class={field}>
			<ProjectMultiPicker {client} bind:value={several} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="archived">
		<h4 class={label}>Archived projects included</h4>
		<div class={field}>
			<ProjectPicker {client} includeArchived bind:value={archived} />
		</div>
	</section>

	<section class={group} data-demo-case="hydrate">
		<h4 class={label}>Bare reference, resolved on mount</h4>
		<div class={field}>
			<ProjectPicker {client} bind:value={bare} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="states">
		<h4 class={label}>Sizes, then disabled, read-only, invalid</h4>
		<div class="flex flex-col gap-2">
			{#each ['sm', 'md', 'lg'] as const as size (size)}
				<div class={field}><ProjectPicker {client} value={preset} {size} /></div>
			{/each}
			<div class={field}><ProjectPicker {client} value={preset} disabled /></div>
			<div class={field}><ProjectPicker {client} value={preset} readonly /></div>
			<div class={field}><ProjectPicker {client} value={preset} invalid /></div>
		</div>
	</section>
</div>
