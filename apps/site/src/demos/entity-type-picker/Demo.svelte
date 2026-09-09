<script lang="ts">
	import { createSchemaService } from '@sg-widgets/core';
	import EntityTypePicker from '$lib/registry/components/entity-type-picker.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const schema = createSchemaService(setDemoClient());

	let one = $state<string | null>('Shot');
	let many = $state<string[]>(['Version']);

	const PRODUCTION = ['Project', 'Sequence', 'Shot', 'Asset', 'Version', 'Task'];
	const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;
	const label = 'text-muted-foreground text-xs';
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-col gap-2" data-demo="single">
		<span class={label}>Single, allow list: the six production types</span>
		<EntityTypePicker
			{schema}
			value={one}
			onValueChange={(next) => (one = next as string | null)}
			allow={PRODUCTION}
		/>
		<span class="text-muted-foreground font-mono text-xs">{one ?? 'null'}</span>
	</div>

	<div class="flex flex-col gap-2" data-demo="multi">
		<span class={label}>Multi, deny list: everything but the two user types</span>
		<EntityTypePicker
			{schema}
			multiple
			value={many}
			onValueChange={(next) => (many = (next as string[] | null) ?? [])}
			deny={['HumanUser', 'ApiUser']}
			placeholder="Select entity types"
		/>
		<span class="text-muted-foreground font-mono text-xs">[{many.join(', ')}]</span>
	</div>

	<div class="flex flex-col gap-2" data-demo="summary">
		<span class={label}>What the control shows for six selected</span>
		{#each SUMMARIES as summary (summary)}
			<div data-demo-summary={summary}>
				<EntityTypePicker {schema} multiple value={PRODUCTION} {summary} allow={PRODUCTION} clearable={false} />
			</div>
		{/each}
	</div>

	<div class="flex flex-col gap-2" data-demo="codes">
		<span class={label}>The code under the display name, and without it</span>
		<EntityTypePicker {schema} value="Version" allow={PRODUCTION} />
		<EntityTypePicker {schema} value="Version" allow={PRODUCTION} showCode={false} />
	</div>

	<div class="flex flex-col gap-2">
		<span class={label}>Sizes, read-only and invalid</span>
		<EntityTypePicker {schema} value="Shot" size="sm" allow={PRODUCTION} />
		<EntityTypePicker {schema} value="Asset" size="lg" allow={PRODUCTION} />
		<EntityTypePicker {schema} value="Task" readonly />
		<EntityTypePicker {schema} value={null} invalid />
		<EntityTypePicker {schema} value="Version" disabled />
	</div>
</div>
