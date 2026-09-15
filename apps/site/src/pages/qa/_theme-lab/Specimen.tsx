/**
 * The theme lab specimen: the shadcn primitives, the raw token surfaces and one section
 * per widget group, so an edit in the lab reads on real controls and every widget the
 * registry ships is on one screen.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CircleAlert, Inbox, Plus, SearchX, X } from 'lucide-react';
import type {
  CollectionColumn,
  EntityRef,
  EntityRow,
  FilterGroup,
  SortKey,
  StatusRecord,
  UrlValue,
  UrlWriteValue,
} from '@sg-widgets/core';
import { condition, createEntitySource, group, resolveColumns } from '@sg-widgets/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Kbd } from '@/components/ui/kbd';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Toggle } from '@/components/ui/toggle';
import { CheckboxEditor } from '@/registry/sg/components/checkbox-editor';
import { ColorEditor } from '@/registry/sg/components/color-editor';
import { ColumnPicker } from '@/registry/sg/components/column-picker';
import { ContextSelector, type WorkContext } from '@/registry/sg/components/context-selector';
import { DateEditor } from '@/registry/sg/components/date-editor';
import { DateTimeEditor } from '@/registry/sg/components/date-time-editor';
import { EntityCard } from '@/registry/sg/components/entity-card';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { EntityGrid } from '@/registry/sg/components/entity-grid';
import { EntityTree } from '@/registry/sg/components/entity-tree';
import { FilterBar } from '@/registry/sg/components/filter-bar';
import { FilterEditor } from '@/registry/sg/components/filter-editor';
import { GlobalSearch } from '@/registry/sg/components/global-search';
import { GroupedList } from '@/registry/sg/components/grouped-list';
import { HierarchicalSearch } from '@/registry/sg/components/hierarchical-search';
import { NumberEditor } from '@/registry/sg/components/number-editor';
import { SortPicker } from '@/registry/sg/components/sort-picker';
import { StateLine } from '@/registry/sg/components/state-line';
import { TextEditor } from '@/registry/sg/components/text-editor';
import { Thumbnail } from '@/registry/sg/components/thumbnail';
import { UrlEditor } from '@/registry/sg/components/url-editor';
import { UserAvatar } from '@/registry/sg/components/user-avatar';
import { REMOVE_CONTROL, type ChipSize } from '@/registry/sg/components/leaf-classes';
import { PICKER_CHIP, PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX, PICKER_TEXT_CHIP_CROSS } from '@/registry/sg/components/picker-classes';
import { cn } from '@/lib/utils';
import { createDemoContext, type DemoContext } from '../../../demos/_shared/client';

const token = (name: string) => `var(--${name})`;

const BUTTONS = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
const BADGES = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
const SURFACES = [
  ['background', 'foreground', 'Page'],
  ['card', 'card-foreground', 'Card'],
  ['popover', 'popover-foreground', 'Popover'],
  ['muted', 'foreground', 'Muted'],
] as const;
const ROLES = ['destructive', 'success', 'warning', 'info'] as const;
const PEOPLE = ['Ada Lovelace', 'Anna van der Meer', 'j.doe'];
const BUTTON_SIZES = ['xs', 'sm', 'default', 'lg'] as const;
const ICON_SIZES = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const;
const TOGGLE_SIZES = ['sm', 'default', 'lg'] as const;
const PAIR_SIZES = ['sm', 'default'] as const;
const CONTROL_SIZES = ['sm', 'md', 'lg'] as const;
const TYPES = ['Shot', 'Asset', 'Sequence'];
const CHIP_ENTITIES: EntityRef[] = [
  { type: 'Shot', id: 862, name: 'sh010_0010' },
  { type: 'Asset', id: 1226, name: 'charAda' },
  { type: 'HumanUser', id: 20, name: 'Ada Lovelace' },
];

/** What the widget panels read: one site's versions, and the paths a task list groups by. */
const VERSION_FIELDS = ['code', 'image', 'sg_status_list', 'user', 'description'];
const CARD_FIELDS = ['user', 'description'];
const TASK_PATHS = ['step.Step.code', 'sg_description', 'due_date'];
const TASK_FIELDS = ['content', 'sg_status_list', ...TASK_PATHS];
const SEARCH_TYPES = ['Shot', 'Asset', 'Version', 'Task'];
const LEAF_SIZES = ['sm', 'md', 'lg'] as const;
const THUMB_SIZES = ['sm', 'md', 'lg', 'xl', '2xl'] as const;
const DENSITIES = ['default', 'compact'] as const;
const CURRENT_USER = CHIP_ENTITIES[2]!;

