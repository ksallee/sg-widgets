<script lang="ts">
	import UserAvatar from '$lib/registry/components/user-avatar.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	async function load() {
		const people = await client.search('HumanUser', {
			fields: ['name', 'image', 'sg_status_list'],
			page: { size: 6 }
		});
		return people.data.map((row) => ({
			name: String(row.attributes['name'] ?? ''),
			image: (row.attributes['image'] as string | null) ?? null,
			inactive: row.attributes['sg_status_list'] === 'dis'
		}));
	}

	const data = load();
	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const row = 'flex flex-wrap items-center gap-2';
</script>

<div class="flex flex-col gap-4">
	{#await data}
		<p class="text-muted-foreground text-sm">Loading people…</p>
	{:then people}
		<section class={group}>
			<h4 class={label}>Sizes</h4>
			<div class={row}>
				<UserAvatar name={people[0]?.name ?? ''} image={people[0]?.image} size="sm" />
				<UserAvatar name={people[0]?.name ?? ''} image={people[0]?.image} size="md" />
				<UserAvatar name={people[0]?.name ?? ''} image={people[0]?.image} size="lg" />
			</div>
		</section>

		<section class={group}>
			<h4 class={label}>The site's people</h4>
			<div class={row}>
				{#each people as person (person.name)}
					<UserAvatar name={person.name} image={person.image} inactive={person.inactive} />
				{/each}
			</div>
		</section>
	{:catch error}
		<p class="text-destructive text-sm">{error.message}</p>
	{/await}

	<section class={group}>
		<h4 class={label}>Initials fallback</h4>
		<div class={row}>
			<UserAvatar name="Ada Lovelace" />
			<UserAvatar name="Kevin van der Meer" />
			<UserAvatar name="Madonna" />
			<UserAvatar name="k.sallee" />
			<UserAvatar name="" />
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Initials, tinted from the name</h4>
		<div class={row}>
		  <UserAvatar name="Ada Lovelace" color="auto" />
		  <UserAvatar name="Kevin van der Meer" color="auto" />
		  <UserAvatar name="Madonna" color="auto" />
		  <UserAvatar name="k.sallee" color="auto" />
		  <UserAvatar name="Grace Hopper" color="auto" />
		  <UserAvatar name="Alan Turing" color="auto" />
		  <UserAvatar name="Bo Chen" color="auto" inactive />
		</div>
	</section>

	<section class={group}>
		<h4 class={label}>Inactive, and an image that fails to load</h4>
		<div class={row}>
			<UserAvatar name="Grace Hopper" inactive />
			<UserAvatar name="Grace Hopper" image="https://picsum.photos/seed/grace.hopper/64/64" inactive />
			<UserAvatar name="Alan Turing" image="data:image/png;base64,iVBORw0KGgo=" />
		</div>
	</section>

	<section class={group} data-demo="api">
		<h4 class={label}>API users</h4>
		<div class={row}>
			<UserAvatar name="sg_widgets_demo" apiUser size="sm" />
			<UserAvatar name="sg_widgets_demo" apiUser />
			<UserAvatar name="sg_widgets_demo" apiUser size="lg" />
			<UserAvatar name="sg_widgets_demo" apiUser inactive />
		</div>
	</section>
</div>
