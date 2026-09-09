<script lang="ts" module>
	import type { FilterGroup, PickerRow, WireGroup } from '@sg-widgets/core';
	import { asFilterGroup, condition, mergeFilters } from '@sg-widgets/core';

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

	/** `API user` for a script account, the login for a person, nothing without one. */
	export function userSubLabel(row: PickerRow): string {
		if (row.type === 'ApiUser') return 'API user';
		const login = row.values['login'];
		return typeof login === 'string' && login.length > 0 ? `@${login}` : '';
	}

	/** Login and email are searched, so they have to be read (entity_types/HumanUser). */
	export const USER_FIELDS = ['login', 'email', 'sg_status_list'];
	export const USER_SEARCH_FIELDS = ['login', 'email'];
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
	query matched against the name, the login and the email; an avatar per row and
	the login under the name.
-->
<EntityPicker
	bind:value
	entityTypes={userTypes(includeApiUsers)}
	searchFields={[...USER_SEARCH_FIELDS, ...searchFields]}
	fields={[...USER_FIELDS, ...fields]}
	filters={userFilters(includeInactive, filters)}
	subLabel={userSubLabel}
	{placeholder}
	{emptyLabel}
	{...rest}
/>
