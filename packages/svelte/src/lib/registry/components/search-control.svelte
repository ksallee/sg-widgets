<script lang="ts" module>
	/** What a read answers: the rows it found and whether a further page may be there. */
	export interface SearchAnswer<T> {
		items: T[];
		hasMore?: boolean;
	}

	/** What a read is asked for: the query as it stands and the page wanted. */
	export interface SearchRequest {
		query: string;
		page: number;
	}

	/** The shell around the list: a command box, a command dialog, or nothing at all. */
	export type SearchShell = 'command' | 'dialog' | 'bare';
</script>

<script lang="ts" generics="T">
	import type { Snippet } from 'svelte';
	import { untrack } from 'svelte';
	import {
		errorText,
		listStatus,
		NO_MATCH_LABEL,
		pressGate,
		queryPlan,
		requestGate,
		searchKeyIntent,
		SEARCH_DEBOUNCE_MS,
		searchView,
		stateLine
	} from 'sg-widgets-core';
	import Search from '@lucide/svelte/icons/search';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import * as Command from '$lib/components/ui/command/index.js';
	import SearchSkeleton from '$lib/registry/components/search-skeleton.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';

	type Props = {
		/** The read behind the list. */
		load: (request: SearchRequest) => Promise<SearchAnswer<T>>;
		/** What the caret holds, two-way. */
		query?: string;
		onQueryChange?: (query: string) => void;
		/** What the read depends on besides the query. A change reads again at once. */
		request?: string;
		/** Nothing is read while this is off. */
		enabled?: boolean;
		/** An empty query reads too, rather than emptying the list. */
		readsEmpty?: boolean;
		/** A further page is asked for on a load-more row under the rows. */
		paging?: boolean;
		/** The pause before a typed query is asked for. */
		debounceMs?: number;
		shell?: SearchShell;
		/** Classes on the command box. */
		commandClass?: string;
		/** Keys the wrapper owns, on the command box, with the rows they act on. */
		onkeydown?: (event: KeyboardEvent, items: T[]) => void;
		/** Whether the dialog is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		/** The dialog's accessible name, and the line under it. */
		title?: string;
		description?: string;
		placeholder?: string;
		/** Shown when the read answered nothing. */
		emptyLabel?: string;
		/** The accessible name of the skeletons a read stands behind. */
		loadingLabel?: string;
		/** Shown in place of what the failed read said. */
		errorLabel?: string;
		/** The `data-slot` each block carries. `null` leaves it unnamed. */
		errorSlot?: string | null;
		loadingSlot?: string | null;
		emptySlot?: string | null;
		/** The shape of the skeletons: how many rows, and the leading slot of each. */
		skeletonLines?: number;
		skeletonLead?: string;
		/** The rows the read answered. */
		rows: Snippet<[{ items: T[]; query: string; loading: boolean }]>;
		/** Drawn in place of the empty line. */
		empty?: Snippet;
	};

	let {
		load,
		query = $bindable(''),
		onQueryChange,
		request = '',
		enabled = true,
		readsEmpty = false,
		paging = false,
		debounceMs = SEARCH_DEBOUNCE_MS,
		shell = 'command',
		commandClass,
		onkeydown,
		open = $bindable(false),
		onOpenChange,
		title = 'Search',
		description,
		placeholder = 'Search…',
		emptyLabel = NO_MATCH_LABEL,
		loadingLabel,
		errorLabel,
		errorSlot = 'search-error',
		loadingSlot = 'search-loading',
		emptySlot = 'search-empty',
		skeletonLines,
		skeletonLead,
		rows,
		empty
	}: Props = $props();

	let items = $state<T[]>([]);
	let page = $state(1);
	let hasMore = $state(false);
	let failure = $state<string | null>(null);
	/** True from the first frame where a read is already on its way, so nothing flashes empty. */
	let loading = $state(untrack(() => enabled && queryPlan(query, readsEmpty) !== 'clear'));

	const gate = requestGate();
	const press = pressGate();
	let timer: ReturnType<typeof setTimeout> | undefined;
	let inputEl = $state<HTMLInputElement | null>(null);

	const asked = $derived(readsEmpty || query.trim().length > 0);
	const view = $derived(searchView({ error: failure, loading, count: items.length, asked }));
	const announcement = $derived(
		listStatus(
			{ loading, count: items.length, error: failure, asked },
			{ emptyLabel, loadingLabel, errorLabel }
		)
	);

	async function run(text: string, nextPage: number): Promise<void> {
		const ticket = gate.next();
		loading = true;
		failure = null;
		try {
			const answer = await load({ query: text, page: nextPage });
			if (!gate.holds(ticket)) return;
			items = nextPage === 1 ? answer.items : [...items, ...answer.items];
			page = nextPage;
			hasMore = answer.hasMore ?? false;
		} catch (error) {
			if (!gate.holds(ticket)) return;
			failure = errorText(error);
			items = [];
			hasMore = false;
		} finally {
			if (gate.holds(ticket)) loading = false;
		}
	}

	/**
	 * A press inside the list that replaces the rows leaves the caret on a row that is
	 * gone. The box takes it back, so the arrows go on walking the rows that replaced
	 * them. A shell the press closed keeps the caret: there is nothing left to focus.
	 */
	function refocus(): void {
		if (!press.takes()) return;
		if (shell === 'dialog' && !open) return;
		if (!inputEl?.isConnected) return;
		inputEl.focus({ preventScroll: true });
	}

	/** Empty the list and ask again, at once or once the pause has elapsed. */
	function restart(text: string, on: boolean): void {
		clearTimeout(timer);
		// Taking the next ticket is the cancellation: a read already in flight for what
		// has just been replaced can no longer write its answer.
		gate.cancel();
		items = [];
		page = 1;
		hasMore = false;
		refocus();
		if (!on) {
			loading = false;
			return;
		}
		const plan = queryPlan(text, readsEmpty);
		if (plan === 'clear') {
			loading = false;
			return;
		}
		loading = true;
		if (plan === 'now') {
			void run(text, 1);
			return;
		}
		timer = setTimeout(() => void run(text, 1), debounceMs);
	}

	$effect(() => {
		const text = query;
		const on = enabled;
		void request;
		untrack(() => restart(text, on));
		return () => clearTimeout(timer);
	});

	// A press is read off the command box in capture, so a row that stops the event
	// on its way up still counts as one.
	$effect(() => {
		const root = inputEl?.closest('[data-slot="command"]');
		if (!root) return;
		const mark = (): void => press.mark();
		root.addEventListener('pointerdown', mark, true);
		root.addEventListener('click', mark, true);
		return () => {
			root.removeEventListener('pointerdown', mark, true);
			root.removeEventListener('click', mark, true);
		};
	});

	/**
	 * Escape is the search box's business only while the query has text: the first press
	 * clears the query and the rows and leaves the caret where it is, and the second is
	 * the shell's, which is what closes a dialog or a popover.
	 */
	function onInputKeydown(event: KeyboardEvent): void {
		if (searchKeyIntent(event.key, { query }).kind !== 'clear') return;
		event.preventDefault();
		event.stopPropagation();
		setQuery('');
	}

	/** The caret's text, written back and announced, as `setOpen` is to `open`. */
	function setQuery(next: string): void {
		if (next === query) return;
		query = next;
		onQueryChange?.(next);
	}

	function setOpen(next: boolean): void {
		if (next === open) return;
		open = next;
		onOpenChange?.(next);
	}
