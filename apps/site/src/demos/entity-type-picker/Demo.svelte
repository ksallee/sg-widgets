<script lang="ts">
	import EntityTypePicker from '$lib/registry/components/entity-type-picker.svelte';
	import { getDemoContext } from '../_shared/client';

	const context = getDemoContext();

	let one = $state<string | null>('Shot');
	let many = $state<string[]>(['Version']);

	const PRODUCTION = ['Project', 'Sequence', 'Shot', 'Asset', 'Version', 'Task'];
	const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;

	const group = 'flex flex-col gap-3';
	/** One control per row, at the pane's full width, with its caption above it. */
	const stack = 'flex flex-col gap-4';
	const field = 'flex w-full flex-col gap-2';
	const label = 'text-muted-foreground text-xs';
	const readout = 'text-muted-foreground font-mono text-xs';
	/** At most 20rem, so the fit has something to cut against. */
	const narrow = 'max-w-80';
</script>

<div class="flex flex-col gap-4">
	<div class={field} data-demo="single">
		<span class={label}>Single, allow list: the six production types</span>
		<EntityTypePicker
			{context}
			value={one}
			onValueChange={(next) => (one = next as string | null)}
			allow={PRODUCTION}
		/>
		<span class={readout}>{one ?? 'null'}</span>
	</div>

	<div class={field} data-demo="multi">
		<span class={label}>Multi, deny list: everything but the two user types</span>
		<EntityTypePicker
			{context}
			multiple
			value={many}
			onValueChange={(next) => (many = (next as string[] | null) ?? [])}
			deny={['HumanUser', 'ApiUser']}
			placeholder="Select entity types"
		/>
		<span class={readout}>[{many.join(', ')}]</span>
	</div>

	<div class={group} data-demo="summary">
		<span class={label}>What the control shows for six selected, wide and narrow</span>
		<div class={stack}>
			{#each SUMMARIES as summary (summary)}
				<div class={field} data-demo-summary={summary}>
					<span class={label}>{summary}, full width</span>
					<EntityTypePicker
						{context}
						multiple
						value={PRODUCTION}
						{summary}
						allow={PRODUCTION}
						clearable={false}
					/>
				</div>
				<div class={field} data-demo-summary="{summary}-narrow">
					<span class={label}>{summary}, at most 20rem</span>
					<div class={narrow}>
						<EntityTypePicker
							{context}
							multiple
							value={PRODUCTION}
							{summary}
							allow={PRODUCTION}
							clearable={false}
						/>
					</div>
				</div>
			{/each}
		</div>
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