interface Fixtures {
  rows: EntityRow[];
  taskColumns: CollectionColumn[];
  statuses: Record<string, StatusRecord>;
}

/** The rows, the columns and the statuses every widget panel below draws, read once. */
function useFixtures(context: DemoContext): { data: Fixtures | null; error: string | null } {
  const [data, setData] = useState<Fixtures | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([
      context.client.search('Version', { fields: VERSION_FIELDS, page: { size: 3 } }),
      resolveColumns(context.schema, 'Task', TASK_PATHS),
      context.statuses.byCode(),
    ])
      .then(([found, taskColumns, table]) => {
        if (!live) return;
        setData({ rows: found.data, taskColumns, statuses: Object.fromEntries(table) });
      })
      .catch((e: unknown) => live && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      live = false;
    };
  }, [context]);
  return { data, error };
}

/** One labelled row inside a panel, as the size ladders draw. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="tl-size-row">
      <span className="tl-size-label">{label}</span>
      {children}
    </div>
  );
}

const Waiting = () => <p className="text-muted-foreground text-sm">Loading the site&hellip;</p>;
const Failed = ({ error }: { error: string }) => <p className="text-destructive text-sm">{error}</p>;

/** The display group: a card at its three sizes, a tile, the two pictures and the state line. */
function DisplayAtoms({ context, data }: { context: DemoContext; data: Fixtures }) {
  const row = data.rows[0];
  if (!row) return <Failed error="The site has no Version to draw." />;
  const image = (row.attributes['image'] as string | null) ?? null;
  const code = String(row.attributes['code'] ?? '');
  return (
    <div className="tl-sizes">
      <Line label="Card">
        <div className="tl-trio">
          {LEAF_SIZES.map((size) => (
            <EntityCard key={size} context={context} row={row} fields={CARD_FIELDS} size={size} />
          ))}
        </div>
      </Line>
      <Line label="Tile">
        <div className="tl-trio">
          {data.rows.map((tile) => (
            <EntityCard key={tile.id} context={context} row={tile} variant="tile" secondaryField="user" />
          ))}
        </div>
      </Line>
      <Line label="Thumbnail">
        <div className="tl-wrap">
          {THUMB_SIZES.map((size) => (
            <Thumbnail key={size} src={image} alt={code} size={size} />
          ))}
        </div>
      </Line>
      <Line label="Avatar">
        <div className="tl-wrap">
          {LEAF_SIZES.map((size) => (
            <UserAvatar key={size} name={PEOPLE[0]!} size={size} />
          ))}
          {PEOPLE.map((person) => (
            <UserAvatar key={person} name={person} />
          ))}
        </div>
      </Line>
      <Line label="State line">
        <div className="tl-list">
          <StateLine state="empty" icon={SearchX} label="No version matches" />
          <StateLine state="error" icon={CircleAlert} label="The read was refused" />
          <StateLine state="empty" pad="table" icon={Inbox} label="No version in this window" />
        </div>
      </Line>
    </div>
  );
}

