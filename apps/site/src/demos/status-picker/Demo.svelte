<script lang="ts">
	import StatusPicker from '$lib/registry/components/status-picker.svelte';
	import { getDemoContext } from '../_shared/client';

	// The shared context: every picker on the page reads the Status table through it, once.
	// Live mode has one project, the toolbar's; the mock has 70 and 71.
	const context = getDemoContext();
	const projectId = context.projectId;
	const otherProjectId = context.projectFor(71);

	let inProjectA = $state<string | undefined>('ip');
	let inProjectB = $state<string | undefined>('pndad');
	let shared = $state<string | undefined>(undefined);
	let project = $state<string | undefined>('Active');
	let unknown = $state<string | undefined>('zz_retired');
	let switching = $state<string | undefined>('part');
	let switchTo = $state(otherProjectId);

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const row = 'flex flex-wrap items-start gap-3';
	const box = 'w-64';
	const readout = 'text-muted-foreground font-mono text-xs tabular-nums';
</script>

<div class="flex flex-col gap-4">
	<section class={group}>
		<h4 class={label}>
			{projectId === otherProjectId
				? `Version, in project ${projectId}`
				: `Version, in project ${projectId} and in project ${otherProjectId}`}
		</h4>
		<div class={row}>
			<div class={box} data-demo="p70">
				<StatusPicker {context} entityType="Version" {projectId} bind:value={inProjectA} />
			</div>
			<div class={box} data-demo="p71">
				<StatusPicker {context} entityType="Version" projectId={otherProjectId} bind:value={inProjectB} />
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>The statuses both projects offer</h4>
		<div class={row}>
			<div class={box} data-demo="both">
				<StatusPicker {context} entityType="Version" projectIds={[projectId, otherProjectId]} bind:value={shared} />
			</div>
			<span class={readout}>{shared ?? '—'}</span>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Project, whose status field is a plain list with no icons</h4>
		<div class={row}>
			<div class={box} data-demo="project">
				<StatusPicker {context} entityType="Project" bind:value={project} />
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>A code the field does not carry, and the code instead of the label</h4>
		<div class={row}>
			<div class={box} data-demo="unknown">
				<StatusPicker {context} entityType="Version" {projectId} bind:value={unknown} />
			</div>
			<div class={box}>
				<StatusPicker
					{context}
					entityType="Version"
					{projectId}
					value="ip"
					showCode
					clearable={false}
				/>
			</div>
		</div>
	</section>

	<section class={group} data-demo="switch">
		<h4 class={label}>Switching project drops a status the new one hides</h4>
		<div class={row}>
			<div class={box} data-demo="switching">
				<StatusPicker {context} entityType="Version" projectId={switchTo} bind:value={switching} />
			</div>
			<button
				type="button"
				class="border-border hover:bg-accent hover:text-accent-foreground h-9 rounded-md border px-2 text-sm transition-colors duration-150 ease-out"
				onclick={() => (switchTo = switchTo === projectId ? otherProjectId : projectId)}
			>
				Project {switchTo}
			</button>
			<span class={readout}>{switching ?? '—'}</span>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Disabled, read-only, invalid</h4>
		<div class={row}>
			<div class={box}>
				<StatusPicker {context} entityType="Version" {projectId} value="apr" disabled />
			</div>
			<div class={box}>
				<StatusPicker {context} entityType="Version" {projectId} value="apr" readonly />
			</div>
			<div class={box}>
				<StatusPicker {context} entityType="Version" {projectId} value="apr" invalid />
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Sizes</h4>
		<div class={row}>
			<div class={box}>
				<StatusPicker {context} entityType="Version" {projectId} value="rev" size="sm" />
			</div>
			<div class={box}>
				<StatusPicker {context} entityType="Version" {projectId} value="rev" size="md" />
			</div>
			<div class={box}>
				<StatusPicker {context} entityType="Version" {projectId} value="rev" size="lg" />
			</div>
		</div>
	</section>
</div>
