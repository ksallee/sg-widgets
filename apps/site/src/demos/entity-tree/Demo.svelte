<script lang="ts">
	import type { EntityRef, TreeNode } from '@sg-widgets/core';
	import EntityTree from '$lib/registry/components/entity-tree.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoClient } from '../_shared/svelte';

	const context = createDemoContext();
	setDemoClient(context.client);

	const rootPath = `/Project/${context.projectId}`;
	const seedPath = context.live ? null : `${rootPath}/Shot/sg_sequence/Sequence/100/id/862`;

	let picked = $state<TreeNode | null>(null);
	let checked = $state<EntityRef[]>([]);

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
</script>

<div class="flex w-full min-w-0 flex-col gap-4">
	<section class={group}>
		<h4 class={label}>A project, seeded open, with checkboxes</h4>
		<EntityTree
			client={context.client}
			{rootPath}
			{seedPath}
			checkable
			filterable
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
