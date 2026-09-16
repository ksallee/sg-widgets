<script lang="ts">
	import ListMultiPicker from '$lib/registry/components/list-multi-picker.svelte';

	const versionType = {
		displayName: 'Version Type',
		mandatory: false,
		validValues: ['Type A', 'Type B', 'Type C']
	};

	const shotType = {
		displayName: 'Shot Type',
		mandatory: false,
		validValues: ['VFX', '2D', 'Full CG', 'Trailer', 'Marketing', 'Look Dev'],
		displayValues: { '2D': 'Two D', 'Look Dev': 'Lookdev' },
		hiddenValues: ['Marketing', 'Trailer']
	};

	/** A field the site flags mandatory: the picker offers no clear. */
	const step = {
		displayName: 'Pipeline Step',
		mandatory: true,
		validValues: ['Model', 'Rig', 'Animate', 'Light', 'Comp']
	};

	let type = $state<string[]>(['Type A']);
	let shot = $state<string[]>(['VFX', '2D']);
	let scoped = $state<string[]>(['Full CG']);
	let searched = $state<string[]>([]);
	let chosen = $state<string[]>(['Model']);

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>valid values</th>
			<td class={cell}>
				<div data-demo="values" data-field-mandatory="false" class="flex w-full min-w-0 flex-col gap-2">
					<ListMultiPicker bind:value={type} field={versionType} />
					<p class={valueCell}>{JSON.stringify(type)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>display values</th>
			<td class={cell}>
				<div data-demo="labels" data-field-mandatory="false" class="flex w-full min-w-0 flex-col gap-2">
					<ListMultiPicker bind:value={shot} field={shotType} showCode />
					<p class={valueCell}>{JSON.stringify(shot)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>project 63</th>
			<td class={cell}>
				<div data-demo="project" data-field-mandatory="false" class="flex w-full min-w-0 flex-col gap-2">
					<ListMultiPicker bind:value={scoped} field={shotType} projectId={63} />
					<p class={valueCell}>{JSON.stringify(scoped)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>searchable</th>
			<td class={cell}>
				<div data-demo="searchable" data-field-mandatory="false" class="flex w-full min-w-0 flex-col gap-2">
					<ListMultiPicker bind:value={searched} field={shotType} searchable />
					<p class={valueCell}>{JSON.stringify(searched)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>mandatory</th>
			<td class={cell}>
				<div data-demo="mandatory" data-field-mandatory={String(step.mandatory)} class="flex w-full min-w-0 flex-col gap-2">
					<ListMultiPicker bind:value={chosen} field={step} />
					<p class={valueCell}>{JSON.stringify(chosen)}</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>disabled</th>
			<td class={cell}>
				<div data-demo="disabled" class="flex w-full min-w-0 flex-col gap-2">
					<ListMultiPicker value={['Type B']} field={versionType} disabled />
					<p class={valueCell}>["Type B"]</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
