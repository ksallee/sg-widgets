import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  ConditionValue,
  EntityRef,
  FieldSchema,
  FilterCondition,
  FilterGroup,
  NodePath,
  Operator,
  Scalar,
  SchemaService,
  SgClient,
  TextSearchRow,
  TimeUnit,
} from '@sg-widgets/core';
import {
  appendAt,
  applyPreset,
  condition as makeCondition,
  createSchemaService,
  defaultCondition,
  emptyFilter,
  filterableFields,
  group as makeGroup,
  operatorMenu,
  presetById,
  presetIdOf,
  removeAt,
  replaceAt,
  TIME_UNITS,
  timeUnitLabel,
  valueArity,
  valueEditorFor,
} from '@sg-widgets/core';
import { ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

/** What the field slot is given. Its job is to call `onSelect` with a dotted path. */
export interface FieldChooserArgs {
  entityType: string;
  /** The path the row holds now, empty on a new row. */
  path: string;
  hidePaths: string[];
  /** Only fields the API can filter on. Always true here. */
  filterableOnly: true;
  disabled: boolean;
  onSelect: (path: string) => void;
}

/** What a value slot is given. Its job is to call `onChange` with the value the operator expects. */
export interface ValueEditorArgs {
  field: FieldSchema | null;
  dataType: string;
  operator: Operator;
  value: ConditionValue;
  /** The arity the operator's wire shape asks for. */
  arity: 'none' | 'one' | 'many' | 'two' | 'relative';
  disabled: boolean;
  onChange: (value: ConditionValue) => void;
}

const UNITS = TIME_UNITS;

function unitLabel(unit: string): string {
  return timeUnitLabel(unit as TimeUnit, 2);
}

/** The `type` a plain input takes for a value editor kind. */
function inputType(kind: string): 'text' | 'number' | 'date' | 'datetime-local' {
  if (kind === 'number') return 'number';
  if (kind === 'date') return 'date';
  if (kind === 'date_time') return 'datetime-local';
  return 'text';
}

/** A `datetime-local` control edits `YYYY-MM-DDTHH:MM`; the wire is `YYYY-MM-DDTHH:MM:SSZ` (field_types/date_time). */
function scalarText(value: Scalar | undefined): string {
  if (value === null || value === undefined || typeof value === 'object') return '';
  const text = String(value);
  return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 16) : text;
}

function parseScalar(kind: string, text: string): Scalar {
  if (text === '') return '';
  if (kind === 'number') return Number(text);
  if (kind === 'date_time') return `${text.length === 16 ? text : text.slice(0, 16)}:00Z`;
  return text;
}

function entityRefs(value: ConditionValue): EntityRef[] {
  if (Array.isArray(value)) return value.filter((v) => v !== null && typeof v === 'object') as EntityRef[];
  return value !== null && typeof value === 'object' ? [value as EntityRef] : [];
}

function sameRef(a: EntityRef, b: EntityRef): boolean {
  return a.type === b.type && a.id === b.id;
}

/** `is` takes one entity hash and `in` a list of them; a list under `is` is a 400 (field_types/entity). */
function toggleRef(refs: EntityRef[], ref: EntityRef, arity: string): ConditionValue {
  if (arity !== 'many') return refs.some((r) => sameRef(r, ref)) ? '' : ref;
  return refs.some((r) => sameRef(r, ref)) ? refs.filter((r) => !sameRef(r, ref)) : [...refs, ref];
}

/** Everything a row needs that does not come from its own node. */
interface EditorContext {
  entityType: string;
  fields: Record<string, FieldSchema>;
  hidePaths: string[];
  disabled: boolean;
  fieldChooser?: (args: FieldChooserArgs) => ReactNode;
  valueEditor?: (args: ValueEditorArgs) => ReactNode;
  search: string;
  setSearch: (value: string) => void;
  setSearchTypes: (types: string[]) => void;
  results: TextSearchRow[];
  searching: boolean;
  fieldOf: (path: string) => FieldSchema | null;
  edit: (path: NodePath, node: FilterCondition | FilterGroup) => void;
  remove: (path: NodePath) => void;
  append: (path: NodePath, node: FilterCondition | FilterGroup) => void;
  pickField: (path: NodePath, node: FilterCondition, chosen: string) => void;
  pickPreset: (path: NodePath, node: FilterCondition, id: string) => void;
}

