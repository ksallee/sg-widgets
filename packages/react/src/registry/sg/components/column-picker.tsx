import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { FieldHop, FieldOption, FieldSchema, SchemaService } from '@sg-widgets/core';
import {
  currentType,
  deriveFieldOptions,
  friendlyFieldPath,
  iconNameFor,
  moveFieldPath,
  searchFieldOptions,
  toggleFieldPath,
} from '@sg-widgets/core';
import {
  Braces,
  Calendar,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDollarSign,
  CircleDot,
  Columns3,
  FileText,
  Fingerprint,
  Globe,
  Hash,
  Image,
  KeyRound,
  Link,
  Link2,
  List,
  Palette,
  Percent,
  Plus,
  RotateCcw,
  Ruler,
  SearchX,
  Shapes,
  Sigma,
  SquareCheck,
  Tag,
  Timer,
  TriangleAlert,
  Type,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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

export type ColumnPickerSize = 'sm' | 'md' | 'lg';

/** Rows follow the control ladder of `docs/design-rules.md`. */
const ROW: Record<ColumnPickerSize, string> = {
  sm: 'min-h-8',
  md: 'min-h-9',
  lg: 'min-h-10',
};
const ACTION: Record<ColumnPickerSize, 'icon-xs' | 'icon-sm' | 'icon'> = {
  sm: 'icon-xs',
  md: 'icon-sm',
  lg: 'icon',
};

const ICONS: Record<string, typeof Type> = {
  braces: Braces,
  calendar: Calendar,
  'calendar-clock': CalendarClock,
  'circle-dollar-sign': CircleDollarSign,
  'circle-dot': CircleDot,
  'file-text': FileText,
  fingerprint: Fingerprint,
  globe: Globe,
  hash: Hash,
  image: Image,
  'key-round': KeyRound,
  link: Link,
  'link-2': Link2,
  list: List,
  palette: Palette,
  percent: Percent,
  ruler: Ruler,
  shapes: Shapes,
  sigma: Sigma,
  'square-check': SquareCheck,
  tag: Tag,
  timer: Timer,
  type: Type,
};

export interface ColumnPickerProps {
  /** Reads the schema. Build it once per app with `createSchemaService`. */
  schema: SchemaService;
  /** The type every path starts on. */
  entityType: string;
  /** The chosen dotted paths, in the order they are shown. */
  value?: string[];
  onValueChange?: (value: string[]) => void;
  /** Allow descending through entity fields. */
  deepLinks?: boolean;
  /** How many hops a path may take. */
  maxDepth?: number;
  /** Data types a field must have to be selected. Traversal ignores this. */
  dataTypes?: string | string[];
  /** A field is selectable only if it links one of these. Traversal ignores this. */
  validTypes?: string[];
  /** Full dotted paths to drop. */
  exclude?: string[];
  /** Dotted prefixes to drop, along with everything beneath them. */
  hidePaths?: string[];
  /** Drop the data types the API refuses in a filter. */
  filterableOnly?: boolean;
  /** Synthetic entries offered at the root only. */
  extraFields?: { name: string; displayName?: string }[];
  /** Caller's own visibility test over the schema and the candidate's full path. */
  filter?: (field: FieldSchema, path: string) => boolean;
  /** The chosen list alone, with the field list behind an add button. */
  compact?: boolean;
  /** Label of the compact add button. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  availableLabel?: string;
  chosenLabel?: string;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  size?: ColumnPickerSize;
  className?: string;
}

/**
 * The columns of a grid, as the two lists a chooser is made of.
 *
 * Left are the fields of the entity type, checked when the path is already a column;
 * right are the chosen paths in the order they are drawn, moved with the arrow buttons
 * or with Alt and an arrow key. A value is ShotGrid's dotted path: a root field is its
 * own code, and every hop names the field followed and the type it landed on. Only a
 * single `entity` field is descended into — a dotted path through a `multi_entity`
 * field reads back nothing, 200 with the key absent (probe 016). A link declaring
 * several target types asks which one first. `dataTypes` and `validTypes` bind what may
 * be chosen, not what may be walked through, so a picker restricted to dates still
 * reaches a date behind a link.
 */
export function ColumnPicker({
  schema,
  entityType,
  value = [],
  onValueChange,
  deepLinks = true,
  maxDepth = 2,
  dataTypes,
  validTypes,
  exclude,
  hidePaths,
  filterableOnly = false,
  extraFields,
  filter,
  compact = false,
  placeholder = 'Add a column',
  searchPlaceholder = 'Search fields…',
  emptyLabel = 'No columns yet.',
  availableLabel = 'Available',
  chosenLabel = 'Columns',
  readOnly = false,
  disabled = false,
  invalid = false,
  size = 'md',
  className,
}: ColumnPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState('');
  const [hops, setHops] = useState<FieldHop[]>([]);
  /** The field whose target type is being chosen, when it declares more than one. */
  const [choosing, setChoosing] = useState<FieldOption | null>(null);
  const [loaded, setLoaded] = useState<{ type: string; fields: Record<string, FieldSchema> } | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const type = currentType(entityType, hops);
  const editable = !readOnly && !disabled;
  // Paths and synthetic names as strings, so a caller passing a fresh array literal
  // on every render does not re-run the resolution.
  const joined = value.join('\n');
  const synthetic = (extraFields ?? []).map((entry) => entry.name).join('\n');

  // `/schema/<Type>/fields` is 48KB and ~330ms (probe 002); the schema service caches
  // it, so a hop back to a type already visited costs nothing.
  useEffect(() => {
    let live = true;
    schema
      .fields(type)
      .then((fields) => {
        if (live) setLoaded({ type, fields });
      })
      .catch((error: unknown) => {
        if (live) setFailure(error instanceof Error ? error.message : String(error));
      });
    return () => {
      live = false;
    };
  }, [schema, type]);

  // One friendly label per chosen path, resolved through the schema of every type the
  // path travels. Keyed by root type so a change of root never shows a stale label.
  useEffect(() => {
    const paths = joined ? joined.split('\n') : [];
    let live = true;
    Promise.all(
      paths.map(async (path): Promise<[string, string]> => {
        const key = `${entityType}::${path}`;
        const extra = (extraFields ?? []).find((entry) => entry.name === path);
        if (extra) return [key, extra.displayName ?? extra.name];
        try {
          return [key, friendlyFieldPath(await schema.resolvePath(entityType, path))];
        } catch {
          // A path the schema no longer holds still has to be readable.
          return [key, path];
        }
      }),
    ).then((pairs) => {
      if (live) setLabels(Object.fromEntries(pairs));
    });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `synthetic` stands for `extraFields`.
  }, [schema, entityType, joined, synthetic]);

  const fields = loaded?.type === type ? loaded.fields : null;
  const options = fields
    ? deriveFieldOptions(fields, {
        rootType: entityType,
        hops,
        deepLinks,
        maxDepth,
        dataTypes,
        validTypes,
        exclude,
        hidePaths,
        filterableOnly,
        extraFields,
        filter,
      })
    : [];
  const query = search.trim().toLowerCase();
  const rows = choosing ? [] : searchFieldOptions(options, search);
  const targets = choosing ? choosing.targets.filter((t) => t.toLowerCase().includes(query)) : [];
  /** Every row's value, in the order they are drawn: what the arrow keys walk. */
  const values = choosing ? targets : rows.map((row) => row.path);
  const cursor = values.includes(highlighted) ? highlighted : (values[0] ?? '');
  const breadcrumb = hops.length > 0 || choosing !== null;

  function labelOf(path: string): string | undefined {
    return labels[`${entityType}::${path}`];
  }

  function toggle(row: FieldOption): void {
    if (!editable) return;
    onValueChange?.(toggleFieldPath(value, row.path));
  }

  function remove(index: number): void {
    if (!editable) return;
    onValueChange?.(value.filter((_, i) => i !== index));
  }

  function move(from: number, to: number): void {
    if (!editable) return;
    onValueChange?.(moveFieldPath(value, from, to));
  }

  /** Every hop clears the search box; nothing is remounted, so focus stays in the input. */
  function descend(field: FieldOption, through: string): void {
    setHops([...hops, { name: field.name, displayName: field.displayName, through }]);
    setChoosing(null);
    setSearch('');
    setHighlighted('');
  }

  function descendInto(row: FieldOption): void {
    if (!row.traversable) return;
    if (row.targets.length === 1) descend(row, row.targets[0] as string);
    else {
      setChoosing(row);
      setSearch('');
      setHighlighted('');
    }
  }

  function activate(row: FieldOption): void {
    if (row.selectable) toggle(row);
    else descendInto(row);
  }

  function back(): void {
    if (choosing) setChoosing(null);
    else setHops(hops.slice(0, -1));
    setSearch('');
    setHighlighted('');
  }

  function reset(): void {
    setHops([]);
    setChoosing(null);
    setSearch('');
    setHighlighted('');
  }

  function onListKeys(event: KeyboardEvent<HTMLDivElement>): void {
    if (event.key === 'ArrowRight') {
      if (choosing) {
        if (cursor) {
          event.preventDefault();
          descend(choosing, cursor);
        }
        return;
      }
      const row = rows.find((r) => r.path === cursor);
      if (row?.traversable) {
        event.preventDefault();
        descendInto(row);
      }
      return;
    }
    if (event.key === 'ArrowLeft' && breadcrumb) {
      event.preventDefault();
      back();
    }
  }

  function onRowKeys(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (!editable) return;
    if (event.altKey && event.key === 'ArrowUp') {
      event.preventDefault();
      move(index, index - 1);
    } else if (event.altKey && event.key === 'ArrowDown') {
      event.preventDefault();
      move(index, index + 1);
    } else if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      remove(index);
    }
  }

  const fieldList = (
    <>
      {breadcrumb ? (
        <div
          data-slot="column-picker-breadcrumb"
          className="border-border flex items-center gap-1.5 border-b px-2 py-1.5"
        >
          <button
            type="button"
            data-slot="column-picker-back"
            aria-label="Go back one level"
            title="Back (Left arrow)"
            onClick={back}
            className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
          >
            <ChevronLeft aria-hidden="true" className="size-4" />
          </button>
          <nav
            aria-label="Field path"
            className="text-muted-foreground flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-xs"
          >
            <span className="shrink-0">{entityType}</span>
            {hops.map((hop) => (
              <Fragment key={`${hop.name}.${hop.through}`}>
                <ChevronRight aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">{hop.displayName}</span>
              </Fragment>
            ))}
            {choosing ? (
              <>
                <ChevronRight aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate italic">{choosing.displayName}</span>
              </>
            ) : null}
          </nav>
          <button
            type="button"
            data-slot="column-picker-reset"
            aria-label="Back to the root type"
            title="Reset"
            onClick={reset}
            className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
          >
            <RotateCcw aria-hidden="true" className="size-4" />
          </button>
        </div>
      ) : null}

      <Command
        shouldFilter={false}
        loop
        value={cursor}
        onValueChange={setHighlighted}
        onKeyDown={onListKeys}
        className="gap-2 bg-transparent p-0"
      >
        <CommandInput
          ref={inputRef}
          value={search}
          onValueChange={setSearch}
          placeholder={choosing ? 'Which type?' : searchPlaceholder}
        />
        <CommandList>
          {failure ? (
            <div
              data-slot="column-picker-error"
              className="text-destructive flex items-center justify-center gap-1.5 py-6 text-center text-sm"
            >
              <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
              <span className="truncate">{failure}</span>
            </div>
          ) : choosing ? (
            <>
              <CommandEmpty>
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <SearchX aria-hidden="true" className="size-4 shrink-0" />
                  No type matches.
                </span>
              </CommandEmpty>
              {targets.map((target) => (
                <CommandItem
                  key={target}
                  value={target}
                  onSelect={() => descend(choosing, target)}
                  className={cn('gap-2', ROW[size])}
                >
                  <Link aria-hidden="true" className="size-4 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1 truncate">{target}</span>
                  <span className="text-muted-foreground shrink-0 text-xs">entity type</span>
                  <ChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-50" />
                </CommandItem>
              ))}
            </>
          ) : fields === null ? (
            <div data-slot="column-picker-loading" className="flex flex-col gap-2 p-1">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <>
              <CommandEmpty>
                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                  <SearchX aria-hidden="true" className="size-4 shrink-0" />
                  No field matches.
                </span>
              </CommandEmpty>
              {rows.map((row) => {
                const Glyph = ICONS[iconNameFor(row.dataType)] ?? FileText;
                return (
                  <CommandItem
                    key={row.path}
                    value={row.path}
                    onSelect={() => activate(row)}
                    data-slot="column-picker-field"
                    data-path={row.path}
                    data-chosen={value.includes(row.path) ? 'true' : undefined}
                    className={cn('gap-2', ROW[size])}
                  >
                    <Checkbox
                      checked={value.includes(row.path)}
                      disabled={!row.selectable}
                      tabIndex={-1}
                      aria-hidden="true"
                      className="pointer-events-none"
                    />
                    <Glyph aria-hidden="true" className="size-4 shrink-0 opacity-70" />
                    <span className="min-w-0 flex-1 truncate" title={row.displayName}>
                      {row.displayName}
                    </span>
                    {row.name !== row.displayName ? (
                      <span className="text-muted-foreground shrink-0 font-mono text-xs">
                        {row.name}
                      </span>
                    ) : null}
                    {row.traversable ? (
                      <button
                        type="button"
                        tabIndex={-1}
                        data-slot="column-picker-descend"
                        aria-label={`Open ${row.displayName}`}
                        title="Open (Right arrow)"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.stopPropagation();
                          descendInto(row);
                        }}
                        className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
                      >
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </button>
                    ) : null}
                  </CommandItem>
                );
              })}
            </>
          )}
        </CommandList>
      </Command>
    </>
  );

  return (
    <div
      data-slot="column-picker"
      data-size={size}
      data-compact={compact ? 'true' : 'false'}
      aria-disabled={disabled ? 'true' : undefined}
      aria-invalid={invalid ? 'true' : undefined}
      data-readonly={readOnly ? 'true' : undefined}
      className={cn(
        '@container flex w-full min-w-0 flex-col gap-3',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <div
        data-slot="column-picker-panes"
        className={cn('grid min-w-0 gap-3', !compact && !readOnly && '@lg:grid-cols-2')}
      >
        {!compact && !readOnly ? (
          <section
            data-slot="column-picker-available"
            className={cn(
              'border-border flex min-w-0 flex-col gap-3 rounded-md border p-3',
              invalid && 'border-destructive ring-destructive/20 dark:ring-destructive/40 ring-2',
            )}
          >
            <h3 data-slot="column-picker-heading" className="truncate text-sm font-medium">
              {availableLabel}
            </h3>
            {fieldList}
          </section>
        ) : null}

        <section
          data-slot="column-picker-chosen"
          className={cn(
            'flex min-w-0 flex-col gap-3',
            !compact && 'border-border rounded-md border p-3',
            !compact &&
              invalid &&
              'border-destructive ring-destructive/20 dark:ring-destructive/40 ring-2',
          )}
        >
          {!compact ? (
            <h3 data-slot="column-picker-heading" className="truncate text-sm font-medium">
              {chosenLabel} ({value.length})
            </h3>
          ) : null}

          {value.length === 0 ? (
            <p
              data-slot="column-picker-empty"
              className="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-center text-sm"
            >
              <Columns3 aria-hidden="true" className="size-4 shrink-0" />
              {emptyLabel}
            </p>
          ) : (
            <ol
              data-slot="column-picker-list"
              className="flex max-h-72 min-w-0 flex-col gap-2 overflow-y-auto"
            >
              {value.map((path, index) => (
                <li
                  key={path}
                  data-slot="column-picker-column"
                  data-index={index}
                  data-path={path}
                  className={cn('flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5', ROW[size])}
                >
                  {labelOf(path) === undefined ? (
                    <Skeleton className="h-4 w-32" />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-sm" title={path}>
                      {labelOf(path)}
                    </span>
                  )}
                  {editable ? (
                    <>
                      <Button
                        variant="ghost"
                        size={ACTION[size]}
                        data-slot="column-picker-up"
                        onKeyDown={(event) => onRowKeys(event, index)}
                        aria-label={`Move ${labelOf(path) ?? path} up`}
                        title="Move up (Alt with the up arrow)"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                      >
                        <ChevronUp aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size={ACTION[size]}
                        data-slot="column-picker-down"
                        onKeyDown={(event) => onRowKeys(event, index)}
                        aria-label={`Move ${labelOf(path) ?? path} down`}
                        title="Move down (Alt with the down arrow)"
                        disabled={index === value.length - 1}
                        onClick={() => move(index, index + 1)}
                      >
                        <ChevronDown aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size={ACTION[size]}
                        data-slot="column-picker-remove"
                        onKeyDown={(event) => onRowKeys(event, index)}
                        aria-label={`Remove ${labelOf(path) ?? path}`}
                        title="Remove (Delete)"
                        onClick={() => remove(index)}
                      >
                        <X aria-hidden="true" />
                      </Button>
                    </>
                  ) : null}
                </li>
              ))}
            </ol>
          )}

          {compact && !readOnly ? (
            <Popover open={open} onOpenChange={(next) => setOpen(disabled ? false : next)}>
              <PopoverTrigger
                data-slot="column-picker-add"
                disabled={disabled}
                className="border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 w-full min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
              >
                <Plus aria-hidden="true" className="size-4 shrink-0" />
                <span className="min-w-0 truncate">{placeholder}</span>
              </PopoverTrigger>
              <PopoverContent
                data-picker="column"
                initialFocus={inputRef}
                align="start"
                className="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden p-0"
              >
                {fieldList}
              </PopoverContent>
            </Popover>
          ) : null}
        </section>
      </div>
    </div>
  );
}
