import { useEffect, useMemo, useState } from 'react';
import type { CollectionColumn, StatusRecord } from '@sg-widgets/core';
import { condition, createEntitySource, resolveColumns } from '@sg-widgets/core';
import { EntityTable } from '@/registry/sg/components/entity-table';
import { createDemoContext } from '../_shared/client';
import { DemoContextProvider } from '../_shared/react';

const COLUMNS = [
  { path: 'code', width: 260 },
  { path: 'sg_status_list', width: 150 },
  { path: 'user', width: 160 },
  { path: 'created_at', width: 170 },
];

export default function EntityTableInfiniteDemo() {
  const context = useMemo(() => createDemoContext({ counts: { versions: 320 } }), []);
  const source = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Version',
        fields: COLUMNS.map((c) => c.path),
        // The mock's rows are one project's already; a real site's are not.
        filters: context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null,
        pageSize: 50,
      }),
    [context],
  );

  const [columns, setColumns] = useState<CollectionColumn[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StatusRecord> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([resolveColumns(context.schema, 'Version', COLUMNS), context.statuses.byCode()])
      .then(([resolved, table]) => {
        if (!live) return;
        void source.count();
        setColumns(resolved);
        setStatuses(Object.fromEntries(table));
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [context, source]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!statuses) return <p className="text-muted-foreground text-sm">Loading the site…</p>;

  return (
    <DemoContextProvider context={context}>
      <EntityTable
        source={source}
        columns={columns}
        onColumnsChange={setColumns}
        statuses={statuses}
        context={context}
        showCode
        paging="more"
        maxHeight="22rem"
      />
    </DemoContextProvider>
  );
}
