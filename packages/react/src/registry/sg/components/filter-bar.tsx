import { useEffect, useMemo, useState } from 'react';
import type {
  FacetValue,
  FieldSchema,
  FilterGroup,
  Scalar,
  SchemaService,
  SgClient,
  WireGroup,
} from '@sg-widgets/core';
import {
  createSchemaService,
  describeCondition,
  emptyFilter,
  facetValues,
  findCondition,
  setFacet,
  toApi3Hash,
  withoutPaths,
} from '@sg-widgets/core';
import { ChevronDownIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
  counts?: (field: string, filters: WireGroup | null) => Promise<Record<string, number>>;
  /** Rows read for the tally when `counts` is not given. */
  sampleSize?: number;
  onChange?: (value: FilterGroup) => void;
  className?: string;
}

/**
 * Quick facets over one entity type.
 *
 * Each pill lists the field's values with a count and adds an `in` condition to the
 * bound tree as they are ticked; the pill then shows what that condition says. More
 * filters opens the same tree in the full editor, so the two edit one value.
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
  const scope = JSON.stringify(toApi3Hash(withoutPaths(value, facets)));

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

  const selectedOf = (name: string): Scalar[] => {
    const found = findCondition(value, name);
    return found && Array.isArray(found.condition.value) ? (found.condition.value as Scalar[]) : [];
  };

  const keyOf = (v: Scalar): string =>
    v !== null && typeof v === 'object' ? `${v.type}:${v.id}` : String(v);

  const summaryOf = (name: string): string => {
    const field = fields[name];
    const found = findCondition(value, name);
    if (!found || selectedOf(name).length === 0) return field?.displayName ?? name;
    return describeCondition(found.condition, field);
  };

  function toggle(name: string, option: FacetValue) {
    const selected = selectedOf(name);
    const next = selected.some((v) => keyOf(v) === option.key)
      ? selected.filter((v) => keyOf(v) !== option.key)
      : [...selected, option.value];
    onChange?.(setFacet(value, name, next));
  }

  return (
    <div className={cn('flex w-full min-w-0 flex-wrap items-center gap-2', className)} data-slot="filter-bar">
      {facets.map((name) => {
        const field = fields[name];
        const selected = selectedOf(name);
        const summary = summaryOf(name);
        return (
          <Popover key={name}>
            <PopoverTrigger
              disabled={disabled || !field}
              data-slot="filter-pill"
              data-field={name}
              className={cn(
                'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 max-w-72 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
                selected.length > 0 && 'bg-accent text-accent-foreground border-transparent',
              )}
            >
              <span className="min-w-0 truncate" title={summary}>
                {summary}
              </span>
              {selected.length > 0 ? (
                <Badge variant="secondary" className="shrink-0">
                  {selected.length}
                </Badge>
              ) : (
                <ChevronDownIcon className="text-muted-foreground size-4 shrink-0" />
              )}
            </PopoverTrigger>
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
          </Popover>
        );
      })}

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
