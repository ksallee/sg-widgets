<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityRef, PickerRow } from '@sg-widgets/core';
	import { type WithElementRef } from '$lib/utils.js';
	import EntityMultiPicker, {
		type EntityMultiPickerBaseProps
	} from './entity-multi-picker.svelte';
	import { USER_FIELDS, userFilters, userSearchFieldsWith, userSubLabel, userTypes } from './user-picker.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> &
		Omit<EntityMultiPickerBaseProps, 'entityTypes'> & {
		value?: EntityRef[];
		onValueChange?: (value: EntityRef[], rows: PickerRow[]) => void;
		/** Search script accounts alongside people. */
		includeApiUsers?: boolean;
		/** Offer people whose status is `dis`. */
		includeInactive?: boolean;
	};

	let {
		value = $bindable([]),
		includeApiUsers = true,
		includeInactive = false,
		filters = null,
		fields = [],
		searchFields = [],
		placeholder = 'Search for people',
		emptyLabel = 'No person matches.',
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
	entityTypes={userTypes(includeApiUsers)}
	searchFields={userSearchFieldsWith(searchFields)}
	fields={[...USER_FIELDS, ...fields]}
	filters={userFilters(includeInactive, filters)}
	subLabel={userSubLabel}
	{placeholder}
	{emptyLabel}
	{...rest}
/>
