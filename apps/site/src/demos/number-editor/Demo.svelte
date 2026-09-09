<script lang="ts">
	import NumberEditor from '$lib/registry/components/number-editor.svelte';

	let frameCount = $state<number | string | null>(1001);
	let ratio = $state<number | string | null>('1.777778');
	let complete = $state<number | string | null>(50);
	let bid = $state<number | string | null>(12500);
	let duration = $state<number | string | null>(480);
	let days = $state<number | string | null>(480);
	let timecode = $state<number | string | null>(3600000);

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>number</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor bind:value={frameCount} dataType="number" />
					<p class={valueCell}>{JSON.stringify(frameCount)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>float, precision 2</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor bind:value={ratio} dataType="float" precision={2} />
					<p class={valueCell}>{JSON.stringify(ratio)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>percent</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor bind:value={complete} dataType="percent" min={0} max={100} />
					<p class={valueCell}>{JSON.stringify(complete)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>currency</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor bind:value={bid} dataType="currency" symbol="$" precision={2} />
					<p class={valueCell}>{JSON.stringify(bid)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>duration</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor bind:value={duration} dataType="duration" />
					<p class={valueCell}>{JSON.stringify(duration)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>duration, 6h day</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor bind:value={days} dataType="duration" hoursPerDay={6} />
					<p class={valueCell}>{JSON.stringify(days)}</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>timecode, 23.976</th>
			<td class={cell}>
				<div class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor bind:value={timecode} dataType="timecode" frameRate={23.976} />
					<p class={valueCell}>{JSON.stringify(timecode)}</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