</script>

<!--
	The query lifecycle and the list every search widget in this registry wears.

	The debounce, the ticket that drops an answer the next query replaced, the page and
	its load-more row, the highlight across a page, and the list itself: the error line,
	the skeletons, the empty line, the rows and the live row that says what the list is
	doing. A wrapper supplies the read behind it and draws its own rows.
-->
{#snippet status()}
	<Command.Status data-slot="search-status">{announcement}</Command.Status>
{/snippet}

{#snippet body()}
	{#if view === 'error'}
		<StateLine
			state="error"
			slotName={errorSlot ?? undefined}
			icon={TriangleAlert}
			label={stateLine('error', { errorLabel }, failure)}
		/>
	{:else if view === 'loading'}
		<SearchSkeleton
			slotName={loadingSlot ?? undefined}
			lines={skeletonLines}
			lead={skeletonLead}
			label={stateLine('loading', { loadingLabel })}
		/>
	{:else if view === 'empty'}
		{#if empty}
			{@render empty()}
		{:else}
			<StateLine state="empty" slotName={emptySlot ?? undefined} icon={Search} label={emptyLabel} />
		{/if}
	{:else}
		{@render rows({ items, query, loading })}
		{#if paging && hasMore}
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
{/snippet}

{#snippet inside()}
	<Command.Input
		bind:ref={inputEl}
		value={query}
		{placeholder}
		oninput={(e) => setQuery(e.currentTarget.value)}
		onkeydown={onInputKeydown}
	/>
	{@render status()}
	<Command.List data-sg-search-list>
		{@render body()}
	</Command.List>
{/snippet}

{#if shell === 'bare'}
	{@render status()}
	{@render body()}
{:else if shell === 'dialog'}
	<!-- Server-side matching only, so the list never filters what came back. -->
	<Command.Dialog bind:open={() => open, setOpen} shouldFilter={false} {title} {description}>
		{@render inside()}
	</Command.Dialog>
{:else}
	<!-- Server-side matching only, so the list never filters what came back. -->
	<Command.Root
		shouldFilter={false}
		class={commandClass}
		onkeydown={(event) => onkeydown?.(event, items)}
	>
		{@render inside()}
	</Command.Root>
{/if}
