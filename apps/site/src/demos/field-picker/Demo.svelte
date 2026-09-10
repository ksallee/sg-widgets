<script lang="ts">
	import FieldPicker from '$lib/registry/components/field-picker.svelte';
	import { getDemoContext } from '../_shared/client';

	const context = getDemoContext();

	let free = $state('');
	let dated = $state('');
	let preset = $state('entity.Shot.sg_turnover_date');
	let computed = $state('');

	const label = 'text-muted-foreground text-xs';
	const path = 'text-muted-foreground font-mono text-xs';
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-2" data-demo="free">
		<span class={label}>Version, deep links on: Link asks which type, Project descends at once</span>
		<FieldPicker
			{context}
			entityType="Version"
			deepLinks
			value={free}
			onValueChange={(next) => (free = next)}
		/>
		<span class={path}>{free || '—'}</span>
	</div>

	<div class="flex flex-col gap-2" data-demo="dates">
		<span class={label}>Restricted to dates: links stay on the list so a nested date is reachable</span>
		<FieldPicker
			{context}
			entityType="Version"
			deepLinks
			dataTypes={['date', 'date_time']}
			value={dated}
			onValueChange={(next) => (dated = next)}
			placeholder="Select a date field"
		/>
		<span class={path}>{dated || '—'}</span>
	</div>

	<div class="flex flex-col gap-2" data-demo="preset">
		<span class={label}>A dotted value, shown as its friendly path</span>
		<FieldPicker
			{context}
			entityType="Version"
			deepLinks
			value={preset}
			onValueChange={(next) => (preset = next)}
		/>
		<span class={path}>{preset || '—'}</span>
	</div>

	<div class="flex flex-col gap-2" data-demo="computed">
		<span class={label}>Filterable types only, with two computed columns and a hidden path</span>
		<FieldPicker
			{context}
			entityType="Shot"
			filterableOnly
			hidePaths={['image']}
			extraFields={[
				{ name: 'row_number', displayName: 'Row Number' },
				{ name: 'note_count', displayName: 'Note Count' }
			]}
			value={computed}
			onValueChange={(next) => (computed = next)}
		/>
		<span class={path}>{computed || '—'}</span>
	</div>

	<div class="flex flex-col gap-2">
		<span class={label}>Sizes, read-only and invalid</span>
		<FieldPicker {context} entityType="Shot" value="code" size="sm" />
		<FieldPicker {context} entityType="Shot" value="sg_status_list" size="lg" />
		<FieldPicker {context} entityType="Shot" value="description" readonly />
		<FieldPicker {context} entityType="Shot" value="" invalid />
		<FieldPicker {context} entityType="Shot" value="sg_cut_in" disabled />
	</div>
</div>
