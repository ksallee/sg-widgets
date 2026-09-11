<script lang="ts" module>
	import type { EntityRef, FieldSpec, HierarchyNode, PickerRow, WireCondition } from '@sg-widgets/core';

	export type HierarchicalSearchSize = 'sm' | 'md' | 'lg';

	/** A row's leading slot and its glyph, on the leaf ladder of `docs/design-rules.md`. */
	const LEAD: Record<HierarchicalSearchSize, string> = { sm: 'size-5', md: 'size-6', lg: 'size-8' };
	const GLYPH: Record<HierarchicalSearchSize, string> = {
		sm: 'size-3.5',
		md: 'size-4',
		lg: 'size-5'
	};
	const TEXT: Record<HierarchicalSearchSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

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
		/** The fields a search read for the row. Empty on a folder, which is not an entity. */
		values: Record<string, unknown>;
		/** Every row the path runs through, root first. */
		path: EntityRef[];
		/** The tree path to feed back to `hierarchyExpand`. */
		nodePath: string;
		hasChildren: boolean;
		selectable: boolean;
	}

	/** One level of the tree, and the levels above it. */
	interface Level {
		path: string;
		crumbs: Array<{ label: string; path: string }>;
	}

	/** Leaf types a drill-down usually ends on. */
	export const HIERARCHICAL_SEARCH_TYPES = ['Shot', 'Asset', 'Sequence', 'Task'];

</script>

