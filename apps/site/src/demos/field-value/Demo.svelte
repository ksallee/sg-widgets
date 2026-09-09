<script lang="ts">
	import type { FieldSchema, StatusRecord } from '@sg-widgets/core';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	interface Sample {
		label: string;
		dataType: string;
		value: unknown;
		hoursPerDay?: number;
		precision?: number;
	}

	async function load() {
		const [rows, fields, shots] = await Promise.all([
			client.statuses(),
			client.fields('Version'),
			client.search('Shot', { fields: ['code', 'image'], page: { size: 1 } })
		]);
		const statuses: Record<string, StatusRecord> = {};
		for (const status of rows) statuses[status.code] = status;
		const shot = shots.data[0];
		return {
			statuses,
			field: fields['sg_status_list'] as FieldSchema,
			samples: samplesFor(
				{ type: 'Shot', id: shot?.id ?? 0, name: String(shot?.attributes['code'] ?? '') },
				(shot?.attributes['image'] as string | null) ?? null
			)
		};
	}

	function samplesFor(shot: { type: string; id: number; name: string }, image: string | null): Sample[] {
		return [
			{ label: 'text', dataType: 'text', value: 'Plate delivered.\nSecond pass pending.' },
			{ label: 'list', dataType: 'list', value: 'Type A' },
			{ label: 'number', dataType: 'number', value: 1001 },
			{ label: 'float', dataType: 'float', value: '1.777778' },
			{ label: 'float, precision 2', dataType: 'float', value: '1.777778', precision: 2 },
			{ label: 'percent', dataType: 'percent', value: 50 },
			{ label: 'duration', dataType: 'duration', value: 480 },
			{ label: 'duration, in days', dataType: 'duration', value: 480, hoursPerDay: 8 },
			{ label: 'timecode', dataType: 'timecode', value: 3600000 },
			{ label: 'date', dataType: 'date', value: '2026-09-02' },
			{ label: 'date_time', dataType: 'date_time', value: '2026-09-02T15:58:21Z' },
			{ label: 'checkbox', dataType: 'checkbox', value: true },
			{ label: 'checkbox', dataType: 'checkbox', value: false },
			{ label: 'status_list', dataType: 'status_list', value: 'ip' },
			{ label: 'entity', dataType: 'entity', value: shot },
			{
				label: 'multi_entity',
				dataType: 'multi_entity',
				value: [
					{ type: 'Asset', id: 1226, name: 'charAda' },
					{ type: 'Asset', id: 1227, name: 'charBabbage' }
				]
			},
			{ label: 'image', dataType: 'image', value: image },
			{
				label: 'url, uploaded',
				dataType: 'url',
				value: {
					url: 'https://s3.example.com/9f2/sh010_0010_comp_v001.mov?X-Amz-Expires=900',
					name: 'sh010_0010_comp_v001.mov',
					content_type: 'video/quicktime',
					link_type: 'upload',
					type: 'Attachment',
					id: 1430
				}
			},
			{
				label: 'url, local',
				dataType: 'url',
				value: {
					link_type: 'local',
					name: 'plate.exr',
					local_path_mac: '/Volumes/shows/sh010/plate.exr'
				}
			},
			{ label: 'color', dataType: 'color', value: '253,94,99' },
			{ label: 'color, sentinel', dataType: 'color', value: 'pipeline_step' },
			{ label: 'pivot_column', dataType: 'pivot_column', value: null },
			{ label: 'text, unset', dataType: 'text', value: null }
		];
	}

	const data = load();
	const cell = 'px-3 py-2 align-middle';
	const typeCell = 'text-muted-foreground px-3 py-2 align-middle font-mono text-xs';
</script>

{#await data}
	<p class="text-muted-foreground text-sm">Loading the site…</p>
{:then { statuses, field, samples }}
	<table class="w-full table-fixed border-collapse text-left">
		<tbody>
			{#each samples as sample (sample.label + String(sample.value))}
				<tr class="border-border border-b last:border-b-0">
					<th scope="row" class={typeCell}>{sample.label}</th>
					<td class={cell}>
						<FieldValue
							value={sample.value}
							dataType={sample.dataType}
							{field}
							{statuses}
							hoursPerDay={sample.hoursPerDay}
							precision={sample.precision}
						/>
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:catch error}
	<p class="text-destructive text-sm">{error.message}</p>
{/await}
