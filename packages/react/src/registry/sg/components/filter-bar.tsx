import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  FacetValue,
  FieldSchema,
  FilterCondition,
  FilterGroup,
  Operator,
  OperatorPreset,
  Scalar,
  SchemaService,
  SgClient,
  WireGroup,
} from '@sg-widgets/core';
import {
  conditionArity,
  conditionParts,
  createSchemaService,
  describeCondition,
  emptyFilter,
  facetPresets,
  facetValues,
  findCondition,
  presetById,
  presetIdOf,
  setFacet,
  setFacetPreset,
  toApi3Hash,
  asFilterGroup,
  group,
  withoutPaths,
} from '@sg-widgets/core';
import { PlusIcon, XIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { FilterDialog } from '@/registry/sg/components/filter-dialog';

export interface FilterBarProps {
  entityType: string;
  client: SgClient;
  schema?: SchemaService;
  /** Field names to offer as pills, in order. */
  facets: string[];
  value: FilterGroup;
  hidePaths?: string[];
  disabled?: boolean;
  /**
   * Counts per value for one facet. Wire it to a `_summarize` grouping call.
   * Without it the bar reads one page of rows and tallies them.
   */
  /** Conditions every facet query carries, such as a project scope. Never edited by the bar. */
  baseFilter?: FilterGroup | WireGroup | null;
  counts?: (field: string, filters: WireGroup | null) => Promise<Record<string, number>>;
  /** Rows read for the tally when `counts` is not given. */
  sampleSize?: number;
  onChange?: (value: FilterGroup) => void;
  className?: string;
}

/**
 * Quick facets over one entity type.
 *
 * An untouched facet is a quiet pill naming its field; ticking a value turns it into
 * a segmented pill reading field, operator and values, where the operator segment is
 * a menu of the operators that field's facet can take and the values segment is the
 * checklist. The pill adds its condition to the bound tree, and More filters opens
 * the same tree in the full editor, so the two edit one value.
 *
 * Counts come from a `_summarize` grouping call when one is wired to `counts`, and
 * otherwise from tallying one page of rows, which makes them as complete as the page
 * size allowed.
 */
export function FilterBar({
  entityType,
  client,
  schema,
  facets,
  value = emptyFilter(),
  hidePaths = [],
  disabled = false,
  counts,
  baseFilter = null,
  sampleSize = 200,
  onChange,
  className,
}: FilterBarProps) {
  const service = useMemo(() => schema ?? createSchemaService(client), [schema, client]);
  const [fields, setFields] = useState<Record<string, FieldSchema>>({});
  const [tally, setTally] = useState<Record<string, FacetValue[]>>({});
  const [counting, setCounting] = useState(true);

  useEffect(() => {
    let live = true;
    void service.fields(entityType).then((loaded) => {
      if (live) setFields(loaded);
    });
    return () => {
      live = false;
    };
  }, [service, entityType]);

  // Counts are read against the filter with every facet's own condition stripped, so
  // ticking one value does not empty its neighbours. One read serves every pill.
  const base = asFilterGroup(baseFilter);
  const scope = JSON.stringify(toApi3Hash(base ? group('and', [base, withoutPaths(value, facets)]) : withoutPaths(value, facets)));

  useEffect(() => {
    const present = facets.map((name) => fields[name]).filter((f): f is FieldSchema => Boolean(f));
    if (present.length === 0) return;
    let live = true;
    setCounting(true);
    const filters = JSON.parse(scope) as WireGroup | null;
    const load = async (): Promise<Record<string, FacetValue[]>> => {
      const out: Record<string, FacetValue[]> = {};
      if (counts) {
        for (const field of present) {
          const found = await counts(field.name, filters);
          out[field.name] = facetValues([], field).map((v) => ({ ...v, count: found[v.key] ?? 0 }));
        }
        return out;
      }
      const rows = await client.search(entityType, {
        filters,
        fields: present.map((f) => f.name),
        page: { size: sampleSize },
      });
      for (const field of present) out[field.name] = facetValues(rows.data, field);
      return out;
    };
    void load()
      .then((found) => {
        if (live) setTally(found);
      })
      .finally(() => {
        if (live) setCounting(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, entityType, fields, facets.join(','), scope, sampleSize, counts]);

  const conditionOf = (name: string): FilterCondition | null => findCondition(value, name)?.condition ?? null;

  const selectedOf = (name: string): Scalar[] => {
    const found = conditionOf(name);
    return found && Array.isArray(found.value) ? (found.value as Scalar[]) : [];
  };

  const keyOf = (v: Scalar): string => (v !== null && typeof v === 'object' ? `${v.type}:${v.id}` : String(v));

  /** The list operator the checklist writes: the one the pill already holds, else `in`. */
  const listOperator = (name: string): Operator => {
    const found = conditionOf(name);
    return found && Array.isArray(found.value) ? found.operator : 'in';
  };

  function toggle(name: string, option: FacetValue) {
    const selected = selectedOf(name);
    const next = selected.some((v) => keyOf(v) === option.key)
      ? selected.filter((v) => keyOf(v) !== option.key)
      : [...selected, option.value];
    onChange?.(setFacet(value, name, next, listOperator(name)));
  }

  /**
   * The operator menu one pill offers. A condition the full editor left on an
   * operator no pill would have chosen still names itself, so the segment reads
   * what the tree says rather than the nearest entry to it.
   */
  const menuOf = (name: string): OperatorPreset[] => {
    const dataType = fields[name]?.dataType ?? '';
    const presets = facetPresets(dataType);
    const found = conditionOf(name);
    if (!found) return presets;
    const current = presetById(dataType, presetIdOf(found, dataType));
    if (!current || presets.some((p) => p.id === current.id)) return presets;
    return [current, ...presets];
  };

  function pickPreset(name: string, id: string) {
    const dataType = fields[name]?.dataType ?? '';
    const preset = presetById(dataType, id);
    if (preset) onChange?.(setFacetPreset(value, name, preset, dataType));
  }

  const facetList = (name: string): ReactNode => {
    const selected = selectedOf(name);
    return (
      <PopoverContent className="w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search values…" />
          <CommandList>
            {counting ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Counting…</p>
            ) : (
              <>
                <CommandEmpty>No value.</CommandEmpty>
                {(tally[name] ?? []).map((option) => (
                  <CommandItem
                    key={option.key}
                    value={`${option.label} ${option.key}`}
                    data-option={option.key}
                    onSelect={() => toggle(name, option)}
                  >
                    <Checkbox
                      checked={selected.some((v) => keyOf(v) === option.key)}
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <span className="text-muted-foreground text-xs tabular-nums" data-slot="facet-count">
                      {option.count}
                    </span>
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
        {selected.length > 0 ? (
          <div className="border-border border-t p-1">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              data-slot="filter-pill-clear"
              onClick={() => onChange?.(setFacet(value, name, []))}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    );
  };

  const activeCount = facets.filter((name) => Boolean(conditionOf(name))).length;

  return (
    <div className={cn('flex w-full min-w-0 flex-wrap items-center gap-2', className)} data-slot="filter-bar">
      {facets.map((name) => {
        const field = fields[name];
        const found = conditionOf(name);
        if (!found) {
          return (
            <Popover key={name}>
              <PopoverTrigger
                disabled={disabled || !field}
                data-slot="filter-pill"
                data-field={name}
                className="border-border text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 max-w-72 min-w-0 items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
              >
                <PlusIcon className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{field?.displayName ?? name}</span>
              </PopoverTrigger>
              {facetList(name)}
            </Popover>
          );
        }
        const dataType = field?.dataType ?? '';
        const parts = conditionParts(found, field);
        const arity = conditionArity(found, dataType);
        const selected = selectedOf(name);
        return (
          <div
            key={name}
            data-slot="filter-pill"
            data-field={name}
            data-active="true"
            role="group"
            aria-label={describeCondition(found, field)}
            className="border-border bg-background inline-flex h-8 max-w-full min-w-0 items-center overflow-hidden rounded-lg border text-sm"
          >
            <span data-slot="filter-pill-field" className="min-w-0 shrink truncate px-2.5 font-medium" title={parts.field}>
              {parts.field}
            </span>
            <Select
              value={presetIdOf(found, dataType)}
              disabled={disabled}
              onValueChange={(id) => pickPreset(name, id as string)}
            >
              <SelectTrigger
                data-slot="filter-pill-operator"
                className="border-border text-muted-foreground hover:bg-muted h-8 shrink-0 rounded-none border-0 border-l bg-transparent px-2 dark:bg-transparent"
              >
                {parts.operator}
              </SelectTrigger>
              <SelectContent>
                {menuOf(name).map((preset) => (
                  <SelectItem key={preset.id} value={preset.id} data-preset={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {arity === 'many' ? (
              <Popover>
                <PopoverTrigger
                  disabled={disabled}
                  data-slot="filter-pill-values"
                  className="border-border hover:bg-muted focus-visible:ring-ring/50 inline-flex h-8 min-w-0 items-center gap-1.5 border-l px-2.5 outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
                >
                  <span className="min-w-0 truncate" title={parts.value}>
                    {parts.value}
                  </span>
                  {selected.length > 1 ? (
                    <Badge variant="secondary" className="shrink-0">
                      {selected.length}
                    </Badge>
                  ) : null}
                </PopoverTrigger>
                {facetList(name)}
              </Popover>
            ) : parts.value ? (
              <span data-slot="filter-pill-values" className="border-border min-w-0 truncate border-l px-2.5" title={parts.value}>
                {parts.value}
              </span>
            ) : null}
            <button
              type="button"
              disabled={disabled}
              data-slot="filter-pill-remove"
              aria-label={`Remove ${parts.field} filter`}
              className="border-border text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center border-l px-1.5 outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
              onClick={() => onChange?.(withoutPaths(value, [name]))}
            >
              <XIcon className="size-4" />
            </button>
          </div>
        );
      })}

      {activeCount > 0 ? (
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className="text-muted-foreground hover:text-foreground"
          data-slot="filter-clear-all"
          onClick={() => onChange?.(withoutPaths(value, facets))}
        >
          Clear all
        </Button>
      ) : null}

      <FilterDialog
        entityType={entityType}
        client={client}
        schema={schema}
        hidePaths={hidePaths}
        disabled={disabled}
        label="More filters"
        value={value}
        onChange={(next) => onChange?.(next)}
      />
    </div>
  );
}
