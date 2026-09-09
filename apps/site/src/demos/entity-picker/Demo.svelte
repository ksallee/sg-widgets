<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import EntityPicker from '$lib/registry/components/entity-picker.svelte';
	import { createDemoClient } from '../_shared/client';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();
	// Its own client, so arming a failure cannot land in another demo on the page.
	const failing = createDemoClient();

	let shot = $state<EntityRef | null>(null);
	let withStatus = $state<EntityRef | null>(null);
	let anything = $state<EntityRef | null>(null);
	let custom = $state<EntityRef | null>(null);
	let inProject = $state<EntityRef | null>(null);
	// A bare reference: type and id, no name. Resolved on mount by one id-in read.
	let bare = $state<EntityRef | null>({ type: 'Shot', id: 866 });
	let paged = $state<EntityRef | null>(null);
	let failed = $state<EntityRef | null>(null);
	let lastError = $state<string | null>(null);
	const preset: EntityRef = { type: 'Asset', id: 1226, name: 'charAda' };

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const field = 'flex max-w-sm flex-col gap-2';
</script>

<div class="flex flex-col gap-4">
	<section class={group} data-demo-case="single">
		<h4 class={label}>One shot</h4>
		<div class={field}>
			<EntityPicker {client} entityTypes={['Shot']} bind:value={shot} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="status-secondary">
		<h4 class={label}>Status as secondary</h4>
		<div class={field}>
			<EntityPicker
				{client}
				entityTypes={['Shot']}
				secondaryField="sg_status_list"
				bind:value={withStatus}
				clearable
			/>
		</div>
	</section>

	<section class={group} data-demo-case="multi-type">
		<h4 class={label}>Three types at once, the type under the name</h4>
		<div class={field}>
			<EntityPicker
				{client}
				entityTypes={['Shot', 'Asset', 'Sequence']}
				bind:value={anything}
				placeholder="Search shots, assets and sequences…"
				clearable
			/>
		</div>
	</section>

	<section class={group} data-demo-case="custom-secondary">
		<h4 class={label}>Custom secondary</h4>
		<div class={field}>
			<EntityPicker
				{client}
				entityTypes={['Shot']}
				secondary={(row) => `#${row.id}`}
				bind:value={custom}
				clearable
			/>
		</div>
	</section>

	<section class={group} data-demo-case="project">
		<h4 class={label}>Scoped to one project</h4>
		<div class={field}>
			<EntityPicker
				{client}
				entityTypes={['Shot']}
				projectId={71}
				bind:value={inProject}
				placeholder="Shots on Harbour Lights…"
			/>
		</div>
	</section>

	<section class={group} data-demo-case="hydrate">
		<h4 class={label}>Bare reference, resolved on mount</h4>
		<div class={field}>
			<EntityPicker {client} entityTypes={['Shot']} bind:value={bare} clearable />
			<button
				type="button"
				class="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background self-start text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
				onclick={() => (bare = { type: 'Asset', id: 1229 })}
			>
				Hand in another bare reference
			</button>
		</div>
	</section>

	<section class={group} data-demo-case="more">
		<h4 class={label}>Five a page, with a load more row</h4>
		<div class={field}>
			<EntityPicker {client} entityTypes={['Shot']} pageSize={5} bind:value={paged} />
		</div>
	</section>

	<section class={group} data-demo-case="error">
		<h4 class={label}>Error state</h4>
		<div class={field}>
			<EntityPicker
				client={failing.client}
				entityTypes={['Shot']}
				bind:value={failed}
				onerror={(error) => (lastError = error.message)}
			/>
			<div class="flex items-center gap-2">
				<button
					type="button"
					class="text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background text-sm underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
					data-arm-failure
					onclick={() => failing.mock.failNext({ status: 503, message: 'Flow PT API error 503' })}
				>
					Arm the next call to fail
				</button>
				{#if lastError}
					<span class="text-destructive text-xs">{lastError}</span>
				{/if}
			</div>
		</div>
	</section>

	<section class={group} data-demo-case="sizes">
		<h4 class={label}>Sizes</h4>
		<div class="flex flex-col gap-2">
			{#each ['sm', 'md', 'lg'] as const as size (size)}
				<div class={field}>
					<EntityPicker {client} entityTypes={['Asset']} value={preset} {size} clearable />
				</div>
			{/each}
		</div>
	</section>

	<section class={group} data-demo-case="states">
		<h4 class={label}>Disabled, read-only, invalid</h4>
		<div class="flex flex-col gap-2">
			<div class={field}><EntityPicker {client} entityTypes={['Asset']} value={preset} disabled /></div>
			<div class={field}><EntityPicker {client} entityTypes={['Asset']} value={preset} readonly /></div>
			<div class={field}><EntityPicker {client} entityTypes={['Asset']} value={preset} invalid /></div>
		</div>
	</section>
</div>