export interface FilterEditorProps {
  /** Type the root of every field path is read on. */
  entityType: string;
  client: SgClient;
  /** Share one across a page so two widgets asking for the same type cost one request. */
  schema?: SchemaService;
  value: FilterGroup;
  /** Paths to keep out of the field list, each hiding itself and everything under it. */
  hidePaths?: string[];
  disabled?: boolean;
  onChange?: (value: FilterGroup) => void;
  fieldChooser?: (args: FieldChooserArgs) => ReactNode;
  valueEditor?: (args: ValueEditorArgs) => ReactNode;
  className?: string;
}

/**
 * A filter tree, edited.
 *
 * A row is a field, an operator and a value; a group nests rows under `All` or
 * `Any`. The operator menu and the value editor both come from the field's
 * `data_type` through core, so a row can only build a filter the API accepts
 * (017_filter_operators). A row with no field, or one whose operator still has no
 * value, is dropped on serialisation rather than sent.
 *
 * The field chooser and the value editors are slots. Left empty they fall back to
 * a flat list of the type's filterable fields and to plain inputs and selects; the
 * drill-down field picker and the per-type editors plug into the same two slots.
 */
export function FilterEditor({
  entityType,
  client,
  schema,
  value = emptyFilter(),
  hidePaths = [],
  disabled = false,
  onChange,
  fieldChooser,
  valueEditor,
  className,
}: FilterEditorProps) {
  const service = useMemo(() => schema ?? createSchemaService(client), [schema, client]);
  const [fields, setFields] = useState<Record<string, FieldSchema>>({});

  // The schema service caches, so this reaches the network once per type however
  // often the tree is edited (probe 002).
  useEffect(() => {
    let live = true;
    void service.fields(entityType).then((loaded) => {
      if (live) setFields(loaded);
    });
    return () => {
      live = false;
    };
  }, [service, entityType]);

  /* The entity fallback combobox: one popover is open at a time, so one query. */
  const [search, setSearch] = useState('');
  const [searchTypes, setSearchTypes] = useState<string[]>([]);
  const [found, setFound] = useState<{ key: string; rows: TextSearchRow[] }>({ key: '', rows: [] });

  // `_text_search` needs two characters to be worth a round trip and every word must
  // match; it caps at 25 rows (053_text_search_matching).
  const key =
    searchTypes.length === 0 || search.trim().length < 2 ? '' : `${searchTypes.join(',')}|${search.trim()}`;

  useEffect(() => {
    if (!key) return;
    let live = true;
    const scope: Record<string, null> = {};
    for (const type of searchTypes) scope[type] = null;
    void client
      .textSearch(search, scope, { size: 10 })
      .then((rows) => {
        if (live) setFound({ key, rows });
      })
      .catch(() => {
        if (live) setFound({ key, rows: [] });
      });
    return () => {
      live = false;
    };
    // `key` carries both the query and the types it is asked on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, key]);

  const results = found.key === key ? found.rows : [];
  const searching = key !== '' && found.key !== key;

  /** The leaf field of a dotted path. A flat name resolves against the root type. */
  const fieldOf = (path: string): FieldSchema | null => {
    if (!path) return null;
    const parts = path.split('.');
    return fields[parts[parts.length - 1] as string] ?? null;
  };

  const dataTypeOf = (path: string): string => fieldOf(path)?.dataType ?? '';
  const commit = (next: FilterGroup) => onChange?.(next);

  const ctx: EditorContext = {
    entityType,
    fields,
    hidePaths,
    disabled,
    fieldChooser,
    valueEditor,
    search,
    setSearch,
    setSearchTypes,
    results,
    searching,
    fieldOf,
    edit: (path, node) => commit(replaceAt(value, path, node)),
    remove: (path) => commit(removeAt(value, path)),
    append: (path, node) => commit(appendAt(value, path, node)),
    pickField: (path, node, chosen) => {
      const before = dataTypeOf(node.path);
      const after = dataTypeOf(chosen);
      // The operator vocabulary is per data type, so moving to another type resets the row.
      commit(
        replaceAt(value, path, before === after && node.path ? { ...node, path: chosen } : defaultCondition(chosen, after)),
      );
    },
    pickPreset: (path, node, id) => {
      const dataType = dataTypeOf(node.path);
      const preset = presetById(dataType, id);
      if (preset) commit(replaceAt(value, path, applyPreset(node, preset, dataType)));
    },
  };

  return (
    <div
      className={cn('flex w-full min-w-0 flex-col gap-3', disabled && 'opacity-50', className)}
      data-slot="filter-editor"
      data-entity-type={entityType}
      aria-disabled={disabled ? 'true' : undefined}
    >
      <GroupNode ctx={ctx} path={[]} node={value} />
    </div>
  );
}

function GroupNode({ ctx, path, node }: { ctx: EditorContext; path: NodePath; node: FilterGroup }) {
  return (
    <div
      className="border-border flex min-w-0 flex-col gap-2 rounded-lg border p-3"
      data-slot="filter-group"
      data-path={path.join('.')}
      data-logical-operator={node.logicalOperator}
    >
      <div className="flex min-w-0 items-center gap-2">
        <ToggleGroup
          size="sm"
          variant="outline"
          disabled={ctx.disabled}
          value={[node.logicalOperator]}
          data-slot="filter-logic"
          onValueChange={(next) => {
            const picked = next[0];
            if (picked) ctx.edit(path, { ...node, logicalOperator: picked as FilterGroup['logicalOperator'] });
          }}
        >
          <ToggleGroupItem value="and" aria-label="Match all">
            All
          </ToggleGroupItem>
          <ToggleGroupItem value="or" aria-label="Match any">
            Any
          </ToggleGroupItem>
        </ToggleGroup>
        <span className="text-muted-foreground min-w-0 flex-1 truncate text-xs">of these match</span>
        <Button
          variant="ghost"
          size="sm"
          disabled={ctx.disabled}
          data-slot="filter-add-condition"
          onClick={() => ctx.append(path, makeCondition('', 'is', ''))}
        >
          <PlusIcon />
          Condition
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={ctx.disabled}
          data-slot="filter-add-group"
          onClick={() => ctx.append(path, makeGroup('or'))}
        >
          <PlusIcon />
          Group
        </Button>
        {path.length > 0 ? (
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={ctx.disabled}
            aria-label="Remove group"
            data-slot="filter-remove"
            onClick={() => ctx.remove(path)}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {node.conditions.map((child, i) =>
          child.kind === 'group' ? (
            <GroupNode key={i} ctx={ctx} path={[...path, i]} node={child} />
          ) : (
            <ConditionRow key={i} ctx={ctx} path={[...path, i]} node={child} />
          ),
        )}
        {node.conditions.length === 0 ? (
          <p className="text-muted-foreground py-6 text-center text-sm">No conditions.</p>
        ) : null}
      </div>
    </div>
  );
}

function ConditionRow({ ctx, path, node }: { ctx: EditorContext; path: NodePath; node: FilterCondition }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2" data-slot="filter-row" data-path={path.join('.')}>
      <FieldSlot ctx={ctx} path={path} node={node} />
      <OperatorSlot ctx={ctx} path={path} node={node} />
      <ValueSlot ctx={ctx} path={path} node={node} />
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={ctx.disabled}
        aria-label="Remove condition"
        data-slot="filter-remove"
        onClick={() => ctx.remove(path)}
      >
        <XIcon />
      </Button>
    </div>
  );
}

function FieldSlot({ ctx, path, node }: { ctx: EditorContext; path: NodePath; node: FilterCondition }) {
  const chosen = ctx.fieldOf(node.path);
  if (ctx.fieldChooser) {
    // Integration point: the drill-down field picker plugs in here.
    return (
      <>
        {ctx.fieldChooser({
          entityType: ctx.entityType,
          path: node.path,
          hidePaths: ctx.hidePaths,
          filterableOnly: true,
          disabled: ctx.disabled,
          onSelect: (next: string) => ctx.pickField(path, node, next),
        })}
      </>
    );
  }
  return (
    <Popover>
      <PopoverTrigger
        disabled={ctx.disabled}
        data-slot="filter-field"
        className={cn(
          'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 w-56 shrink-0 items-center justify-between gap-1.5 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
          !chosen && 'text-muted-foreground',
        )}
      >
        <span className="min-w-0 truncate" title={node.path}>
          {chosen?.displayName ?? node.path ?? ''}
        </span>
        <ChevronDownIcon className="text-muted-foreground size-4" />
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search fields…" />
          <CommandList>
            <CommandEmpty>No field.</CommandEmpty>
            {filterableFields(ctx.fields, { hidePaths: ctx.hidePaths }).map((f) => (
              <CommandItem
                key={f.name}
                value={`${f.displayName} ${f.name}`}
                data-field={f.name}
                onSelect={() => ctx.pickField(path, node, f.name)}
              >
                <span className="min-w-0 flex-1 truncate">{f.displayName}</span>
                <span className="text-muted-foreground font-mono text-xs">{f.name}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function OperatorSlot({ ctx, path, node }: { ctx: EditorContext; path: NodePath; node: FilterCondition }) {
  const dataType = ctx.fieldOf(node.path)?.dataType ?? '';
  const menu = operatorMenu(dataType);
  const current = presetIdOf(node, dataType);
  return (
    <Select
      value={current}
      disabled={ctx.disabled || menu.length === 0}
      onValueChange={(id) => ctx.pickPreset(path, node, id as string)}
    >
      <SelectTrigger className="h-8 w-40 shrink-0" data-slot="filter-operator">
        {presetById(dataType, current)?.label ?? current}
      </SelectTrigger>
      <SelectContent>
        {menu.map((run) => (
          <SelectGroup key={run.label}>
            <SelectLabel>{run.label}</SelectLabel>
            {run.presets.map((preset) => (
              <SelectItem key={preset.id} value={preset.id} data-preset={preset.id}>
                {preset.label}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}

function PickerTrigger({ label, count, disabled }: { label: string; count: number; disabled: boolean }) {
  return (
    <PopoverTrigger
      disabled={disabled}
      data-slot="filter-value-trigger"
      className="border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
    >
      <span className={cn('min-w-0 truncate', count === 0 && 'text-muted-foreground')} title={label}>
        {label}
      </span>
      {count > 0 ? (
        <Badge variant="secondary" className="shrink-0">
          {count}
        </Badge>
      ) : (
        <ChevronDownIcon className="text-muted-foreground size-4" />
      )}
    </PopoverTrigger>
  );
}

function ValueSlot({ ctx, path, node }: { ctx: EditorContext; path: NodePath; node: FilterCondition }) {
  const field = ctx.fieldOf(node.path);
  const dataType = field?.dataType ?? '';
  const kind = valueEditorFor(dataType, node.operator);
  const arity = valueArity(node.operator);
  const set = (v: ConditionValue) => ctx.edit(path, { ...node, value: v });
  const disabled = ctx.disabled;

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" data-slot="filter-value">
      {ctx.valueEditor ? (
        // Integration point: the per-type value editors plug in here.
        ctx.valueEditor({ field, dataType, operator: node.operator, value: node.value, arity, disabled, onChange: set })
      ) : arity === 'none' ? (
        <span className="text-muted-foreground truncate text-sm">no value</span>
      ) : arity === 'relative' ? (
        <RelativeValue value={node.value} disabled={disabled} onChange={set} />
      ) : kind === 'checkbox' ? (
        <Select
          value={node.value === false ? 'false' : 'true'}
          disabled={disabled}
          onValueChange={(v) => set(v === 'true')}
        >
          <SelectTrigger className="h-8 w-28" data-slot="filter-value-trigger">
            {node.value === false ? 'No' : 'Yes'}
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true" data-option="true">
              Yes
            </SelectItem>
            <SelectItem value="false" data-option="false">
              No
            </SelectItem>
          </SelectContent>
        </Select>
      ) : kind === 'options' && arity === 'many' ? (
        <OptionsMany field={field} value={node.value} disabled={disabled} onChange={set} />
      ) : kind === 'options' ? (
        <Select
          value={typeof node.value === 'string' ? node.value : ''}
          disabled={disabled}
          onValueChange={(v) => set(v as string)}
        >
          <SelectTrigger className="h-8 w-full min-w-0" data-slot="filter-value-trigger">
            {typeof node.value === 'string' && node.value
              ? (field?.displayValues?.[node.value] ?? node.value)
              : 'Select a value…'}
          </SelectTrigger>
          <SelectContent>
            {(field?.validValues ?? []).map((code) => (
              <SelectItem key={code} value={code} data-option={code}>
                {field?.displayValues?.[code] ?? code}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : kind === 'entity' ? (
        <EntityValue ctx={ctx} field={field} value={node.value} arity={arity} onChange={set} />
      ) : arity === 'two' ? (
        <TwoValues kind={kind} value={node.value} disabled={disabled} onChange={set} />
      ) : arity === 'many' ? (
        <Input
          className="h-8 min-w-0 flex-1"
          disabled={disabled}
          placeholder="value, value"
          aria-label="Values"
          value={((Array.isArray(node.value) ? node.value : []) as Scalar[]).map(scalarText).join(', ')}
          onChange={(e) =>
            set(
              e.currentTarget.value
                .split(',')
                .map((part) => part.trim())
                .filter(Boolean)
                .map((part) => parseScalar(kind, part)) as ConditionValue,
            )
          }
        />
      ) : (
        <Input
          type={inputType(kind)}
          className="h-8 min-w-0 flex-1"
          disabled={disabled}
          aria-label="Value"
          value={scalarText(node.value as Scalar)}
          onChange={(e) => set(parseScalar(kind, e.currentTarget.value))}
        />
      )}
    </div>
  );
}

function RelativeValue({
  value,
  disabled,
  onChange,
}: {
  value: ConditionValue;
  disabled: boolean;
  onChange: (v: ConditionValue) => void;
}) {
  const pair = (Array.isArray(value) ? value : [1, 'DAY']) as [number, string];
  return (
    <>
      <Input
        type="number"
        min="1"
        className="h-8 w-20 shrink-0"
        disabled={disabled}
        aria-label="Count"
        value={String(pair[0] ?? '')}
        onChange={(e) => onChange([Number(e.currentTarget.value), pair[1]] as ConditionValue)}
      />
      <Select
        value={String(pair[1])}
        disabled={disabled}
        onValueChange={(unit) => onChange([pair[0], unit] as ConditionValue)}
      >
        <SelectTrigger className="h-8 w-28 shrink-0">{unitLabel(String(pair[1]))}</SelectTrigger>
        <SelectContent>
          {UNITS.map((unit) => (
            <SelectItem key={unit} value={unit}>
              {unitLabel(unit)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </>
  );
}

function TwoValues({
  kind,
  value,
  disabled,
  onChange,
}: {
  kind: string;
  value: ConditionValue;
  disabled: boolean;
  onChange: (v: ConditionValue) => void;
}) {
  const pair = (Array.isArray(value) ? value : [null, null]) as [Scalar, Scalar];
  return (
    <>
      <Input
        type={inputType(kind)}
        className="h-8 min-w-0 flex-1"
        disabled={disabled}
        aria-label="From"
        value={scalarText(pair[0])}
        onChange={(e) => onChange([parseScalar(kind, e.currentTarget.value), pair[1]] as ConditionValue)}
      />
      <span className="text-muted-foreground shrink-0 text-sm">and</span>
      <Input
        type={inputType(kind)}
        className="h-8 min-w-0 flex-1"
        disabled={disabled}
        aria-label="To"
        value={scalarText(pair[1])}
        onChange={(e) => onChange([pair[0], parseScalar(kind, e.currentTarget.value)] as ConditionValue)}
      />
    </>
  );
}

function OptionsMany({
  field,
  value,
  disabled,
  onChange,
}: {
  field: FieldSchema | null;
  value: ConditionValue;
  disabled: boolean;
  onChange: (v: ConditionValue) => void;
}) {
  const codes = (Array.isArray(value) ? value : []) as string[];
  return (
    <Popover>
      <PickerTrigger
        disabled={disabled}
        label={codes.length === 0 ? 'Select values…' : codes.map((c) => field?.displayValues?.[c] ?? c).join(', ')}
        count={codes.length}
      />
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search values…" />
          <CommandList>
            <CommandEmpty>No value.</CommandEmpty>
            {(field?.validValues ?? []).map((code) => (
              <CommandItem
                key={code}
                value={`${field?.displayValues?.[code] ?? code} ${code}`}
                data-option={code}
                onSelect={() => onChange(codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code])}
              >
                <Checkbox checked={codes.includes(code)} tabIndex={-1} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{field?.displayValues?.[code] ?? code}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function EntityValue({
  ctx,
  field,
  value,
  arity,
  onChange,
}: {
  ctx: EditorContext;
  field: FieldSchema | null;
  value: ConditionValue;
  arity: string;
  onChange: (v: ConditionValue) => void;
}) {
  const refs = entityRefs(value);
  return (
    <Popover
      onOpenChange={(open) => {
        if (open) {
          ctx.setSearch('');
          ctx.setSearchTypes(field?.validTypes ?? [ctx.entityType]);
        }
      }}
    >
      <PickerTrigger
        disabled={ctx.disabled}
        label={refs.length === 0 ? 'Search…' : refs.map((r) => r.name ?? `${r.type} #${r.id}`).join(', ')}
        count={arity === 'many' ? refs.length : 0}
      />
      <PopoverContent className="w-72 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder="Search…" value={ctx.search} onValueChange={ctx.setSearch} />
          <CommandList>
            {ctx.searching ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Searching…</p>
            ) : ctx.results.length === 0 ? (
              <CommandEmpty>{ctx.search.trim().length < 2 ? 'Type to search.' : 'No match.'}</CommandEmpty>
            ) : null}
            {ctx.results.map((row) => (
              <CommandItem
                key={`${row.type}:${row.id}`}
                value={`${row.type}:${row.id}`}
                data-entity={`${row.type}:${row.id}`}
                onSelect={() => onChange(toggleRef(refs, { type: row.type, id: row.id, name: row.name }, arity))}
              >
                <Checkbox
                  checked={refs.some((r) => r.type === row.type && r.id === row.id)}
                  tabIndex={-1}
                  aria-hidden="true"
                />
                <span className="min-w-0 flex-1 truncate">{row.name}</span>
                <span className="text-muted-foreground text-xs">{row.type}</span>
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
