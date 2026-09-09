<script lang="ts">
	import DateEditor from '$lib/registry/components/date-editor.svelte';

	let turnover = $state<string | null>('2026-09-02');
	let expected = $state<string | null>(null);

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>set</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<DateEditor bind:value={turnover} field={{ displayName: 'Turnover Date', mandatory: false }} />
					<p class={valueCell}>{JSON.stringify(turnover)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>unset</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<DateEditor bind:value={expected} field={{ displayName: 'Next Version Expected', mandatory: false }} />
					<p class={valueCell}>{JSON.stringify(expected)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>readonly</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<DateEditor value="2026-09-02" readonly />
					<p class={valueCell}>"2026-09-02"</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>disabled</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<DateEditor value="2026-09-02" disabled />
					<p class={valueCell}>"2026-09-02"</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
