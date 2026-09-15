<script lang="ts">
	import type {
		CollapseState,
		CollectionColumn,
		EntityRef,
		EntityRow,
		StatusRecord
	} from '@sg-widgets/core';
	import {
		cellValue,
		collapseAll,
		condition,
		createEntitySource,
		displayNameOf,
		expandAll,
		resolveColumns
	} from '@sg-widgets/core';
	import GroupedList from '$lib/registry/components/grouped-list.svelte';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import { createDemoClient, createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';

	const GROUP = 'step.Step.code';
	const SUB = 'sg_description';
	const SECONDARY = 'due_date';
	const FIELDS = ['content', 'sg_status_list', GROUP, SUB, SECONDARY];

	const context = createDemoContext();
	setDemoContext(context);

	const source = createEntitySource({
		client: context.client,
		entityType: 'Task',
		fields: FIELDS,
		// The mock's rows are one project's already; a real site's are not.
		filters: context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null,
		mode: 'pages',
		pageSize: 25
	});

	/** A filter no Task matches, so the list draws the caller's own empty label. */
	const emptySource = createEntitySource({
		client: context.client,
		entityType: 'Task',
		fields: FIELDS,
		filters: condition('content', 'is', 'no such task'),
		mode: 'pages',
		pageSize: 25
	});

	/**
	 * Versions under the Shot or Asset each is of. The record is `entity`, which the
	 * list does not sort on: the caller's own sort on `code` is what puts the versions
	 * of one record together.
	 */
	const recordSource = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: ['code', 'sg_status_list', 'entity', 'description'],
		filters: context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null,
		sort: [{ path: 'code', descending: false }],
		mode: 'infinite',
		pageSize: 25
	});

	/** A client whose next read can be armed to fail, so the error line is on the page. */
	const failing = createDemoClient();
	const failedSource = createEntitySource({
		client: failing.context.client,
		entityType: 'Task',
		fields: FIELDS,
		mode: 'infinite',
		pageSize: 25
	});

	function armFailure(): void {
		failing.mock.failNext({ status: 503, message: 'Flow PT API error 503' });
		// The read a page already made is cached, so the armed call is only reached
		// once the cache lets it through.
		failing.context.invalidate();
		void failedSource.load();
	}

	let statusTable = $state<Record<string, StatusRecord>>({});
	let compact = $state(false);
	let collapsed = $state<CollapseState>(expandAll());
	let selected = $state<EntityRef[]>([]);

	async function load(): Promise<{
		columns: CollectionColumn[];
		statuses: Record<string, StatusRecord>;
	}> {
		const [columns, table] = await Promise.all([
			resolveColumns(context.schema, 'Task', [GROUP, SUB, SECONDARY]),
			context.statuses.byCode()
		]);
		void source.count();
		statusTable = Object.fromEntries(table);
		return { columns, statuses: statusTable };
	}

	const toggle =
		'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
		'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
		'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
		'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';
</script>

{#snippet leading(row: EntityRow)}
	{@const code = String(cellValue(row, 'sg_status_list') ?? '')}
	<StatusBadge {code} status={statusTable[code] ?? null} variant="glyph" size="sm" />
{/snippet}

{#await load()}
	<p class="text-muted-foreground text-sm">Loading the site…</p>
{:then { columns, statuses }}
	<div class="flex w-full min-w-0 flex-col gap-3">
		<div class="flex flex-wrap items-center gap-2">
			<button type="button" class={toggle} aria-pressed={compact} onclick={() => (compact = !compact)}>
				Compact
			</button>
			<span class="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
				{selected.length} selected
			</span>
		</div>
		<GroupedList
			{source}
			{context}
			paging="pages"
			groupBy={columns[0]!}
			labelField="content"
			subLabelField={columns[1]!}
			secondaryField={columns[2]!}
			{statuses}
			{leading}
			selectable
			density={compact ? 'compact' : 'default'}
			onSelectionChange={(rows) => (selected = rows)}
		/>

		<section class="flex w-full min-w-0 flex-col gap-3" data-demo-case="derived">
			<h4 class="text-muted-foreground text-xs font-medium">Grouped on a derived key</h4>
			<div class="flex flex-wrap items-center gap-2">
				<button type="button" class={toggle} data-demo="collapse-all" onclick={() => (collapsed = collapseAll())}>
					Collapse all
				</button>
				<button type="button" class={toggle} data-demo="expand-all" onclick={() => (collapsed = expandAll())}>
					Expand all
				</button>
			</div>
			<GroupedList
				source={recordSource}
				{context}
				paging="more"
				groupKey={(row) => cellValue(row, 'entity')}
				groupLabel={(record) => displayNameOf(record as Record<string, unknown>)}
				labelField="code"
				subLabelField="description"
				{statuses}
				bind:collapsed
				maxHeight="16rem"
			/>
		</section>

		<section class="flex w-full min-w-0 flex-col gap-3" data-demo-case="states">
			<h4 class="text-muted-foreground text-xs font-medium">Empty and error</h4>
			<GroupedList
				source={emptySource}
				{context}
				paging="pages"
				groupBy={columns[0]!}
				labelField="content"
				{statuses}
				maxHeight="12rem"
				emptyLabel="No Task in this window"
			/>
			<GroupedList
				source={failedSource}
				context={failing.context}
				paging="more"
				groupBy={columns[0]!}
				labelField="content"
				{statuses}
				maxHeight="12rem"
			/>
			<button type="button" class={toggle} data-arm-failure onclick={armFailure}>
				Arm the next read to fail
			</button>
		</section>
	</div>
{:catch error}
	<p class="text-destructive text-sm">{error.message}</p>
{/await}
