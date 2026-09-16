<script lang="ts">
	import type { CollectionColumn, FilterGroup, StatusRecord, WireGroup } from '@sg-widgets/core';
	import { condition, createEntitySource, emptyFilter, group, resolveColumns, toApi3Hash } from '@sg-widgets/core';
	import { Button } from '$lib/components/ui/button/index.js';
	import FilterBar, { type FilterBarSize } from '$lib/registry/components/filter-bar.svelte';
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
	const SIZES: FilterBarSize[] = ['sm', 'md', 'lg'];
	const section = 'flex min-w-0 flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

	/** Four statuses and three kinds ticked: the pill names two and reads the rest as `+n`. */
	const seededTree = () =>
		group('and', [
			condition(GROUP, 'in', ['ip', 'rev', 'apr', 'fin']),
			condition('sg_shot_type', 'in', ['VFX', '2D', 'Full CG'])
		]);

	/** Every status ticked, on a bar that names every value: the pill holds its cap. */
	const everyTree = () =>
		group('and', [condition(GROUP, 'in', ['wtg', 'ip', 'rev', 'apr', 'fin', 'hld', 'omt'])]);

	const context = createDemoContext();
	setDemoContext(context);

	let value = $state<FilterGroup>(emptyFilter());
	/** The read-state bar, over a field the API evaluates only `is` and `is_not` on. */
	let readState = $state<FilterGroup>(emptyFilter());
	let seeded = $state<FilterGroup>(seededTree());
	let every = $state<FilterGroup>(everyTree());
	let sized = $state<Record<FilterBarSize, FilterGroup>>({ sm: seededTree(), md: seededTree(), lg: seededTree() });
	const scope = context.live
		? group('and', [condition('project', 'is', { type: 'Project', id: context.projectId })])
		: null;

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

	const readWire = $derived(toApi3Hash(scopeToProject(context, readState)));
	const readCounted = $derived(countNotes(readWire));

	async function countNotes(filters: WireGroup | null): Promise<number | null> {
		const summary = await context.client.summarize('Note', {
			filters,
			summaryFields: [{ field: 'id', type: 'count' }]
		});
		const total = summary.summaries['id'];
		return typeof total === 'number' ? total : null;
	}

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
		labels={{ sg_shot_type: 'Kind' }}
		baseFilter={scope}
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

	<section class={section} data-demo="seeded">
		<h4 class={label}>Seeded with four statuses and three kinds</h4>
		<FilterBar
			entityType="Shot"
			{context}
			facets={['sg_status_list', 'sg_shot_type']}
			labels={{ sg_shot_type: 'Kind' }}
			baseFilter={scope}
			bind:value={seeded}
		/>
	</section>

	<section class={section} data-demo="every-value">
		<h4 class={label}>Every status ticked, every value named</h4>
		<FilterBar
			entityType="Shot"
			{context}
			facets={['sg_status_list']}
			maxValues={0}
			baseFilter={scope}
			bind:value={every}
		/>
	</section>

	<section class={section}>
		<h4 class={label}>Notes by read state</h4>
		<FilterBar
			entityType="Note"
			{context}
			facets={['read_by_current_user']}
			baseFilter={scope}
			bind:value={readState}
		/>
		<p
			class="text-muted-foreground text-sm tabular-nums"
			data-testid="note-count"
			data-for={JSON.stringify(readWire)}
		>
			{#await readCounted}
				Counting…
			{:then total}
				{total === null ? 'The site answered no count.' : `${total} Note${total === 1 ? '' : 's'} match${total === 1 ? 'es' : ''}`}
			{:catch error}
				{error.message}
			{/await}
		</p>
		<pre
			data-testid="note-filter-json"
			class="border-border bg-muted text-foreground max-h-32 overflow-auto rounded-lg border p-3 font-mono text-xs">{JSON.stringify(
				readWire,
				null,
				2
			)}</pre>
	</section>

	<section class={section} data-demo="sizes">
		<h4 class={label}>Sizes, beside a button of the same size</h4>
		<div class="flex min-w-0 flex-col gap-3">
			{#each SIZES as size (size)}
				<div class="flex min-w-0 items-start gap-3" data-qa-widget="filter-bar" data-qa-size={size}>
					<div class="min-w-0 flex-1">
						<FilterBar
							entityType="Shot"
							{context}
							facets={['sg_status_list', 'sg_shot_type']}
							labels={{ sg_shot_type: 'Kind' }}
							{size}
							baseFilter={scope}
							bind:value={sized[size]}
						/>
					</div>
					<Button variant="outline" size={size === 'md' ? 'default' : size}>{size}</Button>
				</div>
			{/each}
		</div>
	</section>
</div>
