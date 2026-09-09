<script lang="ts">
	import ColorEditor from '$lib/registry/components/color-editor.svelte';

	let step = $state<string | null>('253,94,99');
	let project = $state<string | null>('0,126,174');
	let task = $state<string | null>('pipeline_step');

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>triple</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<ColorEditor bind:value={step} field={{ displayName: 'Color', mandatory: false }} />
					<p class={valueCell}>{JSON.stringify(step)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>hex accepted</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<ColorEditor bind:value={project} placeholder="#ff8000" field={{ displayName: 'Color', mandatory: false }} />
					<p class={valueCell}>{JSON.stringify(project)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>pipeline step</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<ColorEditor bind:value={task} field={{ displayName: 'Gantt Bar Color', mandatory: false }} />
					<p class={valueCell}>{JSON.stringify(task)}</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>disabled</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<ColorEditor value="45,45,45" disabled />
					<p class={valueCell}>"45,45,45"</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
