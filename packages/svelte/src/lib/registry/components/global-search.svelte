<script lang="ts" module>
	import type { EntityRef, SearchHit, WireCondition } from '@sg-widgets/core';

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

	/** Long enough that a typist does not fire a request a letter, short enough to feel live. */
	const DEBOUNCE_MS = 250;
	/** The endpoint's cap and its default (probe 053). */
	const PAGE_SIZE = 25;

	const PEOPLE = ['HumanUser', 'ApiUser', 'ClientUser'];


	/** The modifier the hotkey shows, from the platform the page is on. */
	const META =
		typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
			? '⌘'
			: 'Ctrl';

	function typeMap(types: GlobalSearchTypes): Record<string, WireCondition[] | null> {
		return Array.isArray(types) ? Object.fromEntries(types.map((t) => [t, null])) : types;
	}

	function same(a: EntityRef, b: EntityRef): boolean {
		return a.type === b.type && a.id === b.id;
	}
</script>

<script lang="ts">
	import type { SgClient } from '@sg-widgets/core';
	import { createSchemaService, hydrate, matchRuns, scopeToProject } from '@sg-widgets/core';
	import type { Snippet } from 'svelte';
	import Search from '@lucide/svelte/icons/search';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import * as Command from '$lib/components/ui/command/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Kbd } from '$lib/components/ui/kbd/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';
	import UserAvatar from '$lib/registry/components/user-avatar.svelte';

	type Props = {
		/** Where rows come from. Wrap it in `createQueryCache` once for the whole app. */
		client: SgClient;
		entityTypes?: GlobalSearchTypes;
		/** Scope every searched type that has a `project` field to this project. */
		projectId?: number | null;
		/** Opens the palette on Cmd/Ctrl+K. Ignored on the inline variant. */
		hotkey?: boolean;
		/** Render as a combobox in the page instead of a dialog behind a trigger. */
		inline?: boolean;
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
		/** Text on the trigger. */
		label?: string;
		class?: string;
		/** Replaces the trigger button. Call `open()` from inside it. */
		trigger?: Snippet<[{ open: () => void }]>;
	};

	let {
		client,
		entityTypes = GLOBAL_SEARCH_TYPES,
		projectId = null,
		hotkey = false,
		inline = false,
		open = $bindable(false),
		onOpenChange,
		recents = [],
		recentLimit = 5,
		onRecentsChange,
		onSelect,
		placeholder = 'Search…',
		label = 'Search',
		class: className,
		trigger
	}: Props = $props();

	const schema = $derived(createSchemaService(client));

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

	const order = $derived(Object.keys(typeMap(entityTypes)));

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
			let types = typeMap(entityTypes);
			if (projectId !== null && projectId !== undefined) types = await scopeToProject(schema, types, projectId);
			const rows = await client.textSearch(text, types, { size: PAGE_SIZE, number: nextPage });
			const found = await hydrate(client, rows);
			if (id !== requestId) return;
			hits = nextPage === 1 ? found : [...hits, ...found];
			page = nextPage;
			// The answer carries no `links`, so a full page is the only sign of another one (probe 006).
			hasMore = rows.length === PAGE_SIZE;
		} catch (error) {
			if (id !== requestId) return;
			failure = error instanceof Error ? error.message : String(error);
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
		timer = setTimeout(() => void run(text, 1), DEBOUNCE_MS);
	}

	function setOpen(next: boolean): void {
		if (next === open) return;
		open = next;
		onOpenChange?.(next);
	}

	function choose(entity: EntityRef): void {
		onRecentsChange?.([entity, ...recents.filter((r) => !same(r, entity))].slice(0, recentLimit));
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

	function subLabel(hit: SearchHit): string {
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
	{@const name = hit.ref.name ?? `${hit.ref.type} #${hit.ref.id}`}
	{@const sub = subLabel(hit)}
	{#if PEOPLE.includes(hit.ref.type)}
		<UserAvatar name={name} image={hit.image} size="sm" color="auto" apiUser={hit.ref.type === 'ApiUser'} />
	{:else}
		<Thumbnail src={hit.image} size="sm" />
	{/if}
	<span class="flex min-w-0 flex-1 flex-col">
		<span class="truncate" title={name}>
			{#each matchRuns(name, query) as part, i (i)}
				{#if part.match}<span class="font-semibold">{part.text}</span>{:else}{part.text}{/if}
			{/each}
		</span>
		<span class="text-muted-foreground truncate text-xs" title={sub}>{sub}</span>
	</span>
{/snippet}

{#snippet body()}
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
		{:else if loading && hits.length === 0}
			<div data-slot="search-loading" class="flex flex-col gap-2 p-1" aria-busy="true">
				{#each [0, 1, 2] as line (line)}
					<div class="flex items-center gap-2 px-2 py-1.5">
						<Skeleton class="h-6 w-10 shrink-0" />
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
				<span>Nothing matches every word</span>
			</div>
		{:else if showRecents}
			<Command.Group heading="Recent">
				{#each recents as entity (`${entity.type}:${entity.id}`)}
					<Command.Item
						value={`recent:${entity.type}:${entity.id}`}
						onSelect={() => choose(entity)}
					>
						<EntityChip {entity} size="sm" />
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
	<div data-slot="global-search" data-variant="inline" class={cn('w-full', className)}>
		<!-- Server-side matching only, so the list never filters what came back. -->
		<Command.Root shouldFilter={false} bind:value={cursor} class="border-border rounded-md border">
			{@render body()}
		</Command.Root>
	</div>
{:else}
	<div data-slot="global-search" data-variant="dialog" class={cn('w-full', className)}>
		{#if trigger}
			{@render trigger({ open: () => setOpen(true) })}
		{:else}
			<Button
				variant="outline"
				data-slot="global-search-trigger"
				class="h-9 w-full justify-between"
				onclick={() => setOpen(true)}
			>
				<span class="flex min-w-0 items-center gap-1.5">
					<Search aria-hidden="true" class="size-4 opacity-70" />
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
