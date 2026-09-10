<script lang="ts">
	import type { CollectionColumn, EntityRef, FilterGroup, SortKey, StatusRecord } from '@sg-widgets/core';
	import {
		condition,
		createEntitySource,
		emptyFilter,
		group,
		resolveColumns,
		toSortSpecs
	} from '@sg-widgets/core';
	import ColumnPicker from '$lib/registry/components/column-picker.svelte';
	import EntityTable from '$lib/registry/components/entity-table.svelte';
	import FilterBar from '$lib/registry/components/filter-bar.svelte';
	import SortPicker from '$lib/registry/components/sort-picker.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';

	const WIDTHS: Record<string, number> = {
		code: 260,
		entity: 150,
		sg_status_list: 150,
		image: 90,
		description: 260,
		user: 160,
		created_at: 170,
		updated_at: 170
	};
	const PATHS = Object.keys(WIDTHS);
	const SHOWN = ['code', 'entity', 'sg_status_list', 'image', 'description', 'user'];
	const FACETS = ['sg_status_list'];

	const context = createDemoContext({ counts: { versions: 320 } });
	setDemoContext(context);

	// The mock's rows are one project's already; a real site's are not.
	const scope = context.live
		? group('and', [condition('project', 'is', { type: 'Project', id: context.projectId })])
		: null;

	const source = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: PATHS,
		filters: scope,
		mode: 'pages',
		pageSize: 25
	});

	let columns = $state<CollectionColumn[]>([]);
	let filter = $state<FilterGroup>(emptyFilter());
	let sortKeys = $state<SortKey[]>([]);
	let selected = $state<EntityRef[]>([]);
	let picking = $state(false);
	let grouped = $state(false);
	let compact = $state(false);

	async function load(): Promise<{ statuses: Record<string, StatusRecord> }> {
		const [resolved, table] = await Promise.all([
			resolveColumns(
				context.schema,
				'Version',
				SHOWN.map((path) => ({ path, width: WIDTHS[path] }))
			),
			context.statuses.byCode()
		]);
		columns = resolved;
		return { statuses: Object.fromEntries(table) };
	}

	async function pickColumns(paths: string[]): Promise<void> {
		columns = await resolveColumns(
			context.schema,
			'Version',
			paths.map((path) => ({ path, width: WIDTHS[path] }))
		);
	}

	const toggle =
		'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
		'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
		'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
		'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';
</script>

{#await load()}
	<p class="text-muted-foreground text-sm">Loading the site…</p>
{:then { statuses }}
	<div class="flex w-full min-w-0 flex-col gap-3">
		<div class="flex flex-wrap items-center gap-2">
			<button type="button" class={toggle} aria-pressed={grouped} onclick={() => (grouped = !grouped)}>
				Group by status
			</button>
			<button type="button" class={toggle} aria-pressed={compact} onclick={() => (compact = !compact)}>
				Compact
			</button>
			<span class="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
				{selected.length} selected
			</span>
		</div>
		<EntityTable
			{source}
			bind:columns
			bind:selection={selected}
			filters={filter}
			sort={toSortSpecs(sortKeys)}
			{statuses}
			{context}
			selectable
			editable
			density={compact ? 'compact' : 'default'}
			groupBy={grouped ? 'sg_status_list' : null}
		>
			{#snippet toolbarStart()}
				<FilterBar entityType="Version" {context} facets={FACETS} baseFilter={scope} size="sm" bind:value={filter} />
				<div class="flex flex-col gap-2">
					<button type="button" class={toggle} aria-pressed={picking} onclick={() => (picking = !picking)}>
						Columns
					</button>
					{#if picking}
						<div class="w-56">
							<ColumnPicker
								{context}
								entityType="Version"
								size="sm"
								deepLinks={false}
								filter={(_field, path) => PATHS.includes(path)}
								placeholder="Add a column"
								value={columns.map((column) => column.path)}
								onValueChange={(paths) => void pickColumns(paths)}
							/>
						</div>
					{/if}
				</div>
			{/snippet}
			{#snippet toolbarEnd()}
				<SortPicker entityType="Version" {context} size="sm" bind:value={sortKeys} />
			{/snippet}
		</EntityTable>
	</div>
{:catch error}
	<p class="text-destructive text-sm">{error.message}</p>
{/await}
