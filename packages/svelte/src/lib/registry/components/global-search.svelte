<script lang="ts" module>
	import type { EntityRef, FieldSpec, PickerRow, SearchHit, WireCondition } from '@sg-widgets/core';
	import { CONTROL_GLYPH, CONTROL_HEIGHT, type ControlSize } from '$lib/registry/components/control-classes.js';

	export type GlobalSearchSize = ControlSize;

	/** A chip inside a row sits one step down the leaf ladder. */
	const CHIP: Record<GlobalSearchSize, 'xs' | 'sm' | 'md'> = { sm: 'xs', md: 'sm', lg: 'md' };

	/** A skeleton stands in for a row, so its leading slot is the row's picture. */
	const LEAD: Record<GlobalSearchSize, string> = { sm: 'size-6', md: 'size-8', lg: 'size-10' };

	/** Types to search, either bare names or names with a filter each. */
	export type GlobalSearchTypes = string[] | Record<string, WireCondition[] | null>;

	/** One heading and the rows under it. */
	export interface GlobalSearchGroup {
		type: string;
		label: string;
		hits: SearchHit[];
	}

	/** Types a stock site searches over. A caller with custom entities passes its own. */
	export const GLOBAL_SEARCH_TYPES = ['Asset', 'Shot', 'Sequence', 'Task', 'Version', 'HumanUser', 'Project'];

	/** The modifier the hotkey shows, from the platform the page is on. */
	const META =
		typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
			? '⌘'
			: 'Ctrl';

	function keyOf(ref: EntityRef): string {
		return `${ref.type}:${ref.id}`;
	}

	function hitKey(hit: SearchHit): string {
		return keyOf(hit.ref);
	}
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { SgContext } from '@sg-widgets/core';
	import {
		hasMorePage,
		hydrate,
		NO_MATCH_LABEL,
		pathOf,
		placeholderName,
		prependRecent,
		rowFields,
		scopeToProject,
		SEARCH_PAGE_SIZE,
		searchTypeMap
	} from '@sg-widgets/core';
	import type { Snippet } from 'svelte';
	import Search from '@lucide/svelte/icons/search';
	import * as Command from '$lib/components/ui/command/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Kbd } from '$lib/components/ui/kbd/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import Row from '$lib/registry/components/picker-row.svelte';
	import SearchControl, { type SearchAnswer, type SearchRequest } from '$lib/registry/components/search-control.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The widget context. Every read goes through it, so widgets on a page share one cache. */
		context: SgContext;
		entityTypes?: GlobalSearchTypes;
		/** Scope every searched type that has a `project` field to this project. */
		projectId?: number | null;
		/** Field holding the thumbnail URL. `false` hides the leading slot. */
		thumbnail?: string | false;
		/** Field holding the row label. Defaults to the display-name chain. */
		labelField?: string;
		/** The muted line under the label: a path, or a resolved column. */
		subLabelField?: FieldSpec | null;
		/** The muted line of the caller's own making. Wins over `subLabelField`. */
		subLabel?: (hit: SearchHit) => string;
		/** The right-aligned value: a path, or a resolved column so it renders by type. */
		secondaryField?: FieldSpec | null;
		/** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
		secondary?: (hit: SearchHit) => string;
		/** Show the row's `code` beside the label when the two differ. */
		showCode?: boolean;
		/** Extra fields to request, so a caller's own sub-label or secondary can read them. */
		fields?: string[];
		/** Opens the palette on Cmd/Ctrl+K. Ignored on the inline variant. */
		/** Opens the palette on Cmd or Ctrl and K; a string names another key. */
		hotkey?: boolean | string;
		/** Render as a combobox in the page instead of a dialog behind a trigger. */
		inline?: boolean;
		size?: GlobalSearchSize;
		/** Whether the dialog is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		/** Rows picked before, newest first. Held by the caller: persisting them is the app's job. */
		recents?: EntityRef[];
		/** How many recents to keep when a pick is prepended. */
		recentLimit?: number;
		onRecentsChange?: (recents: EntityRef[]) => void;
		onSelect?: (entity: EntityRef) => void;
		placeholder?: string;
		/** Shown when the query matches nothing. */
		emptyLabel?: string;
		/** The accessible name of the skeletons a read stands behind. */
		loadingLabel?: string;
		/** Shown in place of what the failed read said. */
		errorLabel?: string;
		/** Text on the trigger. */
		label?: string;
		class?: string;
		/** Replaces the trigger button. Call `open()` from inside it. */
		trigger?: Snippet<[{ open: () => void }]>;
	};

	let {
		context,
		entityTypes = GLOBAL_SEARCH_TYPES,
		projectId = null,
		thumbnail = 'image',
		labelField,
		subLabelField = null,
		subLabel,
		secondaryField = null,
		secondary,
		showCode = false,
		fields = [],
		hotkey = false,
		inline = false,
		size = 'md',
		open = $bindable(false),
		onOpenChange,
		recents = [],
		recentLimit = 5,
		onRecentsChange,
		onSelect,
		placeholder = 'Search…',
		emptyLabel = NO_MATCH_LABEL,
		loadingLabel,
		errorLabel,
		label = 'Search',
		class: className,
		trigger,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const schema = $derived(context.schema);

	let query = $state('');
	let displayNames = $state<Record<string, string>>({});

	$effect(() => {
		let live = true;
		void schema
			.entityTypes()
			.then((types) => {
				if (live) displayNames = Object.fromEntries(types.map((t) => [t.name, t.displayName]));
			})
			.catch(() => {
				// A heading falls back to the schema name, which is always readable.
			});
		return () => {
			live = false;
		};
	});

	const order = $derived(Object.keys(searchTypeMap(entityTypes)));
	const showRecents = $derived(query.trim().length === 0 && recents.length > 0);

	/** The rows the answer holds, under one heading per type, in the order asked for. */
	function groupsOf(hits: SearchHit[]): GlobalSearchGroup[] {
		const byType = new Map<string, SearchHit[]>();
		for (const hit of hits) {
			const list = byType.get(hit.ref.type);
			if (list) list.push(hit);
			else byType.set(hit.ref.type, [hit]);
		}
		return order
			.filter((type) => byType.has(type))
			.map((type) => ({ type, label: displayNames[type] ?? type, hits: byType.get(type) as SearchHit[] }));
	}

	async function load({ query: text, page }: SearchRequest): Promise<SearchAnswer<SearchHit>> {
		let types = searchTypeMap(entityTypes);
		if (projectId !== null && projectId !== undefined) types = await scopeToProject(schema, types, projectId);
		const found = await context.client.textSearch(text, types, { size: SEARCH_PAGE_SIZE, number: page });
		const hits = await hydrate(context.client, found, {
			fields: rowFields({ thumbnail, labelField, subLabelField, secondaryField, showCode, fields }),
			labelField
		});
		return { items: hits, hasMore: hasMorePage(found.length, SEARCH_PAGE_SIZE) };
	}

	function setOpen(next: boolean): void {
		if (next === open) return;
		open = next;
		onOpenChange?.(next);
	}

	function choose(entity: EntityRef): void {
		onRecentsChange?.(prependRecent(recents, entity, recentLimit, keyOf));
		onSelect?.(entity);
		if (!inline) setOpen(false);
		query = '';
	}

	const hotkeyKey = $derived(typeof hotkey === 'string' ? hotkey : 'k');

	function onKeydown(event: KeyboardEvent): void {
		if (!hotkey || inline) return;
		if (event.key.toLowerCase() !== hotkeyKey.toLowerCase() || !(event.metaKey || event.ctrlKey)) return;
		event.preventDefault();
		setOpen(!open);
	}

	/** The row a hit draws as: the reference, its label and the values the second read answered. */
	function rowOf(hit: SearchHit): PickerRow {
		return {
			type: hit.ref.type,
			id: hit.ref.id,
			name: hit.ref.name || placeholderName(hit.ref),
			values: hit.values
		};
	}

	/**
	 * The muted line under the label. With no field and no function of the caller's,
	 * it is where the row sits: its project, else the row `_text_search` also matched
	 * the words against, else the type.
	 */
	function subLabelOf(hit: SearchHit): string | undefined {
		if (subLabel) return subLabel(hit);
		if (pathOf(subLabelField)) return undefined;
		if (hit.project?.name) return hit.project.name;
		if (hit.link) return `${displayNames[hit.link.type] ?? hit.link.type} ${hit.link.name}`;
		return displayNames[hit.ref.type] ?? hit.ref.type;
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!--
	Search across the site, as a command palette.

	One `_text_search` covers every configured type at once and every word of the query
	has to match, each as a case-insensitive substring of the row's name or of the name
	of the row it links to (probe 053). That endpoint has no `fields` parameter, so the
	thumbnail and the project on each row are a second read of the page just returned.
	Matching is the server's alone: the command list never filters.
-->
{#snippet row(hit: SearchHit)}
	<Row
		row={rowOf(hit)}
		{query}
		{thumbnail}
		{showCode}
		{subLabelField}
		subLabel={subLabelOf(hit)}
		{secondaryField}
		secondary={secondary ? secondary(hit) : undefined}
		{size}
		{context}
	/>
{/snippet}

{#snippet rows({ items }: { items: SearchHit[]; query: string; loading: boolean })}
	{#if showRecents}
		<Command.Group heading="Recent">
			{#each recents as entity (keyOf(entity))}
				<Command.Item value={`recent:${keyOf(entity)}`} onSelect={() => choose(entity)}>
					<EntityChip {entity} size={CHIP[size]} {context} />
					<span class="text-muted-foreground truncate text-xs">
						{displayNames[entity.type] ?? entity.type}
					</span>
				</Command.Item>
			{/each}
		</Command.Group>
	{:else}
		{#each groupsOf(items) as group (group.type)}
			<Command.Group heading={group.label}>
				{#each group.hits as hit (hitKey(hit))}
					<Command.Item
						value={hitKey(hit)}
						data-entity-type={hit.ref.type}
						data-entity-id={hit.ref.id}
						onSelect={() => choose(hit.ref)}
					>
						{@render row(hit)}
					</Command.Item>
				{/each}
			</Command.Group>
		{/each}
	{/if}
{/snippet}

{#snippet control()}
	<SearchControl
		{load}
		bind:query
		shell={inline ? 'command' : 'dialog'}
		commandClass="border-border rounded-lg border"
		bind:open={() => open, setOpen}
		title="Search"
		description="Search across the site by name."
		{placeholder}
		{emptyLabel}
		{loadingLabel}
		{errorLabel}
		skeletonLead={cn('shrink-0', LEAD[size])}
		paging
		{rows}
	/>
{/snippet}

{#if inline}
	<div
		bind:this={ref}
		data-slot="global-search"
		data-variant="inline"
		class={cn('w-full', className)}
		{...rest}
	>
		{@render control()}
	</div>
{:else}
	<div
		bind:this={ref}
		data-slot="global-search"
		data-variant="dialog"
		class={cn('w-full', className)}
		{...rest}
	>
		{#if trigger}
			{@render trigger({ open: () => setOpen(true) })}
		{:else}
			<Button
				variant="outline"
				data-slot="global-search-trigger"
				data-size={size}
				class={cn('w-full justify-between', CONTROL_HEIGHT[size])}
				onclick={() => setOpen(true)}
			>
				<span class="flex min-w-0 items-center gap-1.5">
					<Search aria-hidden="true" class={cn('opacity-70', CONTROL_GLYPH[size])} />
					<span class="truncate">{label}</span>
				</span>
				{#if hotkey}<Kbd>{META}{hotkeyKey.toUpperCase()}</Kbd>{/if}
			</Button>
		{/if}
		{@render control()}
	</div>
{/if}
