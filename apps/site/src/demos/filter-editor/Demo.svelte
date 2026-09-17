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
	 * A catalogue of the editor: one group per data-type family, each holding a spread of
	 * that family's operators, so every value control and every operator shape is on the
	 * page without a reader building one. Each row names a field the site's Version schema
	 * carries, on its own or through Link and Project, so the chooser draws a resolved path.
	 *
	 * The operators are the ones the field's data type accepts, from the operator-by-type
	 * map in `packages/core/src/field-types.ts` (`OPERATORS_BY_TYPE`, from
	 * `017_filter_operators` and `findings/field_types/*`). A `url` field takes no operator
	 * at all and has no row; the mock carries no `currency` field.
	 *
	 * The top level is Any: a catalogue holds rows that contradict each other, and Any keeps
	 * the count under it a count of rows. The link rows name the fixtures' own sequence,
	 * shots, assets and people, so a real site gets the status row alone and the reviewer
	 * builds the rest against rows that exist.
	 */
	function initial(live: boolean): FilterGroup {
		const status = condition('sg_status_list', 'in', ['rev', 'vwd', 'fin', 'cmpt', 'apr']);
		if (live) return group('and', [status]);
		return group('or', [
			// text
			group('or', [
				condition('code', 'contains', 'comp'),
				condition('code', 'starts_with', 'sh'),
				condition('sg_path_to_movie', 'ends_with', '.mov'),
				condition('description', 'not_contains', 'prores'),
				condition('sg_department', 'is_not', 'Comp')
			]),
			// number, float, percent and duration. A duration is typed `1h 30m` or `1:30` and
			// goes out as the 90 minutes it stores.
			group('or', [
				condition('sg_first_frame', 'between', [1001, 1200]),
				condition('sg_last_frame', 'greater_than', 1100),
				condition('frame_count', 'less_than', 120),
				condition('sg_first_frame', 'in', [1001, 1101]),
				condition('sg_uploaded_movie_frame_rate', 'is_not', 25),
				condition('entity.Shot.sg_complexity', 'greater_than', 60),
				condition('entity.Shot.sg_working_duration', 'greater_than', 90)
			]),
			// entity and multi_entity. `type_is`, `type_is_not` and `name_contains` compare
			// against a plain string, so they draw a text input rather than a picker.
			group('or', [
				condition('entity.Shot.sg_sequence', 'is', { type: 'Sequence', id: 100, name: 'sh010' }),
				condition('user', 'is_not', { type: 'HumanUser', id: 20, name: 'Ada Lovelace' }),
				condition('entity', 'in', [
					{ type: 'Shot', id: 862, name: 'sh010_0010' },
					{ type: 'Asset', id: 1226, name: 'charAda' }
				]),
				condition('entity.Shot.assets', 'not_in', [{ type: 'Asset', id: 1228, name: 'propLantern' }]),
				condition('entity', 'type_is', 'Shot'),
				condition('entity', 'type_is_not', 'Asset'),
				condition('playlists', 'name_contains', 'dailies')
			]),
			// status_list and list, on one value and on many
			group('or', [
				status,
				condition('sg_status_list', 'not_in', ['na', 'clsd']),
				condition('sg_status_list', 'is', 'rev'),
				condition('sg_version_type', 'is', 'Type A'),
				condition('project.Project.sg_status', 'in', ['Active', 'Bidding'])
			]),
			// date and date_time, one row per value shape: one date, two dates, a count and a
			// unit, and the calendar entries, which carry their own value and draw no editor.
			group('or', [
				condition('entity.Shot.sg_turnover_date', 'is', '2026-10-01'),
				condition('project.Project.sg_start_date', 'is_not', '2026-05-20'),
				condition('entity.Shot.sg_turnover_date', 'between', ['2026-09-20', '2026-10-20']),
				condition('created_at', 'greater_than', '2026-06-20T00:00:00Z'),
				condition('created_at', 'less_than', '2026-08-20T00:00:00Z'),
				condition('created_at', 'in_last', [3, 'MONTH']),
				condition('entity.Shot.sg_turnover_date', 'in_next', [2, 'WEEK']),
				condition('updated_at', 'in_calendar_day', -1),
				condition('created_at', 'in_calendar_week', 0),
				condition('entity.Shot.sg_turnover_date', 'in_calendar_month', 1)
			]),
			// checkbox, colour and the empty pair, under All, so a group inside a group inside a
			// group reads at three depths.
			group('and', [
				condition('client_approved', 'is', true),
				condition('entity.Shot.sg_omit', 'is', false),
				group('or', [
					condition('sg_bar_color', 'is', '253,94,99'),
					condition('sg_bar_color', 'is_not', '110,180,200'),
					group('or', [
						condition('sg_department', 'is', null),
						condition('sg_department', 'is_not', null)
					])
				])
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
