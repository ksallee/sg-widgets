<script lang="ts">
	import StatusMultiPicker from '$lib/registry/components/status-multi-picker.svelte';
	import { createDemoContext } from '../_shared/client';

	// Live mode has one project, the toolbar's; the mock has 70 and 71.
	const context = createDemoContext();
	const projectId = context.projectId;
	const otherProjectId = context.projectFor(71);

	let inProjectA = $state<string[]>(['ip', 'apr']);
	let inProjectB = $state<string[]>(['pndad']);
	let shared = $state<string[]>([]);
	let project = $state<string[]>(['Active', 'Bidding']);
	let unknown = $state<string[]>(['zz_retired', 'rev']);

	const MODES = ['chips', 'ellipsis', 'count'] as const;
	const BADGES = ['both', 'icon', 'text'] as const;
	const TWO = ['ip', 'apr'];
	const FIVE = ['ip', 'apr', 'rev', 'fin', 'vwd'];

	/** An invented pipeline stage per code, for the row secondary a caller supplies. */
	const STAGE: Record<string, string> = { ip: 'Animation', rev: 'Review', fin: 'Delivery' };
	const stageOf = (option: { code: string }) => STAGE[option.code] ?? '';

	const group = 'flex flex-col gap-3';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	/** One control per row, at the pane's full width, with its caption above it. */
	const stack = 'flex flex-col gap-4';
	const field = 'flex w-full flex-col gap-2';
	const caption = 'text-muted-foreground text-xs';
	/** At most 20rem, so the fit has something to cut against. */
	const narrow = 'max-w-80';
	const readout = 'text-muted-foreground font-mono text-xs tabular-nums';
</script>

<div class="flex flex-col gap-4">
	<section class={group}>
		<h4 class={label}>
			{projectId === otherProjectId
				? `Version, in project ${projectId}`
				: `Version, in project ${projectId} and in project ${otherProjectId}`}
		</h4>
		<div class={stack}>
			<div class={field} data-demo="p70">
				<span class={caption}>Project {projectId}</span>
				<StatusMultiPicker {context} entityType="Version" {projectId} bind:value={inProjectA} />
			</div>
			<div class={field} data-demo="p71">
				<span class={caption}>Project {otherProjectId}</span>
				<StatusMultiPicker {context} entityType="Version" projectId={otherProjectId} bind:value={inProjectB} />
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>The statuses both projects offer</h4>
		<div class={stack}>
			<div class={field} data-demo="both">
				<span class={caption}>The intersection of both projects' codes</span>
				<StatusMultiPicker
					{context}
					entityType="Version"
					projectIds={[projectId, otherProjectId]}
					bind:value={shared}
				/>
				<span class={readout}>{shared.join(', ') || '—'}</span>
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Project, whose status field is a plain list with no icons</h4>
		<div class={stack}>
			<div class={field} data-demo="project">
				<span class={caption}>Project's own status field</span>
				<StatusMultiPicker {context} entityType="Project" bind:value={project} />
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>A code the field does not carry, rows without the code, and a secondary of the caller's own</h4>
		<div class={stack}>
			<div class={field} data-demo="unknown">
				<span class={caption}>A code the field does not carry</span>
				<StatusMultiPicker {context} entityType="Version" {projectId} bind:value={unknown} />
			</div>
			<div class={field} data-demo="no-code">
				<span class={caption}>Rows with the label alone</span>
				<StatusMultiPicker
					{context}
					entityType="Version"
					{projectId}
					value={['ip', 'fin']}
					showCode={false}
					clearable={false}
				/>
			</div>
			<div class={field} data-demo="own-secondary">
				<span class={caption}>A secondary of the caller's own, in place of the code</span>
				<StatusMultiPicker
					{context}
					entityType="Version"
					{projectId}
					value={['ip', 'fin']}
					secondary={stageOf}
					clearable={false}
				/>
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>What the closed trigger shows for five selected, wide and narrow</h4>
		<div class={stack}>
			{#each MODES as mode (mode)}
				<div class={field} data-demo="summary-{mode}-5">
					<span class={caption}>{mode}, full width</span>
					<StatusMultiPicker
						{context}
						entityType="Version"
						{projectId}
						value={FIVE}
						summary={mode}
						clearable={false}
					/>
				</div>
				<div class={field} data-demo="summary-{mode}-narrow">
					<span class={caption}>{mode}, at most 20rem</span>
					<div class={narrow}>
						<StatusMultiPicker
							{context}
							entityType="Version"
							{projectId}
							value={FIVE}
							summary={mode}
							clearable={false}
						/>
					</div>
				</div>
			{/each}
			<div class={field} data-demo="summary-chips-2">
				<span class={caption}>chips, two selected</span>
				<StatusMultiPicker
					{context}
					entityType="Version"
					{projectId}
					value={TWO}
					summary="chips"
					clearable={false}
				/>
			</div>
			<div class={field} data-demo="badge-text-2">
				<span class={caption}>text badges, two selected</span>
				<StatusMultiPicker
					{context}
					entityType="Version"
					{projectId}
					value={TWO}
					summary="chips"
					badge="text"
					clearable={false}
				/>
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>What one badge is drawn as, for five selected</h4>
		<div class={stack}>
			{#each BADGES as badge (badge)}
				<div class={field} data-demo="badge-{badge}-5">
					<span class={caption}>{badge}</span>
					<StatusMultiPicker
						{context}
						entityType="Version"
						{projectId}
						value={FIVE}
						summary="chips"
						{badge}
						clearable={false}
					/>
				</div>
			{/each}
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Two selected, one badge and a "+1"</h4>
		<div class={stack}>
			<div class={field} data-demo="max-one">
				<span class={caption}>One badge at most, whatever the room</span>
				<StatusMultiPicker
					{context}
					entityType="Version"
					{projectId}
					value={TWO}
					max={1}
					clearable={false}
				/>
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Disabled, read-only, invalid</h4>
		<div class={stack}>
			<div class={field}>
				<span class={caption}>Disabled</span>
				<StatusMultiPicker
					{context}
					entityType="Version"
					{projectId}
					value={['apr', 'fin']}
					disabled
				/>
			</div>
			<div class={field}>
				<span class={caption}>Read-only</span>
				<StatusMultiPicker {context} entityType="Version" {projectId} value={['apr']} readonly />
			</div>
			<div class={field}>
				<span class={caption}>Invalid</span>
				<StatusMultiPicker
					{context}
					entityType="Version"
					{projectId}
					value={['apr', 'fin']}
					invalid
				/>
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Sizes</h4>
		<div class={stack}>
			<div class={field}>
				<span class={caption}>sm</span>
				<StatusMultiPicker {context} entityType="Version" {projectId} value={['rev']} size="sm" />
			</div>
			<div class={field}>
				<span class={caption}>md</span>
				<StatusMultiPicker {context} entityType="Version" {projectId} value={['rev']} size="md" />
			</div>
			<div class={field}>
				<span class={caption}>lg</span>
				<StatusMultiPicker {context} entityType="Version" {projectId} value={['rev']} size="lg" />
			</div>
		</div>
	</section>
</div>
