<script lang="ts">
	import type { CollectionColumn, FilterGroup, StatusRecord, WireGroup } from '@sg-widgets/core';
	import { condition, createEntitySource, emptyFilter, group, resolveColumns, toApi3Hash } from '@sg-widgets/core';
	import FilterBar from '$lib/registry/components/filter-bar.svelte';
	import GroupedList from '$lib/registry/components/grouped-list.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';
	import {
		matchLabel,
		readCount,
		RESULT_DEBOUNCE_MS,
		RESULT_PAGE_SIZE,
		scopeToProject,
		type ResultCount
	} from '../_shared/results';

	const GROUP = 'sg_status_list';
	const SUB = 'description';
	const SECONDARY = 'sg_sequence';
	const FIELDS = ['code', GROUP, SUB, SECONDARY];

	const context = createDemoContext();
	setDemoContext(context);

	let value = $state<FilterGroup>(emptyFilter());

	// The first tree goes in at construction, and the group path leads the sort, so the
	// list's own first read is already the one it groups.
	const source = createEntitySource({
		client: context.client,
		entityType: 'Shot',
		fields: FIELDS,
		filters: scopeToProject(context, value),
		sort: [{ path: GROUP, descending: false }],
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
			resolveColumns(context.schema, 'Shot', [GROUP, SUB, SECONDARY]),
			context.statuses.byCode()
		]);
		return { columns, statuses: Object.fromEntries(table) };
	}
</script>

<div class="flex min-w-0 flex-col gap-4">
	<FilterBar
		entityType="Shot"
		{context}
		facets={['sg_status_list', 'sg_sequence', 'sg_shot_type']}
		baseFilter={context.live ? group('and', [condition('project', 'is', { type: 'Project', id: context.projectId })]) : null}
		bind:value
	/>

	<section class="flex min-w-0 flex-col gap-2">
		<h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">Shots matching the filter</h4>
		<p
			class={count.kind === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm tabular-nums'}
			data-testid="result-count"
		>
			{matchLabel(count, 'Shot')}
		</p>
		{#await load()}
			<p class="text-muted-foreground text-sm">Loading the site…</p>
		{:then { columns, statuses }}
			<GroupedList
				{source}
				groupBy={columns[0]!}
				subLabelField={columns[1]!}
				secondaryField={columns[2]!}
				{statuses}
				maxHeight="20rem"
				emptyLabel="No Shot matches this filter"
			/>
		{:catch error}
			<p class="text-destructive text-sm">{error.message}</p>
		{/await}
	</section>
</div>
