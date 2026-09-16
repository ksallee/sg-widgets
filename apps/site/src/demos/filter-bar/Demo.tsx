import { useEffect, useMemo, useRef, useState } from 'react';
import type { CollectionColumn, FilterGroup, StatusRecord, WireGroup } from '@sg-widgets/core';
import { condition, createEntitySource, emptyFilter, group, resolveColumns, toApi3Hash } from '@sg-widgets/core';
import { FilterBar } from '@/registry/sg/components/filter-bar';
import { GroupedList } from '@/registry/sg/components/grouped-list';
import { createDemoContext } from '../_shared/client';
import { DemoContextProvider } from '../_shared/react';
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


export default function FilterBarDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [value, setValue] = useState<FilterGroup>(emptyFilter);
  /** The read-state bar, over a field the API evaluates only `is` and `is_not` on. */
  const [readState, setReadState] = useState<FilterGroup>(emptyFilter);

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
  const readWire = JSON.stringify(toApi3Hash(scopeToProject(context, readState)), null, 2);
  const [notes, setNotes] = useState<ResultCount>({ kind: 'counting' });

  useEffect(() => {
    let live = true;
    setNotes({ kind: 'counting' });
    void readCount(async () => {
      const summary = await context.client.summarize('Note', {
        filters: JSON.parse(readWire) as WireGroup | null,
        summaryFields: [{ field: 'id', type: 'count' }],
      });
      const total = summary.summaries['id'];
      return typeof total === 'number' ? total : null;
    }).then((next) => live && setNotes(next));
    return () => {
      live = false;
    };
  }, [context.client, readWire]);

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
    <DemoContextProvider context={context}>
      <div className="flex min-w-0 flex-col gap-4">
        <FilterBar
          entityType="Shot"
          context={context}
          facets={['sg_status_list', 'sg_sequence', 'sg_shot_type']}
          labels={{ sg_shot_type: 'Kind' }}
          baseFilter={context.live ? group('and', [condition('project', 'is', { type: 'Project', id: context.projectId })]) : null}
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
              subLabelField={loaded.columns[1]!}
              secondaryField={loaded.columns[2]!}
              statuses={loaded.statuses}
              maxHeight="20rem"
              emptyLabel="No Shot matches this filter"
            />
          ) : (
            <p className="text-muted-foreground text-sm">Loading the site…</p>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-2">
          <h4 className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Notes by read state</h4>
          <FilterBar
            entityType="Note"
            context={context}
            facets={['read_by_current_user']}
            baseFilter={
              context.live
                ? group('and', [condition('project', 'is', { type: 'Project', id: context.projectId })])
                : null
            }
            value={readState}
            onChange={setReadState}
          />
          <p className="text-muted-foreground text-sm tabular-nums" data-testid="note-count">
            {matchLabel(notes, 'Note')}
          </p>
          <pre
            data-testid="note-filter-json"
            className="border-border bg-muted text-foreground max-h-32 overflow-auto rounded-lg border p-3 font-mono text-xs"
          >
            {readWire}
          </pre>
        </section>
      </div>
    </DemoContextProvider>
  );
}
