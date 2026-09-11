import { Fragment, useEffect, useMemo, useState } from 'react';
import type { EntityRef, FieldSpec, PickerRow as PickerRowData, SgContext } from '@sg-widgets/core';
import { NO_ROWS_LABEL, pathOf, rowFields, stateLine } from '@sg-widgets/core';
import { ChevronDown, ListChecks, TriangleAlert } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { HierarchicalSearch } from '@/registry/sg/components/hierarchical-search';
import { PickerRow } from '@/registry/sg/components/picker-row';
import { StateLine } from '@/registry/sg/components/state-line';

/** What a widget or a publish needs to know about where the user is working. */
export interface WorkContext {
  project: EntityRef | null;
  /** The row the task hangs off: a Shot, an Asset, a Sequence. */
  entity: EntityRef | null;
  task: EntityRef | null;
}

/** One assigned task, ready to draw. */
export interface MyTask {
  task: EntityRef;
  project: EntityRef | null;
  entity: EntityRef | null;
  step: string;
  status: string;
  /** Every field the read answered, so the row anatomy can draw from it. */
  values: Record<string, unknown>;
}

/** A stable empty list, so the default never changes what an effect depends on. */
const EMPTY_FIELDS: string[] = [];

export const EMPTY_CONTEXT: WorkContext = { project: null, entity: null, task: null };

/**
 * The context a picked row implies. A Task carries its own link and project, so a
 * path is only read for the rows a search returns.
 */
export function contextFromPath(leaf: EntityRef, path: EntityRef[]): WorkContext {
  const project = path.find((r) => r.type === 'Project') ?? null;
  const task = leaf.type === 'Task' ? leaf : null;
  const entity = task
    ? ([...path].reverse().find((r) => r.type !== 'Project' && r.type !== 'Task') ?? null)
    : leaf.type === 'Project'
      ? null
      : leaf;
  return { project, entity, task };
}

function label(context: WorkContext): string {
  return context.task?.name ?? context.entity?.name ?? context.project?.name ?? 'No context';
}

function keyOf(context: WorkContext): string {
  return [context.project, context.entity, context.task].map((r) => (r ? `${r.type}:${r.id}` : '-')).join('|');
}

const heading = 'text-muted-foreground px-2 py-1.5 text-xs font-medium';
const rowClass =
  'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2';
/** A recent is a row of chips, and the chips carry the hover; the row itself stays quiet. */
const recentClass =
  'focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

export type ContextSelectorSize = 'sm' | 'md' | 'lg';

/**
 * Controls follow the input ladder of `docs/design-rules.md`. `data-empty` takes the
 * leading and the vertical inset down one step, so an empty control is tighter than a
 * filled one; `min-h` holds the ladder and the trailing inset stays reserve for the
 * clear and open controls.
 */
const BOX: Record<ContextSelectorSize, string> = {
  sm: 'min-h-8 pr-2 pl-[5px] py-0.5 data-empty:pl-1.5 data-empty:py-0',
  md: 'min-h-9 pr-3 pl-[5px] py-1 data-empty:pl-2 data-empty:py-0.5',
  lg: 'min-h-10 pr-3 pl-1 py-0.5 data-empty:pl-2 data-empty:py-0',
};
const GLYPH: Record<ContextSelectorSize, string> = { sm: 'size-4', md: 'size-4', lg: 'size-5' };
/** A chip inside a control sits one step down the leaf ladder. */
const CHIP: Record<ContextSelectorSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

export interface ContextSelectorProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** The widget context. Every read goes through it, so widgets on a page share one cache. */
  context: SgContext;
  /** The project, the row and the task the user is working in. */
  workContext?: WorkContext;
  /** The person whose tasks the middle section lists. */
  currentUser?: EntityRef | null;
  /** Contexts used before, newest first. Held by the caller. */
  recents?: WorkContext[];
  recentLimit?: number;
  onRecentsChange?: (recents: WorkContext[]) => void;
  onWorkContextChange?: (workContext: WorkContext) => void;
  /** Field holding the thumbnail URL. `false` leaves every task row on its glyph. */
  thumbnail?: string | false;
  /** Field holding a task row's label. Defaults to the task's own name. */
  labelField?: string;
  /** The muted line under the label: a path, or a resolved column. */
  subLabelField?: FieldSpec | null;
  /** The muted line of the caller's own making. Wins over `subLabelField`. */
  subLabel?: (task: MyTask) => string;
  /** The right-aligned value: a path, or a resolved column so it renders by type. */
  secondaryField?: FieldSpec | null;
  /** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
  secondary?: (task: MyTask) => string;
  /** Show the row's `code` beside the label when the two differ. */
  showCode?: boolean;
  /** Extra fields to request, so a caller's own sub-label or secondary can read them. */
  fields?: string[];
  /** Shown when the person has no task assigned. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
  size?: ContextSelectorSize;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * The project, the row and the task the user is working on.
 *
 * The three ways in are the three sections: contexts used before, the tasks assigned
 * to the current user, and a drill-down over the navigation tree. Assigned tasks are
 * one `_search` on Task filtered by `task_assignees`, grouped under their project.
 */
