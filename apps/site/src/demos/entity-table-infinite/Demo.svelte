<script lang="ts">
	import type { CollectionColumn, StatusRecord } from '@sg-widgets/core';
	import { condition, createEntitySource, resolveColumns } from '@sg-widgets/core';
	import EntityTable from '$lib/registry/components/entity-table.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';

	const COLUMNS = [
		{ path: 'code', width: 260 },
		{ path: 'sg_status_list', width: 150 },
		{ path: 'user', width: 160 },
		{ path: 'created_at', width: 170 }
	];

	const context = createDemoContext({ counts: { versions: 320 } });
	setDemoContext(context);

	const source = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: COLUMNS.map((c) => c.path),
		// The mock's rows are one project's already; a real site's are not.
		filters: context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null,
		pageSize: 50
	});

	let columns = $state<CollectionColumn[]>([]);

	async function load(): Promise<{ statuses: Record<string, StatusRecord> }> {
		const [resolved, table] = await Promise.all([
			resolveColumns(context.schema, 'Version', COLUMNS),
			context.statuses.byCode()
		]);
		columns = resolved;
		void source.count();
		return { statuses: Object.fromEntries(table) };
	}
</script>

{#await load()}
	<p class="text-muted-foreground text-sm">Loading the site…</p>
{:then { statuses }}
	<EntityTable {source} bind:columns {statuses} {context} showCode maxHeight="22rem" />
{:catch error}
	<p class="text-destructive text-sm">{error.message}</p>
{/await}
