import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CollectionColumn, EditorPlacement, EntityRef, FilterGroup, PagingMode, SortKey, StatusRecord } from '@sg-widgets/core';
import { condition, createEntitySource, emptyFilter, group, resolveColumns, toSortSpecs } from '@sg-widgets/core';
import { ColumnPicker } from '@/registry/sg/components/column-picker';
import { EntityTable } from '@/registry/sg/components/entity-table';
import { FilterBar } from '@/registry/sg/components/filter-bar';
import { SortPicker } from '@/registry/sg/components/sort-picker';
import { createDemoContext } from '../_shared/client';
import { DemoContextProvider } from '../_shared/react';

const WIDTHS: Record<string, number> = {
  code: 260,
  entity: 150,
  sg_status_list: 150,
  image: 90,
  description: 260,
  user: 160,
  created_at: 170,
  updated_at: 170,
};
const PATHS = Object.keys(WIDTHS);
const SHOWN = ['code', 'entity', 'sg_status_list', 'image', 'description', 'user'];
const FACETS = ['sg_status_list'];
const PLACEMENTS: Array<{ value: EditorPlacement | undefined; label: string }> = [
  { value: undefined, label: 'Editors: auto' },
  { value: 'inline', label: 'Inline' },
  { value: 'popover', label: 'Popover' },
];

const PAGING: Array<{ value: PagingMode; label: string }> = [
  { value: 'pages', label: 'Pages' },
  { value: 'more', label: 'Load more' },
  { value: 'scroll', label: 'Scroll' },
];

const toggle =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
  'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';

export default function EntityTableDemo() {
  const context = useMemo(() => createDemoContext({ counts: { versions: 320 } }), []);
  // The mock's rows are one project's already; a real site's are not.
  const scope = useMemo(
    () =>
      context.live ? group('and', [condition('project', 'is', { type: 'Project', id: context.projectId })]) : null,
    [context],
  );
  const source = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Version',
        fields: PATHS,
        filters: scope,
        mode: 'pages',
        pageSize: 25,
      }),
    [context, scope],
  );

  const [columns, setColumns] = useState<CollectionColumn[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StatusRecord> | null>(null);
  const [filter, setFilter] = useState<FilterGroup>(emptyFilter());
  const [sortKeys, setSortKeys] = useState<SortKey[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const [grouped, setGrouped] = useState(false);
  const [compact, setCompact] = useState(false);
  const [paging, setPaging] = useState<PagingMode>('pages');
  // `undefined` leaves each cell on its data type's own placement.
  const [placement, setPlacement] = useState<EditorPlacement | undefined>(undefined);
  const [selected, setSelected] = useState<EntityRef[]>([]);
  const sort = useMemo(() => toSortSpecs(sortKeys), [sortKeys]);

  const pickColumns = useCallback(
    (paths: string[]) => {
      void resolveColumns(
        context.schema,
        'Version',
        paths.map((path) => ({ path, width: WIDTHS[path] })),
      ).then(setColumns);
    },
    [context],
  );

  useEffect(() => {
    let live = true;
    Promise.all([
      resolveColumns(
        context.schema,
        'Version',
        SHOWN.map((path) => ({ path, width: WIDTHS[path] })),
      ),
      context.statuses.byCode(),
    ])
      .then(([resolved, table]) => {
        if (!live) return;
        setColumns(resolved);
        setStatuses(Object.fromEntries(table));
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [context]);

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!statuses) return <p className="text-muted-foreground text-sm">Loading the site…</p>;

  return (
    <DemoContextProvider context={context}>
      <div className="flex w-full min-w-0 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={toggle} aria-pressed={grouped} onClick={() => setGrouped(!grouped)}>
            Group by status
          </button>
          <button type="button" className={toggle} aria-pressed={compact} onClick={() => setCompact(!compact)}>
            Compact
          </button>
          <div className="flex flex-wrap items-center gap-2" data-testid="paging-modes">
            {PAGING.map((mode) => (
              <button
                key={mode.value}
                type="button"
                className={toggle}
                aria-pressed={paging === mode.value}
                onClick={() => setPaging(mode.value)}
              >
                {mode.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2" data-testid="editor-placements">
            {PLACEMENTS.map((option) => (
              <button
                key={option.label}
                type="button"
                className={toggle}
                aria-pressed={placement === option.value}
                onClick={() => setPlacement(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <span className="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
            {selected.length} selected
          </span>
        </div>
        <EntityTable
          source={source}
          columns={columns}
          onColumnsChange={setColumns}
          selection={selected}
          onSelectionChange={setSelected}
          filters={filter}
          sort={sort}
          statuses={statuses}
          context={context}
          selectable
          editable
          paging={paging}
          editorPlacement={placement}
          density={compact ? 'compact' : 'default'}
          groupBy={grouped ? 'sg_status_list' : null}
          toolbarStart={
            <>
              <FilterBar
                entityType="Version"
                context={context}
                facets={FACETS}
                baseFilter={scope}
                size="sm"
                value={filter}
                onChange={setFilter}
              />
              <div className="flex flex-col gap-2">
                <button type="button" className={toggle} aria-pressed={picking} onClick={() => setPicking(!picking)}>
                  Columns
                </button>
                {picking ? (
                  <div className="w-56">
                    <ColumnPicker
                      context={context}
                      entityType="Version"
                      size="sm"
                      deepLinks={false}
                      filter={(_field, path) => PATHS.includes(path)}
                      placeholder="Add a column"
                      value={columns.map((column) => column.path)}
                      onValueChange={pickColumns}
                    />
                  </div>
                ) : null}
              </div>
            </>
          }
          toolbarEnd={
            <SortPicker entityType="Version" context={context} size="sm" paths={columns.map((column) => column.path)} value={sortKeys} onChange={setSortKeys} />
          }
        />
      </div>
    </DemoContextProvider>
  );
}
