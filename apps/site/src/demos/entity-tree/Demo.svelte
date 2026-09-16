<script lang="ts">
	import type { EntityRef, TreeNode } from '@sg-widgets/core';
	import EntityTree from '$lib/registry/components/entity-tree.svelte';
	import { CONTROL_BUTTON, type ControlSize } from '$lib/registry/components/control-classes.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';

	const context = createDemoContext();
	setDemoContext(context);

	const SIZES: ControlSize[] = ['sm', 'md', 'lg'];

	const rootPath = `/Project/${context.projectId}`;
	const seedPath = context.live ? null : `${rootPath}/Shot/sg_sequence/Sequence/100/id/862`;
	/** The project whose shots sit under no sequence at all. */
	const looseRoot = `/Project/${context.projectFor(72)}`;
	const searchPlaceholder = context.live ? 'Search' : 'Search, e.g. sh020_0030';

	let picked = $state<TreeNode | null>(null);
	let checked = $state<EntityRef[]>([]);
	let expanded = $state<string[]>([]);

	/** Opening a branch from outside the tree: put its path in `expanded`. */
	function openAssets(): void {
		const path = `${rootPath}/Asset`;
		if (!expanded.includes(path)) expanded = [...expanded, path];
	}

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const toggle =
		'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
		'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
		'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
</script>

<div class="flex w-full min-w-0 flex-col gap-4">
	<section class={group}>
		<h4 class={label}>A project, seeded open, searchable, with checkboxes</h4>
		<div class="flex flex-wrap items-center gap-2">
			<button type="button" class={toggle} data-testid="open-assets" onclick={openAssets}>Open Assets</button>
			<span class="text-muted-foreground text-xs tabular-nums" data-testid="expanded-count">
				{expanded.length} open
			</span>
		</div>
		<EntityTree
			{context}
			{rootPath}
			{seedPath}
			checkable
			searchable
			{searchPlaceholder}
			showCode
			bind:expanded
			onSelect={(node) => (picked = node)}
			onCheckedChange={(rows) => (checked = rows)}
		/>
		<p class="text-muted-foreground text-xs">
			<span data-testid="picked">{picked ? picked.label : 'nothing selected'}</span>
			<span class="tabular-nums" data-testid="checked-count">, {checked.length} checked</span>
		</p>
	</section>

	<section class={group}>
		<h4 class={label}>A project whose shots sit under no sequence</h4>
		<EntityTree {context} rootPath={looseRoot} maxHeight="12rem" data-testid="loose-tree" />
	</section>

	<section class={group}>
		<h4 class={label}>The same tree with thumbnails</h4>
		<EntityTree
			{context}
			{rootPath}
			thumbnail="image"
			subLabelField="description"
			maxHeight="16rem"
			data-testid="thumbnail-tree"
		/>
	</section>

	<section class={group}>
		<h4 class={label}>Sizes, each beside a button of the same step</h4>
		{#each SIZES as size (size)}
			<div class="flex flex-wrap items-start gap-3" data-demo="size-{size}">
				<div class="w-72" data-qa-widget="entity-tree" data-qa-size={size}>
					<EntityTree {context} {rootPath} searchable {size} maxHeight="8rem" />
				</div>
				<Button variant="outline" size={CONTROL_BUTTON[size]}>Button</Button>
			</div>
		{/each}
	</section>
</div>
