<script lang="ts">
	import { createSchemaService } from '@sg-widgets/core';
	import ColumnPicker from '$lib/registry/components/column-picker.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const schema = createSchemaService(setDemoClient());

	let columns = $state(['code', 'sg_status_list', 'entity.Shot.sg_turnover_date']);
	let dates = $state(['entity.Shot.sg_turnover_date']);
	let dual = $state(['code', 'sg_cut_in']);

	const label = 'text-muted-foreground text-xs';
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-2" data-demo="columns">
		<span class={label}>Columns on Version: pick a field, then drag the list into order</span>
		<ColumnPicker
			{schema}
			entityType="Version"
			showCount
			value={columns}
			onValueChange={(next) => (columns = next)}
		/>
		<span class="text-muted-foreground font-mono text-xs">[{columns.join(', ')}]</span>
	</div>

	<div class="flex flex-col gap-2" data-demo="dates">
		<span class={label}>Dates only: links stay on the list, so a date behind one is reachable</span>
		<ColumnPicker
			{schema}
			entityType="Version"
			dataTypes="date"
			value={dates}
			onValueChange={(next) => (dates = next)}
		/>
	</div>

	<div class="flex flex-col gap-2" data-demo="dual">
		<span class={label}>Dual: the fields of the type on the left, the chosen paths on the right</span>
		<ColumnPicker
			{schema}
			entityType="Shot"
			layout="dual"
			filterableOnly
			value={dual}
			onValueChange={(next) => (dual = next)}
		/>
	</div>

	<div class="flex flex-col gap-2" data-demo="disabled">
		<span class={label}>Disabled</span>
		<ColumnPicker {schema} entityType="Shot" value={['code', 'sg_cut_in']} disabled />
	</div>

	<div class="flex flex-col gap-2" data-demo="readonly">
		<span class={label}>Read-only: the chosen list alone</span>
		<ColumnPicker {schema} entityType="Shot" value={['code', 'sg_cut_in']} readonly />
	</div>
</div>
