import type { EntityRef, FilterGroup, PickerRow, WireGroup } from '@sg-widgets/core';
import { asFilterGroup, condition, mergeFilters } from '@sg-widgets/core';
import { EntityPicker, type EntityPickerBaseProps } from '@/registry/sg/components/entity-picker';
import {
  EntityMultiPicker,
  type EntityMultiPickerBaseProps,
} from '@/registry/sg/components/entity-multi-picker';

/**
 * Archived projects are hidden unless asked for. `sg_status` is not a liveness
 * filter and is null on most projects; `archived`, `is_template` and `is_demo`
 * are the discriminators (018_project_listing).
 */
function projectFilters(includeArchived: boolean, extra: FilterGroup | WireGroup | null | undefined): FilterGroup {
  return mergeFilters(asFilterGroup(extra), includeArchived ? null : condition('archived', 'is', false));
}

/** Project's status field is `sg_status`, a plain list, not `sg_status_list`. */
const PROJECT_FIELDS = ['sg_status', 'archived'];

interface ProjectOptions {
  /** Offer projects whose `archived` checkbox is set. */
  includeArchived?: boolean;
}

export interface ProjectPickerProps extends Omit<EntityPickerBaseProps, 'entityTypes'>, ProjectOptions {
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
  emptyLabel = 'No project matches.',
  ...rest
}: ProjectPickerProps) {
  return (
    <EntityPicker
      entityTypes={['Project']}
      fields={[...PROJECT_FIELDS, ...fields]}
      filters={projectFilters(includeArchived, filters)}
      subLabelField="sg_status"
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      {...rest}
    />
  );
}

export interface ProjectMultiPickerProps
  extends Omit<EntityMultiPickerBaseProps, 'entityTypes'>,
    ProjectOptions {
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
  emptyLabel = 'No project matches.',
  ...rest
}: ProjectMultiPickerProps) {
  return (
    <EntityMultiPicker
      entityTypes={['Project']}
      fields={[...PROJECT_FIELDS, ...fields]}
      filters={projectFilters(includeArchived, filters)}
      subLabelField="sg_status"
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      {...rest}
    />
  );
}
