import { useEffect, useMemo, useState } from 'react';
import type { CollectionColumn, SortKey, StatusRecord } from '@sg-widgets/core';
import {
  createEntitySource,
  emptyFilter,
  fromSortString,
  resolveColumns,
  serializeSort,
  toSortString,
} from '@sg-widgets/core';
import { Button } from '@/components/ui/button';
import { CONTROL_BUTTON, type ControlSize } from '@/registry/sg/components/control-classes';
import { EntityTable } from '@/registry/sg/components/entity-table';
import { SortPicker } from '@/registry/sg/components/sort-picker';
import { createDemoContext } from '../_shared/client';
import { DemoContextProvider } from '../_shared/react';
import { RESULT_PAGE_SIZE, scopeToProject } from '../_shared/results';

const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const SIZES: ControlSize[] = ['sm', 'md', 'lg'];

const COLUMNS = [
  { path: 'code', width: 200 },
  { path: 'sg_status_list', width: 130 },
  { path: 'sg_sequence', width: 150 },
  { path: 'sg_shot_type', width: 130 },
  { path: 'updated_at', width: 170 },
];

const INITIAL: SortKey[] = [
  { field: 'sg_status_list', direction: 'asc' },
  { field: 'code', direction: 'desc' },
];

/** The keys as the source takes them, read back out of the string the picker emits. */
function specs(sort: string) {
  return fromSortString(sort).map((key) => ({ path: key.field, descending: key.direction === 'desc' }));
}

interface Loaded {
  columns: CollectionColumn[];
  statuses: Record<string, StatusRecord>;
}

export default function SortPickerDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [value, setValue] = useState<SortKey[]>(INITIAL);
  const sort = toSortString(value);

  const source = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Shot',
        fields: COLUMNS.map((column) => column.path),
        filters: scopeToProject(context, emptyFilter()),
        sort: specs(toSortString(INITIAL)),
        pageSize: RESULT_PAGE_SIZE,
      }),
    [context],
  );

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    Promise.all([resolveColumns(context.schema, 'Shot', COLUMNS), context.statuses.byCode()])
      .then(([columns, table]) => live && setLoaded({ columns, statuses: Object.fromEntries(table) }))
      .catch((error: unknown) => live && setSchemaError(error instanceof Error ? error.message : String(error)));
    return () => {
      live = false;
    };
  }, [context]);

  useEffect(() => {
    // A key the site cannot sort on is a silent no-op or a refusal, never a crash: the
    // table shows whichever it was (026_result_order).
    if ((serializeSort(source.sort) ?? '') !== sort) void source.setSort(specs(sort));
  }, [source, sort]);

  return (
    <DemoContextProvider context={context}>
      <div className="flex min-w-0 flex-col gap-4">
        <SortPicker entityType="Shot" context={context} value={value} onValueChange={setValue} />

        <section className="flex flex-col gap-2">
          <h4 className={label}>sort</h4>
          <pre
            data-testid="sort-string"
            className="border-border bg-muted text-foreground overflow-auto rounded-lg border p-3 font-mono text-xs"
          >
            {sort || '(none)'}
          </pre>
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <h4 className={label}>Shots in that order</h4>
          {schemaError ? (
            <p className="text-destructive text-sm">{schemaError}</p>
          ) : loaded ? (
            <EntityTable
              source={source}
              columns={loaded.columns}
              statuses={loaded.statuses}
              maxHeight="20rem"
              emptyLabel="No Shot to order"
            />
          ) : (
            <p className="text-muted-foreground text-sm">Loading the site…</p>
          )}
        </section>

        <section className="flex flex-col gap-2">
          <h4 className={label}>Sizes, each beside a button of the same step</h4>
          {SIZES.map((size) => (
            <div key={size} className="flex flex-wrap items-start gap-3" data-demo={`size-${size}`}>
              <div className="w-64">
                <SortPicker entityType="Shot" context={context} value={INITIAL} size={size} />
              </div>
              <Button variant="outline" size={CONTROL_BUTTON[size]}>
                Button
              </Button>
            </div>
          ))}
        </section>
      </div>
    </DemoContextProvider>
  );
}
