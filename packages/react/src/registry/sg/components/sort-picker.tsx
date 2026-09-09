import { useEffect, useMemo, useState } from 'react';
import type { FieldSchema, SchemaService, SgClient, SortKey } from '@sg-widgets/core';
import { createSchemaService, sortableFields, toSortString } from '@sg-widgets/core';
import {
  ArrowDownIcon,
  ArrowUpDownIcon,
  ArrowUpIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export interface SortPickerProps {
  entityType: string;
  client: SgClient;
  schema?: SchemaService;
  value: SortKey[];
  /** Paths to keep out of the field list, each hiding itself and everything under it. */
  hidePaths?: string[];
  disabled?: boolean;
  /** Both the keys and the `sort` string they serialise to. */
  onChange?: (value: SortKey[], sort: string) => void;
  className?: string;
}

/**
 * The `sort` a query carries, as an ordered list.
 *
 * Each key is a field and a direction; the list serialises to the comma-joined
 * string `_search` takes, a leading `-` marking a descending key
 * (026_result_order). Order is meaningful: the first key wins, and id ascending
 * breaks every remaining tie whether or not it is in the list.
 */
export function SortPicker({
  entityType,
  client,
  schema,
  value = [],
  hidePaths = [],
  disabled = false,
  onChange,
  className,
}: SortPickerProps) {
  const service = useMemo(() => schema ?? createSchemaService(client), [schema, client]);
  const [fields, setFields] = useState<Record<string, FieldSchema>>({});

  useEffect(() => {
    let live = true;
    void service.fields(entityType).then((loaded) => {
      if (live) setFields(loaded);
    });
    return () => {
      live = false;
    };
  }, [service, entityType]);

  const chosen = new Set(value.map((k) => k.field));
  const options = sortableFields(fields, { hidePaths }).filter((f) => !chosen.has(f.name));

  const nameOf = (field: string): string => {
    const parts = field.split('.');
    return fields[parts[parts.length - 1] as string]?.displayName ?? field;
  };

  const label = value.length === 0 ? 'Sort' : value.map((k) => nameOf(k.field)).join(', ');
  const commit = (next: SortKey[]) => onChange?.(next, toSortString(next));

  function move(index: number, delta: number) {
    const to = index + delta;
    if (to < 0 || to >= value.length) return;
    const next = [...value];
    const [key] = next.splice(index, 1);
    next.splice(to, 0, key as SortKey);
    commit(next);
  }

  return (
    <div className={cn('inline-flex min-w-0 items-center', className)} data-slot="sort-picker">
      <Popover>
        <PopoverTrigger
          disabled={disabled}
          data-slot="sort-trigger"
          className="border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
        >
          <ArrowUpDownIcon className="size-4 shrink-0" />
          <span className="min-w-0 truncate" title={label}>
            {label}
          </span>
          {value.length > 1 ? (
            <Badge variant="secondary" className="shrink-0" data-slot="sort-count">
              {value.length}
            </Badge>
          ) : null}
        </PopoverTrigger>
        <PopoverContent className="flex w-96 flex-col gap-3 p-3" align="start">
          <div className="flex min-w-0 flex-col gap-2" data-slot="sort-keys">
            {value.map((key, i) => (
              <div
                key={key.field}
                className="flex min-w-0 items-center gap-2"
                data-slot="sort-key"
                data-field={key.field}
              >
                <span className="min-w-0 flex-1 truncate text-sm" title={key.field}>
                  {nameOf(key.field)}
                </span>
                <ToggleGroup
                  size="sm"
                  variant="outline"
                  value={[key.direction]}
                  data-slot="sort-direction"
                  onValueChange={(next) => {
                    const picked = next[0];
                    if (picked) {
                      commit(value.map((k, j) => (j === i ? { ...k, direction: picked as SortKey['direction'] } : k)));
                    }
                  }}
                >
                  <ToggleGroupItem value="asc" aria-label="Ascending">
                    <ArrowUpIcon />
                  </ToggleGroupItem>
                  <ToggleGroupItem value="desc" aria-label="Descending">
                    <ArrowDownIcon />
                  </ToggleGroupItem>
                </ToggleGroup>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === 0}
                  aria-label="Move up"
                  data-slot="sort-up"
                  onClick={() => move(i, -1)}
                >
                  <ChevronUpIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === value.length - 1}
                  aria-label="Move down"
                  data-slot="sort-down"
                  onClick={() => move(i, 1)}
                >
                  <ChevronDownIcon />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Remove"
                  data-slot="sort-remove"
                  onClick={() => commit(value.filter((_, j) => j !== i))}
                >
                  <XIcon />
                </Button>
              </div>
            ))}
            {value.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No sort. Rows come back id ascending.
              </p>
            ) : null}
          </div>
          <Separator />
          <Command>
            <CommandInput placeholder="Add a field…" />
            <CommandList>
              <CommandEmpty>No field.</CommandEmpty>
              {options.map((f) => (
                <CommandItem
                  key={f.name}
                  value={`${f.displayName} ${f.name}`}
                  data-field={f.name}
                  onSelect={() => commit([...value, { field: f.name, direction: 'asc' }])}
                >
                  <span className="min-w-0 flex-1 truncate">{f.displayName}</span>
                  <span className="text-muted-foreground font-mono text-xs">{f.name}</span>
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
