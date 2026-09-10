<script lang="ts">
	import NumberEditor from '$lib/registry/components/number-editor.svelte';

	let frameCount = $state<number | string | null>(1001);
	let ratio = $state<number | string | null>('1.777778');
	let complete = $state<number | string | null>(50);
	let bid = $state<number | string | null>(12500);
	let duration = $state<number | string | null>(480);
	let days = $state<number | string | null>(480);
	let timecode = $state<number | string | null>(3600000);
	let cut = $state<number | string | null>(75);

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>number</th>
			<td class={cell}>
				<div data-demo-field="number" class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor bind:value={frameCount} dataType="number" field={{ displayName: 'Frame Count', mandatory: false }} />
					<p data-demo-value="number" class={valueCell}>{JSON.stringify(frameCount)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>float, step 0.1</th>
			<td class={cell}>
				<div data-demo-field="float" class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor bind:value={ratio} dataType="float" precision={2} field={{ displayName: 'Aspect Ratio', mandatory: false }} />
					<p data-demo-value="float" class={valueCell}>{JSON.stringify(ratio)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>percent, 0 to 100</th>
			<td class={cell}>
				<div data-demo-field="percent" class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor
						bind:value={complete}
						dataType="percent"
						min={0}
						max={100}
						field={{ displayName: 'Complete', mandatory: false }}
					/>
					<p data-demo-value="percent" class={valueCell}>{JSON.stringify(complete)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>currency</th>
			<td class={cell}>
				<div data-demo-field="currency" class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor
						bind:value={bid}
						dataType="currency"
						symbol="$"
						precision={2}
						field={{ displayName: 'Bid', mandatory: false }}
					/>
					<p data-demo-value="currency" class={valueCell}>{JSON.stringify(bid)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>duration, step 15m</th>
			<td class={cell}>
				<div data-demo-field="duration" class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor bind:value={duration} dataType="duration" hint field={{ displayName: 'Bid Duration', mandatory: false }} />
					<p data-demo-value="duration" class={valueCell}>{JSON.stringify(duration)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>duration, 6h day, scrub</th>
			<td class={cell}>
				<div data-demo-field="days" class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor
						bind:value={days}
						dataType="duration"
						hoursPerDay={6}
						scrub
						label="Time Logged"
						field={{ displayName: 'Time Logged', mandatory: false }}
					/>
					<p data-demo-value="days" class={valueCell}>{JSON.stringify(days)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>timecode, 23.976</th>
			<td class={cell}>
				<div data-demo-field="timecode" class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor
						bind:value={timecode}
						dataType="timecode"
						frameRate={23.976}
						field={{ displayName: 'Head In', mandatory: false }}
					/>
					<p data-demo-value="timecode" class={valueCell}>{JSON.stringify(timecode)}</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>inline, size sm</th>
			<td class={cell}>
				<div data-demo-field="inline" class="flex w-full min-w-0 flex-col gap-2">
					<NumberEditor
						bind:value={cut}
						dataType="percent"
						inline
						size="sm"
						field={{ displayName: 'Cut Duration', mandatory: false }}
					/>
					<p data-demo-value="inline" class={valueCell}>{JSON.stringify(cut)}</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
