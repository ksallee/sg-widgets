import { useEffect, useMemo, useState } from 'react';
import type { CollectionColumn, EntityRef, FieldSchema, StatusRecord } from '@sg-widgets/core';
import { createEntitySource, resolveColumns } from '@sg-widgets/core';
import { EntityGrid } from '@/registry/sg/components/entity-grid';
import { createDemoContext } from '../_shared/client';
import { DemoClientProvider } from '../_shared/react';

const SECONDARY = ['user', 'created_at'];
const FIELDS = ['code', 'image', 'sg_status_list', ...SECONDARY];
const SIZES = ['sm', 'md', 'lg'] as const;

const toggle =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
  'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';

interface Loaded {
  secondary: CollectionColumn[];
  statusField: FieldSchema | null;
  statuses: Record<string, StatusRecord>;
}

export default function EntityGridDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const source = useMemo(
    () => createEntitySource({ client: context.client, entityType: 'Version', fields: FIELDS, pageSize: 12 }),
    [context],
  );

  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [size, setSize] = useState<(typeof SIZES)[number]>('md');
  const [selected, setSelected] = useState<EntityRef[]>([]);

  useEffect(() => {
    let live = true;
    Promise.all([
      resolveColumns(context.schema, 'Version', SECONDARY),
      context.schema.fields('Version'),
      context.statuses.byCode(),
    ])
      .then(([secondary, fields, table]) => {
        if (!live) return;
        void source.count();
        setData({ secondary, statusField: fields['sg_status_list'] ?? null, statuses: Object.fromEntries(table) });
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
          {SIZES.map((option) => (
            <button
              key={option}
              type="button"
              className={toggle}
              aria-pressed={size === option}
              onClick={() => setSize(option)}
            >
              {option}
            </button>
          ))}
          <span className="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
            {selected.length} selected
          </span>
        </div>
        <EntityGrid
          source={source}
          secondary={data.secondary}
          statusField={data.statusField}
          statuses={data.statuses}
          size={size}
          selectable
          maxHeight="26rem"
          onSelectionChange={setSelected}
        />
      </div>
    </DemoClientProvider>
  );
}