/** The three collections at one density. Each holds its own source, as a caller's would. */
function Collection({
  context,
  data,
  density,
}: {
  context: DemoContext;
  data: Fixtures;
  density: (typeof DENSITIES)[number];
}) {
  const versions = useMemo(
    () => createEntitySource({ client: context.client, entityType: 'Version', fields: VERSION_FIELDS, pageSize: 12 }),
    [context],
  );
  const tasks = useMemo(
    () => createEntitySource({ client: context.client, entityType: 'Task', fields: TASK_FIELDS, mode: 'pages', pageSize: 25 }),
    [context],
  );
  return (
    <>
      <Line label={`Grid, ${density}`}>
        <EntityGrid source={versions} context={context} size="sm" density={density} maxHeight="14rem" />
      </Line>
      <Line label={`Grouped list, ${density}`}>
        <GroupedList
          source={tasks}
          context={context}
          paging="pages"
          groupBy={data.taskColumns[0]!}
          labelField="content"
          subLabelField={data.taskColumns[1]!}
          secondaryField={data.taskColumns[2]!}
          statuses={data.statuses}
          density={density}
          maxHeight="14rem"
        />
      </Line>
      <Line label={`Tree, ${density}`}>
        <EntityTree
          context={context}
          rootPath={`/Project/${context.projectId}`}
          density={density}
          searchable
          maxHeight="14rem"
        />
      </Line>
    </>
  );
}

/** The filter group: a ticked pill, the ordering controls and the tree editor. */
function Filters({ context }: { context: DemoContext }) {
  const [bar, setBar] = useState<FilterGroup>(() => group('and', [condition('sg_status_list', 'in', ['ip', 'apr'])]));
  const [tree, setTree] = useState<FilterGroup>(() =>
    group('and', [condition('sg_status_list', 'in', ['ip', 'apr']), condition('sg_first_frame', 'in', [1001, 1101])]),
  );
  const [keys, setKeys] = useState<SortKey[]>([
    { field: 'code', direction: 'asc' },
    { field: 'created_at', direction: 'desc' },
  ]);
  const [columns, setColumns] = useState<string[]>(['code', 'sg_status_list', 'user']);
  return (
    <div className="tl-sizes">
      <Line label="Filter bar">
        <FilterBar entityType="Version" context={context} facets={['sg_status_list']} value={bar} onChange={setBar} />
      </Line>
      <Line label="Sort picker">
        <SortPicker entityType="Version" context={context} value={keys} onChange={setKeys} />
      </Line>
      <Line label="Column picker">
        <ColumnPicker context={context} entityType="Version" showCount value={columns} onValueChange={setColumns} />
      </Line>
      <Line label="Filter editor">
        <FilterEditor entityType="Version" context={context} value={tree} hidePaths={['sg_task']} onChange={setTree} />
      </Line>
    </div>
  );
}

/** The editor group: one of each, with an invalid, a readonly and a disabled among them. */
function Editors() {
  const [note, setNote] = useState<string | null>('Plate handed over with the cut change.');
  const [frames, setFrames] = useState<string | number | null>(1001);
  const [flagged, setFlagged] = useState<boolean | undefined>(true);
  const [day, setDay] = useState<string | null>('2026-09-02');
  const [moment, setMoment] = useState<string | null>('2026-03-04T13:06:07Z');
  const [colour, setColour] = useState<string | null>('0,126,174');
  const [link, setLink] = useState<UrlValue | null>({
    url: 'https://example.com/plate.mov',
    name: 'plate.mov',
    link_type: 'web',
  });
  const field = (label: string, node: ReactNode) => (
    <div className="tl-field">
      <span className="tl-size-label">{label}</span>
      {node}
    </div>
  );
  return (
    <div className="tl-form">
      {field(
        'Description, invalid',
        <TextEditor
          value={note}
          onValueChange={setNote}
          invalid
          error="A description is required."
          field={{ displayName: 'Description', mandatory: true }}
        />,
      )}
      {field(
        'Frame count',
        <NumberEditor
          value={frames}
          onValueChange={setFrames}
          dataType="number"
          field={{ displayName: 'Frame Count', mandatory: false }}
        />,
      )}
      {field(
        'Flagged, readonly',
        <CheckboxEditor
          value={flagged}
          onValueChange={setFlagged}
          readonly
          field={{ displayName: 'Flagged', mandatory: false }}
        />,
      )}
      {field(
        'Turnover date',
        <DateEditor value={day} onValueChange={setDay} field={{ displayName: 'Turnover Date', mandatory: false }} />,
      )}
      {field(
        'Approved at, disabled',
        <DateTimeEditor
          value={moment}
          onValueChange={setMoment}
          disabled
          timeZone="America/Los_Angeles"
          field={{ displayName: 'Client Approved At', mandatory: false }}
        />,
      )}
      {field(
        'Uploaded movie',
        <UrlEditor
          value={link}
          onValueChange={(next: UrlWriteValue | null) => setLink(next as UrlValue | null)}
          field={{ displayName: 'Uploaded Movie', mandatory: false }}
        />,
      )}
      {field(
        'Colour',
        <ColorEditor value={colour} onValueChange={setColour} field={{ displayName: 'Color', mandatory: false }} />,
      )}
    </div>
  );
}

