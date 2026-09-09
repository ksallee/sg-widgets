<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import UserPicker from '$lib/registry/components/user-picker.svelte';
	import UserMultiPicker from '$lib/registry/components/user-multi-picker.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	let one = $state<EntityRef | null>(null);
	let people = $state<EntityRef[]>([]);
	let peopleOnly = $state<EntityRef | null>(null);
	let withInactive = $state<EntityRef | null>(null);
	// A bare reference: type and id, no name. Resolved on mount.
	let bare = $state<EntityRef[]>([{ type: 'HumanUser', id: 22 }]);
	const preset: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const field = 'flex max-w-sm flex-col gap-2';
</script>

<div class="flex flex-col gap-4">
	<section class={group} data-demo-case="single">
		<h4 class={label}>One person or script</h4>
		<div class={field}>
			<UserPicker {client} bind:value={one} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="multi">
		<h4 class={label}>Several, with checkbox rows</h4>
		<div class={field}>
			<UserMultiPicker {client} bind:value={people} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="people-only">
		<h4 class={label}>People only</h4>
		<div class={field}>
			<UserPicker {client} includeApiUsers={false} bind:value={peopleOnly} />
		</div>
	</section>

	<section class={group} data-demo-case="inactive">
		<h4 class={label}>Inactive people included</h4>
		<div class={field}>
			<UserPicker {client} includeInactive bind:value={withInactive} />
		</div>
	</section>

	<section class={group} data-demo-case="hydrate">
		<h4 class={label}>Bare reference, resolved on mount</h4>
		<div class={field}>
			<UserMultiPicker {client} bind:value={bare} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="states">
		<h4 class={label}>Sizes, then disabled, read-only, invalid</h4>
		<div class="flex flex-col gap-2">
			{#each ['sm', 'md', 'lg'] as const as size (size)}
				<div class={field}><UserPicker {client} value={preset} {size} /></div>
			{/each}
			<div class={field}><UserPicker {client} value={preset} disabled /></div>
			<div class={field}><UserPicker {client} value={preset} readonly /></div>
			<div class={field}><UserPicker {client} value={preset} invalid /></div>
		</div>
	</section>
</div>
