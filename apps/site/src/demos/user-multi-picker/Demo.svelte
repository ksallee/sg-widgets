<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import UserMultiPicker from '$lib/registry/components/user-multi-picker.svelte';
	import { getDemoContext } from '../_shared/client';

	const context = getDemoContext();

	let people = $state<EntityRef[]>([]);
	let peopleOnly = $state<EntityRef[]>([]);
	/** A token field with chips already in it, for the keyboard. */
	let tokens = $state<EntityRef[]>([
		{ type: 'HumanUser', id: 20, name: 'Ada Lovelace' },
		{ type: 'HumanUser', id: 22, name: 'Cleo Dias' },
		{ type: 'HumanUser', id: 23, name: 'Dmitri Ivanov' }
	]);
	// Bare references: type and id, no name. Resolved on mount.
	let bare = $state<EntityRef[]>([
		{ type: 'HumanUser', id: 22 },
		{ type: 'HumanUser', id: 25 }
	]);

	const preset: EntityRef[] = [
		{ type: 'HumanUser', id: 20, name: 'Ada Lovelace' },
		{ type: 'HumanUser', id: 22, name: 'Cleo Dias' }
	];
	/** Five, so `ellipsis` has something to count and `max` something to cut. */
	const five: EntityRef[] = [
		...preset,
		{ type: 'HumanUser', id: 23, name: 'Dmitri Ivanov' },
		{ type: 'HumanUser', id: 25, name: 'Farid Nasser' },
		{ type: 'HumanUser', id: 26, name: 'Grace Ono' }
	];
	const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;

	/** One value per summary demo, so every control on the page takes an edit. */
	let shown = $state<Record<string, EntityRef[]>>({});
	const shownAt = (at: string) => shown[at] ?? five;
	const showAt = (at: string, next: EntityRef[]) => (shown = { ...shown, [at]: next });

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	// One control per row, full width of the pane, its caption on the line above.
	const field = 'flex w-full flex-col gap-2';
	const stack = 'flex flex-col gap-4';
	const caption = 'text-muted-foreground text-xs';
	/** At most 20rem, so the fit has something to cut against. */
	const narrow = 'max-w-80';
</script>

<div class="flex flex-col gap-3">
	<section class={group} data-demo-case="multi">
		<h4 class={label}>Several people or scripts</h4>
		<div class={field}>
			<span class={caption}>Several people at once</span>
			<UserMultiPicker {context} bind:value={people} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="tokens">
		<h4 class={label}>A token field: Backspace walks the chips</h4>
		<div class={field}>
			<span class={caption}>Three people already chosen</span>
			<UserMultiPicker {context} summary="chips" bind:value={tokens} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="people-only">
		<h4 class={label}>People only, inactive included</h4>
		<div class={field}>
			<span class={caption}>No script users, and people whose status is dis</span>
			<UserMultiPicker {context} includeApiUsers={false} includeInactive bind:value={peopleOnly} />
		</div>
	</section>

	<section class={group} data-demo-case="hydrate">
		<h4 class={label}>Bare references, resolved on mount</h4>
		<div class={field}>
			<span class={caption}>Types and ids in, names resolved on mount</span>
			<UserMultiPicker {context} bind:value={bare} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="summary">
		<h4 class={label}>What the control shows for five selected, wide and narrow</h4>
		<div class={stack}>
			{#each SUMMARIES as summary (summary)}
				<div class={field} data-demo-summary={summary}>
					<span class={caption}>{summary}, full width</span>
					<UserMultiPicker
						{context}
						value={shownAt(summary)}
						onValueChange={(next) => showAt(summary, next)}
						{summary}
						clearable={false}
					/>
				</div>
				<div class={field} data-demo-summary="{summary}-narrow">
					<span class={caption}>{summary}, at most 20rem</span>
					<div class={narrow}>
						<UserMultiPicker
							{context}
							value={shownAt(`${summary}-narrow`)}
							onValueChange={(next) => showAt(`${summary}-narrow`, next)}
							{summary}
							clearable={false}
						/>
					</div>
				</div>
			{/each}
			<div class={field} data-demo-summary="max">
				<span class={caption}>chips, two at most</span>
				<UserMultiPicker
					{context}
					value={shownAt('max')}
					onValueChange={(next) => showAt('max', next)}
					summary="chips"
					max={2}
					clearable={false}
				/>
			</div>
		</div>
	</section>

	<section class={group} data-demo-case="states">
		<h4 class={label}>Sizes, then disabled, read-only, invalid</h4>
		<div class={stack}>
			{#each ['sm', 'md', 'lg'] as const as size (size)}
				<div class={field}>
					<span class={caption}>{size}</span>
					<UserMultiPicker {context} value={preset} {size} clearable />
				</div>
			{/each}
			<div class={field}>
				<span class={caption}>Disabled</span>
				<UserMultiPicker {context} value={preset} disabled />
			</div>
			<div class={field}>
				<span class={caption}>Read-only</span>
				<UserMultiPicker {context} value={preset} readonly />
			</div>
			<div class={field}>
				<span class={caption}>Invalid</span>
				<UserMultiPicker {context} value={preset} invalid />
			</div>
		</div>
	</section>
</div>
