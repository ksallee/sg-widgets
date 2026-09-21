<script lang="ts" module>
	import type { TreeCheckState, TreeNode } from '@sg-widgets/core';
	import type { StatusBadgeSize } from '$lib/registry/components/status-badge.svelte';

	export type EntityTreeSize = 'sm' | 'md' | 'lg';

	/** What a `row` snippet is handed. It draws a row's contents, not its chevron or its box. */
	export interface EntityTreeRowContext {
		node: TreeNode;
		/** The node's path, which is what a tree keys a row on. */
		id: string;
		level: number;
		expanded: boolean;
		selected: boolean;
		disabled: boolean;
		/** True when the search placed this row, or its label holds every word. */
		match: boolean;
	}

	export type EntityTreeDensity = 'compact' | 'default';

	/** The list-row padding of `docs/design-rules.md`; compact halves the vertical half. */
	const ROW: Record<EntityTreeDensity, string> = { compact: 'px-2 py-1', default: 'px-2 py-1.5' };
	/** A row's text, leading slot and glyphs, on the leaf ladder of `docs/design-rules.md`. */
	const TEXT: Record<EntityTreeSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };
	const LEAD: Record<EntityTreeSize, string> = { sm: 'size-5', md: 'size-6', lg: 'size-8' };
	const GLYPH: Record<EntityTreeSize, string> = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' };
	/** A leaf inside a row sits one step down the ladder. */
	const LEAF: Record<EntityTreeSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };
	/** A badge sits one step under the row it is in, on the chip ladder of `docs/design-rules.md`. */
	const BADGE: Record<EntityTreeSize, StatusBadgeSize> = { sm: 'xs', md: 'sm', lg: 'md' };
	/** The search input's trailing inset: room for the spinner, `end-2` either side of the glyph. */
	const SEARCH_TRAIL: Record<EntityTreeSize, string> = { sm: 'pe-8', md: 'pe-8', lg: 'pe-9' };

	/** `aria-checked` as a tree row spells it: `mixed` for a part-checked branch. */
	function checkedAttr(state: TreeCheckState): 'true' | 'false' | 'mixed' {
		return state === 'mixed' ? 'mixed' : state === 'checked' ? 'true' : 'false';
	}

	const DEBOUNCE_MS = 250;
</script>

