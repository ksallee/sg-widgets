<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityRef, PickerRow, ProjectPickerOptions } from 'sg-widgets-core';
	import { PROJECT_PICKER_FIELDS, projectPickerFilters } from 'sg-widgets-core';
	import { type WithElementRef } from '$lib/utils.js';
	import EntityMultiPicker, {
		type EntityMultiPickerBaseProps
	} from './entity-multi-picker.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> &
		Omit<EntityMultiPickerBaseProps, 'entityTypes'> &
		ProjectPickerOptions & {
			value?: EntityRef[];
			onValueChange?: (value: EntityRef[], rows: PickerRow[]) => void;
		};

	let {
		value = $bindable([]),
		includeArchived = false,
		filters = null,
		fields = [],
		placeholder = 'Search for projects',
		open = $bindable(false),
		ref = $bindable(null),
		...rest
	}: Props = $props();
</script>

<!--
	Several projects, chosen by server-side search.

	The same configuration as the single project picker, on the multi picker.
-->
<EntityMultiPicker
	bind:value
	bind:open
	bind:ref
	entityTypes={['Project']}
	fields={[...PROJECT_PICKER_FIELDS, ...fields]}
	filters={projectPickerFilters(includeArchived, filters)}
	subLabelField="sg_status"
	{placeholder}
	{...rest}
/>
