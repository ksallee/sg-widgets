import { useEffect, useMemo, useRef, useState } from 'react';
import type { CollectionColumn, FilterGroup, StatusRecord, WireGroup } from '@sg-widgets/core';
import { condition, createEntitySource, emptyFilter, facetCounts, group, resolveColumns, toApi3Hash } from '@sg-widgets/core';
import { Button } from '@/components/ui/button';
import { FilterBar, type FilterBarSize } from '@/registry/sg/components/filter-bar';
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
const SIZES: FilterBarSize[] = ['sm', 'md', 'lg'];
const section = 'flex min-w-0 flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';

/** Four statuses and three kinds ticked: the pill names two and reads the rest as `+n`. */
const seededTree = () =>
  group('and', [
    condition(GROUP, 'in', ['ip', 'rev', 'apr', 'fin']),
    condition('sg_shot_type', 'in', ['VFX', '2D', 'Full CG']),
  ]);

interface Loaded {
  columns: CollectionColumn[];
  statuses: Record<string, StatusRecord>;
}


export default function FilterBarDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const [value, setValue] = useState<FilterGroup>(emptyFilter);
  /** The Note bar: two entity facets counted by the site's groups, and the read state, which it refuses to group. */
  const [readState, setReadState] = useState<FilterGroup>(emptyFilter);
  const noteCounts = useMemo(() => facetCounts(context.client, 'Note'), [context]);
  const [seeded, setSeeded] = useState<FilterGroup>(seededTree);
  const [sized, setSized] = useState<Record<FilterBarSize, FilterGroup>>({ sm: seededTree(), md: seededTree(), lg: seededTree() });
  const scope = context.live ? group('and', [condition('project', 'is', { type: 'Project', id: context.projectId })]) : null;

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
  /** The Note total, paired with the filter it answered so a stale total never reads as a new one. */
  const [notes, setNotes] = useState<{ wire: string; count: ResultCount }>({ wire: '', count: { kind: 'counting' } });

  useEffect(() => {
    let live = true;
    void readCount(async () => {
      const summary = await context.client.summarize('Note', {
        filters: JSON.parse(readWire) as WireGroup | null,
        summaryFields: [{ field: 'id', type: 'count' }],
      });
      const total = summary.summaries['id'];
      return typeof total === 'number' ? total : null;
    }).then((next) => live && setNotes({ wire: readWire, count: next }));
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
          baseFilter={scope}
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

        <section className={section} data-demo="seeded">
          <h4 className={label}>Seeded with four statuses and three kinds</h4>
          <FilterBar
            entityType="Shot"
            context={context}
            facets={['sg_status_list', 'sg_shot_type']}
            labels={{ sg_shot_type: 'Kind' }}
            baseFilter={scope}
            value={seeded}
            onChange={setSeeded}
          />
        </section>

        <section className={section}>
          <h4 className={label}>Notes by sender, recipient and read state, counted by the site</h4>
          <FilterBar
            entityType="Note"
            context={context}
            facets={['user', 'addressings_to', 'read_by_current_user']}
            labels={{ user: 'From' }}
            counts={noteCounts}
            baseFilter={scope}
            value={readState}
            onChange={setReadState}
          />
          <p className="text-muted-foreground text-sm tabular-nums" data-testid="note-count" data-for={readWire}>
            {matchLabel(notes.wire === readWire ? notes.count : { kind: 'counting' }, 'Note')}
          </p>
          <pre
            data-testid="note-filter-json"
            className="border-border bg-muted text-foreground max-h-32 overflow-auto rounded-lg border p-3 font-mono text-xs"
          >
            {readWire}
          </pre>
        </section>

        <section className={section} data-demo="sizes">
          <h4 className={label}>Sizes, beside a button of the same size</h4>
          <div className="flex min-w-0 flex-col gap-3">
            {SIZES.map((size) => (
              <div key={size} className="flex min-w-0 items-start gap-3" data-qa-widget="filter-bar" data-qa-size={size}>
                <div className="min-w-0 flex-1">
                  <FilterBar
                    entityType="Shot"
                    context={context}
                    facets={['sg_status_list', 'sg_shot_type']}
                    labels={{ sg_shot_type: 'Kind' }}
                    size={size}
                    baseFilter={scope}
                    value={sized[size]}
                    onChange={(next) => setSized({ ...sized, [size]: next })}
                  />
                </div>
                <Button variant="outline" size={size === 'md' ? 'default' : size}>
                  {size}
                </Button>
              </div>
            ))}
          </div>
        </section>
      </div>
    </DemoContextProvider>
  );
}
