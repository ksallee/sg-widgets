<script lang="ts">
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	async function load() {
		const shots = await client.search('Shot', { fields: ['code', 'image'], page: { size: 3 } });
		return shots.data.map((row) => ({
			code: String(row.attributes['code'] ?? ''),
			src: (row.attributes['image'] as string | null) ?? null
		}));
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
			<Thumbnail src={PENDING} size="lg" />
			<Thumbnail src={BROKEN} size="lg" />
			<Thumbnail src={null} size="lg" aspect="square" playable />
		</div>
	</section>
</div>
