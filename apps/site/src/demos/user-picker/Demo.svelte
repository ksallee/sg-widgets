<script lang="ts">
	import type { EntityRef } from 'sg-widgets-core';
	import UserPicker from '$lib/registry/components/user-picker.svelte';
	import { getDemoContext } from '../_shared/client';

	const context = getDemoContext();

	let one = $state<EntityRef | null>(null);
	let byAddress = $state<EntityRef | null>(null);
	let peopleOnly = $state<EntityRef | null>(null);
	let withInactive = $state<EntityRef | null>(null);
	// A bare reference: type and id, no name. Resolved on mount.
	let bare = $state<EntityRef | null>({ type: 'HumanUser', id: 22 });
	const preset: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };
	const SIZES = [
		{ size: 'sm', caption: 'Small' },
		{ size: 'md', caption: 'Medium, the default' },
		{ size: 'lg', caption: 'Large' }
	] as const;

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	// One control per row, full width of the pane, its caption on the line above.
	const field = 'flex w-full flex-col gap-2';
	const stack = 'flex flex-col gap-4';
	const caption = 'text-muted-foreground text-xs';
</script>

<div class="flex flex-col gap-3">
	<section class={group} data-demo-case="single">
		<h4 class={label}>One person or script</h4>
		<div class={field}>
			<span class={caption}>One person or script, clearable</span>
			<UserPicker {context} bind:value={one} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="by-address">
		<h4 class={label}>Matched on the name, the address or the login</h4>
		<div class={field}>
			<span class={caption}>Matched on the name, the address or the login</span>
			<UserPicker
				{context}
				bind:value={byAddress}
				placeholder="Try ada, ada.lo or @example.studio…"
			/>
		</div>
	</section>

	<section class={group} data-demo-case="people-only">
		<h4 class={label}>People only</h4>
		<div class={field}>
			<span class={caption}>People only, no script users</span>
			<UserPicker {context} includeApiUsers={false} bind:value={peopleOnly} />
		</div>
	</section>

	<section class={group} data-demo-case="inactive">
		<h4 class={label}>Inactive people included</h4>
		<div class={field}>
			<span class={caption}>Inactive people included</span>
			<UserPicker {context} includeInactive bind:value={withInactive} />
		</div>
	</section>

	<section class={group} data-demo-case="hydrate">
		<h4 class={label}>Bare reference, resolved on mount</h4>
		<div class={field}>
			<span class={caption}>Type and id in, name resolved on mount</span>
			<UserPicker {context} bind:value={bare} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="states">
		<h4 class={label}>Sizes, then disabled, read-only, invalid</h4>
		<div class={stack}>
			{#each SIZES as { size, caption: sizeCaption } (size)}
				<div class={field}>
					<span class={caption}>{sizeCaption}</span>
					<UserPicker {context} value={preset} {size} />
				</div>
			{/each}
			<div class={field}>
				<span class={caption}>Disabled</span>
				<UserPicker {context} value={preset} disabled />
			</div>
			<div class={field}>
				<span class={caption}>Read-only</span>
				<UserPicker {context} value={preset} readonly />
			</div>
			<div class={field}>
				<span class={caption}>Invalid</span>
				<UserPicker {context} value={preset} invalid />
			</div>
		</div>
	</section>
</div>
