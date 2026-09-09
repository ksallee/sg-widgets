import { useEffect, useMemo, useState } from 'react';
import type { CollectionColumn, EntityRef, StatusRecord } from '@sg-widgets/core';
import { createEntitySource, resolveColumns } from '@sg-widgets/core';
import { EntityTable } from '@/registry/sg/components/entity-table';
import { createDemoContext } from '../_shared/client';
import { DemoClientProvider } from '../_shared/react';

const COLUMNS = [
  { path: 'code', width: 260 },
  { path: 'entity', width: 150 },
  { path: 'sg_status_list', width: 150 },
  { path: 'image', width: 90 },
  { path: 'description', width: 260 },
  { path: 'user', width: 160 },
  { path: 'created_at', width: 170 },
  { path: 'updated_at', width: 170 },
];

const toggle =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
  'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';

interface Loaded {
  columns: CollectionColumn[];
  statuses: Record<string, StatusRecord>;
}

export default function EntityTableDemo() {
  const context = useMemo(() => createDemoContext({ counts: { versions: 320 } }), []);
  const source = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Version',
        fields: COLUMNS.map((c) => c.path),
        pageSize: 150,
      }),
    [context],
  );

  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [grouped, setGrouped] = useState(false);
  const [compact, setCompact] = useState(false);
  const [selected, setSelected] = useState<EntityRef[]>([]);

  useEffect(() => {
    let live = true;
    Promise.all([resolveColumns(context.schema, 'Version', COLUMNS), context.statuses.byCode()])
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

  return (
    <DemoClientProvider client={context.client}>
      <div className="flex w-full min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={toggle} aria-pressed={grouped} onClick={() => setGrouped(!grouped)}>
            Group by status
          </button>
          <button type="button" className={toggle} aria-pressed={compact} onClick={() => setCompact(!compact)}>
            Compact
          </button>
          <span className="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
            {selected.length} selected
          </span>
        </div>
        <EntityTable
          source={source}
          columns={data.columns}
          statuses={data.statuses}
          selectable
          editable
          density={compact ? 'compact' : 'default'}
          groupBy={grouped ? 'sg_status_list' : null}
          onSelectionChange={setSelected}
        />
      </div>
    </DemoClientProvider>
  );
}
