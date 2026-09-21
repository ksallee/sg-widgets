/**
 * One screen built from the widgets, so the set can be read as one hand.
 *
 * Every part carries `data-qa-widget`, and a control carries `data-qa-size`, so
 * `tools/drives/consistency.js` measures a widget without knowing its markup. A cell
 * marked `data-qa-popup` names the control the drive opens to reach a popup.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type {
  CollectionColumn,
  EntityRef,
  FieldSchema,
  FilterGroup,
  SortKey,
  StatusRecord,
  UrlValue,
  UrlWriteValue,
} from 'sg-widgets-core';
import { condition, createEntitySource, group, resolveColumns, toSortSpecs } from 'sg-widgets-core';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CheckboxEditor } from '@/registry/sg/components/checkbox-editor';
import { ColorEditor } from '@/registry/sg/components/color-editor';
import { ColumnPicker } from '@/registry/sg/components/column-picker';
import { ContextSelector, type WorkContext } from '@/registry/sg/components/context-selector';
import { DateEditor } from '@/registry/sg/components/date-editor';
import { DateTimeEditor } from '@/registry/sg/components/date-time-editor';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { EntityGrid } from '@/registry/sg/components/entity-grid';
import { EntityMultiPicker } from '@/registry/sg/components/entity-multi-picker';
import { EntityPicker } from '@/registry/sg/components/entity-picker';
import { EntityTable } from '@/registry/sg/components/entity-table';
import { EntityTree } from '@/registry/sg/components/entity-tree';
import { EntityTypeMultiPicker } from '@/registry/sg/components/entity-type-multi-picker';
import { EntityTypePicker } from '@/registry/sg/components/entity-type-picker';
import { FieldPicker } from '@/registry/sg/components/field-picker';
import { FilterBar } from '@/registry/sg/components/filter-bar';
import { FilterEditor } from '@/registry/sg/components/filter-editor';
import { GlobalSearch } from '@/registry/sg/components/global-search';
import { ListMultiPicker } from '@/registry/sg/components/list-multi-picker';
import { ListPicker } from '@/registry/sg/components/list-picker';
import { NumberEditor } from '@/registry/sg/components/number-editor';
import { ProjectPicker } from '@/registry/sg/components/project-picker';
import { SortPicker } from '@/registry/sg/components/sort-picker';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { StatusMultiPicker } from '@/registry/sg/components/status-multi-picker';
import { StatusPicker } from '@/registry/sg/components/status-picker';
import { TextEditor } from '@/registry/sg/components/text-editor';
import { UrlEditor } from '@/registry/sg/components/url-editor';
import { UserAvatar } from '@/registry/sg/components/user-avatar';
import { UserMultiPicker } from '@/registry/sg/components/user-multi-picker';
import { UserPicker } from '@/registry/sg/components/user-picker';
import { createDemoContext } from '../_shared/client';
import { DemoContextProvider } from '../_shared/react';

type Size = 'sm' | 'md' | 'lg';

const SIZES: Size[] = ['sm', 'md', 'lg'];
const WIDTHS: Record<string, number> = {
  code: 220,
  sg_status_list: 140,
  user: 150,
  description: 220,
};
const SHOWN = Object.keys(WIDTHS);

const ASSET: EntityRef = { type: 'Asset', id: 1226, name: 'charAda' };
const PERSON: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };
const SHOT: EntityRef = { type: 'Shot', id: 862, name: 'sh010_0010' };

const VERSION_TYPE: Pick<FieldSchema, 'displayName' | 'mandatory' | 'validValues'> = {
  displayName: 'Version Type',
  mandatory: false,
  validValues: ['Type A', 'Type B', 'Type C'],
};

const page = 'flex w-full min-w-0 flex-col gap-6';
const section = 'flex min-w-0 flex-col gap-3';
const heading = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const field = 'flex min-w-0 flex-col gap-2';
const fieldLabel = 'text-sm font-medium';
const cell = 'flex min-w-0 flex-col gap-2';
const cellLabel = 'text-muted-foreground text-xs';

export default function CompositionDemo() {
  const context = useMemo(() => createDemoContext(), []);
  const projectId = context.projectId;
  const project: EntityRef = useMemo(
    () => (context.live ? { type: 'Project', id: projectId } : { type: 'Project', id: projectId, name: 'Blue Moon Rising' }),
    [context.live, projectId],
  );
  const work: WorkContext = useMemo(() => ({ project, entity: ASSET, task: null }), [project]);

  const source = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Version',
        fields: SHOWN,
        mode: 'pages',
        pageSize: 8,
      }),
    [context],
  );
  const gridSource = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Version',
        fields: ['code', 'image', 'sg_status_list', 'user'],
        pageSize: 8,
      }),
    [context],
  );

  const [columns, setColumns] = useState<CollectionColumn[]>([]);
  const [statuses, setStatuses] = useState<Record<string, StatusRecord> | null>(null);
  const [statusField, setStatusField] = useState<FieldSchema | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A ticked pill, a count beside More filters and two sort keys, so the crosses and the
  // count chips the consistency drive reads are drawn.
  const [filter, setFilter] = useState<FilterGroup>(() => group('and', [condition('sg_status_list', 'in', ['ip', 'apr'])]));
  const [sortKeys, setSortKeys] = useState<SortKey[]>([
    { field: 'code', direction: 'asc' },
    { field: 'created_at', direction: 'desc' },
  ]);
  const [editorFilter, setEditorFilter] = useState<FilterGroup>(() =>
    group('and', [condition('sg_status_list', 'in', ['ip', 'apr']), condition('sg_first_frame', 'in', [1001, 1101])]),
  );
  const [paths, setPaths] = useState<string[]>([...SHOWN]);
  /** Which widgets have emitted through their value callback, read by the prop-names drive. */
  const [emitted, setEmitted] = useState<string[]>([]);
  const emit = useCallback(
    (name: string) => setEmitted((was) => (was.includes(name) ? was : [...was, name])),
    [],
  );

  const [note, setNote] = useState<string | null>('Plate handed over with the cut change.');
  const [frames, setFrames] = useState<string | number | null>(1001);
  const [turnover, setTurnover] = useState<string | null>('2026-09-02');
  const [approvedAt, setApprovedAt] = useState<string | null>('2026-03-04T13:06:07Z');
  const [flagged, setFlagged] = useState<boolean | undefined>(true);
  const [listValue, setListValue] = useState<string | null>('Type A');
  const [listValues, setListValues] = useState<string[]>(['Type A', 'Type B']);
  const [colour, setColour] = useState<string | null>('0,126,174');
  const [movie, setMovie] = useState<UrlValue | null>({
    url: 'https://example.com/plate.mov',
    name: 'plate.mov',
    link_type: 'web',
  });

  const sort = useMemo(() => toSortSpecs(sortKeys), [sortKeys]);

  useEffect(() => {
    let live = true;
    Promise.all([
      resolveColumns(
        context.schema,
        'Version',
        SHOWN.map((path) => ({ path, width: WIDTHS[path] })),
      ),
      context.statuses.byCode(),
      context.client.fields('Version'),
    ])
      .then(([resolved, table, fields]) => {
        if (!live) return;
        setColumns(resolved);
        setStatuses(Object.fromEntries(table));
        setStatusField(fields['sg_status_list'] as FieldSchema);
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [context]);

  const pickColumns = useCallback(
    (next: string[]) => {
      setPaths(next);
      void resolveColumns(
        context.schema,
        'Version',
        next.map((path) => ({ path, width: WIDTHS[path] ?? 160 })),
      ).then(setColumns);
    },
    [context],
  );

  function pickers(size: Size): [string, string, ReactNode, string | null][] {
    return [
      ['entity-picker', 'Entity', <EntityPicker context={context} entityTypes={['Asset']} size={size} value={ASSET} />, 'entity-picker-trigger'],
      ['entity-multi-picker', 'Entities', <EntityMultiPicker context={context} entityTypes={['Asset']} size={size} value={[ASSET]} />, null],
      ['user-picker', 'Artist', <UserPicker context={context} size={size} value={PERSON} />, null],
      ['user-multi-picker', 'Reviewers', <UserMultiPicker context={context} size={size} value={[PERSON]} />, null],
      ['project-picker', 'Project', <ProjectPicker context={context} size={size} value={project} />, null],
      ['status-picker', 'Status', <StatusPicker context={context} entityType="Version" projectId={projectId} size={size} value="ip" />, 'status-picker-control'],
      ['status-multi-picker', 'Statuses', <StatusMultiPicker context={context} entityType="Version" projectId={projectId} size={size} value={['ip', 'apr']} />, null],
      ['entity-type-picker', 'Type', <EntityTypePicker context={context} size={size} value="Shot" />, null],
      ['entity-type-multi-picker', 'Types', <EntityTypeMultiPicker context={context} size={size} value={['Shot', 'Asset']} />, null],
      ['field-picker', 'Field', <FieldPicker context={context} entityType="Version" size={size} value="code" />, 'field-picker-trigger'],
      ['context-selector', 'Context', <ContextSelector context={context} size={size} workContext={work} currentUser={PERSON} />, null],
    ];
  }

  if (error) return <p className="text-destructive text-sm">{error}</p>;
  if (!statuses || !statusField) return <p className="text-muted-foreground text-sm">Loading the site…</p>;

  return (
    <DemoContextProvider context={context}>
      <div className={page}>
        <div className="flex min-w-0 flex-wrap items-center gap-2" data-qa-widget="toolbar" data-qa-region="toolbar">
          <div className="min-w-0 flex-1" data-qa-widget="filter-bar" data-qa-size="md">
            <FilterBar
              entityType="Version"
              context={context}
              facets={['sg_status_list']}
              value={filter}
              onValueChange={(next) => {
                setFilter(next);
                emit('filter-bar');
              }}
            />
          </div>
          <div data-qa-widget="sort-picker" data-qa-size="md" data-qa-popup="sort-trigger">
            <SortPicker
              entityType="Version"
              context={context}
              value={sortKeys}
              onValueChange={(next) => {
                setSortKeys(next);
                emit('sort-picker');
              }}
            />
          </div>
          <div data-qa-widget="column-picker" data-qa-size="md" data-qa-popup="popover-trigger">
            <Popover>
              <PopoverTrigger render={<Button variant="outline">Columns</Button>} />
              <PopoverContent align="start" className="w-72 p-3">
                <ColumnPicker
                  context={context}
                  entityType="Version"
                  showCount
                  deepLinks={false}
                  filter={(_field, path) => SHOWN.includes(path)}
                  value={paths}
                  onValueChange={pickColumns}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="w-64 min-w-0" data-qa-widget="global-search" data-qa-size="md">
            <GlobalSearch
              context={context}
              entityTypes={['Shot', 'Asset', 'Version', 'Task']}
              projectId={projectId}
              inline
              placeholder="Search this project…"
            />
          </div>
        </div>

        <div className="grid min-w-0 gap-4 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2" data-qa-widget="entity-table" data-qa-size="md">
            <EntityTable
              source={source}
              columns={columns}
              onColumnsChange={setColumns}
              filters={filter}
              sort={sort}
              statuses={statuses}
              context={context}
              editable
              selectable
              paging="pages"
              maxHeight="22rem"
            />
          </div>
          <div className="min-w-0" data-qa-widget="entity-tree" data-qa-size="md">
            <EntityTree context={context} rootPath={`/Project/${projectId}`} searchable maxHeight="22rem" />
          </div>
        </div>

        <section className={section} data-qa-widget="entity-grid" data-qa-size="sm">
          <h4 className={heading}>Versions</h4>
          <EntityGrid source={gridSource} context={context} size="sm" maxHeight="20rem" />
        </section>

        <section className={section}>
          <h4 className={heading}>Version details</h4>
          <div className="grid min-w-0 gap-4 sm:grid-cols-2">
            <div className={field} data-qa-widget="text-editor" data-qa-size="md">
              <span className={fieldLabel}>Description</span>
              <TextEditor value={note} onValueChange={setNote} field={{ displayName: 'Description', mandatory: false }} />
            </div>
            <div className={field} data-qa-widget="number-editor" data-qa-size="md">
              <span className={fieldLabel}>Frame count</span>
              <NumberEditor
                value={frames}
                onValueChange={setFrames}
                dataType="number"
                field={{ displayName: 'Frame Count', mandatory: false }}
              />
            </div>
            <div className={field} data-qa-widget="date-editor" data-qa-size="md" data-qa-popup="date-editor-trigger">
              <span className={fieldLabel}>Turnover date</span>
              <DateEditor value={turnover} onValueChange={setTurnover} field={{ displayName: 'Turnover Date', mandatory: false }} />
            </div>
            <div className={field} data-qa-widget="date-time-editor" data-qa-size="md">
              <span className={fieldLabel}>Client approved at</span>
              <DateTimeEditor
                value={approvedAt}
                onValueChange={setApprovedAt}
                timeZone="America/Los_Angeles"
                field={{ displayName: 'Client Approved At', mandatory: false }}
              />
            </div>
            <div className={field} data-qa-widget="checkbox-editor" data-qa-size="md">
              <span className={fieldLabel}>Flagged</span>
              <CheckboxEditor value={flagged} onValueChange={setFlagged} field={{ displayName: 'Flagged', mandatory: false }} />
            </div>
            <div className={field} data-qa-widget="list-picker" data-qa-size="md">
              <span className={fieldLabel}>Version type</span>
              <ListPicker value={listValue} onValueChange={setListValue} field={VERSION_TYPE} />
            </div>
            <div className={field} data-qa-widget="list-multi-picker" data-qa-size="md">
              <span className={fieldLabel}>Version types</span>
              <ListMultiPicker value={listValues} onValueChange={setListValues} field={VERSION_TYPE} />
            </div>
            <div className={field} data-qa-widget="color-editor" data-qa-size="md">
              <span className={fieldLabel}>Colour</span>
              <ColorEditor value={colour} onValueChange={setColour} field={{ displayName: 'Color', mandatory: false }} />
            </div>
            <div className={field} data-qa-widget="url-editor" data-qa-size="md">
              <span className={fieldLabel}>Uploaded movie</span>
              <UrlEditor
                value={movie}
                onValueChange={(next: UrlWriteValue | null) => setMovie(next as UrlValue | null)}
                field={{ displayName: 'Uploaded Movie', mandatory: false }}
              />
            </div>
          </div>
        </section>

        <section className={section}>
          <h4 className={heading}>Pickers</h4>
          {SIZES.map((size) => (
            <div key={size} className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
              {pickers(size).map(([name, label, node, opener]) => (
                <div
                  key={name}
                  className={cell}
                  data-qa-widget={name}
                  data-qa-size={size}
                  data-qa-popup={opener && size === 'md' ? opener : undefined}
                >
                  <span className={cellLabel}>{label}</span>
                  {node}
                </div>
              ))}
            </div>
          ))}
        </section>

        <section className={section} data-qa-widget="filter-editor" data-qa-size="md">
          <h4 className={heading}>Filter tree</h4>
          <FilterEditor
            entityType="Version"
            context={context}
            value={editorFilter}
            hidePaths={['sg_task']}
            onValueChange={(next) => {
              setEditorFilter(next);
              emit('filter-editor');
            }}
          />
        </section>

        <span className="sr-only" data-testid="emitted">
          {emitted.join(' ')}
        </span>

        <p className="text-sm" data-qa-widget="inline-atoms">
          The plate is{' '}
          <span data-qa-widget="status-badge" data-qa-size="md">
            <StatusBadge code="ip" status={statuses['ip']} field={statusField} />
          </span>{' '}
          on{' '}
          <span data-qa-widget="entity-chip" data-qa-size="md">
            <EntityChip entity={SHOT} />
          </span>{' '}
          and{' '}
          <span data-qa-widget="user-avatar" data-qa-size="md">
            <UserAvatar name={PERSON.name ?? ''} />
          </span>{' '}
          has it until the turnover.
        </p>
      </div>
    </DemoContextProvider>
  );
}
