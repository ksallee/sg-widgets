<script lang="ts">
	import ListSelect from '$lib/registry/components/list-select.svelte';

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

	let type = $state<string | null>('Type A');
	let shot = $state<string | null>('VFX');
	let scoped = $state<string | null>('Full CG');

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>valid values</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<ListSelect bind:value={type} field={versionType} />
					<p class={valueCell}>{JSON.stringify(type)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>display values</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<ListSelect bind:value={shot} field={shotType} />
					<p class={valueCell}>{JSON.stringify(shot)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>project 63</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<ListSelect bind:value={scoped} field={shotType} projectId={63} />
					<p class={valueCell}>{JSON.stringify(scoped)}</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>disabled</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<ListSelect value="Type B" field={versionType} disabled />
					<p class={valueCell}>"Type B"</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
