<script lang="ts">
	import EntityTypePicker from '$lib/registry/components/entity-type-picker.svelte';
	import { getDemoContext } from '../_shared/client';

	const context = getDemoContext();

	let one = $state<string | null>('Shot');
	let any = $state<string | null>(null);

	const PRODUCTION = ['Project', 'Sequence', 'Shot', 'Asset', 'Version', 'Task'];

	const group = 'flex flex-col gap-3';
	/** One control per row, at the pane's full width, with its caption above it. */
	const stack = 'flex flex-col gap-4';
	const field = 'flex w-full flex-col gap-2';
	const label = 'text-muted-foreground text-xs';
	const readout = 'text-muted-foreground font-mono text-xs';
</script>

<div class="flex flex-col gap-4">
	<div class={field} data-demo="single">
		<span class={label}>Allow list: the six production types</span>
		<EntityTypePicker {context} bind:value={one} allow={PRODUCTION} />
		<span class={readout}>{one ?? 'null'}</span>
	</div>

	<div class={field} data-demo="deny">
		<span class={label}>Deny list: everything but the two user types</span>
		<EntityTypePicker {context} bind:value={any} deny={['HumanUser', 'ApiUser']} />
		<span class={readout}>{any ?? 'null'}</span>
	</div>

	<div class={group} data-demo="codes">
		<span class={label}>The code under the display name, and without it</span>
		<div class={stack}>
			<div class={field}>
				<span class={label}>With the code</span>
				<EntityTypePicker {context} value="Version" allow={PRODUCTION} />
			</div>
			<div class={field}>
				<span class={label}>Without it</span>
				<EntityTypePicker {context} value="Version" allow={PRODUCTION} showCode={false} />
			</div>
		</div>
	</div>

	<div class={group}>
		<span class={label}>Sizes, read-only and invalid</span>
		<div class={stack}>
			<div class={field}>
				<span class={label}>sm</span>
				<EntityTypePicker {context} value="Shot" size="sm" allow={PRODUCTION} />
			</div>
			<div class={field}>
				<span class={label}>lg</span>
				<EntityTypePicker {context} value="Asset" size="lg" allow={PRODUCTION} />
			</div>
			<div class={field}>
				<span class={label}>Read-only</span>
				<EntityTypePicker {context} value="Task" readonly />
			</div>
			<div class={field}>
				<span class={label}>Invalid</span>
				<EntityTypePicker {context} value={null} invalid />
			</div>
			<div class={field}>
				<span class={label}>Disabled</span>
				<EntityTypePicker {context} value="Version" disabled />
			</div>
		</div>
	</div>
</div>
