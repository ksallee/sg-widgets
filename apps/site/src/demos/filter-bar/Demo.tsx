import { useEffect, useMemo, useRef, useState } from 'react';
import type { CollectionColumn, EntityRow, FilterGroup, StatusRecord, WireGroup } from '@sg-widgets/core';
import { cellValue, createEntitySource, emptyFilter, resolveColumns, toApi3Hash } from '@sg-widgets/core';
import { FilterBar } from '@/registry/sg/components/filter-bar';
import { GroupedList } from '@/registry/sg/components/grouped-list';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { createDemoContext } from '../_shared/client';
import { DemoClientProvider } from '../_shared/react';
import {
  matchLabel,
  readCount,
  RESULT_DEBOUNCE_MS,
  RESULT_PAGE_SIZE,
  scopeToProject,
  type ResultCount,
} from '../_shared/results';

const GROUP = 'sg_status_list';
const SUB = 'description';
const SECONDARY = 'sg_sequence';
const FIELDS = ['code', GROUP, SUB, SECONDARY];

interface Loaded {
  columns: CollectionColumn[];
  statuses: Record<string, StatusRecord>;
}

const leading = (row: EntityRow) => (
  <StatusBadge code={String(cellValue(row, GROUP) ?? '')} variant="icon" size="sm" />
);

export default function FilterBarDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [value, setValue] = useState<FilterGroup>(emptyFilter);

  // The first tree goes in at construction, and the group path leads the sort, so the
  // list's own first read is already the one it groups.
  const first = useRef(value);
  const source = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Shot',
        fields: FIELDS,
        filters: scopeToProject(context, first.current),
        sort: [{ path: GROUP, descending: false }],
        pageSize: RESULT_PAGE_SIZE,
      }),
    [context],
  );

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [count, setCount] = useState<ResultCount>({ kind: 'counting' });

  useEffect(() => {
    let live = true;
    Promise.all([resolveColumns(context.schema, 'Shot', [GROUP, SUB, SECONDARY]), context.statuses.byCode()])
      .then(([columns, table]) => live && setLoaded({ columns, statuses: Object.fromEntries(table) }))
      .catch((error: unknown) => live && setSchemaError(error instanceof Error ? error.message : String(error)));
    return () => {
      live = false;
    };
  }, [context]);

  const wire = JSON.stringify(toApi3Hash(scopeToProject(context, value)));

  useEffect(() => {
    let live = true;
    const timer = setTimeout(() => {
      // An unchanged tree only re-counts: setting the same filter would re-read the page.
      if (JSON.stringify(source.filters) !== wire) void source.setFilters(JSON.parse(wire) as WireGroup | null);
      setCount({ kind: 'counting' });
      void readCount(() => source.count()).then((next) => live && setCount(next));
    }, RESULT_DEBOUNCE_MS);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [source, wire]);

  return (
    <DemoClientProvider client={context.client}>
      <div className="flex min-w-0 flex-col gap-4">
        <FilterBar
          entityType="Shot"
          client={context.client}
          facets={['sg_status_list', 'sg_sequence', 'sg_shot_type']}
          value={value}
          onChange={setValue}
        />

        <section className="flex min-w-0 flex-col gap-2">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Shots matching the filter</h4>
          <p
            className={
              count.kind === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm tabular-nums'
            }
            data-testid="result-count"
          >
            {matchLabel(count, 'Shot')}
          </p>
          {schemaError ? (
            <p className="text-destructive text-sm">{schemaError}</p>
          ) : loaded ? (
            <GroupedList
              source={source}
              groupBy={loaded.columns[0]!}
              subLabel={loaded.columns[1]!}
              secondary={loaded.columns[2]!}
              statuses={loaded.statuses}
              leading={leading}
              maxHeight="20rem"
              emptyLabel="No Shot matches this filter"
            />
          ) : (
            <p className="text-muted-foreground text-sm">Loading the site…</p>
          )}
        </section>
      </div>
    </DemoClientProvider>
  );
}
