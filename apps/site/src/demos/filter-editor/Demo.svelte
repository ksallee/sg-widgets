<script lang="ts">
	import type { FilterGroup } from '@sg-widgets/core';
	import { condition, group, toApi3Hash } from '@sg-widgets/core';
	import { Button } from '$lib/components/ui/button/index.js';
	import FilterEditor, { type FilterEditorSize } from '$lib/registry/components/filter-editor.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';
	import VersionResults from '../_shared/version-results.svelte';

	const context = createDemoContext();
	setDemoContext(context);

	/**
	 * A tree a person would build: a status list on the multi picker, two conditions
	 * reached through links, a duration and a nested any-of holding a list of values, a
	 * colour and two relative windows. The duration is typed `1h 30m` or `1:30` and goes
	 * out as the 90 minutes it stores.
	 *
	 * The link rows name the fixtures' own sequence and project, so a real site gets the
	 * status row alone and the reviewer builds the rest against rows that exist.
	 */
	function initial(live: boolean): FilterGroup {
		const status = condition('sg_status_list', 'in', ['rev', 'vwd', 'fin', 'cmpt', 'apr']);
		if (live) return group('and', [status]);
		return group('and', [
			status,
			condition('entity.Shot.sg_sequence', 'is', { type: 'Sequence', id: 100, name: 'sh010' }),
			condition('project.Project.sg_status', 'is', 'Active'),
			condition('entity.Shot.sg_working_duration', 'greater_than', 90),
			group('or', [
				condition('code', 'contains', 'comp'),
				condition('sg_version_type', 'in', ['Type A', 'Type B']),
				condition('sg_bar_color', 'is', '253,94,99'),
				condition('sg_first_frame', 'in', [1001, 1101]),
				condition('created_at', 'in_last', [3, 'MONTH']),
				condition('entity.Shot.sg_turnover_date', 'in_next', [2, 'WEEK'])
			])
		]);
	}

	let value = $state<FilterGroup>(initial(context.live));
	/** A Note, whose read-state field evaluates `is` and `is_not` and nothing else. */
	let note = $state<FilterGroup>(group('and', [condition('read_by_current_user', 'is', 'unread')]));

	/** One row per control kind: a status list on the multi picker and a text on the input. */
	const sizedTree = () =>
		group('and', [condition('sg_status_list', 'in', ['rev']), condition('code', 'contains', 'sh')]);
	let sized = $state<Record<FilterEditorSize, FilterGroup>>({ sm: sizedTree(), md: sizedTree(), lg: sizedTree() });

	const SIZES: FilterEditorSize[] = ['sm', 'md', 'lg'];
	const section = 'flex min-w-0 flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

	const hash = $derived(toApi3Hash(value));
</script>

<div class="flex min-w-0 flex-col gap-4">
	<FilterEditor entityType="Version" {context} bind:value hidePaths={['sg_task']} />

	<section class="flex flex-col gap-2">
		<h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">api3_hash</h4>
		<pre
			data-testid="filter-json"
			class="border-border bg-muted text-foreground max-h-64 overflow-auto rounded-lg border p-3 font-mono text-xs">{JSON.stringify(
				hash,
				null,
				2
			)}</pre>
	</section>

	<VersionResults {context} {value} />

	<section class={section} data-demo="note">
		<h4 class={label}>Note, whose read-state field takes is and is not alone</h4>
		<FilterEditor entityType="Note" {context} bind:value={note} />
	</section>

	<section class={section} data-demo="sizes">
		<h4 class={label}>Sizes, beside a button of the same size</h4>
		<div class="flex min-w-0 flex-col gap-4">
			{#each SIZES as size (size)}
				<div class="flex min-w-0 items-start gap-3" data-qa-widget="filter-editor" data-qa-size={size}>
					<div class="min-w-0 flex-1">
						<FilterEditor entityType="Version" {context} {size} bind:value={sized[size]} />
					</div>
					<Button variant="outline" size={size === 'md' ? 'default' : size}>{size}</Button>
				</div>
			{/each}
		</div>
	</section>
</div>