export function ContextSelector({
  context,
  workContext = EMPTY_CONTEXT,
  currentUser = null,
  recents = [],
  recentLimit = 5,
  onRecentsChange,
  onWorkContextChange,
  thumbnail = 'image',
  labelField,
  subLabelField = null,
  subLabel,
  secondaryField = 'sg_status_list',
  secondary,
  showCode = false,
  fields = EMPTY_FIELDS,
  emptyLabel = NO_ROWS_LABEL,
  loadingLabel,
  errorLabel,
  size = 'md',
  open: openProp,
  onOpenChange,
  className,
  ref,
  ...rest
}: ContextSelectorProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const [tasks, setTasks] = useState<MyTask[]>([]);
  /** True until the first read of the assigned tasks lands. */
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState<string | null>(null);

  const rootPath = workContext.project ? `/Project/${workContext.project.id}` : '/';
  const chips = [workContext.project, workContext.entity, workContext.task].filter(
    (r): r is EntityRef => r !== null,
  );

  /** Tasks under their project, in the order the projects first appear. */
  const byProject = useMemo(() => {
    const groups = new Map<string, { project: EntityRef | null; tasks: MyTask[] }>();
    for (const row of currentUser ? tasks : []) {
      const key = row.project ? `${row.project.type}:${row.project.id}` : '-';
      const group = groups.get(key);
      if (group) group.tasks.push(row);
      else groups.set(key, { project: row.project, tasks: [row] });
    }
    return [...groups.values()];
  }, [currentUser, tasks]);

  useEffect(() => {
    if (!currentUser) return;
    let live = true;
    void context.client
      .search('Task', {
        // `task_assignees` is a multi_entity of Group and HumanUser (entity_types/Task).
        filters: {
          logical_operator: 'and',
          conditions: [['task_assignees', 'in', [{ type: currentUser.type, id: currentUser.id }]]],
        },
        // A Task is named by `content`: it has no `code` and no `name` (entity_types/Task).
        fields: rowFields({ thumbnail, labelField, subLabelField, secondaryField, showCode, fields }, [
          'content',
          'sg_status_list',
          'project',
          'entity',
          'step',
        ]),
        page: { size: 50 },
      })
      .then((result) => {
        if (!live) return;
        setTasks(
          result.data.map((row) => {
            const values: Record<string, unknown> = { ...row.attributes };
            for (const [name, link] of Object.entries(row.relationships)) values[name] = link?.data ?? null;
            const named = labelField ? values[labelField] : undefined;
            const label =
              typeof named === 'string' && named.length > 0
                ? named
                : String(row.attributes['content'] ?? `Task #${row.id}`);
            return {
              task: { type: 'Task', id: row.id, name: label },
              project: (row.relationships['project']?.data as EntityRef | null) ?? null,
              entity: (row.relationships['entity']?.data as EntityRef | null) ?? null,
              step: (row.relationships['step']?.data as EntityRef | null)?.name ?? '',
              status: String(row.attributes['sg_status_list'] ?? ''),
              values,
            };
          }),
        );
      })
      .catch((error: unknown) => {
        if (!live) return;
        setFailure(error instanceof Error ? error.message : String(error));
        setTasks([]);
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.client, currentUser, thumbnail, labelField, subLabelField, secondaryField, showCode, fields]);

  /** The row a task draws as: the reference and every field the read answered. */
  function rowOf(task: MyTask): PickerRowData {
    return { type: 'Task', id: task.task.id, name: task.task.name ?? '', values: task.values };
  }

  /**
   * The muted line under the label. With no field and no function of the caller's,
   * it is what the task hangs off and the step it belongs to.
   */
  function subLabelOf(task: MyTask): string | undefined {
    if (subLabel) return subLabel(task);
    if (pathOf(subLabelField)) return undefined;
    return [task.entity?.name, task.step].filter(Boolean).join(' · ');
  }

  function apply(next: WorkContext): void {
    onRecentsChange?.([next, ...recents.filter((r) => keyOf(r) !== keyOf(next))].slice(0, recentLimit));
    onWorkContextChange?.(next);
    setOpen(false);
  }

  return (
    <div ref={ref} data-slot="context-selector" className={cn('w-full', className)} {...rest}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-slot="context-selector-trigger"
          data-size={size}
          data-empty={chips.length === 0 ? '' : undefined}
          className={cn(
            'border-border bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 items-center gap-1.5 rounded-lg border text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
            BOX[size],
          )}
          aria-label={`Context: ${label(workContext)}`}
        >
          <span className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
            {chips.length === 0 ? (
              <span className="text-muted-foreground text-sm">No context</span>
            ) : (
              chips.map((chip) => (
                <EntityChip key={`${chip.type}:${chip.id}`} entity={chip} size={CHIP[size]} context={context} />
              ))
            )}
          </span>
          <ChevronDown aria-hidden="true" className={cn('text-muted-foreground shrink-0', GLYPH[size])} />
        </PopoverTrigger>

        <PopoverContent className="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 p-3" align="start">
          <section data-slot="context-recents" className="flex max-h-28 flex-col overflow-y-auto">
            <h4 className={heading}>Recent</h4>
            {recents.length === 0 ? (
              <p className="text-muted-foreground px-2 py-1.5 text-sm">Nothing yet.</p>
            ) : (
              recents.map((recent) => (
                <button key={keyOf(recent)} type="button" className={recentClass} onClick={() => apply(recent)}>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                    {[recent.project, recent.entity, recent.task]
                      .filter((r): r is EntityRef => r !== null)
                      .map((chip) => (
                        <EntityChip key={`${chip.type}:${chip.id}`} entity={chip} size={CHIP[size]} context={context} />
                      ))}
                  </span>
                </button>
              ))
            )}
          </section>

          <section data-slot="context-my-tasks" className="flex max-h-52 flex-col overflow-y-auto">
            <h4 className={heading}>My tasks</h4>
            {failure !== null ? (
              <StateLine
                state="error"
                slotName="context-tasks-error"
                icon={TriangleAlert}
                label={stateLine('error', { errorLabel }, failure)}
              />
            ) : loading && currentUser ? (
              <div
                className="flex flex-col gap-2 p-1"
                aria-busy="true"
                aria-label={stateLine('loading', { loadingLabel })}
              >
                {[0, 1].map((line) => (
                  <div key={line} className="flex items-center gap-2 px-2 py-1.5">
                    <Skeleton className="size-4 shrink-0" />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <Skeleton className="h-3 w-1/2" />
                      <Skeleton className="h-2.5 w-1/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : byProject.length === 0 ? (
              <p data-slot="context-tasks-empty" className="text-muted-foreground px-2 py-1.5 text-sm">
                {emptyLabel}
              </p>
            ) : (
              byProject.map((group) => (
                <Fragment key={group.project ? `${group.project.type}:${group.project.id}` : '-'}>
                  <h5 className={heading}>{group.project?.name ?? 'No project'}</h5>
                  {group.tasks.map((row) => (
                    <button
                      key={row.task.id}
                      type="button"
                      className={rowClass}
                      data-entity-type="Task"
                      data-entity-id={row.task.id}
                      onClick={() => apply({ project: row.project, entity: row.entity, task: row.task })}
                    >
                      <PickerRow
                        row={rowOf(row)}
                        thumbnail={thumbnail}
                        showCode={showCode}
                        subLabelField={subLabelField}
                        subLabel={subLabelOf(row)}
                        secondaryField={secondaryField}
                        secondary={secondary ? secondary(row) : undefined}
                        size={size}
                        context={context}
                        glyph={<ListChecks aria-hidden="true" className="size-4" />}
                      />
                    </button>
                  ))}
                </Fragment>
              ))
            )}
          </section>

          <section data-slot="context-hierarchy" className="flex flex-col gap-2">
            <h4 className={heading}>Browse</h4>
            <HierarchicalSearch
              context={context}
              rootPath={rootPath}
              size={size}
              thumbnail={thumbnail}
              labelField={labelField}
              subLabelField={subLabelField}
              showCode={showCode}
              fields={fields}
              onSelect={(leaf, path) => apply(contextFromPath(leaf, path))}
              placeholder="Search for a task or a shot…"
            />
          </section>
        </PopoverContent>
      </Popover>
    </div>
  );
}
