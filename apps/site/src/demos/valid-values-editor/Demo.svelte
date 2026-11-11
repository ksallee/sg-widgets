<script lang="ts">
	import ValidValuesEditor from '$lib/registry/components/valid-values-editor.svelte';
	import { createDemoContext } from '../_shared/client';

	const context = createDemoContext();

	let shotTypes = $state<string[]>(['VFX', '2D', 'Full CG', 'Look Dev']);
	let fresh = $state<string[]>([]);
	let distinct = $state<string[]>(['Type A', 'Type B']);
	let statuses = $state<string[]>(['ip', 'rev', 'apr']);
	let codes = $state<string[]>(['wtg', 'ip', 'fin']);

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground font-mono text-xs break-words';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>list</th>
			<td class={cell}>
				<div data-demo="list" class="flex w-full min-w-0 flex-col gap-2">
					<ValidValuesEditor bind:value={shotTypes} />
					<p class={valueCell}>{JSON.stringify(shotTypes)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>empty</th>
			<td class={cell}>
				<div data-demo="empty" class="flex w-full min-w-0 flex-col gap-2">
					<ValidValuesEditor bind:value={fresh} />
					<p class={valueCell}>{JSON.stringify(fresh)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>unique</th>
			<td class={cell}>
				<div data-demo="unique" class="flex w-full min-w-0 flex-col gap-2">
					<ValidValuesEditor bind:value={distinct} unique size="sm" />
					<p class={valueCell}>{JSON.stringify(distinct)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>status list</th>
			<td class={cell}>
				<div data-demo="status" class="flex w-full min-w-0 flex-col gap-2">
					<ValidValuesEditor dataType="status_list" {context} bind:value={statuses} />
					<p class={valueCell}>{JSON.stringify(statuses)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>status list, no site</th>
			<td class={cell}>
				<div data-demo="codes" class="flex w-full min-w-0 flex-col gap-2">
					<ValidValuesEditor dataType="status_list" bind:value={codes} placeholder="Add a status code" />
					<p class={valueCell}>{JSON.stringify(codes)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>readonly</th>
			<td class={cell}>
				<div data-demo="readonly" class="flex w-full min-w-0 flex-col gap-2">
					<ValidValuesEditor value={['Type A', 'Type B', 'Type C']} readonly />
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>readonly status list</th>
			<td class={cell}>
				<div data-demo="readonly-status" class="flex w-full min-w-0 flex-col gap-2">
					<ValidValuesEditor dataType="status_list" {context} value={['ip', 'fin']} readonly />
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>invalid</th>
			<td class={cell}>
				<div data-demo="invalid" class="flex w-full min-w-0 flex-col gap-2">
					<ValidValuesEditor value={[]} invalid />
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>disabled</th>
			<td class={cell}>
				<div data-demo="disabled" class="flex w-full min-w-0 flex-col gap-2">
					<ValidValuesEditor value={['Type A', 'Type B']} disabled />
				</div>
			</td>
		</tr>
	</tbody>
</table>
