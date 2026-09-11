<script lang="ts">
	import type { FieldSchema, NativeStatus, StatusRecord } from '@sg-widgets/core';
	import { NATIVE_STATUSES, STOCK_ICON_KEYS } from '@sg-widgets/core';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import { setDemoContext } from '../_shared/svelte';

	const context = setDemoContext();

	async function load() {
		const [rows, fields] = await Promise.all([
			context.client.statuses(),
			context.client.fields('Version')
		]);
		const statuses: Record<string, StatusRecord> = {};
		for (const row of rows) statuses[row.code] = row;
		return { statuses, field: fields['sg_status_list'] as FieldSchema };
	}

	/* No site is reachable from a demo: this one serves a stand-in sprite at the stock path. */
	const DEMO_SITE = '/demo-site';

	/** A shipped status as `GET /entity/statuses` returns it. `act` is the one with an html icon. */
	function nativeRecord(status: NativeStatus, index: number): StatusRecord {
		return {
			id: index,
			code: status.code,
			name: status.name,
			bgColor: null,
			icon: status.imageMapKey
				? { displayType: 'image_map', imageMapKey: status.imageMapKey }
				: { displayType: 'html', html: status.name }
		};
	}

	const natives = NATIVE_STATUSES.map(nativeRecord);

	/** A stock icon the package does not bundle: it draws only from a site's own sprite. */
	const cancelled: StatusRecord = {
		id: 900,
		code: 'cncl',
		name: 'Cancelled',
		bgColor: null,
		icon: { displayType: 'image_map', imageMapKey: 'icon_x_thin_white' }
	};

	/** A selection the cross can take from. */
	const REMOVABLE = ['ip', 'apr', 'hld'];
	let removed = $state<string[]>([]);
	const shown = $derived(REMOVABLE.filter((code) => !removed.includes(code)));

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

		<section class={group} data-demo="color">
			<h4 class={label}>Neutral, then coloured</h4>
			<div class={row} data-demo="neutral">
				<StatusBadge code="apr" status={statuses['apr']} {field} />
				<StatusBadge code="ip" status={statuses['ip']} {field} />
				<StatusBadge code="hld" status={statuses['hld']} {field} />
				<StatusBadge code="omt" status={statuses['omt']} {field} />
			</div>
			<div class={row} data-demo="coloured">
				<StatusBadge code="apr" status={statuses['apr']} {field} color />
				<StatusBadge code="ip" status={statuses['ip']} {field} color />
				<StatusBadge code="hld" status={statuses['hld']} {field} color />
				<StatusBadge code="omt" status={statuses['omt']} {field} color />
			</div>
		</section>

		<section class={group} data-demo="removable">
			<h4 class={label}>Removable, with the cross inside the pill</h4>
			<div class={row}>
				{#each shown as code (code)}
					<StatusBadge
						{code}
						status={statuses[code]}
						{field}
						color
						removable
						onRemove={(c) => (removed = [...removed, c])}
					/>
				{/each}
				<StatusBadge code="rev" status={statuses['rev']} {field} color variant="icon" removable />
				{#if shown.length === 0}
					<button
						type="button"
						class="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
						onclick={() => (removed = [])}
					>
						Put them back
					</button>
				{/if}
			</div>
		</section>

		<section class={group} data-demo="label">
			<h4 class={label}>Name, and the code instead</h4>
			<div class={row}>
				<StatusBadge code="rev" status={statuses['rev']} {field} />
				<StatusBadge code="rev" status={statuses['rev']} {field} label="code" />
			</div>
		</section>

		<section class={group} data-demo="icons">
			<h4 class={label}>Uploaded icon, and an html icon</h4>
			<div class={row}>
				<StatusBadge code="custom" status={statuses['custom']} {field} />
				<StatusBadge code="act" status={statuses['act']} {field} />
			</div>
		</section>

		<section class={group} data-demo="unknown">
			<h4 class={label}>Label from the schema, and an unknown code</h4>
			<div class={row}>
				<StatusBadge code="fin" {field} />
				<StatusBadge code="zz_retired" />
			</div>
		</section>
		<section class={group} data-demo="site">
			<h4 class={label}>This site's statuses, custom ones included</h4>
			<div class={row}>
				{#each Object.values(statuses).sort((a, b) => a.name.localeCompare(b.name)) as status (status.code)}
					<StatusBadge code={status.code} {status} size="sm" />
				{/each}
			</div>
		</section>
	{:catch error}
		<p class="text-destructive text-sm">{error.message}</p>
	{/await}

	<section class={group} data-demo="native">
		<h4 class={label}>The shipped statuses</h4>
		<div class={row}>
			{#each natives as status (status.code)}
				<StatusBadge code={status.code} {status} size="sm" />
			{/each}
		</div>
	</section>

	<section class={group} data-demo="stock">
		<h4 class={label}>The shipped icons</h4>
		<div class={row}>
			{#each STOCK_ICON_KEYS as key (key)}
				<StatusBadge
					code={key}
					status={{ id: 0, code: key, name: key, bgColor: null, icon: { displayType: 'image_map', imageMapKey: key } }}
					variant="icon"
					size="sm"
				/>
			{/each}
		</div>
	</section>

	<section class={group} data-demo="sprite">
		<h4 class={label}>A sprite cell outside the status set, without and with a site</h4>
		<div class={row}>
			<StatusBadge code={cancelled.code} status={cancelled} />
			<StatusBadge code={cancelled.code} status={cancelled} siteUrl={DEMO_SITE} />
		</div>
	</section>
</div>
