<script lang="ts" module>
	import type { FilterGroup, WireGroup } from '@sg-widgets/core';
	import { asFilterGroup, condition, mergeFilters } from '@sg-widgets/core';

	/**
	 * Archived projects are hidden unless asked for. `sg_status` is not a liveness
	 * filter and is null on most projects; `archived`, `is_template` and `is_demo`
	 * are the discriminators (018_project_listing).
	 */
	export function projectFilters(
		includeArchived: boolean,
		extra: FilterGroup | WireGroup | null | undefined
	): FilterGroup {
		return mergeFilters(asFilterGroup(extra), includeArchived ? null : condition('archived', 'is', false));
	}

	/** Project's status field is `sg_status`, a plain list, not `sg_status_list`. */
	export const PROJECT_FIELDS = ['sg_status', 'archived'];
</script>

<script lang="ts">
	import type { EntityRef, PickerRow } from '@sg-widgets/core';
	import EntityPicker, { type EntityPickerBaseProps } from './entity-picker.svelte';

	type Props = Omit<EntityPickerBaseProps, 'entityTypes'> & {
		value?: EntityRef | null;
		onValueChange?: (value: EntityRef | null, row: PickerRow | null) => void;
		/** Offer projects whose `archived` checkbox is set. */
		includeArchived?: boolean;
	};

	let {
		value = $bindable(null),
		includeArchived = false,
		filters = null,
		fields = [],
		placeholder = 'Search for a project',
		emptyLabel = 'No project matches.',
		open = $bindable(false),
		...rest
	}: Props = $props();
</script>

<!--
	One project, chosen by server-side search.

	The generic entity picker configured for Project: the project thumbnail, the
	status under the name so an active project can be told from a bidding one, and
	archived projects left out unless asked for.
-->
<EntityPicker
	bind:value
	bind:open
	entityTypes={['Project']}
	fields={[...PROJECT_FIELDS, ...fields]}
	filters={projectFilters(includeArchived, filters)}
	subLabelField="sg_status"
	{placeholder}
	{emptyLabel}
	{...rest}
/>
