<script lang="ts">
	import type { CollectionColumn, EntityRef, EntityRow, StatusRecord } from '@sg-widgets/core';
	import { cellValue, condition, createEntitySource, resolveColumns } from '@sg-widgets/core';
	import GroupedList from '$lib/registry/components/grouped-list.svelte';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoClient } from '../_shared/svelte';

	const GROUP = 'step.Step.code';
	const SUB = 'sg_description';
	const SECONDARY = 'due_date';
	const FIELDS = ['content', 'sg_status_list', GROUP, SUB, SECONDARY];

	const context = createDemoContext();
	setDemoClient(context.client);

	const source = createEntitySource({
		client: context.client,
		entityType: 'Task',
		fields: FIELDS,
		// The mock's rows are one project's already; a real site's are not.
		filters: context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null,
		pageSize: 50
	});

	let compact = $state(false);
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
		return { columns, statuses: Object.fromEntries(table) };
	}

	const toggle =
		'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
		'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
		'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
		'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';
</script>

{#snippet leading(row: EntityRow)}
	<StatusBadge code={String(cellValue(row, 'sg_status_list') ?? '')} variant="icon" size="sm" />
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
			groupBy={columns[0]!}
			subLabel={columns[1]!}
			secondary={columns[2]!}
			{statuses}
			{leading}
			selectable
			density={compact ? 'compact' : 'default'}
			onselectionchange={(rows) => (selected = rows)}
		/>
	</div>
{:catch error}
	<p class="text-destructive text-sm">{error.message}</p>
{/await}
