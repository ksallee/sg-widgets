import type { EntityRef, PickerRow, ProjectPickerOptions } from 'sg-widgets-core';
import { PROJECT_PICKER_FIELDS, projectPickerFilters } from 'sg-widgets-core';
import { EntityPicker, type EntityPickerBaseProps } from '@/registry/sg/components/entity-picker';

export interface ProjectPickerProps
  extends Omit<EntityPickerBaseProps, 'entityTypes'>,
    ProjectPickerOptions {
  value?: EntityRef | null;
  onValueChange?: (value: EntityRef | null, row: PickerRow | null) => void;
}

/**
 * One project, chosen by server-side search.
 *
 * The generic entity picker configured for Project: the project thumbnail, the
 * status under the name so an active project can be told from a bidding one, and
 * archived projects left out unless asked for.
 */
export function ProjectPicker({
  includeArchived = false,
  filters = null,
  fields = [],
  placeholder = 'Search for a project',
  ...rest
}: ProjectPickerProps) {
  return (
    <EntityPicker
      entityTypes={['Project']}
      fields={[...PROJECT_PICKER_FIELDS, ...fields]}
      filters={projectPickerFilters(includeArchived, filters)}
      subLabelField="sg_status"
      placeholder={placeholder}
      {...rest}
    />
  );
}