/** The search group: the dialog trigger, the context selector and the drill-down. */
function Search({ context }: { context: DemoContext }) {
  const [work, setWork] = useState<WorkContext>({
    project: { type: 'Project', id: context.projectId, name: 'Blue Moon Rising' },
    entity: CHIP_ENTITIES[1]!,
    task: null,
  });
  return (
    <div className="tl-sizes">
      <Line label="Global search">
        <div className="tl-wrap">
          <GlobalSearch context={context} entityTypes={SEARCH_TYPES} label="Search the site" onSelect={() => undefined} />
        </div>
      </Line>
      <Line label="Context selector">
        <div className="tl-wrap">
          <ContextSelector context={context} workContext={work} currentUser={CURRENT_USER} onWorkContextChange={setWork} />
        </div>
      </Line>
      <Line label="Hierarchical search">
        <HierarchicalSearch
          context={context}
          rootPath={`/Project/${context.projectId}`}
          entityTypes={SEARCH_TYPES}
          secondaryField="sg_status_list"
          onSelect={() => undefined}
        />
      </Line>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="tl-panel">
      <h3 className="tl-h">{title}</h3>
      {children}
    </section>
  );
}

/**
 * Every chip step, from `xs` to `lg`: entity chips with their glyph, one with a cross, and the
 * text chip a code or a list value wears. A picker gives its chips the step under it, so the
 * steps come from `PICKER_CHIP`; `lg` only stands alone, where no text chip is drawn.
 */
