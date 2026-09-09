<script lang="ts" module>
	import type { FilterGroup, PickerRow, SearchFieldSpec, WireGroup } from '@sg-widgets/core';
	import { asFilterGroup, condition, mergeFilters, userSearchFields } from '@sg-widgets/core';

	/** People and script accounts, in that order. */
	export function userTypes(includeApiUsers: boolean): string[] {
		return includeApiUsers ? ['HumanUser', 'ApiUser'] : ['HumanUser'];
	}

	/**
	 * The active condition, unless inactive people are wanted. `sg_status_list` on
	 * HumanUser is two codes, `act` and `dis`, and `act` is the default
	 * (entity_types/HumanUser). ApiUser has no status field, so the picker drops the
	 * condition on that type rather than sending a filter that would 400.
	 */
	export function userFilters(
		includeInactive: boolean,
		extra: FilterGroup | WireGroup | null | undefined
	): FilterGroup {
		return mergeFilters(
			asFilterGroup(extra),
			includeInactive ? null : condition('sg_status_list', 'is', 'act')
		);
	}

	/** `API user` for a script account, the email for a person, nothing without one. */
	export function userSubLabel(row: PickerRow): string {
		if (row.type === 'ApiUser') return 'API user';
		const email = row.values['email'];
		return typeof email === 'string' ? email : '';
	}

	/** The caller's own search fields, on top of the ones a person is searched by. */
	export function userSearchFieldsWith(
		extra: SearchFieldSpec[] | ((query: string) => SearchFieldSpec[])
	): (query: string) => SearchFieldSpec[] {
		return (query: string) => [
			...userSearchFields(query),
			...(typeof extra === 'function' ? extra(query) : extra)
		];
	}

	/** Login and email are searched and shown, so they have to be read (entity_types/HumanUser). */
	export const USER_FIELDS = ['login', 'email', 'sg_status_list'];
</script>

<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import EntityPicker, { type EntityPickerBaseProps } from './entity-picker.svelte';

	type Props = Omit<EntityPickerBaseProps, 'entityTypes'> & {
		value?: EntityRef | null;
		onValueChange?: (value: EntityRef | null, row: PickerRow | null) => void;
		/** Search script accounts alongside people. */
		includeApiUsers?: boolean;
		/** Offer people whose status is `dis`. */
		includeInactive?: boolean;
	};

	let {
		value = $bindable(null),
		includeApiUsers = true,
		includeInactive = false,
		filters = null,
		fields = [],
		searchFields = [],
		placeholder = 'Search for a person',
		emptyLabel = 'No person matches.',
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
	entityTypes={userTypes(includeApiUsers)}
	searchFields={userSearchFieldsWith(searchFields)}
	fields={[...USER_FIELDS, ...fields]}
	filters={userFilters(includeInactive, filters)}
	subLabel={userSubLabel}
	{placeholder}
	{emptyLabel}
	{...rest}
/>
