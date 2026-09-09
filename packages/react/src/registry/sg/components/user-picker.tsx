import type { EntityRef, FilterGroup, PickerRow, WireGroup } from '@sg-widgets/core';
import { asFilterGroup, condition, mergeFilters } from '@sg-widgets/core';
import { EntityPicker, type EntityPickerBaseProps } from '@/registry/sg/components/entity-picker';
import {
  EntityMultiPicker,
  type EntityMultiPickerBaseProps,
} from '@/registry/sg/components/entity-multi-picker';

/** People and script accounts, in that order. */
function userTypes(includeApiUsers: boolean): string[] {
  return includeApiUsers ? ['HumanUser', 'ApiUser'] : ['HumanUser'];
}

/**
 * The active condition, unless inactive people are wanted. `sg_status_list` on
 * HumanUser is two codes, `act` and `dis`, and `act` is the default
 * (entity_types/HumanUser). ApiUser has no status field, so the picker drops the
 * condition on that type rather than sending a filter that would 400.
 */
function userFilters(includeInactive: boolean, extra: FilterGroup | WireGroup | null | undefined): FilterGroup {
  return mergeFilters(asFilterGroup(extra), includeInactive ? null : condition('sg_status_list', 'is', 'act'));
}

/** `API user` for a script account, the login for a person, nothing without one. */
function userSubLabel(row: PickerRow): string {
  if (row.type === 'ApiUser') return 'API user';
  const login = row.values['login'];
  return typeof login === 'string' && login.length > 0 ? `@${login}` : '';
}

/** Login and email are searched, so they have to be read (entity_types/HumanUser). */
const USER_FIELDS = ['login', 'email', 'sg_status_list'];
const USER_SEARCH_FIELDS = ['login', 'email'];

interface UserOptions {
  /** Search script accounts alongside people. */
  includeApiUsers?: boolean;
  /** Offer people whose status is `dis`. */
  includeInactive?: boolean;
}

export interface UserPickerProps extends Omit<EntityPickerBaseProps, 'entityTypes'>, UserOptions {
  value?: EntityRef | null;
  onValueChange?: (value: EntityRef | null, row: PickerRow | null) => void;
}

/**
 * One person, chosen by server-side search.
 *
 * The generic entity picker with the person configuration: human users and,
 * optionally, script accounts; active people only unless asked otherwise; the
 * query matched against the name, the login and the email; an avatar per row and
 * the login under the name.
 */
export function UserPicker({
  includeApiUsers = true,
  includeInactive = false,
  filters = null,
  fields = [],
  searchFields = [],
  placeholder = 'Search for a person',
  emptyLabel = 'No person matches.',
  ...rest
}: UserPickerProps) {
  return (
    <EntityPicker
      entityTypes={userTypes(includeApiUsers)}
      searchFields={[...USER_SEARCH_FIELDS, ...searchFields]}
      fields={[...USER_FIELDS, ...fields]}
      filters={userFilters(includeInactive, filters)}
      subLabel={userSubLabel}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      {...rest}
    />
  );
}

export interface UserMultiPickerProps extends Omit<EntityMultiPickerBaseProps, 'entityTypes'>, UserOptions {
  value?: EntityRef[];
  onValueChange?: (value: EntityRef[], rows: PickerRow[]) => void;
}

/**
 * Several people, chosen by server-side search.
 *
 * The same configuration as the single user picker, on the multi picker: checkbox
 * rows, removable chips, and selections pinned into the list so they can be
 * unticked whatever the query.
 */
export function UserMultiPicker({
  includeApiUsers = true,
  includeInactive = false,
  filters = null,
  fields = [],
  searchFields = [],
  placeholder = 'Search for people',
  emptyLabel = 'No person matches.',
  ...rest
}: UserMultiPickerProps) {
  return (
    <EntityMultiPicker
      entityTypes={userTypes(includeApiUsers)}
      searchFields={[...USER_SEARCH_FIELDS, ...searchFields]}
      fields={[...USER_FIELDS, ...fields]}
      filters={userFilters(includeInactive, filters)}
      subLabel={userSubLabel}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      {...rest}
    />
  );
}
