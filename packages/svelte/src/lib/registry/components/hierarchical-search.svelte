<script lang="ts" module>
	import type { EntityRef, HierarchyNode, WireCondition } from '@sg-widgets/core';

	/** Types to search, either bare names or names with a filter each. */
	export type HierarchicalSearchTypes = string[] | Record<string, WireCondition[] | null>;

	/** A row of the list: a path found by searching, or a node of the level being browsed. */
	export interface HierarchicalSearchRow {
		/** The row's own label, the last crumb. */
		label: string;
		/** The crumbs above it, project first when the search answered one. */
		crumbs: string[];
		/** The row itself, when it is an entity rather than a type folder. */
		ref: EntityRef | null;
		/** Every row the path runs through, root first. */
		path: EntityRef[];
		/** The tree path to feed back to `hierarchyExpand`. */
		nodePath: string;
		hasChildren: boolean;
		selectable: boolean;
	}

	/** Leaf types a drill-down usually ends on. */
	export const HIERARCHICAL_SEARCH_TYPES = ['Shot', 'Asset', 'Sequence', 'Task'];

	const DEBOUNCE_MS = 250;
	/** Each hit costs one path lookup, so the search asks for fewer rows than the endpoint allows. */
	const LEAF_LIMIT = 10;

	function typeMap(types: HierarchicalSearchTypes): Record<string, WireCondition[] | null> {
		return Array.isArray(types) ? Object.fromEntries(types.map((t) => [t, null])) : types;
	}

	/** The project a root path names, for scoping the text search that finds the leaves. */
	function projectOf(rootPath: string): number | null {
		const match = /^\/Project\/(\d+)/.exec(rootPath);
		return match ? Number(match[1]) : null;
	}
</script>

