<script lang="ts">
	import type { CollectionColumn, EntityRef, FieldSchema, StatusRecord } from '@sg-widgets/core';
	import { condition, createEntitySource, resolveColumns } from '@sg-widgets/core';
	import EntityGrid from '$lib/registry/components/entity-grid.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoClient } from '../_shared/svelte';

	const SUB = 'user';
	const EXTRA = ['created_at'];
	const FIELDS = ['code', 'image', 'sg_status_list', SUB, ...EXTRA];

	const context = createDemoContext();
	setDemoClient(context.client);

	const source = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: FIELDS,
		// The mock's rows are one project's already; a real site's are not.
		filters: context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null,
		pageSize: 12
	});

	let size = $state<'sm' | 'md' | 'lg'>('md');
	let selected = $state<EntityRef[]>([]);

	async function load(): Promise<{
		subLabel: CollectionColumn;
		fields: CollectionColumn[];
		statusField: FieldSchema | null;
		statuses: Record<string, StatusRecord>;
	}> {
		const [resolved, schema, table] = await Promise.all([
			resolveColumns(context.schema, 'Version', [SUB, ...EXTRA]),
			context.schema.fields('Version'),
			context.statuses.byCode()
		]);
		void source.count();
		return {
			subLabel: resolved[0]!,
			fields: resolved.slice(1),
			statusField: schema['sg_status_list'] ?? null,
			statuses: Object.fromEntries(table)
		};
	}

	const toggle =
		'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
		'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
		'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
		'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';
</script>

{#await load()}
	<p class="text-muted-foreground text-sm">Loading the site…</p>
{:then { subLabel, fields, statusField, statuses }}
	<div class="flex w-full min-w-0 flex-col gap-3">
		<div class="flex flex-wrap items-center gap-2">
			{#each ['sm', 'md', 'lg'] as const as option (option)}
				<button type="button" class={toggle} aria-pressed={size === option} onclick={() => (size = option)}>
					{option}
				</button>
			{/each}
			<span class="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
				{selected.length} selected
			</span>
		</div>
		<EntityGrid
			{source}
			{context}
			subLabelField={subLabel}
			secondaryField="id"
			{fields}
			{statusField}
			{statuses}
			{size}
			selectable
			maxHeight="26rem"
			onselectionchange={(rows) => (selected = rows)}
		/>
	</div>
{:catch error}
	<p class="text-destructive text-sm">{error.message}</p>
{/await}
