<script lang="ts" module>
	import type { EntityRef, FieldSpec, PickerRow, SearchHit, WireCondition } from '@sg-widgets/core';
	import { CONTROL_GLYPH, CONTROL_HEIGHT, type ControlSize } from '$lib/registry/components/control-classes.js';

	export type GlobalSearchSize = ControlSize;

	/** A chip inside a row sits one step down the leaf ladder. */
	const CHIP: Record<GlobalSearchSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

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

	/** The endpoint's cap and its default (probe 053). */
	const PAGE_SIZE = 25;

	/** The modifier the hotkey shows, from the platform the page is on. */
	const META =
		typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
			? '⌘'
			: 'Ctrl';

	function keyOf(ref: EntityRef): string {
		return `${ref.type}:${ref.id}`;
	}
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { SgContext } from '@sg-widgets/core';
	import {
		errorText,
		hydrate,
		NO_MATCH_LABEL,
		pathOf,
		placeholderName,
		prependRecent,
		rowFields,
		scopeToProject,
		SEARCH_DEBOUNCE_MS,
		searchTypeMap,
		stateLine
	} from '@sg-widgets/core';
	import type { Snippet } from 'svelte';
	import { tick } from 'svelte';
	import Search from '@lucide/svelte/icons/search';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import * as Command from '$lib/components/ui/command/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Kbd } from '$lib/components/ui/kbd/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import SearchSkeleton from '$lib/registry/components/search-skeleton.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import Row from '$lib/registry/components/picker-row.svelte';

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
		hotkey?: boolean;
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
	let hits = $state<SearchHit[]>([]);
	let page = $state(1);
	let hasMore = $state(false);
	let loading = $state(false);
	let failure = $state<string | null>(null);
	let displayNames = $state<Record<string, string>>({});

	/** An answer whose id is no longer the current one lost the race and is dropped. */
	let requestId = 0;
	let timer: ReturnType<typeof setTimeout> | undefined;

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

	const groups = $derived.by((): GlobalSearchGroup[] => {
		const byType = new Map<string, SearchHit[]>();
		for (const hit of hits) {
			const list = byType.get(hit.ref.type);
			if (list) list.push(hit);
			else byType.set(hit.ref.type, [hit]);
		}
		return order
			.filter((type) => byType.has(type))
			.map((type) => ({ type, label: displayNames[type] ?? type, hits: byType.get(type) as SearchHit[] }));
	});

	const showRecents = $derived(query.trim().length === 0 && recents.length > 0);
	/**
	 * The row the cursor sits on. cmdk moves it to the first row whenever the list
	 * changes and bits-ui leaves it where it was, so it is set here and the two
	 * frameworks answer Down and Enter the same way.
	 */
	let cursor = $state('');
	let listEl = $state<HTMLElement | null>(null);
	const firstRow = $derived(
		showRecents
			? recents[0]
				? `recent:${recents[0].type}:${recents[0].id}`
				: ''
			: hits[0]
				? `${hits[0].ref.type}:${hits[0].ref.id}`
				: ''
	);
	$effect(() => {
		cursor = firstRow;
	});
	const empty = $derived(!loading && failure === null && groups.length === 0 && query.trim().length > 0);

	async function run(text: string, nextPage: number): Promise<void> {
		const id = (requestId += 1);
		loading = true;
		failure = null;
		try {
			let types = searchTypeMap(entityTypes);
			if (projectId !== null && projectId !== undefined) types = await scopeToProject(schema, types, projectId);
			const rows = await context.client.textSearch(text, types, { size: PAGE_SIZE, number: nextPage });
			const found = await hydrate(context.client, rows, {
				fields: rowFields({ thumbnail, labelField, subLabelField, secondaryField, showCode, fields }),
				labelField
			});
			if (id !== requestId) return;
			hits = nextPage === 1 ? found : [...hits, ...found];
			page = nextPage;
			// A page lands under the row that asked for it: the highlight moves to its first
			// row, so the list stays where the reader was instead of returning to the top.
			if (nextPage > 1 && found[0]) {
				// The rows must be in the list, and registered with the primitive, before it
				// takes one of them as its value; registration runs after the flush.
				await tick();
				await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
				cursor = `${found[0].ref.type}:${found[0].ref.id}`;
				// The primitive scrolls for the keys, not for a value written to it.
				await tick();
				listEl?.querySelector('[data-selected]')?.scrollIntoView({ block: 'nearest' });
			}
			// The answer carries no `links`, so a full page is the only sign of another one (probe 006).
			hasMore = rows.length === PAGE_SIZE;
		} catch (error) {
			if (id !== requestId) return;
			failure = errorText(error);
			hits = [];
			hasMore = false;
		} finally {
			if (id === requestId) loading = false;
		}
	}

	function setQuery(text: string): void {
		query = text;
		clearTimeout(timer);
		// Bumping the id here is the cancellation: a request already in flight for the
		// text just replaced can no longer write its answer.
		requestId += 1;
		hits = [];
		hasMore = false;
		if (text.trim().length === 0) {
			loading = false;
			return;
		}
		loading = true;
		timer = setTimeout(() => void run(text, 1), SEARCH_DEBOUNCE_MS);
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
		setQuery('');
	}

	function onKeydown(event: KeyboardEvent): void {
		if (!hotkey || inline) return;
		if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
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

{#snippet body()}
	<Command.Input value={query} {placeholder} oninput={(e) => setQuery(e.currentTarget.value)} />
	<Command.List bind:ref={listEl} data-sg-search-list>
		{#if failure !== null}
			<StateLine
				state="error"
				slotName="search-error"
				icon={TriangleAlert}
				label={stateLine('error', { errorLabel }, failure)}
			/>
		{:else if loading && hits.length === 0}
			<SearchSkeleton slotName="search-loading" label={stateLine('loading', { loadingLabel })} />
		{:else if empty}
			<StateLine state="empty" slotName="search-empty" icon={Search} label={emptyLabel} />
		{:else if showRecents}
			<Command.Group heading="Recent">
				{#each recents as entity (`${entity.type}:${entity.id}`)}
					<Command.Item
						value={`recent:${entity.type}:${entity.id}`}
						onSelect={() => choose(entity)}
					>
						<EntityChip {entity} size={CHIP[size]} {context} />
						<span class="text-muted-foreground truncate text-xs">
							{displayNames[entity.type] ?? entity.type}
						</span>
					</Command.Item>
				{/each}
			</Command.Group>
		{:else}
			{#each groups as group (group.type)}
				<Command.Group heading={group.label}>
					{#each group.hits as hit (`${hit.ref.type}:${hit.ref.id}`)}
						<Command.Item
							value={`${hit.ref.type}:${hit.ref.id}`}
							data-entity-type={hit.ref.type}
							data-entity-id={hit.ref.id}
							onSelect={() => choose(hit.ref)}
						>
							{@render row(hit)}
						</Command.Item>
					{/each}
				</Command.Group>
			{/each}
			{#if hasMore}
				<Command.Item
					value="load-more"
					data-slot="search-load-more"
					onSelect={() => void run(query, page + 1)}
				>
					<span class="text-muted-foreground flex-1 text-center text-sm">
						{loading ? 'Loading…' : 'Load more'}
					</span>
				</Command.Item>
			{/if}
		{/if}
	</Command.List>
{/snippet}

{#if inline}
	<div
		bind:this={ref}
		data-slot="global-search"
		data-variant="inline"
		class={cn('w-full', className)}
		{...rest}
	>
		<!-- Server-side matching only, so the list never filters what came back. -->
		<Command.Root shouldFilter={false} bind:value={cursor} class="border-border rounded-lg border">
			{@render body()}
		</Command.Root>
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
				{#if hotkey}<Kbd>{META}K</Kbd>{/if}
			</Button>
		{/if}
		<Command.Dialog
			bind:open={() => open, setOpen}
			bind:value={cursor}
			shouldFilter={false}
			title="Search"
			description="Search across the site by name."
		>
			{@render body()}
		</Command.Dialog>
	</div>
{/if}
