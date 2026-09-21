<script lang="ts">
	import type { CollectionColumn, SortKey, SortSpec, StatusRecord } from 'sg-widgets-core';
	import {
		createEntitySource,
		emptyFilter,
		fromSortString,
		resolveColumns,
		serializeSort,
		toSortString
	} from 'sg-widgets-core';
	import EntityTable from '$lib/registry/components/entity-table.svelte';
	import SortPicker from '$lib/registry/components/sort-picker.svelte';
	import { CONTROL_BUTTON, type ControlSize } from '$lib/registry/components/control-classes.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';
	import { RESULT_PAGE_SIZE, scopeToProject } from '../_shared/results';

	const COLUMNS = [
		{ path: 'code', width: 200 },
		{ path: 'sg_status_list', width: 130 },
		{ path: 'sg_sequence', width: 150 },
		{ path: 'sg_shot_type', width: 130 },
		{ path: 'updated_at', width: 170 }
	];

	const INITIAL: SortKey[] = [
		{ field: 'sg_status_list', direction: 'asc' },
		{ field: 'code', direction: 'desc' }
	];
	const SIZES: ControlSize[] = ['sm', 'md', 'lg'];

	/** The keys as the source takes them, read back out of the string the picker emits. */
	function specs(sort: string): SortSpec[] {
		return fromSortString(sort).map((key) => ({ path: key.field, descending: key.direction === 'desc' }));
	}

	const context = createDemoContext();
	setDemoContext(context);

	let value = $state<SortKey[]>(INITIAL);

	const sort = $derived(toSortString(value));

	const source = createEntitySource({
		client: context.client,
		entityType: 'Shot',
		fields: COLUMNS.map((column) => column.path),
		filters: scopeToProject(context, emptyFilter()),
		sort: specs(toSortString(INITIAL)),
		pageSize: RESULT_PAGE_SIZE
	});

	$effect(() => {
		// A key the site cannot sort on is a silent no-op or a refusal, never a crash: the
		// table shows whichever it was (026_result_order).
		if ((serializeSort(source.sort) ?? '') !== sort) void source.setSort(specs(sort));
	});

	async function load(): Promise<{ columns: CollectionColumn[]; statuses: Record<string, StatusRecord> }> {
		const [columns, table] = await Promise.all([
			resolveColumns(context.schema, 'Shot', COLUMNS),
			context.statuses.byCode()
		]);
		return { columns, statuses: Object.fromEntries(table) };
	}

	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
</script>

<div class="flex min-w-0 flex-col gap-4">
	<SortPicker entityType="Shot" {context} bind:value />

	<section class="flex flex-col gap-2">
		<h4 class={label}>sort</h4>
		<pre
			data-testid="sort-string"
			class="border-border bg-muted text-foreground overflow-auto rounded-lg border p-3 font-mono text-xs">{sort ||
				'(none)'}</pre>
	</section>

	<section class="flex min-w-0 flex-col gap-2">
		<h4 class={label}>Shots in that order</h4>
		{#await load()}
			<p class="text-muted-foreground text-sm">Loading the site…</p>
		{:then { columns, statuses }}
			<EntityTable {source} {columns} {statuses} maxHeight="20rem" emptyLabel="No Shot to order" />
		{:catch error}
			<p class="text-destructive text-sm">{error.message}</p>
		{/await}
	</section>

	<section class="flex flex-col gap-2">
		<h4 class={label}>Sizes, each beside a button of the same step</h4>
		{#each SIZES as size (size)}
			<div class="flex flex-wrap items-start gap-3" data-demo="size-{size}">
				<div class="w-64">
					<SortPicker entityType="Shot" {context} value={INITIAL} {size} />
				</div>
				<Button variant="outline" size={CONTROL_BUTTON[size]}>Button</Button>
			</div>
		{/each}
	</section>
</div>
