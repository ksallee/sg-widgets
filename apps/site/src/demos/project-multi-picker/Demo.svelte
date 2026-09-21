<script lang="ts">
	import type { EntityRef } from 'sg-widgets-core';
	import ProjectMultiPicker from '$lib/registry/components/project-multi-picker.svelte';
	import { createDemoContext } from '../_shared/client';

	const context = createDemoContext();

	let several = $state<EntityRef[]>([]);
	let archived = $state<EntityRef[]>([]);
	// Bare references: type and id, no name. Resolved on mount.
	let bare = $state<EntityRef[]>([{ type: 'Project', id: context.projectFor(71) }]);

	// The names are the mock's. A live site holds its own projects, so the picker is
	// handed the one the page is scoped to and resolves its name.
	const preset: EntityRef[] = context.live
		? [{ type: 'Project', id: context.projectId }]
		: [
				{ type: 'Project', id: 70, name: 'Blue Moon Rising' },
				{ type: 'Project', id: 71, name: 'Harbour Lights' },
				{ type: 'Project', id: 72, name: 'Night Ferry' }
			];
	const SUMMARIES = ['chips', 'ellipsis', 'count'] as const;

	/** One value per summary demo, so every control on the page takes an edit. */
	let shown = $state<Record<string, EntityRef[]>>({});
	const shownAt = (at: string) => shown[at] ?? preset;
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
		<h4 class={label}>Several projects</h4>
		<div class={field}>
			<span class={caption}>Several projects at once</span>
			<ProjectMultiPicker {context} bind:value={several} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="tokens">
		<h4 class={label}>A token field: Backspace walks the chips</h4>
		<div class={field}>
			<span class={caption}>The projects already chosen, as chips</span>
			<ProjectMultiPicker
				{context}
				summary="chips"
				value={shownAt('tokens')}
				onValueChange={(next) => showAt('tokens', next)}
				clearable
			/>
		</div>
	</section>

	<section class={group} data-demo-case="archived">
		<h4 class={label}>Archived projects included</h4>
		<div class={field}>
			<span class={caption}>Archived projects included</span>
			<ProjectMultiPicker {context} includeArchived bind:value={archived} />
		</div>
	</section>

	<section class={group} data-demo-case="hydrate">
		<h4 class={label}>Bare references, resolved on mount</h4>
		<div class={field}>
			<span class={caption}>Types and ids in, names resolved on mount</span>
			<ProjectMultiPicker {context} bind:value={bare} clearable />
		</div>
	</section>

	<section class={group} data-demo-case="summary">
		<h4 class={label}>What the control shows for the selection, wide and narrow</h4>
		<div class={stack}>
			{#each SUMMARIES as summary (summary)}
				<div class={field} data-demo-summary={summary}>
					<span class={caption}>{summary}, full width</span>
					<ProjectMultiPicker
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
						<ProjectMultiPicker
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
				<ProjectMultiPicker
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
					<ProjectMultiPicker {context} value={preset} {size} clearable />
				</div>
			{/each}
			<div class={field}>
				<span class={caption}>Disabled</span>
				<ProjectMultiPicker {context} value={preset} disabled />
			</div>
			<div class={field}>
				<span class={caption}>Read-only</span>
				<ProjectMultiPicker {context} value={preset} readonly />
			</div>
			<div class={field}>
				<span class={caption}>Invalid</span>
				<ProjectMultiPicker {context} value={preset} invalid />
			</div>
		</div>
	</section>
</div>
