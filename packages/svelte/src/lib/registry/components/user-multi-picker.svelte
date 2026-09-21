<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityRef, PickerRow, UserPickerOptions } from 'sg-widgets-core';
	import {
		USER_PICKER_FIELDS,
		userPickerFilters,
		userPickerSearchFields,
		userPickerSubLabel,
		userPickerTypes
	} from 'sg-widgets-core';
	import { type WithElementRef } from '$lib/utils.js';
	import EntityMultiPicker, {
		type EntityMultiPickerBaseProps
	} from './entity-multi-picker.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> &
		Omit<EntityMultiPickerBaseProps, 'entityTypes'> &
		UserPickerOptions & {
			value?: EntityRef[];
			onValueChange?: (value: EntityRef[], rows: PickerRow[]) => void;
		};

	let {
		value = $bindable([]),
		includeApiUsers = true,
		includeInactive = false,
		filters = null,
		fields = [],
		searchFields = [],
		placeholder = 'Search for people',
		open = $bindable(false),
		ref = $bindable(null),
		...rest
	}: Props = $props();
</script>

<!--
	Several people, chosen by server-side search.

	The same configuration as the single user picker, on the multi picker: checkbox
	rows, removable chips, and selections pinned into the list so they can be
	unticked whatever the query.
-->
<EntityMultiPicker
	bind:value
	bind:open
	bind:ref
	entityTypes={userPickerTypes(includeApiUsers)}
	searchFields={userPickerSearchFields(searchFields)}
	fields={[...USER_PICKER_FIELDS, ...fields]}
	filters={userPickerFilters(includeInactive, filters)}
	subLabel={userPickerSubLabel}
	{placeholder}
	{...rest}
/>
