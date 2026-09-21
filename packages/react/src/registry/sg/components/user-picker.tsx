import type { EntityRef, PickerRow, UserPickerOptions } from 'sg-widgets-core';
import {
  USER_PICKER_FIELDS,
  userPickerFilters,
  userPickerSearchFields,
  userPickerSubLabel,
  userPickerTypes,
} from 'sg-widgets-core';
import { EntityPicker, type EntityPickerBaseProps } from '@/registry/sg/components/entity-picker';

export interface UserPickerProps extends Omit<EntityPickerBaseProps, 'entityTypes'>, UserPickerOptions {
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
      entityTypes={userPickerTypes(includeApiUsers)}
      searchFields={userPickerSearchFields(searchFields)}
      fields={[...USER_PICKER_FIELDS, ...fields]}
      filters={userPickerFilters(includeInactive, filters)}
      subLabel={userPickerSubLabel}
      placeholder={placeholder}
      {...rest}
    />
  );
}
