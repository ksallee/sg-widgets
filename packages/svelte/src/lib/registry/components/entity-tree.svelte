<script lang="ts" module>
	import type { TreeCheckState } from '@sg-widgets/core';

	/** `aria-checked` as a tree row spells it: `mixed` for a part-checked branch. */
	function checkedAttr(state: TreeCheckState): 'true' | 'false' | 'mixed' {
		return state === 'mixed' ? 'mixed' : state === 'checked' ? 'true' : 'false';
	}
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityRef, SgClient, TreeFieldPlan, TreeNode, TreeRow } from '@sg-widgets/core';
	import {
		createSchemaService,
		createStatusService,
		createTree,
		hierarchyLoader,
		isEmptyValue,
		resolveTreeFields,
		TREE_STATUS_FIELDS
	} from '@sg-widgets/core';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Check from '@lucide/svelte/icons/check';
	import Inbox from '@lucide/svelte/icons/inbox';
	import Loader from '@lucide/svelte/icons/loader';
	import Minus from '@lucide/svelte/icons/minus';
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
		oncheckedchange?: (rows: EntityRef[]) => void;
		onselect?: (node: TreeNode) => void;
		onerror?: (error: Error) => void;
		/** Shows a filter input that narrows the nodes already loaded. */
		filterable?: boolean;
		filterPlaceholder?: string;
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
	};

	let {
		client,
		rootPath,
		seedPath = null,
		checkable = false,
		selection = 'single',
		oncheckedchange,
		onselect,
		onerror,
		filterable = false,
		filterPlaceholder = 'Filter loaded nodes',
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
			loader: hierarchyLoader(client, { fields: requested })
		})
	);

	// svelte-ignore state_referenced_locally
	let snap = $state(engine.snapshot());
	let filter = $state('');

	$effect(() => {
		const tree = engine;
		snap = tree.snapshot();
		const stop = tree.subscribe(() => (snap = tree.snapshot()));
		void (seedPath ? tree.expandToPath(seedPath) : tree.load());
		return stop;
	});

	$effect(() => {
		if (snap.error) onerror?.(snap.error);
	});

	/** The checked set as one string, so the callback fires when it moves and not on every keystroke. */
	const checkedKey = $derived(snap.checked.join('|'));

	$effect(() => {
		void checkedKey;
		oncheckedchange?.(engine.checkedRefs());
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
		}, onerror);
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

	/* interaction ------------------------------------------------------------ */

	function activate(row: TreeRow): void {
		engine.focus(row.node.path);
		if (row.node.hasChildren) void engine.toggle(row.node.path);
		else {
			engine.select(row.node.path);
			onselect?.(row.node);
		}
	}

	function onKeydown(event: KeyboardEvent): void {
		const path = snap.cursor;
		if (!engine.keyDown(event)) return;
		event.preventDefault();
		if (event.key !== 'Enter' || path === null) return;
		const node = engine.node(path);
		if (node && !node.hasChildren) onselect?.(node);
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

	The filter narrows what is already loaded. It never asks the server, so a branch that
	was never opened is not searched.
-->
<div bind:this={ref} data-slot="entity-tree" class={cn('flex w-full min-w-0 flex-col gap-2', className)} {...rest}>
	{#if filterable}
		<Input
			type="search"
			value={filter}
			oninput={(event) => {
				filter = event.currentTarget.value;
				engine.setFilter(filter);
			}}
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
								'focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 cursor-default gap-1.5 rounded-md px-2 py-1.5 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
								hasSubLabel ? 'items-start' : 'items-center',
								row.selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50'
							)}
						>
							{#if node.hasChildren}
								{#if row.loading}
									<Loader aria-hidden="true" class="size-4 shrink-0 motion-safe:animate-spin" />
								{:else}
									<ChevronRight
										aria-hidden="true"
										class={cn(
											'text-muted-foreground size-4 shrink-0 transition-transform duration-150 ease-out',
											row.expanded && 'rotate-90'
										)}
									/>
								{/if}
							{:else}
								<span aria-hidden="true" class="size-4 shrink-0"></span>
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
										'flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150 [&>svg]:size-3.5',
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
								<span class="flex shrink-0 items-center">
									<Thumbnail src={thumbOf(node)} aspect="square" size="sm" />
								</span>
							{/if}

							<span class="flex min-w-0 flex-1 flex-col">
								<span class="flex min-w-0 items-center gap-1.5">
									<span data-slot="entity-tree-label" class="truncate" title={name}>{name}</span>
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
									size="sm"
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
