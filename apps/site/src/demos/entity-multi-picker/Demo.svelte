<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import EntityMultiPicker from '$lib/registry/components/entity-multi-picker.svelte';
	import { createDemoClient } from '../_shared/client';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();
	// Its own client, so arming a failure cannot land in another demo on the page.
	const failing = createDemoClient();

	let shots = $state<EntityRef[]>([]);
	let withStatus = $state<EntityRef[]>([]);
	let anything = $state<EntityRef[]>([]);
	let custom = $state<EntityRef[]>([]);
	// Bare references: type and id, no name. Resolved on mount, one read per type.
	let bare = $state<EntityRef[]>([
		{ type: 'Shot', id: 866 },
		{ type: 'Asset', id: 1226 }
	]);
	let excluding = $state<EntityRef[]>([]);
	/** A token field with chips already in it, for the keyboard. */
	let tokens = $state<EntityRef[]>([
		{ type: 'Asset', id: 1226, name: 'charAda' },
		{ type: 'Asset', id: 1227, name: 'charBruno' },
		{ type: 'Asset', id: 1228, name: 'propLantern' }
	]);
	let paged = $state<EntityRef[]>([]);
	let failed = $state<EntityRef[]>([]);
	let lastError = $state<string | null>(null);

	/** Rows already on the team, kept out of the results by the server filter. */
	const alreadyThere: EntityRef[] = [
		{ type: 'Shot', id: 862, name: 'sh010_0010' },
		{ type: 'Shot', id: 863, name: 'sh010_0020' }
	];
	const preset: EntityRef[] = [
		{ type: 'Asset', id: 1226, name: 'charAda' },
		{ type: 'Asset', id: 1227, name: 'charBruno' }
	];
	/** Five, so `ellipsis` has something to count and `max` something to cut. */
	const five: EntityRef[] = [
		...preset,
		{ type: 'Asset', id: 1228, name: 'propLantern' },
		{ type: 'Asset', id: 1229, name: 'propCrate' },
		{ type: 'Asset', id: 1230, name: 'envForest' }
	];
	const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;

	const group = 'flex flex-col gap-3';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	/** One control per row, at the pane's full width, with its caption above it. */
	const stack = 'flex flex-col gap-4';
	const field = 'flex w-full flex-col gap-2';
	const caption = 'text-muted-foreground text-xs';
	/** At most 20rem, so the fit has something to cut against. */
	const narrow = 'max-w-80';
</script>

<div class="flex flex-col gap-4">
	<section class={group} data-demo-case="multi">
		<h4 class={label}>Several shots</h4>
		<div class={field}>
			<EntityMultiPicker {client} entityTypes={['Shot']} bind:value={shots} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="tokens">
		<h4 class={label}>A token field: Backspace walks the chips</h4>
		<div class={field}>
			<EntityMultiPicker
				{client}
				entityTypes={['Asset']}
				summary="chips"
				bind:value={tokens}
				clearable
			/>
		</div>
	</section>

	<section class={group} data-demo-case="status-secondary">
		<h4 class={label}>Status as secondary</h4>
		<div class={field}>
			<EntityMultiPicker
				{client}
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
			<EntityMultiPicker
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
			<EntityMultiPicker
				{client}
				entityTypes={['Shot']}
				secondary={(row) => `#${row.id}`}
				bind:value={custom}
				clearable
			/>
		</div>
	</section>

	<section class={group} data-demo-case="hydrate">
		<h4 class={label}>Bare references, resolved on mount</h4>
		<div class={field}>
			<EntityMultiPicker {client} entityTypes={['Shot', 'Asset']} bind:value={bare} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="exclude">
		<h4 class={label}>Two shots excluded from the results</h4>
		<div class={field}>
			<EntityMultiPicker
				{client}
				entityTypes={['Shot']}
				exclude={alreadyThere}
				bind:value={excluding}
				placeholder="sh010_0010 and sh010_0020 are not offered…"
			/>
		</div>
	</section>

	<section class={group} data-demo-case="more">
		<h4 class={label}>Five a page, with a load more row</h4>
		<div class={field}>
			<EntityMultiPicker {client} entityTypes={['Shot']} pageSize={5} bind:value={paged} />
		</div>
	</section>

	<section class={group} data-demo-case="error">
		<h4 class={label}>Error state</h4>
		<div class={field}>
			<EntityMultiPicker
				client={failing.client}
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

	<section class={group} data-demo-case="summary">
		<h4 class={label}>What the control shows for five selected, wide and narrow</h4>
		<div class={stack}>
			{#each SUMMARIES as summary (summary)}
				<div class={field} data-demo-summary={summary}>
					<span class={caption}>{summary}, full width</span>
					<EntityMultiPicker
						{client}
						entityTypes={['Asset']}
						value={five}
						{summary}
						clearable={false}
					/>
				</div>
				<div class={field} data-demo-summary="{summary}-narrow">
					<span class={caption}>{summary}, at most 20rem</span>
					<div class={narrow}>
						<EntityMultiPicker
							{client}
							entityTypes={['Asset']}
							value={five}
							{summary}
							clearable={false}
						/>
					</div>
				</div>
			{/each}
			<div class={field} data-demo-summary="max">
				<span class={caption}>chips, two at most</span>
				<EntityMultiPicker
					{client}
					entityTypes={['Asset']}
					value={five}
					summary="chips"
					max={2}
					clearable={false}
				/>
			</div>
		</div>
	</section>

	<section class={group} data-demo-case="sizes">
		<h4 class={label}>Sizes</h4>
		<div class={stack}>
			{#each ['sm', 'md', 'lg'] as const as size (size)}
				<div class={field}>
					<span class={caption}>{size}</span>
					<EntityMultiPicker {client} entityTypes={['Asset']} value={preset} {size} clearable />
				</div>
			{/each}
		</div>
	</section>

	<section class={group} data-demo-case="states">
		<h4 class={label}>Disabled, read-only, invalid</h4>
		<div class={stack}>
			<div class={field}>
				<span class={caption}>Disabled</span>
				<EntityMultiPicker {client} entityTypes={['Asset']} value={preset} disabled />
			</div>
			<div class={field}>
				<span class={caption}>Read-only</span>
				<EntityMultiPicker {client} entityTypes={['Asset']} value={preset} readonly />
			</div>
			<div class={field}>
				<span class={caption}>Invalid</span>
				<EntityMultiPicker {client} entityTypes={['Asset']} value={preset} invalid />
			</div>
		</div>
	</section>
</div>
