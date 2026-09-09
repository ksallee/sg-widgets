<!--
	The Versions a filter tree matches: a count and the rows behind it.

	The editor emits a tree on every keystroke, so the read is debounced. The count and
	the table come from one source, so both answer the same filter, and a path the site
	refuses fails that read rather than the page: the table shows the refusal in place.
-->
<script lang="ts">
	import type { CollectionColumn, FilterNode, StatusRecord, WireGroup } from '@sg-widgets/core';
	import { createEntitySource, resolveColumns, toApi3Hash } from '@sg-widgets/core';
	import EntityTable from '$lib/registry/components/entity-table.svelte';
	import type { DemoContext } from './client';
	import {
		matchLabel,
		readCount,
		RESULT_DEBOUNCE_MS,
		RESULT_PAGE_SIZE,
		scopeToProject,
		VERSION_COLUMNS,
		type ResultCount
	} from './results';

	let { context, value }: { context: DemoContext; value: FilterNode } = $props();

	// The first tree goes in at construction, so the table's own first read is already
	// the filtered one.
	const source = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: VERSION_COLUMNS.map((column) => column.path),
		filters: scopeToProject(context, value),
		pageSize: RESULT_PAGE_SIZE
	});

	let count = $state<ResultCount>({ kind: 'counting' });

	const wire = $derived(JSON.stringify(toApi3Hash(scopeToProject(context, value))));

	$effect(() => {
		const next = wire;
		let live = true;
		const timer = setTimeout(() => {
			// An unchanged tree only re-counts: setting the same filter would re-read the page.
			if (JSON.stringify(source.filters) !== next) void source.setFilters(JSON.parse(next) as WireGroup | null);
			count = { kind: 'counting' };
			void readCount(() => source.count()).then((answer) => {
				if (live) count = answer;
			});
		}, RESULT_DEBOUNCE_MS);
		return () => {
			live = false;
			clearTimeout(timer);
		};
	});

	async function load(): Promise<{ columns: CollectionColumn[]; statuses: Record<string, StatusRecord> }> {
		const [columns, table] = await Promise.all([
			resolveColumns(context.schema, 'Version', VERSION_COLUMNS),
			context.statuses.byCode()
		]);
		return { columns, statuses: Object.fromEntries(table) };
	}
</script>

<section class="flex min-w-0 flex-col gap-2">
	<h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">Versions matching the filter</h4>
	<p
		class={count.kind === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm tabular-nums'}
		data-testid="result-count"
	>
		{matchLabel(count, 'Version')}
	</p>
	{#await load()}
		<p class="text-muted-foreground text-sm">Loading the site…</p>
	{:then { columns, statuses }}
		<EntityTable {source} {columns} {statuses} maxHeight="20rem" emptyLabel="No Version matches this filter" />
	{:catch error}
		<p class="text-destructive text-sm">{error.message}</p>
	{/await}
</section>
