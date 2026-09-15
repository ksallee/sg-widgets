<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import ProjectPicker from '$lib/registry/components/project-picker.svelte';
	import { createDemoContext } from '../_shared/client';

	const context = createDemoContext();

	let one = $state<EntityRef | null>(null);
	let archived = $state<EntityRef | null>(null);
	// A bare reference: type and id, no name. Resolved on mount.
	let bare = $state<EntityRef | null>({ type: 'Project', id: context.projectFor(71) });
	// The name is the mock's. A live project arrives bare and the picker resolves it.
	const preset: EntityRef = context.live
		? { type: 'Project', id: context.projectId }
		: { type: 'Project', id: context.projectId, name: 'Blue Moon Rising' };
	const SIZES = [
		{ size: 'sm', caption: 'Small' },
		{ size: 'md', caption: 'Medium, the default' },
		{ size: 'lg', caption: 'Large' }
	] as const;

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	// One control per row, full width of the pane, its caption on the line above.
	const field = 'flex w-full flex-col gap-2';
	const stack = 'flex flex-col gap-4';
	const caption = 'text-muted-foreground text-xs';
</script>

<div class="flex flex-col gap-3">
	<section class={group} data-demo-case="single">
		<h4 class={label}>One project</h4>
		<div class={field}>
			<span class={caption}>One project, clearable</span>
			<ProjectPicker {context} bind:value={one} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="archived">
		<h4 class={label}>Archived projects included</h4>
		<div class={field}>
			<span class={caption}>Archived projects included</span>
			<ProjectPicker {context} includeArchived bind:value={archived} />
		</div>
	</section>

	<section class={group} data-demo-case="hydrate">
		<h4 class={label}>Bare reference, resolved on mount</h4>
		<div class={field}>
			<span class={caption}>Type and id in, name resolved on mount</span>
			<ProjectPicker {context} bind:value={bare} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="states">
		<h4 class={label}>Sizes, then disabled, read-only, invalid</h4>
		<div class={stack}>
			{#each SIZES as { size, caption: sizeCaption } (size)}
				<div class={field}>
					<span class={caption}>{sizeCaption}</span>
					<ProjectPicker {context} value={preset} {size} />
				</div>
			{/each}
			<div class={field}>
				<span class={caption}>Disabled</span>
				<ProjectPicker {context} value={preset} disabled />
			</div>
			<div class={field}>
				<span class={caption}>Read-only</span>
				<ProjectPicker {context} value={preset} readonly />
			</div>
			<div class={field}>
				<span class={caption}>Invalid</span>
				<ProjectPicker {context} value={preset} invalid />
			</div>
		</div>
	</section>
</div>
