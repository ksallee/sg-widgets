import type { EntityRef, PickerRow, ProjectPickerOptions } from 'sg-widgets-core';
import { PROJECT_PICKER_FIELDS, projectPickerFilters } from 'sg-widgets-core';
import {
  EntityMultiPicker,
  type EntityMultiPickerBaseProps,
} from '@/registry/sg/components/entity-multi-picker';

export interface ProjectMultiPickerProps
  extends Omit<EntityMultiPickerBaseProps, 'entityTypes'>,
    ProjectPickerOptions {
  value?: EntityRef[];
  onValueChange?: (value: EntityRef[], rows: PickerRow[]) => void;
}

/**
 * Several projects, chosen by server-side search.
 *
 * The same configuration as the single project picker, on the multi picker.
 */
export function ProjectMultiPicker({
  includeArchived = false,
  filters = null,
  fields = [],
  placeholder = 'Search for projects',
  ...rest
}: ProjectMultiPickerProps) {
  return (
    <EntityMultiPicker
      entityTypes={['Project']}
      fields={[...PROJECT_PICKER_FIELDS, ...fields]}
      filters={projectPickerFilters(includeArchived, filters)}
      subLabelField="sg_status"
      placeholder={placeholder}
      {...rest}
    />
  );
}