<script lang="ts">
	import type { SgClient } from '@sg-widgets/core';
	import {
		breadcrumb,
		createSchemaService,
		hierarchyEntity,
		hydrate,
		matchRuns,
		pathRefs,
		scopeToProject
	} from '@sg-widgets/core';
	import Box from '@lucide/svelte/icons/box';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import Film from '@lucide/svelte/icons/film';
	import Folder from '@lucide/svelte/icons/folder';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import Search from '@lucide/svelte/icons/search';
	import Tag from '@lucide/svelte/icons/tag';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import User from '@lucide/svelte/icons/user';
	import Video from '@lucide/svelte/icons/video';
	import * as Command from '$lib/components/ui/command/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';

	type Props = {
		/** Where rows come from. Wrap it in `createQueryCache` once for the whole app. */
		client: SgClient;
		/** Where the tree starts, `/Project/<id>` for one project or `/` for the site. */
		rootPath?: string;
		/** Types a search may end on. Browsing reaches every level whatever this says. */
		entityTypes?: HierarchicalSearchTypes;
		onselect?: (entity: EntityRef, path: EntityRef[]) => void;
		placeholder?: string;
		class?: string;
	};

	let {
		client,
		rootPath = '/',
		entityTypes = HIERARCHICAL_SEARCH_TYPES,
		onselect,
		placeholder = 'Search the hierarchy…',
		class: className
	}: Props = $props();

	const schema = $derived(createSchemaService(client));

	let query = $state('');
	let rows = $state<HierarchicalSearchRow[]>([]);
	let loading = $state(false);
	let failure = $state<string | null>(null);
	/** Where browsing is, and the labels of every level above it. `$effect` sets it from `rootPath`. */
	let here = $state('/');
	let trail = $state<Array<{ label: string; path: string }>>([]);

	let requestId = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

	const searching = $derived(query.trim().length > 0);
	/**
	 * The row the cursor sits on. cmdk moves it to the first row whenever the list
	 * changes and bits-ui leaves it where it was, so it is set here and the two
	 * frameworks answer Down, Right and Enter the same way.
	 */
	let cursor = $state('');
	const firstRow = $derived(!searching && trail.length > 0 ? 'up' : (rows[0]?.nodePath ?? ''));
	$effect(() => {
		cursor = firstRow;
	});
	const empty = $derived(!loading && failure === null && rows.length === 0);

	const GLYPHS: Record<string, typeof Tag> = {
		Shot: Clapperboard,
		Asset: Box,
		Sequence: Film,
		Version: Video,
		Task: ListChecks,
		HumanUser: User,
		Project: Folder
	};

	function glyphFor(row: HierarchicalSearchRow): typeof Tag {
		if (!row.ref) return Folder;
		return GLYPHS[row.ref.type] ?? Tag;
	}

	function browseRow(node: HierarchyNode, crumbs: string[]): HierarchicalSearchRow {
		const ref = hierarchyEntity(node.ref);
		const allowed = Object.keys(typeMap(entityTypes));
		return {
			label: node.label,
			crumbs,
			ref: ref ? { ...ref, name: node.label } : null,
			path: pathRefs(node.path),
			nodePath: node.path,
			hasChildren: node.hasChildren,
			selectable: ref !== null && allowed.includes(ref.type)
		};
	}

	/** Open one level of the tree. `children` names the next paths (post_hierarchy_expand). */
	async function browse(path: string, crumbs: Array<{ label: string; path: string }>): Promise<void> {
		const id = (requestId += 1);
		loading = true;
		failure = null;
		try {
			const node = await client.hierarchyExpand(path);
			if (id !== requestId) return;
			here = path;
			trail = crumbs;
			rows = node.children.map((child) => browseRow(child, [...crumbs.map((c) => c.label), node.label]));
		} catch (error) {
			if (id !== requestId) return;
			failure = error instanceof Error ? error.message : String(error);
			rows = [];
		} finally {
			if (id === requestId) loading = false;
		}
	}

	/**
	 * Find the leaves, then ask where each one sits. The hierarchy endpoint takes an
	 * entity and answers its path, so the words are matched by `_text_search` first
	 * (post_hierarchy_search).
	 */
	async function search(text: string): Promise<void> {
		const id = (requestId += 1);
		loading = true;
		failure = null;
		try {
			let types = typeMap(entityTypes);
			const projectId = projectOf(rootPath);
			if (projectId !== null) types = await scopeToProject(schema, types, projectId);
			const found = await client.textSearch(text, types, { size: LEAF_LIMIT, number: 1 });
			const hits = await hydrate(client, found);
			const paths = await Promise.all(
				hits.map((hit) =>
					client
						.hierarchySearch(rootPath, hit.ref)
						.then((answers) => answers[0] ?? null)
						.catch(() => null)
				)
			);
			if (id !== requestId) return;
			rows = paths.flatMap((path, i) => {
				const hit = hits[i];
				// A row the tree has no place for under this root is not a result.
				if (!path || !hit) return [];
				const crumbs = breadcrumb(path);
				return [
					{
						label: crumbs[crumbs.length - 1] as string,
						crumbs: crumbs.slice(0, -1),
						ref: { ...hit.ref, name: path.label },
						path: pathRefs(path.incrementalPath),
						nodePath: path.incrementalPath[path.incrementalPath.length - 1] ?? rootPath,
						hasChildren: false,
						selectable: true
					}
				];
			});
		} catch (error) {
			if (id !== requestId) return;
			failure = error instanceof Error ? error.message : String(error);
			rows = [];
		} finally {
			if (id === requestId) loading = false;
		}
	}

	function setQuery(text: string): void {
		query = text;
		clearTimeout(timer);
		// Bumping the id cancels an answer already in flight for the text just replaced.
		requestId += 1;
		rows = [];
		loading = true;
		if (text.trim().length === 0) {
			void browse(here, trail);
			return;
		}
		timer = setTimeout(() => void search(text), DEBOUNCE_MS);
	}

	function drill(row: HierarchicalSearchRow): void {
		if (!row.hasChildren || searching) return;
		void browse(row.nodePath, [...trail, { label: row.label, path: here }]);
	}

	function up(): void {
		if (searching || trail.length === 0) return;
		const parent = trail[trail.length - 1];
		if (!parent) return;
		void browse(parent.path, trail.slice(0, -1));
	}

	function activate(row: HierarchicalSearchRow): void {
		if (row.selectable && row.ref) {
			onselect?.(row.ref, row.path);
			return;
		}
		drill(row);
	}

	/**
	 * Left and Right walk the tree the way Up and Down walk a level. The row under the
	 * cursor is read off the DOM because the command list owns it, and both frameworks
	 * mark it the same way.
	 */
	function onKeydown(event: KeyboardEvent): void {
		if (searching) return;
		if (event.key === 'ArrowLeft' || (event.key === 'Backspace' && query.length === 0)) {
			event.preventDefault();
			up();
			return;
		}
		if (event.key !== 'ArrowRight') return;
		const root = event.currentTarget as HTMLElement | null;
		// cmdk marks an unselected row `data-selected="false"` where bits-ui omits it; `aria-selected` is the same in both.
		const nodePath = root?.querySelector('[data-slot="command-item"][aria-selected="true"]')?.getAttribute('data-node-path');
		const item = rows.find((r) => r.nodePath === nodePath);
		if (!item?.hasChildren) return;
		event.preventDefault();
		drill(item);
	}

	$effect(() => {
		void browse(rootPath, []);
	});
