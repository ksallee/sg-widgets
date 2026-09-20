<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import EntityPicker from '$lib/registry/components/entity-picker.svelte';
	import { createDemoClient, createDemoContext } from '../_shared/client';

	const context = createDemoContext();
	// Its own context, so arming a failure cannot land in another demo on the page.
	const failing = createDemoClient();

	let shot = $state<EntityRef | null>(null);
	let withStatus = $state<EntityRef | null>(null);
	let anything = $state<EntityRef | null>(null);
	let custom = $state<EntityRef | null>(null);
	let inProject = $state<EntityRef | null>(null);
	// A bare reference: type and id, no name. Resolved on mount by one id-in read.
	let bare = $state<EntityRef | null>({ type: 'Shot', id: 866 });
	let plain = $state<EntityRef | null>(null);
	let anatomy = $state<EntityRef | null>(null);
	let paged = $state<EntityRef | null>(null);
	let failed = $state<EntityRef | null>(null);
	let lastError = $state<string | null>(null);
	const preset: EntityRef = { type: 'Asset', id: 1226, name: 'charAda' };
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
		<h4 class={label}>One shot</h4>
		<div class={field}>
			<span class={caption}>One shot, clearable</span>
			<EntityPicker {context} entityTypes={['Shot']} bind:value={shot} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="status-secondary">
		<h4 class={label}>Status as secondary</h4>
		<div class={field}>
			<span class={caption}>Status on the right of every row</span>
			<EntityPicker
				{context}
				entityTypes={['Shot']}
				secondaryField="sg_status_list"
				bind:value={withStatus}
				clearable
			/>
		</div>
	</section>

	<section class={group} data-demo-case="multi-type">
		<h4 class={label}>Three types at once, the type on the right</h4>
		<div class={field}>
			<span class={caption}>Shots, assets and sequences in one list</span>
			<EntityPicker
				{context}
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
			<span class={caption}>The id, rendered by the caller</span>
			<EntityPicker
				{context}
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
			<span class={caption}>Scoped to one project</span>
			<EntityPicker
				{context}
				entityTypes={['Shot']}
				projectId={context.projectFor(71)}
				bind:value={inProject}
				placeholder="Shots on one project…"
			/>
		</div>
	</section>

	<section class={group} data-demo-case="hydrate">
		<h4 class={label}>Bare reference, resolved on mount</h4>
		<div class={field}>
			<span class={caption}>Type and id in, name resolved on mount</span>
			<EntityPicker {context} entityTypes={['Shot']} bind:value={bare} clearable />
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
			<span class={caption}>Five a page</span>
			<EntityPicker {context} entityTypes={['Shot']} pageSize={5} bind:value={paged} />
		</div>
	</section>

	<section class={group} data-demo-case="error">
		<h4 class={label}>Error state</h4>
		<div class={field}>
			<span class={caption}>Reads a client whose next call can be armed to fail</span>
			<EntityPicker
				context={failing.context}
				entityTypes={['Shot']}
				bind:value={failed}
				onError={(error) => (lastError = error.message)}
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

	<section class={group} data-demo-case="anatomy">
		<h4 class={label}>Row anatomy: no thumbnail, a sub-label, the code beside the name</h4>
		<div class={stack}>
			<div class={field}>
				<span class={caption}>No thumbnail</span>
				<EntityPicker {context} entityTypes={['Shot']} thumbnail={false} bind:value={plain} clearable />
			</div>
			<div class={field}>
				<span class={caption}>Everything: thumbnail, sub-label, secondary and the code beside the name</span>
				<EntityPicker
					{context}
					entityTypes={['Version']}
					subLabelField="sg_status_list"
					secondaryField="id"
					showCode
					bind:value={anatomy}
					clearable
				/>
			</div>
		</div>
	</section>

	<section class={group} data-demo-case="sizes">
		<h4 class={label}>Sizes</h4>
		<div class={stack}>
			{#each SIZES as { size, caption: sizeCaption } (size)}
				<div class={field}>
					<span class={caption}>{sizeCaption}</span>
					<EntityPicker {context} entityTypes={['Asset']} value={preset} {size} clearable />
				</div>
			{/each}
		</div>
	</section>

	<section class={group} data-demo-case="states">
		<h4 class={label}>Disabled, read-only, invalid</h4>
		<div class={stack}>
			<div class={field}>
				<span class={caption}>Disabled</span>
				<EntityPicker {context} entityTypes={['Asset']} value={preset} disabled />
			</div>
			<div class={field}>
				<span class={caption}>Read-only</span>
				<EntityPicker {context} entityTypes={['Asset']} value={preset} readonly />
			</div>
			<div class={field}>
				<span class={caption}>Invalid</span>
				<EntityPicker {context} entityTypes={['Asset']} value={preset} invalid />
			</div>
		</div>
	</section>
</div>
