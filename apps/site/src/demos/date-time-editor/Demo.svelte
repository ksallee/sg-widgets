<script lang="ts">
	import DateTimeEditor from '$lib/registry/components/date-time-editor.svelte';

	let approvedAt = $state<string | null>('2026-03-04T13:06:07Z');
	let importedAt = $state<string | null>('2026-03-04T13:06:07Z');
	let never = $state<string | null>(null);

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>Los Angeles</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<DateTimeEditor
						bind:value={approvedAt}
						timeZone="America/Los_Angeles"
						field={{ displayName: 'Client Approved At', mandatory: false }}
					/>
					<p class={valueCell}>{JSON.stringify(approvedAt)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>Paris, seconds</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<DateTimeEditor
						bind:value={importedAt}
						timeZone="Europe/Paris"
						showSeconds
						field={{ displayName: 'Media Center Import Time', mandatory: false }}
					/>
					<p class={valueCell}>{JSON.stringify(importedAt)}</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>unset</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<DateTimeEditor bind:value={never} timeZone="UTC" />
					<p class={valueCell}>{JSON.stringify(never)}</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
