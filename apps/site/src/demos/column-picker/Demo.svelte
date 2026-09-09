<script lang="ts">
	import { createSchemaService } from '@sg-widgets/core';
	import ColumnPicker from '$lib/registry/components/column-picker.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const schema = createSchemaService(setDemoClient());

	let columns = $state(['code', 'sg_status_list', 'entity.Shot.sg_turnover_date']);
	let compact = $state(['code', 'sg_version_type']);

	const label = 'text-muted-foreground text-xs';
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-2" data-demo="ordered">
		<span class={label}>Ordered columns on Version: add, drag a grip, or Alt with an arrow key</span>
		<ColumnPicker
			{schema}
			entityType="Version"
			value={columns}
			onValueChange={(next) => (columns = next)}
		/>
		<span class="text-muted-foreground font-mono text-xs">[{columns.join(', ')}]</span>
	</div>

	<div class="flex flex-col gap-2" data-demo="compact">
		<span class={label}>Compact: inline chips, no ordering</span>
		<ColumnPicker
			{schema}
			entityType="Shot"
			compact
			filterableOnly
			value={compact}
			onValueChange={(next) => (compact = next)}
		/>
	</div>

	<div class="flex flex-col gap-2">
		<span class={label}>Read-only</span>
		<ColumnPicker {schema} entityType="Shot" value={['code', 'sg_cut_in']} readonly />
	</div>
</div>
