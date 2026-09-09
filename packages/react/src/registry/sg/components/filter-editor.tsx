import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type {
  ConditionValue,
  EntityRef,
  FieldSchema,
  FilterCondition,
  FilterGroup,
  FilterNode,
  NodePath,
  Operator,
  Scalar,
  SchemaService,
  SgClient,
  TimeUnit,
} from '@sg-widgets/core';
import {
  appendAt,
  applyPreset,
  condition as makeCondition,
  createSchemaService,
  defaultCondition,
  emptyFilter,
  group as makeGroup,
  operatorMenu,
  presetById,
  presetIdOf,
  removeAt,
  replaceAt,
  TIME_UNITS,
  timeUnitLabel,
  conditionArity,
  valueEditorFor,
} from '@sg-widgets/core';
import { ChevronDownIcon, PlusIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { CheckboxEditor } from '@/registry/sg/components/checkbox-editor';
import { DateEditor } from '@/registry/sg/components/date-editor';
import { DateTimeEditor } from '@/registry/sg/components/date-time-editor';
import { EntityMultiPicker } from '@/registry/sg/components/entity-multi-picker';
import { EntityPicker } from '@/registry/sg/components/entity-picker';
import { FieldPicker } from '@/registry/sg/components/field-picker';
import { ListSelect } from '@/registry/sg/components/list-select';
import { NumberEditor } from '@/registry/sg/components/number-editor';
import { StatusMultiPicker } from '@/registry/sg/components/status-multi-picker';
import { StatusPicker } from '@/registry/sg/components/status-picker';
import { TextEditor } from '@/registry/sg/components/text-editor';

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

/** The six types NumberEditor parses. `footage` is numeric to the API and reads as a plain number. */
const NUMERIC_EDITORS = ['number', 'float', 'percent', 'duration', 'timecode', 'currency'] as const;
type NumericEditor = (typeof NUMERIC_EDITORS)[number];

function numericType(dataType: string): NumericEditor {
  return (NUMERIC_EDITORS as readonly string[]).includes(dataType) ? (dataType as NumericEditor) : 'number';
}

function textValue(value: Scalar | undefined): string | null {
  if (value === null || value === undefined) return null;
  return typeof value === 'object' ? null : String(value);
}

function numberValue(value: Scalar | undefined): number | string | null {
  if (value === null || value === undefined || value === '') return null;
  return typeof value === 'number' || typeof value === 'string' ? value : null;
}

function codesOf(value: ConditionValue): string[] {
  if (!Array.isArray(value)) return [];
  return (value as Scalar[]).filter((v): v is string => typeof v === 'string');
}

function scalarText(value: Scalar | undefined): string {
  if (value === null || value === undefined || typeof value === 'object') return '';
  return String(value);
}

function parseScalar(kind: string, text: string): Scalar {
  if (text === '') return '';
  return kind === 'number' ? Number(text) : text;
}

/** `is` takes one entity hash and `in` a list of them; a list under `is` is a 400 (field_types/entity). */
function entityRefs(value: ConditionValue): EntityRef[] {
  if (Array.isArray(value)) return value.filter((v) => v !== null && typeof v === 'object') as EntityRef[];
  return value !== null && typeof value === 'object' ? [value as EntityRef] : [];
}

function entityRef(value: ConditionValue): EntityRef | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as EntityRef) : null;
}

/** Every dotted path the tree holds. A flat name needs no resolution. */
function dottedPaths(node: FilterNode, out: string[] = []): string[] {
  if (node.kind === 'condition') {
    if (node.path.includes('.')) out.push(node.path);
    return out;
  }
  for (const child of node.conditions) dottedPaths(child, out);
  return out;
}

