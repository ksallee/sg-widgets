<script lang="ts">
	import TextEditor from '$lib/registry/components/text-editor.svelte';

	const field = { displayName: 'Description', mandatory: false };

	let one = $state<string | null>('Plate delivered.');
	let many = $state<string | null>('Plate delivered.\nSecond pass pending.');
	let blocked = $state<string | null>('sh010_comp_v001');

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>input</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<TextEditor bind:value={one} {field} placeholder="Type here" />
					<p class={valueCell}>{JSON.stringify(one)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>multiline</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<TextEditor bind:value={many} {field} multiline />
					<p class={valueCell}>{JSON.stringify(many)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>readonly</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<TextEditor value={blocked} {field} readonly />
					<p class={valueCell}>{JSON.stringify(blocked)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>disabled</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<TextEditor value={blocked} {field} disabled />
					<p class={valueCell}>{JSON.stringify(blocked)}</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>invalid</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<TextEditor value={null} {field} invalid error="The site refused this value." />
					<p class={valueCell}>null</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
