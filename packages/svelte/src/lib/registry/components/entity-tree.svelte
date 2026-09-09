<script lang="ts" module>
	import type { EntityRef, HierarchyNode, HierarchyRef } from '@sg-widgets/core';

	/** One loaded node, plus where it sits and what it knows about its children. */
	export interface TreeNode {
		path: string;
		label: string;
		ref: HierarchyRef;
		hasChildren: boolean;
		/** Paths of the level below, once it has been read. */
		childPaths: string[];
		level: number;
	}

	function toNode(raw: HierarchyNode, level: number): TreeNode {
		return {
			path: raw.path,
			label: raw.label,
			ref: raw.ref,
			hasChildren: raw.hasChildren,
			childPaths: raw.children.map((child) => child.path),
			level
		};
	}
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { SgClient } from '@sg-widgets/core';
	import { hierarchyEntity } from '@sg-widgets/core';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Loader from '@lucide/svelte/icons/loader';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
		/** Reads one level per call. Wrap it in a query cache so a reopened node costs nothing. */
		client: SgClient;
		/** Where the tree starts, `/Project/<id>`. */
		rootPath: string;
		/** Opens the tree down to this path on mount, one level per call. */
		seedPath?: string | null;
		/** Draws a checkbox per node and reports the checked rows. */
		checkable?: boolean;
		oncheckedchange?: (rows: EntityRef[]) => void;
		/** A node with nothing under it was chosen. */
		onselect?: (node: TreeNode) => void;
		/** Shows a filter input that narrows the nodes already loaded. */
		filterable?: boolean;
		filterPlaceholder?: string;
		maxHeight?: string;
		emptyLabel?: string;
	};

	let {
		client,
		rootPath,
		seedPath = null,
		checkable = false,
		oncheckedchange,
		onselect,
		filterable = false,
		filterPlaceholder = 'Filter loaded nodes',
		maxHeight = '24rem',
		emptyLabel = 'Nothing under this project',
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	let nodes = $state<Record<string, TreeNode>>({});
	let expanded = $state<Record<string, boolean>>({});
	let busy = $state<Record<string, boolean>>({});
	let checked = $state<Record<string, boolean>>({});
	let cursor = $state<string | null>(null);
	let error = $state<string | null>(null);
	let filter = $state('');
	let started = false;

	async function read(path: string, level: number): Promise<TreeNode | null> {
		if (busy[path]) return null;
		busy = { ...busy, [path]: true };
		try {
			const answer = await client.hierarchyExpand(path);
			const own = toNode(answer, level);
			const next = { ...nodes, [path]: own };
			for (const child of answer.children) next[child.path] = toNode(child, level + 1);
			nodes = next;
			error = null;
			return own;
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
			return null;
		} finally {
			busy = { ...busy, [path]: false };
		}
	}

	async function open(path: string): Promise<void> {
		const node = nodes[path];
		expanded = { ...expanded, [path]: true };
		// One level per call, and `children` names the next paths (post_hierarchy_expand),
		// so a level already read is never read again.
		if (node && node.childPaths.length === 0 && node.hasChildren) await read(path, node.level);
	}

	function close(path: string): void {
		expanded = { ...expanded, [path]: false };
	}

	async function seed(): Promise<void> {
		const root = await read(rootPath, 0);
		if (!root) return;
		cursor = rootPath;
		expanded = { ...expanded, [rootPath]: true };
		if (!seedPath || seedPath === rootPath) return;
		// The path shape is the site's own navigation configuration, not a fixed hierarchy
		// (post_hierarchy_search), so the walk follows whichever child is a prefix of the seed.
		let here = root;
		for (let depth = 0; depth < 12; depth += 1) {
			const child: string | undefined = here.childPaths.find((p) => seedPath === p || seedPath.startsWith(`${p}/`));
			if (!child) return;
			expanded = { ...expanded, [child]: true };
			cursor = child;
			if (child === seedPath) return;
			const loaded = await read(child, here.level + 1);
			if (!loaded) return;
			here = loaded;
		}
	}

	$effect(() => {
		if (started) return;
		started = true;
		void seed();
	});

	$effect(() => {
		const rows: EntityRef[] = [];
		for (const [path, on] of Object.entries(checked)) {
			const entity = on ? hierarchyEntity(nodes[path]?.ref) : null;
			if (entity) rows.push(entity);
		}
		oncheckedchange?.(rows);
	});

	/* the visible list ------------------------------------------------------ */

	const parents = $derived.by(() => {
		const map: Record<string, string> = {};
		for (const node of Object.values(nodes)) for (const child of node.childPaths) map[child] = node.path;
		return map;
	});

	/** Paths kept by the filter: every match, and every ancestor that leads to one. */
	const kept = $derived.by(() => {
		const needle = filter.trim().toLowerCase();
		if (!needle) return null;
		const keep = new Set<string>();
		for (const node of Object.values(nodes)) {
			if (!node.label.toLowerCase().includes(needle)) continue;
			keep.add(node.path);
			let up = parents[node.path];
			while (up) {
				keep.add(up);
				up = parents[up];
			}
		}
		return keep;
	});

	const visible = $derived.by(() => {
		const out: TreeNode[] = [];
		const walk = (path: string): void => {
			const node = nodes[path];
			if (!node) return;
			if (kept && !kept.has(path)) return;
			out.push(node);
			// While filtering, a branch that leads to a match is open whatever its own state.
			if (expanded[path] || kept) for (const child of node.childPaths) walk(child);
		};
		walk(rootPath);
		return out;
	});

	/* keyboard -------------------------------------------------------------- */

	function moveTo(index: number): void {
		const node = visible[Math.max(0, Math.min(index, visible.length - 1))];
		if (node) cursor = node.path;
	}

	function activate(node: TreeNode): void {
		if (node.hasChildren) void (expanded[node.path] ? close(node.path) : open(node.path));
		else onselect?.(node);
	}

	function onKeydown(event: KeyboardEvent): void {
		const index = visible.findIndex((node) => node.path === cursor);
		const node = visible[index];
		if (!node) return;
		switch (event.key) {
			case 'ArrowDown':
				event.preventDefault();
				moveTo(index + 1);
				break;
			case 'ArrowUp':
				event.preventDefault();
				moveTo(index - 1);
				break;
			case 'ArrowRight':
				event.preventDefault();
				if (node.hasChildren && !expanded[node.path]) void open(node.path);
				else moveTo(index + 1);
				break;
			case 'ArrowLeft': {
				event.preventDefault();
				if (node.hasChildren && expanded[node.path]) close(node.path);
				else {
					const up = parents[node.path];
					if (up) cursor = up;
				}
				break;
			}
			case 'Home':
				event.preventDefault();
				moveTo(0);
				break;
			case 'End':
				event.preventDefault();
				moveTo(visible.length - 1);
				break;
			case 'Enter':
			case ' ':
				event.preventDefault();
				activate(node);
				break;
		}
	}

	$effect(() => {
		// The cursor is a roving tabindex, so the focused row follows it.
		const path = cursor;
		if (!path) return;
		queueMicrotask(() => {
			const element = document.querySelector<HTMLElement>(`[data-slot="entity-tree"] [data-path="${CSS.escape(path)}"]`);
			if (element && element.matches(':not(:focus)') && element.closest('[data-slot="entity-tree"]')?.contains(document.activeElement)) {
				element.focus();
			}
		});
	});

	const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';
</script>

<!--
	A project's navigation tree, one level per call.

	`POST /hierarchy/_expand` answers one level: the node, and children carrying a label,
	a ref and whether expanding them is worth it, so walking a project is one call per
	node (post_hierarchy_expand). Which levels a project has is the site's own navigation
	configuration and not a fixed hierarchy - the probed site's Shot path runs through
	the field name `sg_sequence` (post_hierarchy_search) - so `seedPath` is followed by
	taking whichever child is a prefix of it rather than by parsing the path.

	The filter narrows what is already loaded. It never asks the server, so a branch that
	was never opened is not searched.
-->
<div bind:this={ref} data-slot="entity-tree" class={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
	{#if filterable}
		<Input
			type="search"
			bind:value={filter}
			placeholder={filterPlaceholder}
			aria-label={filterPlaceholder}
			data-slot="entity-tree-filter"
		/>
	{/if}

	<div
		data-slot="entity-tree-scroll"
		style="max-height:{maxHeight}"
		class="border-border w-full overflow-auto rounded-md border p-1"
	>
		{#if error}
			<p class={cn(stateClass, 'text-destructive')}>
				<CircleAlert aria-hidden="true" class="size-4 shrink-0" />
				{error}
			</p>
		{:else if visible.length === 0 && busy[rootPath]}
			<div class="flex flex-col gap-2 p-1">
				{#each { length: 5 } as _, index (index)}
					<Skeleton class="h-6 w-full" />
				{/each}
			</div>
		{:else if visible.length === 0}
			<p class={stateClass}>
				<Inbox aria-hidden="true" class="size-4 shrink-0" />
				{emptyLabel}
			</p>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
			<ul role="tree" aria-label="Project hierarchy" onkeydown={onKeydown} class="flex flex-col">
				{#each visible as node (node.path)}
					{@const entity = hierarchyEntity(node.ref)}
					<li role="none" class="flex items-center gap-1.5" style="padding-left:{node.level * 16}px">
						{#if checkable}
							<Checkbox
								aria-label="Select {node.label}"
								checked={checked[node.path] === true}
								onCheckedChange={() => (checked = { ...checked, [node.path]: !checked[node.path] })}
								class="shrink-0"
							/>
						{/if}
						<!-- The tree's keyboard model lives on the `tree` element, which owns the roving focus. -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							role="treeitem"
							data-path={node.path}
							aria-level={node.level + 1}
							aria-expanded={node.hasChildren ? expanded[node.path] === true : undefined}
							aria-selected={cursor === node.path}
							tabindex={cursor === node.path ? 0 : -1}
							onclick={() => {
								cursor = node.path;
								activate(node);
							}}
							class={cn(
								'focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 flex-1 cursor-default items-center gap-1.5 rounded-md px-2 py-1.5 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
								cursor === node.path ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
							)}
						>
							{#if node.hasChildren}
								{#if busy[node.path]}
									<Loader aria-hidden="true" class="size-4 shrink-0 motion-safe:animate-spin" />
								{:else}
									<ChevronRight
										aria-hidden="true"
										class={cn(
											'size-4 shrink-0 transition-transform duration-150 ease-out',
											expanded[node.path] && 'rotate-90'
										)}
									/>
								{/if}
							{:else}
								<span aria-hidden="true" class="size-4 shrink-0"></span>
							{/if}
							{#if entity}
								<EntityChip entity={{ ...entity, name: node.label }} size="sm" class="border-none bg-transparent px-0" />
							{:else}
								<span class="truncate" title={node.label}>{node.label}</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