<script lang="ts">
	import { untrack, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type {
		EntityRef,
		FieldSpec,
		SgContext,
		TreeFieldNames,
		TreeFieldPlan,
		TreeRow,
		TreeSelectionMode
	} from '@sg-widgets/core';
	import {
		createTree,
		hierarchyLoader,
		hierarchySearcher,
		isEmptyValue,
		NO_MATCH_LABEL,
		NO_ROWS_LABEL,
		pathOf,
		resolveTreeFields,
		rowSubLabel,
		rowThumbnail,
		subLabelType,
		sameIds,
		stateLine,
		TREE_STATUS_FIELDS
	} from '@sg-widgets/core';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Loader from '@lucide/svelte/icons/loader';
	import Search from '@lucide/svelte/icons/search';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { CONTROL_BOX, CONTROL_GLYPH } from '$lib/registry/components/control-classes.js';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import MatchText from '$lib/registry/components/match-text.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
		/** The widget context. Every read goes through it, so widgets on a page share one cache. */
		context: SgContext;
		/** Where the tree starts, `/Project/<id>`. */
		rootPath: string;
		/** Opens the tree down to this path on mount, one level per call. */
		seedPath?: string | string[] | null;
		/** Draws a checkbox per node and reports the checked rows. */
		checkable?: boolean;
		/** How many nodes may be selected at once. */
		selectionMode?: TreeSelectionMode;
		/** Paths of the selected nodes, two-way. */
		selection?: string[];
		onSelectionChange?: (paths: string[]) => void;
		/** Paths of the open nodes, two-way. */
		expanded?: string[];
		onExpandedChange?: (paths: string[]) => void;
		/** True for a node the arrows skip and the selection refuses. */
		isRowDisabled?: (node: TreeNode) => boolean;
		onCheckedChange?: (rows: EntityRef[]) => void;
		onSelect?: (node: TreeNode) => void;
		onError?: (error: Error) => void;
		/** Draws a row's contents: everything after the chevron and the checkbox. */
		row?: Snippet<[EntityTreeRowContext]>;
		/** Region above the tree. */
		header?: Snippet;
		/** Region below the tree. */
		footer?: Snippet;
		/** Shows an input that searches the project and opens the tree onto the hits. */
		searchable?: boolean;
		searchPlaceholder?: string;
		/** How many levels a whole-branch expansion opens. */
		expandDepth?: number;
		/** Field holding the thumbnail URL. `false`, the default here, hides the leading slot. */
		thumbnail?: string | false;
		/** Field shown as the row's label. Falls back to the label the tree answers. */
		labelField?: string;
		/** The muted line under the label: a path, or a resolved column. */
		subLabelField?: FieldSpec | null;
		/** Muted line under the label, of the caller's own making. Wins over `subLabelField`. */
		subLabel?: (node: TreeNode) => string;
		/** The right-aligned value: a path, or a resolved column, drawn by its data type. */
		secondaryField?: FieldSpec | null;
		/** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
		secondary?: (node: TreeNode) => string;
		/** Show the schema name beside the label on a node that stands for a type. */
		showCode?: boolean;
		/** Extra fields to request, so a caller's own sub-label or secondary can read them. */
		fields?: string[];
		/** The site the status sprite is served from. Defaults to the context's. */
		siteUrl?: string;
		label?: string;
		maxHeight?: string;
		/** Shown when the root holds nothing. */
		emptyLabel?: string;
		/** Shown when the query matches nothing. */
		noMatchLabel?: string;
		/** The accessible name of the skeletons a read stands behind. */
		loadingLabel?: string;
		/** Shown in place of what the failed read said. */
		errorLabel?: string;
		size?: EntityTreeSize;
		density?: EntityTreeDensity;
	};

	let {
		context,
		rootPath,
		seedPath = null,
		checkable = false,
		selectionMode = 'single',
		selection = $bindable([]),
		onSelectionChange,
		expanded = $bindable(),
		onExpandedChange,
		isRowDisabled,
		onCheckedChange,
		onSelect,
		onError,
		row: rowSnippet,
		header,
		footer,
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
		emptyLabel = NO_ROWS_LABEL,
		noMatchLabel = NO_MATCH_LABEL,
		loadingLabel,
		errorLabel,
		size = 'md',
		density = 'default',
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// The context's own services, so every widget on the page shares one schema read
	// and one status table.
	const schema = $derived(context.schema);
	const statusTable = $derived(context.statuses);
	const site = $derived(siteUrl ?? context.siteUrl);

	/** What a level is read under: the status names, the thumbnail and whatever the row shows. */
	const requested = $derived([
		...TREE_STATUS_FIELDS,
		...(thumbnail === false ? [] : [thumbnail]),
		...(labelField ? [labelField] : []),
		...(pathOf(subLabelField) ? [pathOf(subLabelField)] : []),
		...(pathOf(secondaryField) && pathOf(secondaryField) !== 'id' ? [pathOf(secondaryField)] : []),
		...(fields ?? [])
	]);

	const engine = $derived(
		createTree({
			rootPath,
			selection: selectionMode,
			expandDepth,
			disabled: isRowDisabled,
			loader: hierarchyLoader(context.client, { fields: requested }),
			searcher: hierarchySearcher(context.client, rootPath, { schema })
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

	/*
	 * Two-way state.
	 *
	 * Each pair is one effect out of the engine and one into it, each reading the other
	 * side untracked, so a change travels once and the two never write to each other.
	 */
	$effect(() => {
		const open = snap.expanded;
		if (sameIds(open, untrack(() => expanded ?? []))) return;
		expanded = [...open];
		onExpandedChange?.(expanded);
	});
	$effect(() => {
		const wanted = expanded;
		if (wanted === undefined || sameIds(wanted, untrack(() => snap.expanded))) return;
		void engine.setExpanded(wanted);
	});
	$effect(() => {
		const chosen = snap.selected;
		if (sameIds(chosen, untrack(() => selection ?? []))) return;
		selection = [...chosen];
		onSelectionChange?.(selection);
	});
	$effect(() => {
		const wanted = selection;
		if (wanted === undefined || sameIds(wanted, untrack(() => snap.selected))) return;
		engine.setSelected(wanted);
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
	function loadPlan(seen: string, names: TreeFieldNames): TreeFieldPlan {
		const plan = $state<TreeFieldPlan>({ status: {}, secondary: {}, subLabel: {}, statuses: null });
		const types = seen.split(',').filter(Boolean);
		void resolveTreeFields(schema, statusTable, types, names).then((found) => {
			plan.status = found.status;
			plan.secondary = found.secondary;
			plan.subLabel = found.subLabel;
			plan.statuses = found.statuses;
		}, onError);
		return plan;
	}

	const secondaryPath = $derived(pathOf(secondaryField));
	const subPath = $derived(pathOf(subLabelField));
	const plan = $derived(
		loadPlan(typeKey, { secondary: secondaryPath || undefined, subLabel: subPath || undefined })
	);
	const hasSubLabel = $derived(Boolean(subLabelField || subLabel));
	/** An id is a code, and codes are the mono treatment of `docs/design-rules.md`. */
	const secondaryIsId = $derived(secondaryPath === 'id');

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
		const field = node.entity ? plan.subLabel[node.entity.type] : null;
		return rowSubLabel(node.values, { subLabelField }, {
			dataType: subLabelType({ subLabelField }, field?.dataType),
			statuses: plan.statuses
		});
	}

	function statusOf(node: TreeNode): string {
		const field = node.entity ? plan.status[node.entity.type] : null;
		const code = field ? node.values[field.name] : null;
		return typeof code === 'string' ? code : '';
	}

	function secondaryValue(node: TreeNode): unknown {
		if (!secondaryPath) return null;
		return secondaryIsId ? (node.entity?.id ?? null) : node.values[secondaryPath];
	}

	function secondaryType(node: TreeNode): string {
		const declared = secondaryField && typeof secondaryField !== 'string' ? secondaryField.dataType : undefined;
		const field = node.entity ? plan.secondary[node.entity.type] : null;
		return declared ?? field?.dataType ?? (secondaryIsId ? 'number' : 'text');
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
		// One tab stop: focus follows the cursor while a row already holds it. The search
		// box is inside the tree too, and a result arriving must not take the caret.
		const path = snap.cursor;
		const root = ref;
		if (!path || !root || !document.activeElement?.closest('[data-path]')) return;
		if (!root.contains(document.activeElement)) return;
		const row = root.querySelector<HTMLElement>(`[data-path="${CSS.escape(path)}"]`);
		row?.focus({ preventScroll: true });
		row?.scrollIntoView({ block: 'nearest' });
	});

	const loadingText = $derived(stateLine('loading', { loadingLabel }));
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
	{#if header}
		<div data-slot="entity-tree-header" class="flex w-full min-w-0 flex-wrap items-center gap-2">
			{@render header()}
		</div>
	{/if}

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
				class={cn(CONTROL_BOX[size], SEARCH_TRAIL[size])}
			/>
			{#if snap.searching}
				<Loader
					aria-hidden="true"
					class={cn(
						'text-muted-foreground pointer-events-none absolute end-2 motion-safe:animate-spin',
						CONTROL_GLYPH[size]
					)}
				/>
			{/if}
		</div>
	{/if}

	<div
		data-slot="entity-tree-scroll"
		style="max-height:{maxHeight}"
		class="border-border w-full overflow-auto rounded-lg border p-1"
	>
		{#if snap.status === 'error'}
			<StateLine
				state="error"
				pad="table"
				icon={CircleAlert}
				label={stateLine('error', { errorLabel }, snap.error?.message)}
			/>
		{:else if snap.status === 'loading' || snap.status === 'idle'}
			<div class="flex flex-col" aria-busy="true" aria-label={loadingText}>
				{#each { length: 5 } as _, index (index)}
					<div class={cn('flex items-center', ROW[density])}>
						<Skeleton class="h-5 w-full" />
					</div>
				{/each}
			</div>
		{:else if snap.rows.length === 0}
			<StateLine state="empty" pad="table" icon={Inbox} label={emptyLabel} />
		{:else if noMatch}
			<StateLine
				state="empty"
				slotName="entity-tree-no-match"
				pad="table"
				icon={Search}
				label={noMatchLabel}
			/>
		{:else}
			<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
			<ul
				role="tree"
				aria-label={label}
								aria-multiselectable={selectionMode === 'multiple' ? true : undefined}
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
					{@const disabled = row.disabled}
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
							data-disabled={disabled ? 'true' : undefined}
							aria-disabled={disabled ? 'true' : undefined}
							aria-level={node.level + 1}
							aria-expanded={node.hasChildren ? row.expanded : undefined}
							aria-selected={row.selected}
							aria-checked={checkable ? checkedAttr(row.checked) : undefined}
							aria-busy={row.loading ? true : undefined}
							tabindex={row.focused && !disabled ? 0 : -1}
							onclick={() => activate(row)}
							class={cn(
								'focus-visible:ring-ring focus-visible:ring-offset-background relative flex min-w-0 focus-visible:z-10 cursor-default gap-2 rounded-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
								ROW[density],
								TEXT[size],
								hasSubLabel ? 'items-start' : 'items-center',
								dimming && !row.match && 'text-muted-foreground',
								row.selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
								disabled && 'pointer-events-none opacity-50'
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
									class="flex shrink-0 items-center"
								>
									<Checkbox
										checked={row.checked === 'checked'}
										indeterminate={row.checked === 'mixed'}
										tabindex={-1}
										aria-hidden="true"
										class="pointer-events-none"
									/>
								</span>
							{/if}

							{#if rowSnippet}
								{@render rowSnippet({
									node,
									id: node.path,
									level: node.level,
									expanded: row.expanded,
									selected: row.selected,
									disabled,
									match: row.match
								})}
							{:else}
								{#if thumbnail !== false}
									<span class={cn('flex shrink-0 items-center', LEAD[size])}>
										{#if rowThumbnail(node.values, { thumbnail })}
											<Thumbnail
												src={rowThumbnail(node.values, { thumbnail })}
												aspect="square"
												size={LEAF[size]}
												entityType={node.entity?.type ?? null}
											/>
										{/if}
									</span>
								{/if}

								<span class="flex min-w-0 flex-1 flex-col">
									<span class="flex min-w-0 items-center gap-1.5">
										<MatchText
											data-slot="entity-tree-label"
											text={name}
											query={snap.search}
											class="truncate"
											title={name}
										/>
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
									<!-- A tree row is dense, so the status is the bare icon; the name stays in the badge for a reader. -->
									<StatusBadge
										code={status}
										status={plan.statuses?.[status] ?? null}
										field={node.entity ? (plan.status[node.entity.type] ?? null) : null}
										variant="glyph"
										size={BADGE[size]}
										siteUrl={site}
										class="shrink-0"
									/>
								{/if}

								{#if custom}
									<span data-slot="entity-tree-secondary" class="text-muted-foreground shrink-0 text-xs">{custom}</span>
								{:else if secondaryPath && !isEmptyValue(raw)}
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
											siteUrl={site}
											{context}
											{density}
											class="w-auto justify-end text-xs"
										/>
									</span>
								{/if}
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if footer}
		<div data-slot="entity-tree-footer" class="flex w-full min-w-0 flex-wrap items-center gap-2">
			{@render footer()}
		</div>
	{/if}
</div>
