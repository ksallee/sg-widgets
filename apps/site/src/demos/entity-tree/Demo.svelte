<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import EntityTree, { type TreeNode } from '$lib/registry/components/entity-tree.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoClient } from '../_shared/svelte';

	const context = createDemoContext();
	setDemoClient(context.client);

	let picked = $state<TreeNode | null>(null);
	let checked = $state<EntityRef[]>([]);
</script>

<div class="flex w-full min-w-0 flex-col gap-3">
	<EntityTree
		client={context.client}
		rootPath={`/Project/${context.projectId}`}
		seedPath={context.live ? undefined : `/Project/${context.projectId}/Shot/sg_sequence/Sequence/100/id/862`}
		checkable
		filterable
		onselect={(node) => (picked = node)}
		oncheckedchange={(rows) => (checked = rows)}
	/>
	<p class="text-muted-foreground text-xs">
		<span data-testid="picked">{picked ? picked.label : 'nothing selected'}</span>
		<span class="tabular-nums" data-testid="checked-count">, {checked.length} checked</span>
	</p>
</div>