function Chips() {
  const steps: { step: ChipSize; where: string; picker: (typeof CONTROL_SIZES)[number] | null }[] = [
    ...CONTROL_SIZES.map((picker) => ({ step: PICKER_CHIP[picker], where: `${picker} picker`, picker })),
    { step: 'lg', where: 'standalone', picker: null },
  ];
  return (
    <div className="tl-sizes">
      {steps.map(({ step, where, picker }) => (
        <div key={step} className="tl-size-row">
          <span className="tl-size-label">
            {step} · {where}
          </span>
          <div className="tl-wrap">
            {CHIP_ENTITIES.map((entity) => (
              <EntityChip key={entity.id} entity={entity} size={step} />
            ))}
            <EntityChip
              entity={CHIP_ENTITIES[1]!}
              size={step}
              removable
              onRemove={() => undefined}
              removeLabel="Remove charAda"
            />
            {picker
              ? TYPES.map((code) => (
                  <span key={code} data-chip="" className={cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX[picker])}>
                    <span className="truncate">{code}</span>
                    <button type="button" aria-label={`Remove ${code}`} className={REMOVE_CONTROL}>
                      <X aria-hidden="true" className={PICKER_TEXT_CHIP_CROSS[picker]} />
                    </button>
                  </span>
                ))
              : null}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Every size a primitive offers, and the sm/md/lg ladder the widgets use. */
function Sizes() {
  const [picked, setPicked] = useState<Record<string, string>>({ sm: 'Shot', default: 'Asset' });
  const [text, setText] = useState<Record<string, string | null>>({ sm: 'sh010_0010', md: 'sh010_0010', lg: 'sh010_0010' });
  const row = (label: string, children: ReactNode) => (
    <div className="tl-size-row">
      <span className="tl-size-label">{label}</span>
      {children}
    </div>
  );
  return (
    <div className="tl-sizes">
      {row(
        'Button',
        <div className="tl-wrap">
          {BUTTON_SIZES.map((size) => (
            <Button key={size} size={size}>
              {size}
            </Button>
          ))}
        </div>,
      )}
      {row(
        'Button, outline',
        <div className="tl-wrap">
          {BUTTON_SIZES.map((size) => (
            <Button key={size} size={size} variant="outline">
              {size}
            </Button>
          ))}
        </div>,
      )}
      {row(
        'Icon button',
        <div className="tl-wrap">
          {ICON_SIZES.map((size) => (
            <Button key={size} size={size} variant="outline" aria-label={size} title={size}>
              <Plus />
            </Button>
          ))}
        </div>,
      )}
      {row(
        'Toggle',
        <div className="tl-wrap">
          {TOGGLE_SIZES.map((size) => (
            <Toggle key={size} size={size} variant="outline" defaultPressed={size === 'default'}>
              {size}
            </Toggle>
          ))}
        </div>,
      )}
      {row(
        'Select',
        <div className="tl-wrap">
          {PAIR_SIZES.map((size) => (
            <Select
              key={size}
              value={picked[size]}
              onValueChange={(value) => {
                if (typeof value === 'string') setPicked((current) => ({ ...current, [size]: value }));
              }}
            >
              <SelectTrigger size={size} aria-label={`Select, ${size}`} className="w-auto" style={{ minWidth: '7rem' }}>
                <span data-slot="select-value">
                  {picked[size]} ({size})
                </span>
              </SelectTrigger>
              <SelectContent>
                {TYPES.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ))}
        </div>,
      )}
      {row(
        'Switch',
        <div className="tl-wrap">
          {PAIR_SIZES.map((size) => (
            <label key={size} className="tl-inline">
              <Switch size={size} defaultChecked /> {size}
            </label>
          ))}
        </div>,
      )}
      {row(
        'Input',
        <div className="tl-wrap">
          <Input placeholder="One size only" style={{ maxWidth: '14rem' }} />
        </div>,
      )}
      {row(
        'Editor, filled',
        <div className="tl-trio">
          {CONTROL_SIZES.map((size) => (
            <TextEditor
              key={size}
              size={size}
              value={text[size] ?? null}
              placeholder={`Empty, ${size}`}
              onValueChange={(value) => setText((current) => ({ ...current, [size]: value }))}
            />
          ))}
        </div>,
      )}
      {row(
        'Editor, empty',
        <div className="tl-trio">
          {CONTROL_SIZES.map((size) => (
            <TextEditor key={size} size={size} value={null} placeholder={`Type here, ${size}`} />
          ))}
        </div>,
      )}
    </div>
  );
}

export default function Specimen() {
  const context = useMemo(() => createDemoContext(), []);
  const { data, error } = useFixtures(context);
  /** A widget panel draws once the fixtures land, and says so while they have not. */
  const widgets = (build: (fixtures: Fixtures) => ReactNode): ReactNode =>
    error ? <Failed error={error} /> : data ? build(data) : <Waiting />;
  return (
    <div className="tl-spec">
      <Panel title="Surfaces and text">
        <div className="tl-tiles">
          {SURFACES.map(([surface, text, label]) => (
            <div key={surface} className="tl-tile" style={{ background: token(surface), color: token(text) }}>
              <strong>{label}</strong>
              <span>Body text on --{surface}.</span>
              <span style={{ color: token('muted-foreground') }}>Muted caption, 12 items</span>
              <span className="tl-chip" style={{ background: token('secondary'), color: token('secondary-foreground') }}>
                charAda
              </span>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Buttons">
        <div className="tl-wrap">
          {BUTTONS.map((variant) => (
            <Button key={variant} variant={variant}>
              {variant}
            </Button>
          ))}
          <Button disabled>disabled</Button>
          <Button size="sm" variant="outline">
            small
          </Button>
        </div>
      </Panel>

      <Panel title="Sizes">
        <Sizes />
      </Panel>

      <Panel title="Badges">
        <div className="tl-wrap">
          {BADGES.map((variant) => (
            <Badge key={variant} variant={variant}>
              {variant}
            </Badge>
          ))}
        </div>
      </Panel>

      <Panel title="Chips">
        <Chips />
      </Panel>

      <Panel title="Fields">
        <div className="tl-form">
          <div className="tl-field">
            <Label htmlFor="tl-empty">Empty</Label>
            <Input id="tl-empty" placeholder="Search for a person" />
          </div>
          <div className="tl-field">
            <Label htmlFor="tl-filled">Filled</Label>
            <Input id="tl-filled" defaultValue="sh010_0010_comp_v001" />
          </div>
          <div className="tl-field">
            <Label htmlFor="tl-invalid">Invalid</Label>
            <Input id="tl-invalid" aria-invalid defaultValue="not an email" />
          </div>
          <div className="tl-field">
            <Label htmlFor="tl-disabled">Disabled</Label>
            <Input id="tl-disabled" disabled defaultValue="Read only" />
          </div>
          <div className="tl-field tl-span">
            <Label htmlFor="tl-notes">Notes</Label>
            <Textarea id="tl-notes" placeholder="Write a note" />
          </div>
          <div className="tl-wrap tl-span">
            <label className="tl-inline">
              <Checkbox defaultChecked /> Checked
            </label>
            <label className="tl-inline">
              <Checkbox /> Unchecked
            </label>
            <label className="tl-inline">
              <Switch defaultChecked /> On
            </label>
            <label className="tl-inline">
              <Switch /> Off
            </label>
            <span className="tl-inline">
              Search <Kbd>⌘K</Kbd>
            </span>
          </div>
        </div>
      </Panel>

      <Panel title="A list: resting, selected, focused">
        <div className="tl-list">
          {PEOPLE.map((person, i) => (
            <div
              key={person}
              className="tl-item"
              style={i === 1 ? { background: token('accent'), color: token('accent-foreground') } : undefined}
            >
              {person}
              {i === 1 ? <span style={{ color: token('muted-foreground') }}>selected</span> : null}
            </div>
          ))}
          <Separator />
          <div className="tl-item tl-focus">Focus ring on --ring</div>
        </div>
      </Panel>

      <Panel title="Status roles">
        <div className="tl-wrap">
          {ROLES.map((role) => (
            <span key={role} className="tl-role" style={{ background: token(role), color: token(`${role}-foreground`) }}>
              {role}
            </span>
          ))}
        </div>
        <div className="tl-wrap">
          {ROLES.map((role) => (
            <span key={role} className="tl-role tl-soft" style={{ color: token(role), borderColor: token(role) }}>
              {role} text
            </span>
          ))}
        </div>
      </Panel>

      <Panel title="Charts">
        <div className="tl-bars">
          {[1, 2, 3, 4, 5].map((n) => (
            <span key={n} title={`--chart-${n}`} style={{ background: token(`chart-${n}`), height: `${40 + n * 11}%` }} />
          ))}
        </div>
      </Panel>

      <Panel title="Display atoms">{widgets((fixtures) => <DisplayAtoms context={context} data={fixtures} />)}</Panel>

      <Panel title="Collections">
        {widgets((fixtures) => (
          <div className="tl-sizes">
            {DENSITIES.map((density) => (
              <Collection key={density} context={context} data={fixtures} density={density} />
            ))}
          </div>
        ))}
      </Panel>

      <Panel title="Filters and ordering">
        <Filters context={context} />
      </Panel>

      <Panel title="Editors">
        <Editors />
      </Panel>

      <Panel title="Search">
        <Search context={context} />
      </Panel>

      <Panel title="Sidebar">
        <div
          className="tl-list"
          style={{ background: token('sidebar'), color: token('sidebar-foreground'), borderColor: token('sidebar-border') }}
        >
          <span className="tl-item" style={{ background: token('sidebar-primary'), color: token('sidebar-primary-foreground') }}>
            Current page
          </span>
          <span className="tl-item" style={{ background: token('sidebar-accent'), color: token('sidebar-accent-foreground') }}>
            Hovered
          </span>
          <span className="tl-item">Resting</span>
        </div>
      </Panel>
    </div>
  );
}
