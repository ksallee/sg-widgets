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
	import EntityPicker, { type EntityPickerBaseProps } from './entity-picker.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> &
		Omit<EntityPickerBaseProps, 'entityTypes'> &
		UserPickerOptions & {
			value?: EntityRef | null;
			onValueChange?: (value: EntityRef | null, row: PickerRow | null) => void;
		};

	let {
		value = $bindable(null),
		includeApiUsers = true,
		includeInactive = false,
		filters = null,
		fields = [],
		searchFields = [],
		placeholder = 'Search for a person',
		open = $bindable(false),
		ref = $bindable(null),
		...rest
	}: Props = $props();
</script>

<!--
	One person, chosen by server-side search.

	The generic entity picker with the person configuration: human users and,
	optionally, script accounts; active people only unless asked otherwise; the
	query matched against the name, the email and, while it holds no whitespace, the
	login; an avatar per row and the email under the name.
-->
<EntityPicker
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
