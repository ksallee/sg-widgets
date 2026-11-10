<script lang="ts">
	import DataTypePicker from '$lib/registry/components/data-type-picker.svelte';

	/** The types a site created over REST (019_create_fields). The caller owns this list. */
	const creatable = [
		'text',
		'number',
		'float',
		'percent',
		'duration',
		'footage',
		'date',
		'date_time',
		'checkbox',
		'list',
		'entity',
		'multi_entity',
		'url'
	];

	const wording = { url: 'File or link', entity: 'Link to one', multi_entity: 'Link to many' };

	let chosen = $state<string | null>('text');
	let searched = $state<string | null>(null);
	let worded = $state<string | null>('url');
	let cleared = $state<string | null>('date_time');

	const cell = 'px-3 py-2 align-top';
	const typeCell = 'text-muted-foreground w-28 px-3 py-2 align-top font-mono text-xs';
	const valueCell = 'text-muted-foreground truncate font-mono text-xs';
</script>

<table class="w-full table-fixed border-collapse text-left">
	<tbody>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>a given set</th>
			<td class={cell}>
				<div data-demo="set" class="flex w-full min-w-0 flex-col gap-2">
					<DataTypePicker bind:value={chosen} types={creatable} />
					<p class={valueCell}>{JSON.stringify(chosen)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>searchable</th>
			<td class={cell}>
				<div data-demo="searchable" class="flex w-full min-w-0 flex-col gap-2">
					<DataTypePicker bind:value={searched} types={creatable} searchable />
					<p class={valueCell}>{JSON.stringify(searched)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>own labels</th>
			<td class={cell}>
				<div data-demo="labels" class="flex w-full min-w-0 flex-col gap-2">
					<DataTypePicker bind:value={worded} types={creatable} labels={wording} />
					<p class={valueCell}>{JSON.stringify(worded)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>clearable</th>
			<td class={cell}>
				<div data-demo="clearable" class="flex w-full min-w-0 flex-col gap-2">
					<DataTypePicker bind:value={cleared} types={creatable} clearable size="sm" />
					<p class={valueCell}>{JSON.stringify(cleared)}</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>readonly, outside the set</th>
			<td class={cell}>
				<div data-demo="outside" class="flex w-full min-w-0 flex-col gap-2">
					<DataTypePicker value="calculated" types={creatable} readonly />
					<p class={valueCell}>"calculated"</p>
				</div>
			</td>
		</tr>
		<tr class="border-border border-b">
			<th scope="row" class={typeCell}>readonly, unknown</th>
			<td class={cell}>
				<div data-demo="unknown" class="flex w-full min-w-0 flex-col gap-2">
					<DataTypePicker value="sg_future_type" types={creatable} readonly />
					<p class={valueCell}>"sg_future_type"</p>
				</div>
			</td>
		</tr>
		<tr>
			<th scope="row" class={typeCell}>disabled</th>
			<td class={cell}>
				<div data-demo="disabled" class="flex w-full min-w-0 flex-col gap-2">
					<DataTypePicker value="list" types={creatable} disabled />
					<p class={valueCell}>"list"</p>
				</div>
			</td>
		</tr>
	</tbody>
</table>
