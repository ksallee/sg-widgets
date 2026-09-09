<script lang="ts">
	import DateTimeEditor from '$lib/registry/components/date-time-editor.svelte';

	let approvedAt = $state<string | null>('2026-03-04T13:06:07Z');
	let importedAt = $state<string | null>('2026-03-04T13:06:07Z');
	let never = $state<string | null>(null);

	const zone = 'America/Los_Angeles';
	const field = { displayName: 'Client Approved At', mandatory: false };
	const item = 'flex w-full min-w-0 flex-col gap-2';
	const nameCell = 'text-muted-foreground font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<div class="flex w-full min-w-0 flex-col gap-4">
	<div class={item} data-demo-row="sm">
		<p class={nameCell}>sm</p>
		<DateTimeEditor bind:value={approvedAt} timeZone={zone} size="sm" hint={false} {field} />
	</div>
	<div class={item} data-demo-row="md">
		<p class={nameCell}>md</p>
		<DateTimeEditor bind:value={approvedAt} timeZone={zone} {field} />
		<p class={valueCell} data-demo-value="set">{JSON.stringify(approvedAt)}</p>
	</div>
	<div class={item} data-demo-row="lg">
		<p class={nameCell}>lg</p>
		<DateTimeEditor bind:value={approvedAt} timeZone={zone} size="lg" hint={false} {field} />
	</div>
	<div class={item} data-demo-row="seconds">
		<p class={nameCell}>Paris, seconds</p>
		<DateTimeEditor
			bind:value={importedAt}
			timeZone="Europe/Paris"
			showSeconds
			field={{ displayName: 'Media Center Import Time', mandatory: false }}
		/>
		<p class={valueCell} data-demo-value="seconds">{JSON.stringify(importedAt)}</p>
	</div>
	<div class={item} data-demo-row="unset">
		<p class={nameCell}>unset</p>
		<DateTimeEditor bind:value={never} timeZone="UTC" />
		<p class={valueCell} data-demo-value="unset">{JSON.stringify(never)}</p>
	</div>
	<div class={item} data-demo-row="invalid">
		<p class={nameCell}>invalid</p>
		<DateTimeEditor
			value="2026-03-04T13:06:07Z"
			timeZone={zone}
			hint={false}
			invalid
			error="Before the version was delivered."
			{field}
		/>
	</div>
	<div class={item} data-demo-row="readonly">
		<p class={nameCell}>readonly</p>
		<DateTimeEditor value="2026-03-04T13:06:07Z" timeZone={zone} hint={false} readonly {field} />
	</div>
	<div class={item} data-demo-row="disabled">
		<p class={nameCell}>disabled</p>
		<DateTimeEditor value="2026-03-04T13:06:07Z" timeZone={zone} hint={false} disabled {field} />
	</div>
</div>
