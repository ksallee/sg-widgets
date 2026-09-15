<script lang="ts">
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';
	import { setDemoContext } from '../_shared/svelte';
	import { createDemoContext } from '../_shared/client';

	const context = createDemoContext();
	setDemoContext(context);

	// The chosen project's own picture first, then that project's Versions that carry one:
	// a Shot's image is filled only from its Versions, so Shots rarely have one.
	async function load() {
		const project = { type: 'Project', id: context.projectId };
		const [projects, versions] = await Promise.all([
			context.client.search('Project', {
				filters: { logical_operator: 'and', conditions: [['id', 'is', context.projectId]] },
				fields: ['name', 'image'],
				page: { size: 1 }
			}),
			context.client.search('Version', {
				filters: { logical_operator: 'and', conditions: [['project', 'is', project], ['image', 'is_not', null]] },
				fields: ['code', 'image'],
				page: { size: 3 }
			})
		]);
		const rows = [
			...projects.data.map((row) => ({ code: String(row.attributes['name'] ?? ''), src: (row.attributes['image'] as string | null) ?? null })),
			...versions.data.map((row) => ({ code: String(row.attributes['code'] ?? ''), src: (row.attributes['image'] as string | null) ?? null }))
		].filter((r) => r.src);
		return rows.length >= 3 ? rows : [...rows, ...rows, ...rows].slice(0, 3);
	}

	const data = load();

	/** The URL Flow PT serves while a thumbnail is still transcoding. */
	const PENDING = 'https://sg.example.com/images/status/transient/thumbnail_pending.png';
	/** A truncated PNG: it fails to decode, which is the load-failure fallback. */
	const BROKEN = 'data:image/png;base64,iVBORw0KGgo=';

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const row = 'flex flex-wrap items-center gap-2';
</script>

<div class="flex flex-col gap-4">
	{#await data}
		<p class="text-muted-foreground text-sm">Loading shots…</p>
	{:then shots}
		<section class={group}>
			<h4 class={label}>Sizes</h4>
			<div class={row}>
				<Thumbnail src={shots[0]?.src} alt={shots[0]?.code ?? ''} size="sm" />
				<Thumbnail src={shots[0]?.src} alt={shots[0]?.code ?? ''} size="md" />
				<Thumbnail src={shots[0]?.src} alt={shots[0]?.code ?? ''} size="lg" />
			<Thumbnail src={shots[0]?.src} alt={shots[0]?.code ?? ''} size="xl" />
			<Thumbnail src={shots[0]?.src} alt={shots[0]?.code ?? ''} size="2xl" />
			</div>
		</section>

		<section class={group}>
			<h4 class={label}>Aspect</h4>
			<div class={row}>
				<Thumbnail src={shots[1]?.src} alt={shots[1]?.code ?? ''} size="lg" aspect="16:9" />
				<Thumbnail src={shots[1]?.src} alt={shots[1]?.code ?? ''} size="lg" aspect="square" />
			</div>
		</section>

		<section class={group}>
			<h4 class={label}>Playable</h4>
			<div class={row}>
				<Thumbnail src={shots[2]?.src} alt={shots[2]?.code ?? ''} size="sm" playable />
				<Thumbnail src={shots[2]?.src} alt={shots[2]?.code ?? ''} size="md" playable />
				<Thumbnail src={shots[2]?.src} alt={shots[2]?.code ?? ''} size="lg" playable />
			<Thumbnail src={shots[2]?.src} alt={shots[2]?.code ?? ''} size="xl" playable />
			<Thumbnail src={shots[2]?.src} alt={shots[2]?.code ?? ''} size="2xl" playable />
			</div>
		</section>
	{:catch error}
		<p class="text-destructive text-sm">{error.message}</p>
	{/await}

	<section class={group}>
		<h4 class={label}>No image, still transcoding, failed to load</h4>
		<div class={row}>
			<Thumbnail src={null} size="lg" />
			<Thumbnail src={null} size="lg" entityType="Shot" />
			<Thumbnail src={null} size="lg" entityType="Asset" />
			<Thumbnail src={null} size="lg" entityType="Version" />
			<Thumbnail src={PENDING} size="lg" />
			<Thumbnail src={BROKEN} size="lg" entityType="Shot" />
			<Thumbnail src={null} size="lg" aspect="square" entityType="Task" playable />
		</div>
	</section>
</div>
