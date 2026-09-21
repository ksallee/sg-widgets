<script lang="ts">
	import { hasMorePage, matchesEveryWord } from 'sg-widgets-core';
	import * as Command from '$lib/components/ui/command/index.js';
	import SearchControl, { type SearchAnswer, type SearchRequest } from '$lib/registry/components/search-control.svelte';

	/** One crew member, which is all a row of this demo holds. */
	interface Member {
		id: string;
		name: string;
		department: string;
	}

	/** The set every read here answers from. A wrapper's own read is all it adds. */
	const CREW: Member[] = [
		{ id: 'avdm', name: 'Anna van der Meer', department: 'Layout' },
		{ id: 'poos', name: 'Piet Oosterhuis', department: 'Animation' },
		{ id: 'mhal', name: 'Mira Halloran', department: 'Lighting' },
		{ id: 'tber', name: 'Tomas Bergqvist', department: 'Compositing' },
		{ id: 'inak', name: 'Iris Nakamura', department: 'Effects' },
		{ id: 'rcha', name: 'Ravi Chandrasekar', department: 'Matchmove' },
		{ id: 'edua', name: 'Elena Duarte', department: 'Rigging' },
		{ id: 'jkle', name: 'Jonas Klein', department: 'Editorial' },
		{ id: 'nokb', name: 'Nora Okonjo', department: 'Layout' },
		{ id: 'sfer', name: 'Sofia Ferreira', department: 'Animation' },
		{ id: 'lmar', name: 'Luca Marchetti', department: 'Lighting' },
		{ id: 'yhas', name: 'Yuki Hasegawa', department: 'Compositing' }
	];

	/** The page this demo reads at, small enough that a load-more row is always there. */
	const PAGE = 4;

	function pause(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/** One page of the crew matching every word of the query. */
	async function find({ query, page }: SearchRequest): Promise<SearchAnswer<Member>> {
		await pause(300);
		const matched = CREW.filter((member) => matchesEveryWord(`${member.name} ${member.department}`, query));
		const from = (page - 1) * PAGE;
		const items = matched.slice(from, from + PAGE);
		return { items, hasMore: hasMorePage(items.length, PAGE) && from + PAGE < matched.length };
	}

	/** The whole crew, in one read, for a list that takes no query. */
	async function everyone(): Promise<SearchAnswer<Member>> {
		await pause(300);
		return { items: CREW.slice(0, 4) };
	}

	async function fails(): Promise<SearchAnswer<Member>> {
		await pause(300);
		throw new Error('The crew list is not answering.');
	}


	let picked = $state('Nothing yet');

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const row = 'flex w-full min-w-0 items-center gap-2 px-2 py-1.5 text-sm';
	const box = 'border-border flex flex-col rounded-lg border p-1';
</script>

{#snippet member(item: Member)}
	<span class="min-w-0 flex-1 truncate" title={item.name}>{item.name}</span>
	<span class="text-muted-foreground shrink-0 text-xs">{item.department}</span>
{/snippet}

{#snippet found({ items }: { items: Member[]; query: string; loading: boolean })}
	{#each items as item (item.id)}
		<Command.Item value={item.id} data-slot="search-control-option" onSelect={() => (picked = item.name)}>
			{@render member(item)}
		</Command.Item>
	{/each}
{/snippet}

{#snippet listed({ items }: { items: Member[]; query: string; loading: boolean })}
	{#each items as item (item.id)}
		<div data-slot="search-control-option" class={row}>
			{@render member(item)}
		</div>
	{/each}
{/snippet}

<div class="flex flex-col gap-4">
	<section class={group} data-demo-case="search">
		<h4 class={label}>A query, debounced, paged and picked</h4>
		<SearchControl
			load={find}
			commandClass="border-border rounded-lg border"
			placeholder="Search the crew…"
			emptyLabel="No one by that name"
			paging
			rows={found}
		/>
		<p class="text-muted-foreground font-mono text-xs" data-demo="picked">{picked}</p>
	</section>

	<section class={group} data-demo-case="bare">
		<h4 class={label}>No query: one read, the same list</h4>
		<div class={box}>
			<SearchControl load={everyone} shell="bare" readsEmpty skeletonLines={2} rows={listed} />
		</div>
	</section>

	<section class={group} data-demo-case="error">
		<h4 class={label}>A read that failed</h4>
		<div class={box}>
			<SearchControl load={fails} shell="bare" readsEmpty skeletonLines={2} rows={listed} />
		</div>
	</section>
</div>
