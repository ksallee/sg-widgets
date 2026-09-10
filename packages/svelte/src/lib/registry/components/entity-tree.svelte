<script lang="ts" module>
	import type { TreeCheckState } from '@sg-widgets/core';

	export type EntityTreeSize = 'sm' | 'md' | 'lg';
	export type EntityTreeDensity = 'compact' | 'default';

	/** The list-row padding of `docs/design-rules.md`; compact halves the vertical half. */
	const ROW: Record<EntityTreeDensity, string> = { compact: 'px-2 py-1', default: 'px-2 py-1.5' };
	/** A row's text, leading slot and glyphs, on the leaf ladder of `docs/design-rules.md`. */
	const TEXT: Record<EntityTreeSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
	const LEAD: Record<EntityTreeSize, string> = { sm: 'size-5', md: 'size-6', lg: 'size-8' };
	const GLYPH: Record<EntityTreeSize, string> = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' };
	/** A leaf inside a row sits one step down the ladder. */
	const LEAF: Record<EntityTreeSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

	/** `aria-checked` as a tree row spells it: `mixed` for a part-checked branch. */
	function checkedAttr(state: TreeCheckState): 'true' | 'false' | 'mixed' {
		return state === 'mixed' ? 'mixed' : state === 'checked' ? 'true' : 'false';
	}

	const DEBOUNCE_MS = 250;
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityRef, SgClient, TreeFieldPlan, TreeNode, TreeRow } from '@sg-widgets/core';
	import {
		createSchemaService,
		createStatusService,
		createTree,
		hierarchyLoader,
		hierarchySearcher,
		isEmptyValue,
		matchRuns,
		resolveTreeFields,
		TREE_STATUS_FIELDS
	} from '@sg-widgets/core';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Check from '@lucide/svelte/icons/check';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Loader from '@lucide/svelte/icons/loader';
	import Minus from '@lucide/svelte/icons/minus';
	import Search from '@lucide/svelte/icons/search';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
		/** Reads one level per call. Wrap it in a query cache so a reopened node costs nothing. */
		client: SgClient;
		/** Where the tree starts, `/Project/<id>`. */
		rootPath: string;
		/** Opens the tree down to this path on mount, one level per call. */
		seedPath?: string | string[] | null;
		/** Draws a checkbox per node and reports the checked rows. */
		checkable?: boolean;
		selection?: 'none' | 'single' | 'multiple';
		onCheckedChange?: (rows: EntityRef[]) => void;
		onSelect?: (node: TreeNode) => void;
		onError?: (error: Error) => void;
		/** Shows an input that searches the project and opens the tree onto the hits. */
		searchable?: boolean;
		searchPlaceholder?: string;
		/** How many levels a whole-branch expansion opens. */
		expandDepth?: number;
		/** Field holding the thumbnail URL. `false`, the default here, hides the leading slot. */
		thumbnail?: string | false;
		/** Field shown as the row's label. Falls back to the label the tree answers. */
		labelField?: string;
		/** Field shown under the label. */
		subLabelField?: string;
		/** Muted line under the label, of the caller's own making. Wins over `subLabelField`. */
		subLabel?: (node: TreeNode) => string;
		/** Right-aligned field, drawn by its data type through FieldValue. */
		secondaryField?: string;
		/** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
		secondary?: (node: TreeNode) => string;
		/** Show the schema name beside the label on a node that stands for a type. */
		showCode?: boolean;
		/** Extra fields to request, so a caller's own sub-label or secondary can read them. */
		fields?: string[];
		/** The site the status sprite is served from. */
		siteUrl?: string;
		label?: string;
		maxHeight?: string;
		emptyLabel?: string;
		noMatchLabel?: string;
		size?: EntityTreeSize;
		density?: EntityTreeDensity;
	};

	let {
		client,
		rootPath,
		seedPath = null,
		checkable = false,
		selection = 'single',
		onCheckedChange,
		onSelect,
		onError,
		searchable = false,
		searchPlaceholder = 'Search',
		expandDepth = 3,
		thumbnail = false,
		labelField,
		subLabelField,
		subLabel,
		secondaryField,
		secondary,
		showCode = false,
		fields,
		siteUrl,
		label = 'Project hierarchy',
		maxHeight = '24rem',
		emptyLabel = 'Nothing under this project',
		noMatchLabel = 'Nothing matches every word',
		size = 'md',
		density = 'default',
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const schema = $derived(createSchemaService(client));
	const statusTable = $derived(createStatusService(client));

	/** What a level is read under: the status names, the thumbnail and whatever the row shows. */
	const requested = $derived([
		...TREE_STATUS_FIELDS,
		...(thumbnail === false ? [] : [thumbnail]),
		...(labelField ? [labelField] : []),
		...(subLabelField ? [subLabelField] : []),
		...(secondaryField && secondaryField !== 'id' ? [secondaryField] : []),
		...(fields ?? [])
	]);

	const engine = $derived(
		createTree({
			rootPath,
			selection,
			expandDepth,
			loader: hierarchyLoader(client, { fields: requested }),
			searcher: hierarchySearcher(client, rootPath, { schema })
		})
	);

	// svelte-ignore state_referenced_locally
	let snap = $state(engine.snapshot());
	let query = $state('');
	let timer: ReturnType<typeof setTimeout> | undefined;

	$effect(() => {
		const tree = engine;
		snap = tree.snapshot();
		const stop = tree.subscribe(() => (snap = tree.snapshot()));
		void (seedPath ? tree.expandToPath(seedPath) : tree.load());
		return stop;
	});

	$effect(() => {
		if (snap.error) onError?.(snap.error);
	});

	/** The checked set as one string, so the callback fires when it moves and not on every keystroke. */
	const checkedKey = $derived(snap.checked.join('|'));

	$effect(() => {
		void checkedKey;
		onCheckedChange?.(engine.checkedRefs());
	});

	/* what a row draws with -------------------------------------------------- */

	/** The types on show, as one string so the schema read runs when the set changes and not before. */
	const typeKey = $derived(
		[...new Set(snap.rows.map((row) => row.node.entity?.type).filter((t) => t !== undefined))].sort().join(',')
	);

	/**
	 * The status field and the secondary field of every type on show, resolved
	 * through the cached schema service. The read hangs off the props through a
	 * derived and never off an effect with a "last seen" key.
	 */
	function loadPlan(seen: string, name: string | undefined): TreeFieldPlan {
		const plan = $state<TreeFieldPlan>({ status: {}, secondary: {}, statuses: null });
		const types = seen.split(',').filter(Boolean);
		void resolveTreeFields(schema, statusTable, types, name).then((found) => {
			plan.status = found.status;
			plan.secondary = found.secondary;
			plan.statuses = found.statuses;
		}, onError);
		return plan;
	}

	const plan = $derived(loadPlan(typeKey, secondaryField));
	const hasSubLabel = $derived(Boolean(subLabelField || subLabel));
	/** An id is a code, and codes are the mono treatment of `docs/design-rules.md`. */
	const secondaryIsId = $derived(secondaryField === 'id');

	function labelOf(node: TreeNode): string {
		const explicit = labelField ? node.values[labelField] : undefined;
		return typeof explicit === 'string' && explicit.length > 0 ? explicit : node.label;
	}

	/** The schema name a folder stands for, which is the only code a tree row has. */
	function codeOf(node: TreeNode): string {
		return showCode && node.ref.kind === 'entity_type' && typeof node.ref.value === 'string' ? node.ref.value : '';
	}

	function subLabelOf(node: TreeNode): string {
		if (subLabel) return subLabel(node);
		if (!subLabelField) return '';
		const raw = node.values[subLabelField];
		return raw === null || raw === undefined ? '' : String(raw);
	}

	function thumbOf(node: TreeNode): string | null {
		if (thumbnail === false) return null;
		const raw = node.values[thumbnail];
		return typeof raw === 'string' ? raw : null;
	}

	function statusOf(node: TreeNode): string {
		const field = node.entity ? plan.status[node.entity.type] : null;
		const code = field ? node.values[field.name] : null;
		return typeof code === 'string' ? code : '';
	}

	function secondaryValue(node: TreeNode): unknown {
		if (!secondaryField) return null;
		return secondaryField === 'id' ? (node.entity?.id ?? null) : node.values[secondaryField];
	}

	function secondaryType(node: TreeNode): string {
		const field = node.entity ? plan.secondary[node.entity.type] : null;
		return field?.dataType ?? (secondaryIsId ? 'number' : 'text');
	}

	/* searching --------------------------------------------------------------- */

	const searchText = $derived(snap.search.trim());
	const noMatch = $derived(searchText.length > 0 && !snap.searching && snap.matches.length === 0);
	const dimming = $derived(searchText.length > 0 && snap.matches.length > 0);

	function setQuery(text: string): void {
		query = text;
		clearTimeout(timer);
		if (text.trim().length === 0) {
			void engine.search('');
			return;
		}
		timer = setTimeout(() => void engine.search(text), DEBOUNCE_MS);
	}

	function onSearchKeydown(event: KeyboardEvent): void {
		if (event.key !== 'Escape' || query.length === 0) return;
		event.preventDefault();
		event.stopPropagation();
		setQuery('');
	}

	/* interaction ------------------------------------------------------------ */

	/** Alt or Cmd/Ctrl on the chevron opens the whole branch rather than one level. */
	function openBranch(event: MouseEvent, row: TreeRow): void {
		event.stopPropagation();
		engine.focus(row.node.path);
		if (event.altKey || event.metaKey || event.ctrlKey) void engine.expandAll(row.node.path, expandDepth);
		else void engine.toggle(row.node.path);
	}

	function activate(row: TreeRow): void {
		engine.focus(row.node.path);
		if (row.node.hasChildren) void engine.toggle(row.node.path);
		else {
			engine.select(row.node.path);
			onSelect?.(row.node);
		}
	}

	function onKeydown(event: KeyboardEvent): void {
		const path = snap.cursor;
		if (!engine.keyDown(event)) return;
		event.preventDefault();
		if (event.key !== 'Enter' || path === null) return;
		const node = engine.node(path);
		if (node && !node.hasChildren) onSelect?.(node);
	}

	$effect(() => {
		// One tab stop: focus follows the cursor while the tree already holds it.
		const path = snap.cursor;
		const root = ref;
		if (!path || !root || !root.contains(document.activeElement)) return;
		root.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`)?.focus({ preventScroll: true });
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

	Every row's fields come with its level: one read per type over the ids just returned,
	so a sub-label or a status costs nothing per row.

	Searching is two calls a query: `_text_search` matches the words and `hierarchy/_search`
	says where each hit sits, so the tree opens along every answered path, marks the rows
	the words found and dims the rest (post_entity_text_search, post_hierarchy_search).
-->
<div bind:this={ref} data-slot="entity-tree" class={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
	{#if searchable}
		<div class="relative flex items-center">
			<Input
				type="search"
				value={query}
				oninput={(event) => setQuery(event.currentTarget.value)}
				onkeydown={onSearchKeydown}
				placeholder={searchPlaceholder}
				aria-label={searchPlaceholder}
				aria-busy={snap.searching ? true : undefined}
				data-slot="entity-tree-search"
				class="pe-8"
			/>
			{#if snap.searching}
				<Loader
					aria-hidden="true"
					class="text-muted-foreground pointer-events-none absolute end-2 size-4 motion-safe:animate-spin"
				/>
			{/if}
		</div>
	{/if}

	<div
		data-slot="entity-tree-scroll"
		style="max-height:{maxHeight}"
		class="border-border w-full overflow-auto rounded-md border p-1"
	>
		{#if snap.status === 'error'}
			<p class={cn(stateClass, 'text-destructive')}>
				<CircleAlert aria-hidden="true" class="size-4 shrink-0" />
				{snap.error?.message}
			</p>
		{:else if snap.status === 'loading' || snap.status === 'idle'}
			<div class="flex flex-col gap-2 p-1">
				{#each { length: 5 } as _, index (index)}
					<Skeleton class="h-6 w-full" />
				{/each}
			</div>
		{:else if snap.rows.length === 0}
			<p class={stateClass}>
				<Inbox aria-hidden="true" class="size-4 shrink-0" />
				{emptyLabel}
			</p>
		{:else if noMatch}
			<p data-slot="entity-tree-no-match" class={stateClass}>
				<Search aria-hidden="true" class="size-4 shrink-0" />
				{noMatchLabel}
			</p>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
			<ul
				role="tree"
				aria-label={label}
				aria-multiselectable={selection === 'multiple' ? true : undefined}
				data-slot="entity-tree-list"
				style="--tree-indent:1rem"
				class="flex flex-col"
				onkeydown={onKeydown}
			>
				{#each snap.rows as row (row.node.path)}
					{@const node = row.node}
					{@const name = labelOf(node)}
					{@const code = codeOf(node)}
					{@const sub = subLabelOf(node)}
					{@const status = statusOf(node)}
					{@const custom = secondary ? secondary(node) : ''}
					{@const raw = secondaryValue(node)}
					<li
						role="none"
						data-slot="entity-tree-item"
						style="padding-inline-start:calc(var(--tree-indent) * {node.level})"
					>
						<!-- The keyboard model lives on the `tree` element, which owns the roving focus. -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							role="treeitem"
							data-slot="entity-tree-item-label"
							data-path={node.path}
							data-level={node.level}
							data-state={node.hasChildren ? (row.expanded ? 'open' : 'closed') : undefined}
							data-selected={row.selected ? 'true' : undefined}
							aria-level={node.level + 1}
							aria-expanded={node.hasChildren ? row.expanded : undefined}
							aria-selected={row.selected}
							aria-checked={checkable ? checkedAttr(row.checked) : undefined}
							aria-busy={row.loading ? true : undefined}
							tabindex={row.focused ? 0 : -1}
							onclick={() => activate(row)}
							class={cn(
								'focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 cursor-default gap-1.5 rounded-md outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
								ROW[density],
								TEXT[size],
								hasSubLabel ? 'items-start' : 'items-center',
								dimming && !row.match && 'text-muted-foreground',
								row.selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
							)}
						>
							{#if node.hasChildren}
								<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
								<span
									aria-hidden="true"
									data-slot="entity-tree-chevron"
									onclick={(event) => openBranch(event, row)}
									class={cn('flex shrink-0 items-center justify-center', GLYPH[size])}
								>
									{#if row.loading}
										<Loader
											aria-hidden="true"
											class={cn('shrink-0 motion-safe:animate-spin', GLYPH[size])}
										/>
									{:else}
										<ChevronRight
											aria-hidden="true"
											class={cn(
												'text-muted-foreground shrink-0 transition-transform duration-150 ease-out',
												GLYPH[size],
												row.expanded && 'rotate-90'
											)}
										/>
									{/if}
								</span>
							{:else}
								<span aria-hidden="true" class={cn('shrink-0', GLYPH[size])}></span>
							{/if}

							{#if checkable}
								<!-- The row carries `aria-checked`, so the box itself is chrome and never a second tab stop. -->
								<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
								<span
									aria-hidden="true"
									data-slot="entity-tree-checkbox"
									onclick={(event) => {
										event.stopPropagation();
										engine.focus(node.path);
										engine.toggleChecked(node.path);
									}}
									class={cn(
										'flex shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150 [&>svg]:size-3.5',
										GLYPH[size],
										row.checked === 'unchecked'
											? 'border-input'
											: 'border-primary bg-primary text-primary-foreground'
									)}
								>
									{#if row.checked === 'checked'}
										<Check />
									{:else if row.checked === 'mixed'}
										<Minus />
									{/if}
								</span>
							{/if}

							{#if thumbnail !== false}
								<span class={cn('flex shrink-0 items-center', LEAD[size])}>
									{#if thumbOf(node)}
										<Thumbnail src={thumbOf(node)} aspect="square" size={LEAF[size]} />
									{/if}
								</span>
							{/if}

							<span class="flex min-w-0 flex-1 flex-col">
								<span class="flex min-w-0 items-center gap-1.5">
									<span data-slot="entity-tree-label" class="truncate" title={name}>
										{#each matchRuns(name, snap.search) as part, i (i)}
											{#if part.match}<span class="font-semibold">{part.text}</span>{:else}{part.text}{/if}
										{/each}
									</span>
									{#if code}
										<span data-slot="entity-tree-code" class="text-muted-foreground shrink-0 font-mono text-xs"
											>{code}</span
										>
									{/if}
								</span>
								{#if sub}
									<span data-slot="entity-tree-sub-label" class="text-muted-foreground truncate text-xs" title={sub}
										>{sub}</span
									>
								{/if}
							</span>

							{#if status}
								<!-- A tree row is dense, so the status is its icon; the name stays in the badge for a reader. -->
								<StatusBadge
									code={status}
									status={plan.statuses?.[status] ?? null}
									field={node.entity ? (plan.status[node.entity.type] ?? null) : null}
									variant="icon"
									size={LEAF[size]}
									{siteUrl}
									class="shrink-0"
								/>
							{/if}

							{#if custom}
								<span data-slot="entity-tree-secondary" class="text-muted-foreground shrink-0 text-xs">{custom}</span>
							{:else if secondaryField && !isEmptyValue(raw)}
								<span
									data-slot="entity-tree-secondary"
									class={cn(
										'text-muted-foreground flex shrink-0 items-center text-xs',
										secondaryIsId && 'font-mono tabular-nums'
									)}
								>
									<FieldValue
										value={raw}
										dataType={secondaryType(node)}
										field={node.entity ? (plan.secondary[node.entity.type] ?? null) : null}
										statuses={plan.statuses}
										{siteUrl}
										class="w-auto justify-end text-xs"
									/>
								</span>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</div>