/** Everything a row needs that does not come from its own node. */
interface EditorContext {
  entityType: string;
  client: SgClient;
  service: SchemaService;
  hidePaths: string[];
  projectId?: number;
  disabled: boolean;
  fieldChooser?: (args: FieldChooserArgs) => ReactNode;
  valueEditor?: (args: ValueEditorArgs) => ReactNode;
  entityEditor?: (args: ValueEditorArgs) => ReactNode;
  fieldOf: (path: string) => FieldSchema | null;
  /** True while a dotted path is still being walked; its leaf decides the whole row. */
  unresolved: (path: string) => boolean;
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
  /** Scopes the status pickers to the codes one project allows. */
  projectId?: number;
  disabled?: boolean;
  onChange?: (value: FilterGroup) => void;
  fieldChooser?: (args: FieldChooserArgs) => ReactNode;
  valueEditor?: (args: ValueEditorArgs) => ReactNode;
  entityEditor?: (args: ValueEditorArgs) => ReactNode;
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
 * The field is chosen with FieldPicker, which descends through links, so a row may
 * filter on a dotted path; the leaf of that path is resolved through the schema
 * service and is what picks the operator menu and the value editor. An operator that
 * pins its value draws no editor at all.
 */
export function FilterEditor({
  entityType,
  client,
  schema,
  value = emptyFilter(),
  hidePaths = [],
  projectId,
  disabled = false,
  onChange,
  fieldChooser,
  valueEditor,
  entityEditor,
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

  /**
   * The leaf schema of every dotted path the tree holds, added once and kept.
   * The in-flight map is a ref, so filling the cache never re-runs the walk.
   */
  const [leaves, setLeaves] = useState<Record<string, FieldSchema | null>>({});
  const resolving = useRef(new Map<string, Promise<FieldSchema | null>>());

  const resolveLeaf = useCallback(
    (path: string): Promise<FieldSchema | null> => {
      const at = `${entityType}|${path}`;
      let job = resolving.current.get(at);
      if (!job) {
        job = service.resolvePath(entityType, path).then(
          (segments) => segments[segments.length - 1]?.field ?? null,
          // A path the schema no longer holds still has to be editable, so the row keeps it.
          () => null,
        );
        resolving.current.set(at, job);
        void job.then((leaf) => {
          setLeaves((held) => ({ ...held, [at]: leaf }));
        });
      }
      return job;
    },
    [service, entityType],
  );

  useEffect(() => {
    for (const path of dottedPaths(value)) void resolveLeaf(path);
  }, [value, resolveLeaf]);

  /** The leaf field of a path. A flat name is a field of the root type. */
  const fieldOf = (path: string): FieldSchema | null => {
    if (!path) return null;
    if (!path.includes('.')) return fields[path] ?? null;
    return leaves[`${entityType}|${path}`] ?? null;
  };

  const dataTypeOf = (path: string): string => fieldOf(path)?.dataType ?? '';
  const commit = (next: FilterGroup) => onChange?.(next);

  const ctx: EditorContext = {
    entityType,
    client,
    service,
    hidePaths,
    projectId,
    disabled,
    fieldChooser,
    valueEditor,
    entityEditor,
    fieldOf,
    unresolved: (path) => path.includes('.') && !(`${entityType}|${path}` in leaves),
    edit: (path, node) => commit(replaceAt(value, path, node)),
    remove: (path) => commit(removeAt(value, path)),
    append: (path, node) => commit(appendAt(value, path, node)),
    pickField: (path, node, chosen) => {
      const before = dataTypeOf(node.path);
      const leaf = chosen.includes('.') ? resolveLeaf(chosen) : Promise.resolve(fields[chosen] ?? null);
      void leaf.then((after) => {
        const type = after?.dataType ?? '';
        // The operator vocabulary is per data type, so moving to another type resets the row.
        commit(
          replaceAt(
            value,
            path,
            before === type && node.path ? { ...node, path: chosen } : defaultCondition(chosen, type),
          ),
        );
      });
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

/**
 * A group is a header, its rows and a foot. The header says how the rows join and
 * removes the group; the rows hang off one rail, so a level of nesting is one
 * indent; the foot is where rows and groups are added.
 */
function GroupNode({ ctx, path, node }: { ctx: EditorContext; path: NodePath; node: FilterGroup }) {
  const depth = path.length;
  return (
    <div
      className={cn('flex min-w-0 flex-col gap-2', depth > 0 && 'bg-muted/40 rounded-lg p-2')}
      data-slot="filter-group"
      data-path={path.join('.')}
      data-depth={depth}
      data-logical-operator={node.logicalOperator}
    >
      <div className="flex min-h-9 min-w-0 items-center gap-2" data-slot="filter-group-header">
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
        {depth > 0 ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground shrink-0"
            disabled={ctx.disabled}
            aria-label="Remove group"
            data-slot="filter-remove"
            onClick={() => ctx.remove(path)}
          >
            <XIcon />
          </Button>
        ) : null}
      </div>
      <div className="border-border flex min-w-0 flex-col gap-2 border-l pl-3" data-slot="filter-group-body">
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
      <div className="flex min-w-0 flex-wrap items-center gap-1 pl-3" data-slot="filter-foot">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          disabled={ctx.disabled}
          data-slot="filter-add-condition"
          data-path={path.join('.')}
          onClick={() => ctx.append(path, makeCondition('', 'is', ''))}
        >
          <PlusIcon />
          Condition
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
          disabled={ctx.disabled}
          data-slot="filter-add-group"
          data-path={path.join('.')}
          onClick={() => ctx.append(path, makeGroup('or'))}
        >
          <PlusIcon />
          Group
        </Button>
      </div>
    </div>
  );
}

/**
 * A row is two bands: the field, the operator and the value on one 36px line, and
 * the remove button on its own. The remove sits outside the wrapping band, so it
 * holds the same vertical axis at every depth and never costs the row a line.
 */
function ConditionRow({ ctx, path, node }: { ctx: EditorContext; path: NodePath; node: FilterCondition }) {
  return (
    <div className="flex min-h-9 min-w-0 items-center gap-2" data-slot="filter-row" data-path={path.join('.')}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" data-slot="filter-row-content">
        <FieldSlot ctx={ctx} path={path} node={node} />
        <OperatorSlot ctx={ctx} path={path} node={node} />
        <ValueSlot ctx={ctx} path={path} node={node} />
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-foreground shrink-0"
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
  return (
    // The field is the row's widest cell: it takes 14rem, truncates, and gives the rest back.
    <div data-slot="filter-field" className="w-56 min-w-24 shrink">
      {ctx.fieldChooser ? (
        ctx.fieldChooser({
          entityType: ctx.entityType,
          path: node.path,
          hidePaths: ctx.hidePaths,
          filterableOnly: true,
          disabled: ctx.disabled,
          onSelect: (next: string) => ctx.pickField(path, node, next),
        })
      ) : (
        <FieldPicker
          schema={ctx.service}
          entityType={ctx.entityType}
          hidePaths={ctx.hidePaths}
          disabled={ctx.disabled}
          value={node.path}
          deepLinks
          filterableOnly
          clearable={false}
          size="sm"
          placeholder="Select a field"
          onValueChange={(next) => ctx.pickField(path, node, next)}
        />
      )}
    </div>
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
  const arity = conditionArity(node, dataType);
  const set = (v: ConditionValue) => ctx.edit(path, { ...node, value: v });
  const disabled = ctx.disabled;
  const args: ValueEditorArgs = { field, dataType, operator: node.operator, value: node.value, arity, disabled, onChange: set };

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" data-slot="filter-value">
      {ctx.unresolved(node.path) ? (
        <Skeleton className="h-8 min-w-0 flex-1" />
      ) : ctx.valueEditor ? (
        // Integration point: a caller's own editors replace every one below.
        ctx.valueEditor(args)
      ) : arity === 'none' ? (
        // `is empty` and the calendar presets pin their value; there is nothing to edit.
        null
      ) : arity === 'relative' ? (
        <RelativeValue value={node.value} disabled={disabled} onChange={set} />
      ) : kind === 'entity' ? (
        ctx.entityEditor ? (
          // Integration point: EntityMultiPicker plugs in here.
          ctx.entityEditor(args)
        ) : (
          <EntityValue ctx={ctx} field={field} value={node.value} arity={arity} onChange={set} />
        )
      ) : kind === 'checkbox' ? (
        <CheckboxEditor
          className="min-w-0 flex-1"
          size="sm"
          disabled={disabled}
          field={{ displayName: field?.displayName ?? 'Value', mandatory: false }}
          value={node.value === true}
          onValueChange={(next) => set(next)}
        />
      ) : kind === 'options' && dataType === 'status_list' && arity === 'many' ? (
        <StatusMultiPicker
          className="min-w-0 flex-1"
          size="sm"
          client={ctx.client}
          disabled={disabled}
          projectId={ctx.projectId}
          entityType={field?.entityType ?? ctx.entityType}
          field={field?.name}
          value={codesOf(node.value)}
          onValueChange={(next) => set([...next])}
        />
      ) : kind === 'options' && dataType === 'status_list' ? (
        <StatusPicker
          className="min-w-0 flex-1"
          size="sm"
          client={ctx.client}
          disabled={disabled}
          projectId={ctx.projectId}
          entityType={field?.entityType ?? ctx.entityType}
          field={field?.name}
          value={typeof node.value === 'string' && node.value !== '' ? node.value : undefined}
          onValueChange={(next) => set(next ?? '')}
        />
      ) : kind === 'options' && arity === 'many' ? (
        <OptionsMany field={field} value={node.value} disabled={disabled} onChange={set} />
      ) : kind === 'options' ? (
        <ListSelect
          className="min-w-0 flex-1"
          size="sm"
          disabled={disabled}
          field={field}
          placeholder="Select a value…"
          value={typeof node.value === 'string' && node.value !== '' ? node.value : null}
          onValueChange={(next) => set(next ?? '')}
        />
      ) : arity === 'two' ? (
        <TwoValues kind={kind} dataType={dataType} value={node.value} disabled={disabled} onChange={set} />
      ) : arity === 'many' ? (
        // A list of dates, numbers or strings has no per-value editor: one line, comma separated.
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
        <ScalarEditor
          kind={kind}
          dataType={dataType}
          label={field?.displayName ?? 'Value'}
          value={node.value as Scalar}
          disabled={disabled}
          onChange={(v) => set(v)}
        />
      )}
    </div>
  );
}

/**
 * A value editor sized for a row. The typed types take the width their content needs and
 * the free width goes to the ones that hold a name: a date, a time and a number never
 * push the row onto a second line.
 */
function ScalarEditor({
  kind,
  dataType,
  label,
  value,
  disabled,
  onChange,
}: {
  kind: string;
  dataType: string;
  label: string;
  value: Scalar;
  disabled: boolean;
  onChange: (v: Scalar) => void;
}) {
  const field = { displayName: label, mandatory: false };
  if (kind === 'number') {
    return (
      <NumberEditor
        className="shrink-0"
        size="sm"
        inline
        disabled={disabled}
        dataType={numericType(dataType)}
        field={field}
        value={numberValue(value)}
        onValueChange={(next) => onChange(next ?? '')}
      />
    );
  }
  if (kind === 'date') {
    return (
      <DateEditor
        className="shrink-0"
        size="sm"
        inline
        disabled={disabled}
        field={field}
        value={textValue(value)}
        onValueChange={(next) => onChange(next ?? '')}
      />
    );
  }
  if (kind === 'date_time') {
    return (
      <DateTimeEditor
        className="shrink-0"
        size="sm"
        inline
        hint={false}
        disabled={disabled}
        field={field}
        value={textValue(value)}
        onValueChange={(next) => onChange(next ?? '')}
      />
    );
  }
  return (
    <TextEditor
      className="min-w-0 flex-1"
      size="sm"
      disabled={disabled}
      field={field}
      value={textValue(value)}
      onValueChange={(next) => onChange(next ?? '')}
    />
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
    // A window is one quantity: the count and its unit share a box.
    <InputGroup className="w-40 shrink-0">
      <InputGroupInput
        type="number"
        min="1"
        className="tabular-nums"
        disabled={disabled}
        aria-label="Count"
        value={String(pair[0] ?? '')}
        onChange={(e) => onChange([Number(e.currentTarget.value), pair[1]] as ConditionValue)}
      />
      <InputGroupAddon align="inline-end" className="py-0 pr-1">
        <Select
          value={String(pair[1])}
          disabled={disabled}
          onValueChange={(unit) => onChange([pair[0], unit] as ConditionValue)}
        >
          <SelectTrigger size="sm" className="border-0 bg-transparent dark:bg-transparent">
            {unitLabel(String(pair[1]))}
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((unit) => (
              <SelectItem key={unit} value={unit}>
                {unitLabel(unit)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </InputGroupAddon>
    </InputGroup>
  );
}

function TwoValues({
  kind,
  dataType,
  value,
  disabled,
  onChange,
}: {
  kind: string;
  dataType: string;
  value: ConditionValue;
  disabled: boolean;
  onChange: (v: ConditionValue) => void;
}) {
  const pair = (Array.isArray(value) ? value : [null, null]) as [Scalar, Scalar];
  return (
    // Both ends on one line, joined by the word that reads the range.
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2" data-slot="filter-range">
      <ScalarEditor
        kind={kind}
        dataType={dataType}
        label="From"
        value={pair[0]}
        disabled={disabled}
        onChange={(v) => onChange([v, pair[1]] as ConditionValue)}
      />
      <span className="text-muted-foreground shrink-0 text-sm">and</span>
      <ScalarEditor
        kind={kind}
        dataType={dataType}
        label="To"
        value={pair[1]}
        disabled={disabled}
        onChange={(v) => onChange([pair[0], v] as ConditionValue)}
      />
    </div>
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
  const codes = codesOf(value);
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
  const types = field?.validTypes?.length ? field.validTypes : [ctx.entityType];
  if (arity === 'many') {
    return (
      <EntityMultiPicker
        className="min-w-0 flex-1"
        size="sm"
        client={ctx.client}
        disabled={ctx.disabled}
        projectId={ctx.projectId}
        entityTypes={types}
        placeholder="Search entities"
        value={entityRefs(value)}
        onValueChange={(next) => onChange([...next])}
      />
    );
  }
  return (
    <EntityPicker
      className="min-w-0 flex-1"
      size="sm"
      client={ctx.client}
      disabled={ctx.disabled}
      projectId={ctx.projectId}
      entityTypes={types}
      placeholder="Search entities"
      value={entityRef(value)}
      onValueChange={(next) => onChange(next ?? '')}
    />
  );
}
