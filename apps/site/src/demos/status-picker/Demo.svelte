<script lang="ts">
	import StatusPicker from '$lib/registry/components/status-picker.svelte';
	import { getDemoContext } from '../_shared/client';

	// The shared context: every picker on the page reads the Status table through it, once.
	// Live mode has one project, the toolbar's; the mock has 70 and 71.
	const context = getDemoContext();
	const projectId = context.projectId;
	const otherProjectId = context.projectFor(71);

	let inProjectA = $state<string | null>('ip');
	let inProjectB = $state<string | null>('pndad');
	let shared = $state<string | null>(null);
	let project = $state<string | null>('Active');
	let unknown = $state<string | null>('zz_retired');
	let note = $state<string | null>('opn');
	let switching = $state<string | null>('part');
	let switchTo = $state(otherProjectId);

	/** Whether each type's status field is mandatory, read from the schema and written on the cells. */
	let mandatory = $state<Record<string, boolean>>({});
	for (const type of ['Version', 'Project', 'Note']) {
		void context.schema.statusField(type).then((found) => {
			mandatory[type] = typeof found !== 'string' && Boolean(found.mandatory);
		});
	}
	const flag = (type: string) => (type in mandatory ? String(mandatory[type]) : undefined);

	/** An invented pipeline stage per code, for the row secondary a caller supplies. */
	const STAGE: Record<string, string> = { ip: 'Animation', rev: 'Review', fin: 'Delivery' };
	const stageOf = (option: { code: string }) => STAGE[option.code] ?? '';

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
			<div class={box} data-demo="p70" data-field-mandatory={flag('Version')}>
				<StatusPicker {context} entityType="Version" {projectId} bind:value={inProjectA} />
			</div>
			<div class={box} data-demo="p71" data-field-mandatory={flag('Version')}>
				<StatusPicker {context} entityType="Version" projectId={otherProjectId} bind:value={inProjectB} />
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>The statuses both projects offer</h4>
		<div class={row}>
			<div class={box} data-demo="both" data-field-mandatory={flag('Version')}>
				<StatusPicker {context} entityType="Version" projectIds={[projectId, otherProjectId]} bind:value={shared} />
			</div>
			<span class={readout}>{shared ?? '—'}</span>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Project, whose status field is a plain list with no icons</h4>
		<div class={row}>
			<div class={box} data-demo="project" data-field-mandatory={flag('Project')}>
				<StatusPicker {context} entityType="Project" bind:value={project} />
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>A mandatory field, which offers no clear</h4>
		<div class={row}>
			<div class={box} data-demo="mandatory" data-field-mandatory={flag('Note')}>
				<StatusPicker {context} entityType="Note" bind:value={note} />
			</div>
			<span class={readout}>{note ?? '—'}</span>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>A code the field does not carry, rows without the code, and a secondary of the caller's own</h4>
		<div class={row}>
			<div class={box} data-demo="unknown" data-field-mandatory={flag('Version')}>
				<StatusPicker {context} entityType="Version" {projectId} bind:value={unknown} />
			</div>
			<div class={box} data-demo="no-code" data-field-mandatory={flag('Version')}>
				<StatusPicker
					{context}
					entityType="Version"
					{projectId}
					value="ip"
					showCode={false}
					clearable={false}
				/>
			</div>
			<div class={box} data-demo="own-secondary" data-field-mandatory={flag('Version')}>
				<StatusPicker
					{context}
					entityType="Version"
					{projectId}
					value="ip"
					secondary={stageOf}
					clearable={false}
				/>
			</div>
		</div>
	</section>

	<section class={group} data-demo="switch">
		<h4 class={label}>Switching project drops a status the new one hides</h4>
		<div class={row}>
			<div class={box} data-demo="switching" data-field-mandatory={flag('Version')}>
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
