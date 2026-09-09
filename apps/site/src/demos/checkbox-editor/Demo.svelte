<script lang="ts">
	import CheckboxEditor from '$lib/registry/components/checkbox-editor.svelte';

	let flagged = $state(true);
	let approved = $state(false);

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>flagged</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<CheckboxEditor bind:value={flagged} field={{ displayName: 'Flagged', mandatory: false }} />
					<p class={valueCell}>{JSON.stringify(flagged)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>client approved</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<CheckboxEditor
						bind:value={approved}
						field={{ displayName: 'Client Approved', mandatory: false }}
						labels={{ on: 'Approved', off: 'Not approved' }}
					/>
					<p class={valueCell}>{JSON.stringify(approved)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>readonly</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<CheckboxEditor value={true} readonly />
					<p class={valueCell}>true</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>disabled</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<CheckboxEditor value={false} disabled />
					<p class={valueCell}>false</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
