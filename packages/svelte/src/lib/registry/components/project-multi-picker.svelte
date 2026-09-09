<script lang="ts">
	import type { EntityRef, PickerRow } from '@sg-widgets/core';
	import EntityMultiPicker, {
		type EntityMultiPickerBaseProps
	} from './entity-multi-picker.svelte';
	import { PROJECT_FIELDS, projectFilters } from './project-picker.svelte';

	type Props = Omit<EntityMultiPickerBaseProps, 'entityTypes'> & {
		value?: EntityRef[];
		onValueChange?: (value: EntityRef[], rows: PickerRow[]) => void;
		/** Offer projects whose `archived` checkbox is set. */
		includeArchived?: boolean;
	};

	let {
		value = $bindable([]),
		includeArchived = false,
		filters = null,
		fields = [],
		placeholder = 'Search for projects',
		emptyLabel = 'No project matches.',
		...rest
	}: Props = $props();
</script>

<!--
	Several projects, chosen by server-side search.

	The same configuration as the single project picker, on the multi picker.
-->
<EntityMultiPicker
	bind:value
	entityTypes={['Project']}
	fields={[...PROJECT_FIELDS, ...fields]}
	filters={projectFilters(includeArchived, filters)}
	subLabelField="sg_status"
	{placeholder}
	{emptyLabel}
	{...rest}
/>
