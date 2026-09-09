<script lang="ts">
	import type { CollectionColumn, EntityRef, StatusRecord } from '@sg-widgets/core';
	import { createEntitySource, resolveColumns } from '@sg-widgets/core';
	import EntityTable from '$lib/registry/components/entity-table.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoClient } from '../_shared/svelte';

	const COLUMNS = [
		{ path: 'code', width: 260 },
		{ path: 'entity', width: 150 },
		{ path: 'sg_status_list', width: 150 },
		{ path: 'image', width: 90 },
		{ path: 'description', width: 260 },
		{ path: 'user', width: 160 },
		{ path: 'created_at', width: 170 },
		{ path: 'updated_at', width: 170 }
	];

	const context = createDemoContext({ counts: { versions: 320 } });
	setDemoClient(context.client);

	const source = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: COLUMNS.map((c) => c.path),
		pageSize: 150
	});

	let grouped = $state(false);
	let compact = $state(false);
	let selected = $state<EntityRef[]>([]);

	async function load(): Promise<{ columns: CollectionColumn[]; statuses: Record<string, StatusRecord> }> {
		const [columns, table] = await Promise.all([
			resolveColumns(context.schema, 'Version', COLUMNS),
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

{#await load()}
	<p class="text-muted-foreground text-sm">Loading the site…</p>
{:then { columns, statuses }}
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
			{columns}
			{statuses}
			selectable
			editable
			density={compact ? 'compact' : 'default'}
			groupBy={grouped ? 'sg_status_list' : null}
			onselectionchange={(rows) => (selected = rows)}
		/>
	</div>
{:catch error}
	<p class="text-destructive text-sm">{error.message}</p>
{/await}
