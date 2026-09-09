<script lang="ts">
	import type { EntityRef, TreeNode } from '@sg-widgets/core';
	import EntityTree from '$lib/registry/components/entity-tree.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoClient } from '../_shared/svelte';

	const context = createDemoContext();
	setDemoClient(context.client);

	const rootPath = `/Project/${context.projectId}`;
	const seedPath = context.live ? null : `${rootPath}/Shot/sg_sequence/Sequence/100/id/862`;
	/** The project whose shots sit under no sequence at all. */
	const looseRoot = `/Project/${context.projectFor(72)}`;
	const searchPlaceholder = context.live ? 'Search' : 'Search, e.g. sh020_0030';

	let picked = $state<TreeNode | null>(null);
	let checked = $state<EntityRef[]>([]);

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
</script>

<div class="flex w-full min-w-0 flex-col gap-4">
	<section class={group}>
		<h4 class={label}>A project, seeded open, searchable, with checkboxes</h4>
		<EntityTree
			client={context.client}
			{rootPath}
			{seedPath}
			checkable
			searchable
			{searchPlaceholder}
			showCode
			onselect={(node) => (picked = node)}
			oncheckedchange={(rows) => (checked = rows)}
		/>
		<p class="text-muted-foreground text-xs">
			<span data-testid="picked">{picked ? picked.label : 'nothing selected'}</span>
			<span class="tabular-nums" data-testid="checked-count">, {checked.length} checked</span>
		</p>
	</section>

	<section class={group}>
		<h4 class={label}>A project whose shots sit under no sequence</h4>
		<EntityTree client={context.client} rootPath={looseRoot} maxHeight="12rem" data-testid="loose-tree" />
	</section>

	<section class={group}>
		<h4 class={label}>The same tree with thumbnails</h4>
		<EntityTree
			client={context.client}
			{rootPath}
			thumbnail="image"
			subLabelField="description"
			maxHeight="16rem"
			data-testid="thumbnail-tree"
		/>
	</section>
</div>
