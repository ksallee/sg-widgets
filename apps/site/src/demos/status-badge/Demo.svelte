<script lang="ts">
	import type { FieldSchema, StatusRecord } from '@sg-widgets/core';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	async function load() {
		const [rows, fields] = await Promise.all([client.statuses(), client.fields('Version')]);
		const statuses: Record<string, StatusRecord> = {};
		for (const row of rows) statuses[row.code] = row;
		return { statuses, field: fields['sg_status_list'] as FieldSchema };
	}

	const data = load();
	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const row = 'flex flex-wrap items-center gap-2';
</script>

<div class="flex flex-col gap-4">
	{#await data}
		<p class="text-muted-foreground text-sm">Loading statuses…</p>
	{:then { statuses, field }}
		<section class={group}>
			<h4 class={label}>Sizes</h4>
			<div class={row}>
				<StatusBadge code="apr" status={statuses['apr']} {field} size="sm" />
				<StatusBadge code="apr" status={statuses['apr']} {field} size="md" />
				<StatusBadge code="apr" status={statuses['apr']} {field} size="lg" />
			</div>
		</section>

		<section class={group}>
			<h4 class={label}>Variants</h4>
			<div class={row}>
				<StatusBadge code="ip" status={statuses['ip']} {field} variant="both" />
				<StatusBadge code="ip" status={statuses['ip']} {field} variant="icon" />
				<StatusBadge code="ip" status={statuses['ip']} {field} variant="text" />
			</div>
		</section>

		<section class={group}>
			<h4 class={label}>Icon display types</h4>
			<div class={row}>
				<StatusBadge code="na" status={statuses['na']} {field} />
				<StatusBadge code="custom" status={statuses['custom']} {field} />
				<StatusBadge code="act" status={statuses['act']} {field} />
			</div>
		</section>

		<section class={group}>
			<h4 class={label}>Every status on the site</h4>
			<div class={row}>
				{#each Object.values(statuses) as status (status.code)}
					<StatusBadge code={status.code} {status} {field} size="sm" />
				{/each}
			</div>
		</section>

		<section class={group}>
			<h4 class={label}>Label from the schema, and an unknown code</h4>
			<div class={row}>
				<StatusBadge code="fin" {field} />
				<StatusBadge code="zz_retired" />
			</div>
		</section>
	{:catch error}
		<p class="text-destructive text-sm">{error.message}</p>
	{/await}
</div>
