import { Fragment, useEffect, useMemo, useState } from 'react';
import type { EntityRef, FieldSchema, SgContext, StatusRecord } from '@sg-widgets/core';
import { ChevronDown, ListChecks, TriangleAlert } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { HierarchicalSearch } from '@/registry/sg/components/hierarchical-search';
import { StatusBadge } from '@/registry/sg/components/status-badge';

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
}

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

export type ContextSelectorSize = 'sm' | 'md' | 'lg';

/**
 * Controls follow the input ladder of `docs/design-rules.md`. `data-empty` takes the
 * leading and the vertical inset down one step, so an empty control is tighter than a
 * filled one; `min-h` holds the ladder and the trailing inset stays reserve for the
 * clear and open controls.
 */
const BOX: Record<ContextSelectorSize, string> = {
  sm: 'min-h-8 px-2 py-1 data-empty:pl-1.5 data-empty:py-0.5',
  md: 'min-h-9 px-3 py-1 data-empty:pl-2 data-empty:py-0.5',
  lg: 'min-h-10 px-3 py-1 data-empty:pl-2 data-empty:py-0.5',
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
  size = 'md',
  open: openProp,
  onOpenChange,
  className,
  ref,
  ...rest
}: ContextSelectorProps) {
  const schema = context.schema;

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
  const [statuses, setStatuses] = useState<Record<string, StatusRecord>>({});
  const [statusField, setStatusField] = useState<FieldSchema | null>(null);

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
    let live = true;
    void Promise.all([context.statuses.byCode(), schema.field('Task', 'sg_status_list')])
      .then(([rows, field]) => {
        if (!live) return;
        setStatuses(Object.fromEntries(rows));
        setStatusField(field ?? null);
      })
      .catch(() => {
        // A badge falls back to the raw code, which is always readable.
      });
    return () => {
      live = false;
    };
  }, [context.statuses, schema]);

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
        fields: ['content', 'sg_status_list', 'project', 'entity', 'step'],
        page: { size: 50 },
      })
      .then((result) => {
        if (!live) return;
        setTasks(
          result.data.map((row) => ({
            task: { type: 'Task', id: row.id, name: String(row.attributes['content'] ?? `Task #${row.id}`) },
            project: (row.relationships['project']?.data as EntityRef | null) ?? null,
            entity: (row.relationships['entity']?.data as EntityRef | null) ?? null,
            step: (row.relationships['step']?.data as EntityRef | null)?.name ?? '',
            status: String(row.attributes['sg_status_list'] ?? ''),
          })),
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
  }, [context.client, currentUser]);

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
            'border-border bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 items-center gap-2 rounded-md border text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
            BOX[size],
          )}
          aria-label={`Context: ${label(workContext)}`}
        >
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
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
                <button key={keyOf(recent)} type="button" className={rowClass} onClick={() => apply(recent)}>
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
              <p className="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-sm">
                <TriangleAlert aria-hidden="true" className="size-4" />
                <span className="truncate">{failure}</span>
              </p>
            ) : loading && currentUser ? (
              <div className="flex flex-col gap-2 p-1" aria-busy="true">
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
              <p className="text-muted-foreground px-2 py-1.5 text-sm">No tasks assigned.</p>
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
                      <ListChecks aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate" title={row.task.name}>
                          {row.task.name}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                          {[row.entity?.name, row.step].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <StatusBadge
                        code={row.status}
                        status={statuses[row.status]}
                        field={statusField}
                        size={CHIP[size]}
                        siteUrl={context.siteUrl}
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
              onSelect={(leaf, path) => apply(contextFromPath(leaf, path))}
              placeholder="Search for a task or a shot…"
            />
          </section>
        </PopoverContent>
      </Popover>
    </div>
  );
}
