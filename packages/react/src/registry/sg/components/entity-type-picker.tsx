import { useEffect, useState } from 'react';
import type { EntityTypeInfo, SchemaService } from '@sg-widgets/core';
import { filterEntityTypes, matchesTokens } from '@sg-widgets/core';
import { ChevronsUpDown, SearchX, TriangleAlert, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type EntityTypePickerSize = 'sm' | 'md' | 'lg';

/** Controls follow the input ladder of `docs/design-rules.md`. */
const BOX: Record<EntityTypePickerSize, string> = {
  sm: 'h-8 px-2',
  md: 'h-9 px-3',
  lg: 'h-10 px-3',
};
const GLYPH: Record<EntityTypePickerSize, string> = {
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};

export interface EntityTypePickerProps {
  /** Reads the site's enabled types. Build it once per app with `createSchemaService`. */
  schema: SchemaService;
  /** A type code in single mode, an array of them in multi mode. */
  value?: string | string[] | null;
  multiple?: boolean;
  onValueChange?: (value: string | string[] | null) => void;
  /** Codes on offer. Empty or absent means every enabled type. */
  allow?: string[];
  /** Codes withheld, applied after `allow`. */
  deny?: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  clearable?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  size?: EntityTypePickerSize;
  className?: string;
}

/**
 * One entity type, or several, as a searchable combobox.
 *
 * The list is every type the site has enabled, display name first with the code
 * beneath it when the two differ. `allow` and `deny` narrow the derived options
 * rather than the read, so a caller switching modes sees the list change without a
 * refetch. Multi mode keeps the popover open and puts a checkbox on every row.
 */
export function EntityTypePicker({
  schema,
  value = null,
  multiple = false,
  onValueChange,
  allow,
  deny,
  placeholder = 'Select an entity type',
  searchPlaceholder = 'Search types…',
  emptyLabel = 'No entity type matches.',
  clearable = true,
  readOnly = false,
  disabled = false,
  invalid = false,
  size = 'md',
  className,
}: EntityTypePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState('');
  const [loaded, setLoaded] = useState<EntityTypeInfo[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  // One read per site, cached by the schema service: `/schema` is 12KB and holds
  // every enabled type (probe 002). Allow and deny are applied to the derived list
  // below, so narrowing them re-filters with no second call.
  useEffect(() => {
    let live = true;
    schema
      .entityTypes()
      .then((types) => {
        if (live) setLoaded(types);
      })
      .catch((error: unknown) => {
        if (live) setFailure(error instanceof Error ? error.message : String(error));
      });
    return () => {
      live = false;
    };
  }, [schema]);

  const selected = multiple ? ((value as string[] | null) ?? []) : value ? [value as string] : [];
  const types = loaded ? filterEntityTypes(loaded, { allow, deny }) : [];
  const shown = types.filter((t) => matchesTokens(search, t.displayName, t.name));
  const cursor = shown.some((t) => t.name === highlighted) ? highlighted : (shown[0]?.name ?? '');
  const byName = new Map(types.map((t) => [t.name, t]));
  const label = selected.map((code) => byName.get(code)?.displayName ?? code).join(', ');
  const showClear = clearable && selected.length > 0 && !readOnly && !disabled;

  function emit(next: string | string[] | null): void {
    onValueChange?.(next);
  }

  function choose(code: string): void {
    if (!multiple) {
      emit(code);
      setOpen(false);
      return;
    }
    emit(selected.includes(code) ? selected.filter((c) => c !== code) : [...selected, code]);
  }

  return (
    <div
      data-slot="entity-type-picker"
      data-size={size}
      data-multiple={multiple ? 'true' : 'false'}
      className={cn('relative flex w-full min-w-0 items-center', className)}
    >
      <Popover open={open} onOpenChange={(next) => setOpen(readOnly || disabled ? false : next)}>
        <PopoverTrigger
          data-slot="entity-type-picker-trigger"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid ? 'true' : undefined}
          aria-disabled={disabled ? 'true' : undefined}
          data-readonly={readOnly ? 'true' : undefined}
          disabled={disabled}
          title={label || placeholder}
          className={cn(
            'border-input bg-background focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex w-full min-w-0 items-center rounded-md border text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2',
            BOX[size],
            readOnly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8',
          )}
        >
          <span className={cn('truncate', selected.length === 0 && 'text-muted-foreground')}>
            {label || placeholder}
          </span>
        </PopoverTrigger>

        <PopoverContent
          data-picker="entity-type"
          align="start"
          className="w-96 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
        >
          <Command shouldFilter={false} loop value={cursor} onValueChange={setHighlighted}>
            <CommandInput
              autoFocus
              value={search}
              onValueChange={setSearch}
              placeholder={searchPlaceholder}
            />
            <CommandList>
              {failure ? (
                <div
                  data-slot="entity-type-picker-error"
                  className="text-destructive flex items-center justify-center gap-1.5 py-6 text-center text-sm"
                >
                  <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{failure}</span>
                </div>
              ) : loaded === null ? (
                <div data-slot="entity-type-picker-loading" className="flex flex-col gap-2 p-1">
                  {[0, 1, 2].map((row) => (
                    <Skeleton key={row} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <SearchX aria-hidden="true" className="size-4 shrink-0" />
                      {emptyLabel}
                    </span>
                  </CommandEmpty>
                  {shown.map((type) => (
                    <CommandItem
                      key={type.name}
                      value={type.name}
                      onSelect={() => choose(type.name)}
                      data-checked={!multiple && selected.includes(type.name) ? 'true' : undefined}
                      className="items-start"
                    >
                      {multiple ? (
                        <Checkbox
                          checked={selected.includes(type.name)}
                          tabIndex={-1}
                          aria-hidden="true"
                          className="pointer-events-none mt-0.5"
                        />
                      ) : null}
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{type.displayName}</span>
                        {type.name !== type.displayName ? (
                          <span className="text-muted-foreground truncate font-mono text-xs">
                            {type.name}
                          </span>
                        ) : null}
                      </span>
                    </CommandItem>
                  ))}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {!readOnly ? (
        <div className="pointer-events-none absolute right-2 flex items-center gap-1">
          {showClear ? (
            <button
              type="button"
              data-slot="entity-type-picker-clear"
              aria-label="Clear the selection"
              onClick={() => emit(multiple ? [] : null)}
              className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
            >
              <X aria-hidden="true" className={GLYPH[size]} />
            </button>
          ) : null}
          <ChevronsUpDown aria-hidden="true" className={cn('shrink-0 opacity-50', GLYPH[size])} />
        </div>
      ) : null}
    </div>
  );
}
