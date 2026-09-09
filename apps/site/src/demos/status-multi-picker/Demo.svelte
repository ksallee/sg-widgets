<script lang="ts">
	import StatusMultiPicker from '$lib/registry/components/status-multi-picker.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	let inProject70 = $state<string[]>(['ip', 'apr']);
	let inProject71 = $state<string[]>(['pndad']);
	let shared = $state<string[]>([]);
	let project = $state<string[]>(['Active', 'Bidding']);
	let unknown = $state<string[]>(['zz_retired', 'rev']);

	const MODES = ['icons', 'names', 'both', 'count'] as const;
	const TWO = ['ip', 'apr'];
	const FIVE = ['ip', 'apr', 'rev', 'fin', 'vwd'];

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const row = 'flex flex-wrap items-start gap-3';
	const box = 'w-64';
	const readout = 'text-muted-foreground font-mono text-xs tabular-nums';
</script>

<div class="flex flex-col gap-4">
	<section class={group}>
		<h4 class={label}>Version, in project 70 and in project 71</h4>
		<div class={row}>
			<div class={box} data-demo="p70">
				<StatusMultiPicker {client} entityType="Version" projectId={70} bind:value={inProject70} />
			</div>
			<div class={box} data-demo="p71">
				<StatusMultiPicker {client} entityType="Version" projectId={71} bind:value={inProject71} />
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>The statuses both projects offer</h4>
		<div class={row}>
			<div class={box} data-demo="both">
				<StatusMultiPicker
					{client}
					entityType="Version"
					projectIds={[70, 71]}
					bind:value={shared}
				/>
			</div>
			<span class={readout}>{shared.join(', ') || '—'}</span>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Project, whose status field is a plain list with no icons</h4>
		<div class={row}>
			<div class={box} data-demo="project">
				<StatusMultiPicker {client} entityType="Project" bind:value={project} />
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>A code the field does not carry, and the code instead of the label</h4>
		<div class={row}>
			<div class={box} data-demo="unknown">
				<StatusMultiPicker {client} entityType="Version" projectId={70} bind:value={unknown} />
			</div>
			<div class={box}>
				<StatusMultiPicker
					{client}
					entityType="Version"
					projectId={70}
					value={['ip', 'fin']}
					showCode
					clearable={false}
				/>
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>What the closed trigger shows, with two and with five selected</h4>
		<div class={row}>
			{#each MODES as mode (mode)}
				<div class={group}>
					<span class={readout}>{mode}</span>
					<div class={box} data-demo="summary-{mode}-2">
						<StatusMultiPicker
							{client}
							entityType="Version"
							projectId={70}
							value={TWO}
							summary={mode}
							clearable={false}
						/>
					</div>
					<div class={box} data-demo="summary-{mode}-5">
						<StatusMultiPicker
							{client}
							entityType="Version"
							projectId={70}
							value={FIVE}
							summary={mode}
							clearable={false}
						/>
					</div>
				</div>
			{/each}
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Two selected, collapsing above one</h4>
		<div class={row}>
			<div class={box} data-demo="max-one">
				<StatusMultiPicker
					{client}
					entityType="Version"
					projectId={70}
					value={TWO}
					max={1}
					clearable={false}
				/>
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Disabled, read-only, invalid</h4>
		<div class={row}>
			<div class={box}>
				<StatusMultiPicker
					{client}
					entityType="Version"
					projectId={70}
					value={['apr', 'fin']}
					disabled
				/>
			</div>
			<div class={box}>
				<StatusMultiPicker {client} entityType="Version" projectId={70} value={['apr']} readonly />
			</div>
			<div class={box}>
				<StatusMultiPicker
					{client}
					entityType="Version"
					projectId={70}
					value={['apr', 'fin']}
					invalid
				/>
			</div>
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Sizes</h4>
		<div class={row}>
			<div class={box}>
				<StatusMultiPicker {client} entityType="Version" projectId={70} value={['rev']} size="sm" />
			</div>
			<div class={box}>
				<StatusMultiPicker {client} entityType="Version" projectId={70} value={['rev']} size="md" />
			</div>
			<div class={box}>
				<StatusMultiPicker {client} entityType="Version" projectId={70} value={['rev']} size="lg" />
			</div>
		</div>
	</section>
</div>
