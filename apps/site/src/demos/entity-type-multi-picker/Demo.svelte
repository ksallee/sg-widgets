<script lang="ts">
	import EntityTypeMultiPicker from '$lib/registry/components/entity-type-multi-picker.svelte';
	import { getDemoContext } from '../_shared/client';

	const context = getDemoContext();

	let many = $state<string[]>(['Version']);

	const PRODUCTION = ['Project', 'Sequence', 'Shot', 'Asset', 'Version', 'Task'];
	/** Types whose code and display name differ, so the code line has something to show. */
	const MIXED = ['Shot', 'Version', 'HumanUser', 'ApiUser', 'Step'];
	const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;

	/** One value per summary demo, so every control on the page takes an edit. */
	let shown = $state<Record<string, string[]>>({});
	const shownAt = (at: string) => shown[at] ?? PRODUCTION;
	const showAt = (at: string, next: string[]) => (shown = { ...shown, [at]: next });

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
	<div class={field} data-demo="multi">
		<span class={label}>Deny list: everything but the two user types</span>
		<EntityTypeMultiPicker {context} bind:value={many} deny={['HumanUser', 'ApiUser']} />
		<span class={readout}>[{many.join(', ')}]</span>
	</div>

	<div class={group} data-demo="summary">
		<span class={label}>What the control shows for six selected, wide and narrow</span>
		<div class={stack}>
			{#each SUMMARIES as summary (summary)}
				<div class={field} data-demo-summary={summary}>
					<span class={label}>{summary}, full width</span>
					<EntityTypeMultiPicker
						{context}
						value={shownAt(summary)}
						onValueChange={(next) => showAt(summary, next)}
						{summary}
						allow={PRODUCTION}
						clearable={false}
					/>
				</div>
				<div class={field} data-demo-summary="{summary}-narrow">
					<span class={label}>{summary}, at most 20rem</span>
					<div class={narrow}>
						<EntityTypeMultiPicker
							{context}
							value={shownAt(`${summary}-narrow`)}
							onValueChange={(next) => showAt(`${summary}-narrow`, next)}
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
				<EntityTypeMultiPicker {context} value={['Version']} allow={MIXED} />
			</div>
			<div class={field}>
				<span class={label}>Without it</span>
				<EntityTypeMultiPicker {context} value={['Version']} allow={MIXED} showCode={false} />
			</div>
		</div>
	</div>

	<div class={group}>
		<span class={label}>Sizes, read-only and invalid</span>
		<div class={stack}>
			<div class={field}>
				<span class={label}>sm</span>
				<EntityTypeMultiPicker {context} value={['Shot', 'Asset']} size="sm" allow={PRODUCTION} />
			</div>
			<div class={field}>
				<span class={label}>lg</span>
				<EntityTypeMultiPicker {context} value={['Shot', 'Asset']} size="lg" allow={PRODUCTION} />
			</div>
			<div class={field}>
				<span class={label}>Read-only</span>
				<EntityTypeMultiPicker {context} value={['Task']} readonly />
			</div>
			<div class={field}>
				<span class={label}>Invalid</span>
				<EntityTypeMultiPicker {context} value={[]} invalid />
			</div>
			<div class={field}>
				<span class={label}>Disabled</span>
				<EntityTypeMultiPicker {context} value={['Version']} disabled />
			</div>
		</div>
	</div>
</div>
