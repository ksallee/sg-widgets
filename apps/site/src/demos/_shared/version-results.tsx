/**
 * The Versions a filter tree matches: a count and the rows behind it.
 *
 * The editor emits a tree on every keystroke, so the read is debounced. The count and
 * the table come from one source, so both answer the same filter, and a path the site
 * refuses fails that read rather than the page: the table shows the refusal in place.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { CollectionColumn, FilterNode, StatusRecord, WireGroup } from 'sg-widgets-core';
import { createEntitySource, resolveColumns, toApi3Hash } from 'sg-widgets-core';
import { EntityTable } from '@/registry/sg/components/entity-table';
import type { DemoContext } from './client';
import {
  matchLabel,
  readCount,
  RESULT_DEBOUNCE_MS,
  RESULT_PAGE_SIZE,
  scopeToProject,
  VERSION_COLUMNS,
  type ResultCount,
} from './results';

interface Loaded {
  columns: CollectionColumn[];
  statuses: Record<string, StatusRecord>;
}

export function VersionResults({
  context,
  value,
  heading = 'Versions matching the filter',
}: {
  context: DemoContext;
  value: FilterNode;
  heading?: string;
}) {
  // The first tree goes in at construction, so the table's own first read is already
  // the filtered one.
  const first = useRef(value);
  const source = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Version',
        fields: VERSION_COLUMNS.map((column) => column.path),
        filters: scopeToProject(context, first.current),
        pageSize: RESULT_PAGE_SIZE,
      }),
    [context],
  );

  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [schemaError, setSchemaError] = useState<string | null>(null);
  const [count, setCount] = useState<ResultCount>({ kind: 'counting' });

  useEffect(() => {
    let live = true;
    Promise.all([resolveColumns(context.schema, 'Version', VERSION_COLUMNS), context.statuses.byCode()])
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
    <section className="flex min-w-0 flex-col gap-2">
      <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{heading}</h4>
      <p
        className={count.kind === 'error' ? 'text-destructive text-sm' : 'text-muted-foreground text-sm tabular-nums'}
        data-testid="result-count"
      >
        {matchLabel(count, 'Version')}
      </p>
      {schemaError ? (
        <p className="text-destructive text-sm">{schemaError}</p>
      ) : loaded ? (
        <EntityTable
          source={source}
          columns={loaded.columns}
          statuses={loaded.statuses}
          paging="more"
          maxHeight="20rem"
          emptyLabel="No Version matches this filter"
        />
      ) : (
        <p className="text-muted-foreground text-sm">Loading the site…</p>
      )}
    </section>
  );
}
