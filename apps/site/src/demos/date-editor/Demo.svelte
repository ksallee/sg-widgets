<script lang="ts">
	import DateEditor from '$lib/registry/components/date-editor.svelte';

	let turnover = $state<string | null>('2026-09-02');
	let expected = $state<string | null>(null);

	const field = { displayName: 'Turnover Date', mandatory: false };
	const item = 'flex w-full min-w-0 flex-col gap-2';
	const nameCell = 'text-muted-foreground font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<div class="flex w-full min-w-0 flex-col gap-4">
	<div class={item} data-demo-row="sm">
		<p class={nameCell}>sm</p>
		<DateEditor bind:value={turnover} size="sm" {field} />
	</div>
	<div class={item} data-demo-row="md">
		<p class={nameCell}>md</p>
		<DateEditor bind:value={turnover} {field} />
		<p class={valueCell} data-demo-value="set">{JSON.stringify(turnover)}</p>
	</div>
	<div class={item} data-demo-row="lg">
		<p class={nameCell}>lg</p>
		<DateEditor bind:value={turnover} size="lg" {field} />
	</div>
	<div class={item} data-demo-row="unset">
		<p class={nameCell}>unset</p>
		<DateEditor
			bind:value={expected}
			field={{ displayName: 'Next Version Expected', mandatory: false }}
		/>
		<p class={valueCell} data-demo-value="unset">{JSON.stringify(expected)}</p>
	</div>
	<div class={item} data-demo-row="invalid">
		<p class={nameCell}>invalid</p>
		<DateEditor value="2026-09-02" invalid error="Outside the shoot window." {field} />
	</div>
	<div class={item} data-demo-row="readonly">
		<p class={nameCell}>readonly</p>
		<DateEditor value="2026-09-02" readonly {field} />
	</div>
	<div class={item} data-demo-row="disabled">
		<p class={nameCell}>disabled</p>
		<DateEditor value="2026-09-02" disabled {field} />
	</div>
</div>