</script>

<!--
	Drill down to one row, by browsing the navigation tree or by searching it.

	Browsing is `hierarchy/_expand`, one call a level: `children` names the next paths
	and `hasChildren` says which are worth opening. Searching cannot go through the
	same endpoint, because `hierarchy/_search` takes an entity and answers where it
	sits rather than matching words (post_hierarchy_search). So the words go to
	`_text_search` and each hit is then asked for its path, which is what makes a
	result a breadcrumb. The path runs through field names such as `sg_sequence`,
	because the tree follows the site's own navigation configuration.
-->
<div data-slot="hierarchical-search" class={cn('w-full', className)}>
	<!-- Server-side matching only, so the list never filters what came back. -->
	<Command.Root shouldFilter={false} bind:value={cursor} class="border-border rounded-md border" onkeydown={onKeydown}>
		<Command.Input value={query} {placeholder} oninput={(e) => setQuery(e.currentTarget.value)} />
		<Command.List data-sg-search-list>
			{#if failure !== null}
				<div
					data-slot="search-error"
					class="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-sm"
				>
					<TriangleAlert aria-hidden="true" class="size-4" />
					<span class="truncate">{failure}</span>
				</div>
			{:else if loading && rows.length === 0}
				<div data-slot="search-loading" class="flex flex-col gap-2 p-1" aria-busy="true">
					{#each [0, 1, 2] as line (line)}
						<div class="flex items-center gap-2 px-2 py-1.5">
							<Skeleton class="size-6 shrink-0" />
							<div class="flex min-w-0 flex-1 flex-col gap-1">
								<Skeleton class="h-3 w-1/2" />
								<Skeleton class="h-2.5 w-1/4" />
							</div>
						</div>
					{/each}
				</div>
			{:else if empty}
				<div
					data-slot="search-empty"
					class="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-sm"
				>
					<Search aria-hidden="true" class="size-4" />
					<span>{searching ? 'Nothing matches every word' : 'Nothing below this level'}</span>
				</div>
			{:else}
				<Command.Group heading={searching ? 'Results' : trail.map((c) => c.label).join(' › ') || 'Tree'}>
					{#if !searching && trail.length > 0}
						<Command.Item value="up" data-slot="search-up" onSelect={up}>
							<span class="text-muted-foreground flex size-6 shrink-0 items-center justify-center">
								<ChevronRight aria-hidden="true" class="size-4 rotate-180" />
							</span>
							<span class="text-muted-foreground min-w-0 flex-1 truncate text-sm">Back</span>
						</Command.Item>
					{/if}
					{#each rows as item (item.nodePath)}
						{@const Glyph = glyphFor(item)}
						<Command.Item
							value={item.nodePath}
							data-node-path={item.nodePath}
							data-entity-type={item.ref?.type}
							data-entity-id={item.ref?.id}
							data-selectable={item.selectable ? 'true' : 'false'}
							onSelect={() => activate(item)}
						>
							<span class="text-muted-foreground flex size-6 shrink-0 items-center justify-center">
								<Glyph aria-hidden="true" class="size-4" />
							</span>
							<span class="flex min-w-0 flex-1 flex-col">
								<span
									data-slot="search-breadcrumb"
									class="truncate"
									title={[...item.crumbs, item.label].join(' › ')}
								>
									{#each item.crumbs as crumb, i (i)}
										<span class="text-muted-foreground">{crumb}</span>
										<span aria-hidden="true" class="text-muted-foreground">{' › '}</span>
									{/each}
									<span class="font-medium">
										{#each matchRuns(item.label, query) as part, i (i)}
											{#if part.match}<span class="font-semibold">{part.text}</span>{:else}{part.text}{/if}
										{/each}
									</span>
								</span>
								<span class="text-muted-foreground truncate text-xs">
									{item.selectable ? (item.ref?.type ?? '') : 'Group'}
								</span>
							</span>
							{#if item.hasChildren && !searching}
								<button
									type="button"
									data-slot="search-drill"
									aria-label={`Open ${item.label}`}
									class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2"
									onclick={(e) => {
										e.stopPropagation();
										drill(item);
									}}
								>
									<ChevronRight aria-hidden="true" class="size-4" />
								</button>
							{/if}
						</Command.Item>
					{/each}
				</Command.Group>
			{/if}
		</Command.List>
	</Command.Root>
</div>