<script lang="ts">
	import type { Component } from 'svelte';
	import { untrack } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { SgContext } from '@sg-widgets/core';
	import {
		breadcrumb,
		hierarchyEntity,
		HIERARCHY_LEAF_LIMIT,
		hydrate,
		NO_MATCH_LABEL,
		NO_ROWS_LABEL,
		pathOf,
		pathRefs,
		projectOfPath,
		rowFields,
		scopeToProject,
		searchTypeMap
	} from '@sg-widgets/core';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import Folder from '@lucide/svelte/icons/folder';
	import * as Command from '$lib/components/ui/command/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { entityGlyph } from '$lib/registry/components/entity-glyphs.js';
	import Row from '$lib/registry/components/picker-row.svelte';
	import SearchControl, { type SearchAnswer, type SearchRequest } from '$lib/registry/components/search-control.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The widget context. Every read goes through it, so widgets on a page share one cache. */
		context: SgContext;
		/** Where the tree starts, `/Project/<id>` for one project or `/` for the site. */
		rootPath?: string;
		/** Types a search may end on. Browsing reaches every level whatever this says. */
		entityTypes?: HierarchicalSearchTypes;
		/** Field holding the thumbnail URL. `false` leaves every row on its type glyph. */
		thumbnail?: string | false;
		/** Field holding the row label. Defaults to the label the tree answers. */
		labelField?: string;
		/** The muted line under the label: a path, or a resolved column. */
		subLabelField?: FieldSpec | null;
		/** The muted line of the caller's own making. Wins over `subLabelField`. */
		subLabel?: (row: HierarchicalSearchRow) => string;
		/** The right-aligned value: a path, or a resolved column so it renders by type. */
		secondaryField?: FieldSpec | null;
		/** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
		secondary?: (row: HierarchicalSearchRow) => string;
		/** Show the row's `code` beside the label when the two differ. */
		showCode?: boolean;
		/** Extra fields to request, so a caller's own sub-label or secondary can read them. */
		fields?: string[];
		onSelect?: (entity: EntityRef, path: EntityRef[]) => void;
		placeholder?: string;
		/** Shown when a level holds nothing. */
		emptyLabel?: string;
		/** Shown when the query matches nothing. */
		noMatchLabel?: string;
		/** The accessible name of the skeletons a read stands behind. */
		loadingLabel?: string;
		/** Shown in place of what the failed read said. */
		errorLabel?: string;
		size?: HierarchicalSearchSize;
		class?: string;
	};

	let {
		context,
		rootPath = '/',
		entityTypes = HIERARCHICAL_SEARCH_TYPES,
		thumbnail = 'image',
		labelField,
		subLabelField = null,
		subLabel,
		secondaryField = null,
		secondary,
		showCode = false,
		fields = [],
		onSelect,
		placeholder = 'Search the hierarchy…',
		emptyLabel = NO_ROWS_LABEL,
		noMatchLabel = NO_MATCH_LABEL,
		loadingLabel,
		errorLabel,
		size = 'md',
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const schema = $derived(context.schema);

	let query = $state('');
	/** The level being browsed, and the levels above it. */
	let level = $state<Level>({ path: untrack(() => rootPath), crumbs: [] });

	const searching = $derived(query.trim().length > 0);
	const trail = $derived(level.crumbs);

	$effect(() => {
		level = { path: rootPath, crumbs: [] };
	});

	/** A level is a folder; a row takes its type's own glyph. */
	function glyphFor(row: HierarchicalSearchRow): Component {
		return row.ref ? entityGlyph(row.ref.type) : Folder;
	}

	/** The row a list entry draws as: the reference it stands for and what a search read. */
	function rowOf(item: HierarchicalSearchRow): PickerRow {
		return {
			type: item.ref?.type ?? '',
			id: item.ref?.id ?? 0,
			name: item.label,
			values: item.values
		};
	}

	/**
	 * The muted line under the label. With no field and no function of the caller's,
	 * it says what the row is: its type, or that it is a level rather than a row.
	 */
	function subLabelOf(item: HierarchicalSearchRow): string | undefined {
		if (subLabel) return subLabel(item);
		if (pathOf(subLabelField)) return undefined;
		return item.selectable ? (item.ref?.type ?? '') : 'Group';
	}

	function browseRow(node: HierarchyNode, crumbs: string[]): HierarchicalSearchRow {
		const ref = hierarchyEntity(node.ref);
		const allowed = Object.keys(searchTypeMap(entityTypes));
		return {
			label: node.label,
			crumbs,
			ref: ref ? { ...ref, name: node.label } : null,
			values: {},
			path: pathRefs(node.path),
			nodePath: node.path,
			hasChildren: node.hasChildren,
			selectable: ref !== null && allowed.includes(ref.type)
		};
	}

	/** Open one level of the tree. `children` names the next paths (post_hierarchy_expand). */
	async function browse(at: Level): Promise<HierarchicalSearchRow[]> {
		const node = await context.client.hierarchyExpand(at.path);
		return node.children.map((child) => browseRow(child, [...at.crumbs.map((c) => c.label), node.label]));
	}

	/**
	 * Find the leaves, then ask where each one sits. The hierarchy endpoint takes an
	 * entity and answers its path, so the words are matched by `_text_search` first
	 * (post_hierarchy_search).
	 */
	async function searchLeaves(text: string): Promise<HierarchicalSearchRow[]> {
		let types = searchTypeMap(entityTypes);
		const projectId = projectOfPath(rootPath);
		if (projectId !== null) types = await scopeToProject(schema, types, projectId);
		const found = await context.client.textSearch(text, types, { size: HIERARCHY_LEAF_LIMIT, number: 1 });
		const hits = await hydrate(context.client, found, {
			fields: rowFields({ thumbnail, labelField, subLabelField, secondaryField, showCode, fields }),
			labelField
		});
		const paths = await Promise.all(
			hits.map((hit) =>
				context.client
					.hierarchySearch(rootPath, hit.ref)
					.then((answers) => answers[0] ?? null)
					.catch(() => null)
			)
		);
		return paths.flatMap((path, i) => {
			const hit = hits[i];
			// A row the tree has no place for under this root is not a result.
			if (!path || !hit) return [];
			const crumbs = breadcrumb(path);
			// The tree's own label names the row, unless the caller named a field.
			const own = (labelField ? hit.ref.name : '') || (crumbs[crumbs.length - 1] as string);
			return [
				{
					label: own,
					crumbs: crumbs.slice(0, -1),
					ref: { ...hit.ref, name: path.label },
					values: hit.values,
					path: pathRefs(path.incrementalPath),
					nodePath: path.incrementalPath[path.incrementalPath.length - 1] ?? rootPath,
					hasChildren: false,
					selectable: true
				}
			];
		});
	}

	async function load({ query: text }: SearchRequest): Promise<SearchAnswer<HierarchicalSearchRow>> {
		if (text.trim().length === 0) return { items: await browse(level) };
		return { items: await searchLeaves(text) };
	}

	function drill(row: HierarchicalSearchRow): void {
		if (!row.hasChildren || searching) return;
		level = { path: row.nodePath, crumbs: [...trail, { label: row.label, path: level.path }] };
	}

	function up(): void {
		if (searching || trail.length === 0) return;
		const parent = trail[trail.length - 1];
		if (!parent) return;
		level = { path: parent.path, crumbs: trail.slice(0, -1) };
	}

	function activate(row: HierarchicalSearchRow): void {
		if (row.selectable && row.ref) {
			onSelect?.(row.ref, row.path);
			return;
		}
		drill(row);
	}

	/**
	 * Left and Right walk the tree the way Up and Down walk a level. The row under the
	 * cursor is read off the DOM because the command list owns it, and both frameworks
	 * mark it the same way.
	 */
	function onKeydown(event: KeyboardEvent, items: HierarchicalSearchRow[]): void {
		if (searching) return;
		if (event.key === 'ArrowLeft' || (event.key === 'Backspace' && query.length === 0)) {
			event.preventDefault();
			up();
			return;
		}
		if (event.key !== 'ArrowRight') return;
		const root = event.currentTarget as HTMLElement | null;
		const nodePath = root
			?.querySelector('[data-slot="command-item"][data-highlighted]')
			?.getAttribute('data-node-path');
		const item = items.find((r) => r.nodePath === nodePath);
		if (!item?.hasChildren) return;
		event.preventDefault();
		drill(item);
	}
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
{#snippet rows({ items }: { items: HierarchicalSearchRow[]; query: string; loading: boolean })}
	<Command.Group heading={searching ? 'Results' : trail.map((c) => c.label).join(' › ') || 'Tree'}>
		{#if !searching && trail.length > 0}
			<Command.Item value="up" data-slot="search-up" onSelect={up}>
				<span class={cn('text-muted-foreground flex shrink-0 items-center justify-center', LEAD[size])}>
					<ChevronRight aria-hidden="true" class={cn('rotate-180', GLYPH[size])} />
				</span>
				<span class={cn('text-muted-foreground min-w-0 flex-1 truncate', TEXT[size])}>Back</span>
			</Command.Item>
		{/if}
		{#each items as item (item.nodePath)}
			{@const Glyph = glyphFor(item)}
			<Command.Item
				value={item.nodePath}
				data-node-path={item.nodePath}
				data-entity-type={item.ref?.type}
				data-entity-id={item.ref?.id}
				data-selectable={item.selectable ? 'true' : 'false'}
				onSelect={() => activate(item)}
			>
				<Row
					row={rowOf(item)}
					{query}
					crumbs={item.crumbs}
					{thumbnail}
					{showCode}
					{subLabelField}
					subLabel={subLabelOf(item)}
					{secondaryField}
					secondary={secondary ? secondary(item) : undefined}
					{size}
					{context}
				>
					{#snippet glyph()}<Glyph aria-hidden="true" class={GLYPH[size]} />{/snippet}
				</Row>
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
						<ChevronRight aria-hidden="true" class={GLYPH[size]} />
					</button>
				{/if}
			</Command.Item>
		{/each}
	</Command.Group>
{/snippet}

<div bind:this={ref} data-slot="hierarchical-search" class={cn('w-full', className)} {...rest}>
	<SearchControl
		{load}
		bind:query
		request={level.path}
		readsEmpty
		commandClass="border-border rounded-lg border"
		onkeydown={onKeydown}
		{placeholder}
		emptyLabel={searching ? noMatchLabel : emptyLabel}
		{loadingLabel}
		{errorLabel}
		skeletonLead={cn('shrink-0', LEAD[size])}
		{rows}
	/>
</div>
