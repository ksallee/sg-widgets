import type { EntityRef, FilterGroup, PickerRow, SearchFieldSpec, WireGroup } from '@sg-widgets/core';
import { asFilterGroup, condition, mergeFilters, userSearchFields } from '@sg-widgets/core';
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

/** `API user` for a script account, the email for a person, nothing without one. */
function userSubLabel(row: PickerRow): string {
  if (row.type === 'ApiUser') return 'API user';
  const email = row.values['email'];
  return typeof email === 'string' ? email : '';
}

/** The caller's own search fields, on top of the ones a person is searched by. */
function userSearchFieldsWith(
  extra: SearchFieldSpec[] | ((query: string) => SearchFieldSpec[]),
): (query: string) => SearchFieldSpec[] {
  return (query: string) => [
    ...userSearchFields(query),
    ...(typeof extra === 'function' ? extra(query) : extra),
  ];
}

/** Login and email are searched and shown, so they have to be read (entity_types/HumanUser). */
const USER_FIELDS = ['login', 'email', 'sg_status_list'];

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
 * query matched against the name, the email and, while it holds no whitespace, the
 * login; an avatar per row and the email under the name.
 */
export function UserPicker({
  includeApiUsers = true,
  includeInactive = false,
  filters = null,
  fields = [],
  searchFields = [],
  placeholder = 'Search for a person',
  ...rest
}: UserPickerProps) {
  return (
    <EntityPicker
      entityTypes={userTypes(includeApiUsers)}
      searchFields={userSearchFieldsWith(searchFields)}
      fields={[...USER_FIELDS, ...fields]}
      filters={userFilters(includeInactive, filters)}
      subLabel={userSubLabel}
      placeholder={placeholder}
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
  ...rest
}: UserMultiPickerProps) {
  return (
    <EntityMultiPicker
      entityTypes={userTypes(includeApiUsers)}
      searchFields={userSearchFieldsWith(searchFields)}
      fields={[...USER_FIELDS, ...fields]}
      filters={userFilters(includeInactive, filters)}
      subLabel={userSubLabel}
      placeholder={placeholder}
      {...rest}
    />
  );
}
