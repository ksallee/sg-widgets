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
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  CircleDot,
  Columns3,
  FileText,
  Fingerprint,
  Globe,
  GripVertical,
  Hash,
  Image,
  KeyRound,
  Link,
  Link2,
  List,
  Palette,
  Percent,
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
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FieldPicker } from '@/registry/sg/components/field-picker';
import { useSortable } from '@/registry/sg/components/sortable';

export type ColumnPickerSize = 'sm' | 'md' | 'lg';
export type ColumnPickerLayout = 'list' | 'dual';

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
  /** `list` is the field picker over the ordered list; `dual` is the two lists side by side. */
  layout?: ColumnPickerLayout;
  /** Show how many columns are chosen under the list. */
  showCount?: boolean;
  /** Placeholder of the field picker. */
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  availableLabel?: string;
  chosenLabel?: string;
  readonly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  size?: ColumnPickerSize;
  className?: string;
}

/**
 * The columns of a grid, as a field picker over the ordered list it fills.
 *
 * Picking a field appends its path and clears the picker; each row carries a grip, the
 * friendly path and a remove button, and moves by drag or with Alt and an arrow key.
 * `layout="dual"` swaps that for the two lists side by side, the type's fields checked
 * on the left and the chosen paths on the right. A value is ShotGrid's dotted path: a
 * root field is its own code, and every hop names the field followed and the type it
 * landed on. Only a single `entity` field is descended into — a dotted path through a
 * `multi_entity` field reads back nothing, 200 with the key absent (probe 016). A link
 * declaring several target types asks which one first. `dataTypes` and `validTypes` bind
 * what may be chosen, not what may be walked through, so a picker restricted to dates
 * still reaches a date behind a link.
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
  layout = 'list',
  showCount = false,
  placeholder = 'Add a column',
  searchPlaceholder = 'Search fields…',
  emptyLabel = 'No columns yet.',
  availableLabel = 'Available',
  chosenLabel = 'Columns',
  readonly = false,
  disabled = false,
  invalid = false,
  size = 'md',
  className,
}: ColumnPickerProps) {
  /** The field picker's own value, cleared as soon as the path is appended. */
  const [adding, setAdding] = useState('');
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState('');
  const [hops, setHops] = useState<FieldHop[]>([]);
  /** The field whose target type is being chosen, when it declares more than one. */
  const [choosing, setChoosing] = useState<FieldOption | null>(null);
  const [loaded, setLoaded] = useState<{ type: string; fields: Record<string, FieldSchema> } | null>(null);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const type = currentType(entityType, hops);
  const editable = !readonly && !disabled;
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
  const count = `${value.length} column${value.length === 1 ? '' : 's'}`;
  /** A chosen path is off the field picker's list, so the same column is never added twice. */
  const offered = [...(exclude ?? []), ...value];

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

  function append(path: string): void {
    setAdding('');
    if (!editable || path === '' || value.includes(path)) return;
    onValueChange?.([...value, path]);
    // The trigger takes focus back where the popover left it, with the page still.
    requestAnimationFrame(() =>
      rootRef.current
        ?.querySelector<HTMLElement>('[data-slot="field-picker-trigger"]')
        ?.focus({ preventScroll: true }),
    );
  }

  const { ref: sortableRef, dragging, announcement } = useSortable<HTMLOListElement>({
    ids: value,
    onOrderChange: (next) => onValueChange?.(next),
    label: (path) => labelOf(path) ?? path,
    disabled: !editable,
  });

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
    // The sortable owns the arrow keys while it carries a row.
    if (!editable || dragging !== null) return;
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

  const chosen = (
    <>
      {value.length === 0 ? (
        <p
          data-slot="column-picker-empty"
          className="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-center text-sm"
        >
          <Columns3 aria-hidden="true" className="size-4 shrink-0" />
          {emptyLabel}
        </p>
      ) : (
        <>
          <ol
            ref={sortableRef}
            data-slot="column-picker-list"
            className="flex max-h-72 min-w-0 flex-col gap-2 overflow-y-auto"
          >
            {value.map((path, index) => (
              <li
                key={path}
                data-slot="column-picker-column"
                data-sortable-id={path}
                data-index={index}
                data-path={path}
                className={cn(
                  'bg-background flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5',
                  'data-[dragging]:z-10 data-[dragging]:opacity-90 data-[dragging]:shadow-md',
                  'data-[drop-target]:bg-accent/40',
                  ROW[size],
                )}
              >
                {!readonly ? (
                  <Button
                    variant="ghost"
                    size={ACTION[size]}
                    data-slot="column-picker-grip"
                    data-sortable-handle="true"
                    disabled={disabled}
                    onKeyDown={(event) => onRowKeys(event, index)}
                    aria-label={`Reorder ${labelOf(path) ?? path}`}
                    title="Drag to reorder, or press Space and use the arrow keys"
                    className="cursor-grab touch-none active:cursor-grabbing"
                  >
                    <GripVertical aria-hidden="true" />
                  </Button>
                ) : null}
                {labelOf(path) === undefined ? (
                  <Skeleton className="h-4 w-32" />
                ) : (
                  <span className="min-w-0 flex-1 truncate text-sm" title={path}>
                    {labelOf(path)}
                  </span>
                )}
                {!readonly ? (
                  <Button
                    variant="ghost"
                    size={ACTION[size]}
                    data-slot="column-picker-remove"
                    disabled={disabled}
                    onKeyDown={(event) => onRowKeys(event, index)}
                    aria-label={`Remove ${labelOf(path) ?? path}`}
                    title="Remove (Delete)"
                    onClick={() => remove(index)}
                  >
                    <X aria-hidden="true" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ol>
          <div
            data-slot="column-picker-live-region"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {announcement}
          </div>
        </>
      )}
      {showCount ? (
        <p data-slot="column-picker-count" className="text-muted-foreground text-xs">
          {count}
        </p>
      ) : null}
    </>
  );

  const picker = (
    <FieldPicker
      schema={schema}
      entityType={entityType}
      deepLinks={deepLinks}
      maxDepth={maxDepth}
      dataTypes={dataTypes}
      validTypes={validTypes}
      hidePaths={hidePaths}
      filterableOnly={filterableOnly}
      extraFields={extraFields}
      filter={filter}
      searchPlaceholder={searchPlaceholder}
      placeholder={placeholder}
      disabled={disabled}
      invalid={invalid}
      size={size}
      value={adding}
      exclude={offered}
      clearable={false}
      emptyLabel="No field left to add."
      onValueChange={append}
    />
  );

  return (
    <div
      ref={rootRef}
      data-slot="column-picker"
      data-size={size}
      data-layout={layout}
      aria-disabled={disabled ? 'true' : undefined}
      aria-invalid={invalid ? 'true' : undefined}
      data-readonly={readonly ? 'true' : undefined}
      className={cn(
        '@container flex w-full min-w-0 flex-col gap-3',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      {layout === 'dual' ? (
        <div
          data-slot="column-picker-panes"
          className={cn('grid min-w-0 gap-3', !readonly && '@lg:grid-cols-2')}
        >
          {!readonly ? (
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
              'border-border flex min-w-0 flex-col gap-3 rounded-md border p-3',
              invalid && 'border-destructive ring-destructive/20 dark:ring-destructive/40 ring-2',
            )}
          >
            <h3 data-slot="column-picker-heading" className="truncate text-sm font-medium">
              {chosenLabel}
            </h3>
            {chosen}
          </section>
        </div>
      ) : (
        <>
          {!readonly ? picker : null}
          {chosen}
        </>
      )}
    </div>
  );
}
