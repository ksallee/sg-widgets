import { useEffect, useMemo, useState } from 'react';
import type { CollectionColumn, EntityRef, EntityRow, StatusRecord } from '@sg-widgets/core';
import { cellValue, condition, createEntitySource, resolveColumns } from '@sg-widgets/core';
import { GroupedList } from '@/registry/sg/components/grouped-list';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { createDemoContext } from '../_shared/client';
import { DemoClientProvider } from '../_shared/react';

const GROUP = 'step.Step.code';
const SUB = 'sg_description';
const SECONDARY = 'due_date';
const FIELDS = ['content', 'sg_status_list', GROUP, SUB, SECONDARY];

const toggle =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
  'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';

interface Loaded {
  columns: CollectionColumn[];
  statuses: Record<string, StatusRecord>;
}

export default function GroupedListDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const source = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Task',
        fields: FIELDS,
        // The mock's rows are one project's already; a real site's are not.
        filters: context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null,
        mode: 'pages',
        pageSize: 25,
      }),
    [context],
  );

  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [selected, setSelected] = useState<EntityRef[]>([]);

  useEffect(() => {
    let live = true;
    Promise.all([resolveColumns(context.schema, 'Task', [GROUP, SUB, SECONDARY]), context.statuses.byCode()])
      .then(([columns, table]) => {
        if (!live) return;
        void source.count();
        setData({ columns, statuses: Object.fromEntries(table) });
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [context, source]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!data) return <p className="text-muted-foreground text-sm">Loading the site…</p>;

  const leading = (row: EntityRow) => {
    const code = String(cellValue(row, 'sg_status_list') ?? '');
    return <StatusBadge code={code} status={data.statuses[code] ?? null} variant="icon" size="sm" />;
  };

  return (
    <DemoClientProvider client={context.client}>
      <div className="flex w-full min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={toggle} aria-pressed={compact} onClick={() => setCompact(!compact)}>
            Compact
          </button>
          <span className="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
            {selected.length} selected
          </span>
        </div>
        <GroupedList
          source={source}
          context={context}
          groupBy={data.columns[0]!}
          labelField="content"
          subLabelField={data.columns[1]!}
          secondaryField={data.columns[2]!}
          statuses={data.statuses}
          leading={leading}
          selectable
          density={compact ? 'compact' : 'default'}
          onSelectionChange={setSelected}
        />
      </div>
    </DemoClientProvider>
  );
}
