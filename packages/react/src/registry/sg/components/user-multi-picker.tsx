import type { EntityRef, PickerRow, UserPickerOptions } from '@sg-widgets/core';
import {
  USER_PICKER_FIELDS,
  userPickerFilters,
  userPickerSearchFields,
  userPickerSubLabel,
  userPickerTypes,
} from '@sg-widgets/core';
import {
  EntityMultiPicker,
  type EntityMultiPickerBaseProps,
} from '@/registry/sg/components/entity-multi-picker';

export interface UserMultiPickerProps
  extends Omit<EntityMultiPickerBaseProps, 'entityTypes'>,
    UserPickerOptions {
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
