import { useEffect, useMemo, useState } from 'react';
import type { CollapseState, CollectionColumn, EntityRef, EntityRow, SortSpec, StatusRecord } from '@sg-widgets/core';
import {
  cellValue,
  collapseAll,
  condition,
  createEntitySource,
  displayNameOf,
  expandAll,
  resolveColumns,
} from '@sg-widgets/core';
import { GroupedList } from '@/registry/sg/components/grouped-list';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { createDemoClient, createDemoContext } from '../_shared/client';
import { DemoContextProvider } from '../_shared/react';

const GROUP = 'step.Step.code';
const SUB = 'sg_description';
const SECONDARY = 'due_date';
const FIELDS = ['content', 'sg_status_list', GROUP, SUB, SECONDARY];

const toggle =
  'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-sm shadow-xs ' +
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

  /** A filter no Task matches, so the list draws the caller's own empty label. */
  const emptySource = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Task',
        fields: FIELDS,
        filters: condition('content', 'is', 'no such task'),
        mode: 'pages',
        pageSize: 25,
      }),
    [context],
  );

  /**
   * Versions under the Shot or Asset each is of. The record is `entity`, which the list
   * does not sort on: the caller's own sort on `code` is what puts the versions of one
   * record together.
   */
  const recordSource = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Version',
        fields: ['code', 'sg_status_list', 'entity', 'description'],
        filters: context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null,
        sort: [{ path: 'code', descending: false }],
        mode: 'infinite',
        pageSize: 25,
      }),
    [context],
  );

  /** A client whose next read can be armed to fail, so the error line is on the page. */
  const failing = useMemo(() => createDemoClient(), []);
  const failedSource = useMemo(
    () =>
      createEntitySource({
        client: failing.context.client,
        entityType: 'Task',
        fields: FIELDS,
        mode: 'infinite',
        pageSize: 25,
      }),
    [failing],
  );

  const [data, setData] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compact, setCompact] = useState(false);
  const [pagedCollapsed, setPagedCollapsed] = useState<CollapseState>(expandAll);
  const [collapsed, setCollapsed] = useState<CollapseState>(expandAll);
  /** The derived list's sort, as the source holds it. */
  const [derivedSort, setDerivedSort] = useState<SortSpec[]>([]);
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
    return <StatusBadge code={code} status={data.statuses[code] ?? null} variant="glyph" size="sm" />;
  };

  return (
    <DemoContextProvider context={context}>
      <div className="flex w-full min-w-0 flex-col gap-3">
        <section className="flex w-full min-w-0 flex-col gap-3" data-demo-case="pages">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={toggle} aria-pressed={compact} onClick={() => setCompact(!compact)}>
              Compact
            </button>
            <button type="button" className={toggle} data-demo="collapse-all" onClick={() => setPagedCollapsed(collapseAll())}>
              Collapse all
            </button>
            <button type="button" className={toggle} data-demo="expand-all" onClick={() => setPagedCollapsed(expandAll())}>
              Expand all
            </button>
            <span className="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
              {selected.length} selected
            </span>
          </div>
          <GroupedList
            source={source}
            context={context}
            paging="pages"
            groupBy={data.columns[0]!}
            labelField="content"
            subLabelField={data.columns[1]!}
            secondaryField={data.columns[2]!}
            statuses={data.statuses}
            leading={leading}
            selectable
            density={compact ? 'compact' : 'default'}
            collapsed={pagedCollapsed}
            onCollapsedChange={setPagedCollapsed}
            onSelectionChange={setSelected}
          />
        </section>

        <section className="flex w-full min-w-0 flex-col gap-3" data-demo-case="derived">
          <h4 className="text-muted-foreground text-xs font-medium">Grouped on a derived key</h4>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={toggle} data-demo="collapse-all" onClick={() => setCollapsed(collapseAll())}>
              Collapse all
            </button>
            <button type="button" className={toggle} data-demo="expand-all" onClick={() => setCollapsed(expandAll())}>
              Expand all
            </button>
            <span className="text-muted-foreground text-xs" data-testid="derived-sort">
              Sorted on {derivedSort.map((key) => key.path).join(', ') || 'nothing'}
            </span>
          </div>
          <GroupedList
            source={recordSource}
            context={context}
            paging="more"
            groupKey={(row) => cellValue(row, 'entity')}
            groupLabel={(record) => displayNameOf(record as Record<string, unknown>)}
            labelField="code"
            subLabelField="sg_status_list"
            statuses={data.statuses}
            collapsed={collapsed}
            onCollapsedChange={setCollapsed}
            onSortChange={setDerivedSort}
            maxHeight="16rem"
          />
        </section>

        <section className="flex w-full min-w-0 flex-col gap-3" data-demo-case="states">
          <h4 className="text-muted-foreground text-xs font-medium">Empty and error</h4>
          <GroupedList
            source={emptySource}
            context={context}
            paging="pages"
            groupBy={data.columns[0]!}
            labelField="content"
            statuses={data.statuses}
            maxHeight="12rem"
            emptyLabel="No Task in this window"
          />
          <GroupedList
            source={failedSource}
            context={failing.context}
            paging="more"
            groupBy={data.columns[0]!}
            labelField="content"
            statuses={data.statuses}
            maxHeight="12rem"
          />
          <button
            type="button"
            className={toggle}
            data-arm-failure
            onClick={() => {
              failing.mock.failNext({ status: 503, message: 'Flow PT API error 503' });
              // The read a page already made is cached, so the armed call is only
              // reached once the cache lets it through.
              failing.context.invalidate();
              void failedSource.load();
            }}
          >
            Arm the next read to fail
          </button>
        </section>
      </div>
    </DemoContextProvider>
  );
}
