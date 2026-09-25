import { Fragment, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { FieldHop, FieldOption, FieldPathOption, FieldSchema, SgContext } from 'sg-widgets-core';
import {
  currentType,
  deriveFieldOptions,
  errorText,
  friendlyFieldPath,
  iconNameFor,
  NO_MATCH_LABEL,
  pickerKeyIntent,
  repeatedLabels,
  resolveFieldPathOptions,
  searchFieldOptions,
  searchFieldPathOptions,
  stateLine,
} from 'sg-widgets-core';
import {
  Braces,
  Calendar,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CircleDollarSign,
  CircleDot,
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
import {
  PICKER_CONTROL,
  PICKER_GLYPH,
  PICKER_ICON_BUTTON,
  PICKER_TEXT_BOX,
  PICKER_TRAILING,
} from '@/registry/sg/components/picker-classes';
import { StateLine } from '@/registry/sg/components/state-line';

export type FieldPickerSize = 'sm' | 'md' | 'lg';

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

export interface FieldPickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** The widget context. The schema is read through it, once per page. */
  context: SgContext;
  /** The type the path starts on. */
  entityType: string;
  /** A fixed list of paths, offered flat. The list restrictions do not apply to it. */
  options?: string[];
  /** The dotted path, `field` or `field.Type.field…`. Empty when nothing is chosen. */
  value?: string;
  onValueChange?: (value: string) => void;
  /** Allow descending through entity fields. */
  deepLinks?: boolean;
  /** Show the programmatic name beside the display name. */
  showCode?: boolean;
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
  /** Close the popover on a selection. Off keeps it open for the next pick. */
  closeOnSelect?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Shown when the search matches nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
  clearable?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  size?: FieldPickerSize;
  /** Whether the popover is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * One field of one entity type, as a searchable combobox that descends through links.
 *
 * The value is ShotGrid's dotted path: a root field is its own code, and every hop
 * names the field followed and the type it landed on. Only a single `entity` field
 * is descended into — a dotted path through a `multi_entity` field reads back
 * nothing, 200 with the key absent (probe 016). A link declaring several target
 * types asks which one first. `dataTypes` and `validTypes` bind what may be chosen,
 * not what may be walked through, so a picker restricted to dates still reaches a
 * date behind a link.
 *
 * `options` replaces the schema list with a caller's own paths, flat: no links, no
 * descending, no breadcrumb, and the list restrictions do not apply.
 */
export function FieldPicker({
  context,
  entityType,
  options,
  value = '',
  onValueChange,
  deepLinks = false,
  showCode = false,
  maxDepth = 2,
  dataTypes,
  validTypes,
  exclude,
  hidePaths,
  filterableOnly = false,
  extraFields,
  filter,
  closeOnSelect = true,
  placeholder = 'Select a field',
  searchPlaceholder = 'Search fields…',
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
  clearable = true,
  readonly = false,
  disabled = false,
  invalid = false,
  size = 'md',
  open: openProp,
  onOpenChange,
  className,
  ref,
  ...rest
}: FieldPickerProps) {
  // The context's own service, so every widget on the page shares one schema read.
  const schema = context.schema;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    // The query goes with the list, so the next open starts on the whole set.
    if (!next) {
      setSearch('');
      setHighlighted('');
    }
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [highlighted, setHighlighted] = useState('');
  const [hops, setHops] = useState<FieldHop[]>([]);
  /** The field whose target type is being chosen, when it declares more than one. */
  const [choosing, setChoosing] = useState<FieldOption | null>(null);
  const [loaded, setLoaded] = useState<{ type: string; fields: Record<string, FieldSchema> } | null>(null);
  /** The caller's fixed list, resolved. Keyed on what was asked for, so a change re-reads. */
  const [fixed, setFixed] = useState<{ key: string; rows: FieldPathOption[] } | null>(null);
  const [resolved, setResolved] = useState<{ path: string; label: string } | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const type = currentType(entityType, hops);
  const computed = extraFields?.find((extra) => extra.name === value);
  /** The list is a fresh array on every render, so the read is keyed on what it holds. */
  const fixedKey = options ? `${entityType}|${options.join(',')}` : null;

  // Every path of the fixed list is resolved through the types it travels, once per list.
  useEffect(() => {
    if (fixedKey === null) return;
    const cut = fixedKey.indexOf('|');
    const joined = fixedKey.slice(cut + 1);
    let live = true;
    void resolveFieldPathOptions(schema, fixedKey.slice(0, cut), joined === '' ? [] : joined.split(',')).then((rows) => {
      if (live) setFixed({ key: fixedKey, rows });
    });
    return () => {
      live = false;
    };
  }, [schema, fixedKey]);

  // `/schema/<Type>/fields` is 48KB and ~330ms (probe 002); the schema service caches
  // it, so a hop back to a type already visited costs nothing.
  useEffect(() => {
    if (fixedKey !== null) return;
    let live = true;
    schema
      .fields(type)
      .then((fields) => {
        if (live) setLoaded({ type, fields });
      })
      .catch((error: unknown) => {
        if (live) setFailure(errorText(error));
      });
    return () => {
      live = false;
    };
  }, [schema, type, fixedKey]);

  // The closed control shows the friendly path, never the raw one, so the label is
  // resolved through the schema of every type the path travels.
  const synthetic = computed !== undefined;
  useEffect(() => {
    if (!value || synthetic) return;
    let live = true;
    schema
      .resolvePath(entityType, value)
      .then((segments) => {
        if (live) setResolved({ path: value, label: friendlyFieldPath(segments) });
      })
      // A path the schema no longer holds still has to be readable, so it stays as it is.
      .catch(() => {
        if (live) setResolved({ path: value, label: value });
      });
    return () => {
      live = false;
    };
  }, [schema, entityType, value, synthetic]);

  const fixedRows = fixed?.key === fixedKey ? fixed.rows : null;
  const fields = loaded?.type === type ? loaded.fields : null;
  const derived = fields
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
  /** One shape for both lists, so a fixed row and a schema row draw the same. */
  const rows: { path: string; label: string; code: string; sub: string; dataType: string; field: FieldOption | null }[] =
    fixedRows
      ? searchFieldPathOptions(fixedRows, search).map((row) => ({
          path: row.path,
          label: row.label,
          code: row.name,
          sub: row.subLabel,
          dataType: row.dataType,
          field: null,
        }))
      : choosing
        ? []
        : searchFieldOptions(derived, search).map((row) => ({
            path: row.path,
            label: row.displayName,
            code: row.name,
            sub: row.computed ? 'computed' : row.dataType,
            dataType: row.dataType,
            field: row,
          }));
  /** Labels two rows share, over the whole list so a search never changes a row. Such a row shows its code. */
  const repeated = repeatedLabels(fixedRows ? fixedRows.map((row) => row.label) : derived.map((row) => row.displayName));
  const targets = choosing ? choosing.targets.filter((t) => t.toLowerCase().includes(query)) : [];
  /** Every row's value, in the order they are drawn: what the arrow keys walk. */
  const values = choosing ? targets : rows.map((row) => row.path);
  const cursor = values.includes(highlighted) ? highlighted : (values[0] ?? '');
  const offered = fixedRows?.find((row) => row.path === value);
  const label = computed
    ? (computed.displayName ?? computed.name)
    : offered
      ? offered.label
      : resolved?.path === value
        ? resolved.label
        : null;
  const ready = options ? fixedRows !== null : fields !== null;
  const showClear = clearable && value !== '' && !readonly && !disabled;
  const breadcrumb = !options && (hops.length > 0 || choosing !== null);

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

  function activate(row: { path: string; field: FieldOption | null }): void {
    if (row.field?.traversable && !row.field.selectable) {
      descendInto(row.field);
      return;
    }
    onValueChange?.(row.path);
    // The search box clears on every selection as it does on every hop, so a caller
    // adding one field after another never has to reach for the mouse.
    setSearch('');
    setHighlighted('');
    if (closeOnSelect) setOpen(false);
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

  function onKeys(event: KeyboardEvent<HTMLDivElement>): void {
    // One value, so an empty query takes Backspace down to nothing in a press.
    const intent = pickerKeyIntent(event.key, {
      open,
      query: search,
      count: value === '' ? 0 : 1,
      focused: null,
      editable: !readonly && !disabled,
      multiple: false,
    });
    if (intent.kind === 'remove') {
      event.preventDefault();
      onValueChange?.('');
      return;
    }
    if (event.key === 'ArrowRight') {
      if (choosing) {
        if (cursor) {
          event.preventDefault();
          descend(choosing, cursor);
        }
        return;
      }
      const row = rows.find((r) => r.path === cursor)?.field;
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

  return (
    <div
      ref={ref}
      data-slot="field-picker"
      data-size={size}
      data-depth={hops.length}
      className={cn('relative flex w-full min-w-0 items-center', className)}
      {...rest}
    >
      <Popover
        open={open}
        onOpenChange={(next) => {
          const showing = !(readonly || disabled) && next;
          setOpen(showing);
          // The search box takes focus on open, with the page still: the list scrolls its
          // highlighted row into view, and a page dragged there with it is not the widget's.
          if (showing) requestAnimationFrame(() => inputRef.current?.focus({ preventScroll: true }));
        }}
      >
        <PopoverTrigger
          data-slot="field-picker-trigger"
          role="combobox"
          aria-expanded={open}
          aria-invalid={invalid ? 'true' : undefined}
          aria-disabled={disabled ? 'true' : undefined}
          data-readonly={readonly ? 'true' : undefined}
          data-value={value || undefined}
          data-empty={value === '' ? '' : undefined}
          disabled={disabled}
          title={label ?? placeholder}
          className={cn(
            PICKER_CONTROL,
            // The trigger is the focusable element itself, not a box round an input.
            'focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2',
            PICKER_TEXT_BOX[size],
            readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8',
          )}
        >
          {value === '' ? (
            <span className="text-muted-foreground truncate">{placeholder}</span>
          ) : label === null ? (
            <Skeleton className="h-4 w-32" />
          ) : (
            <span data-slot="field-picker-label" className="truncate">
              {label}
            </span>
          )}
        </PopoverTrigger>

        <PopoverContent
          data-picker="field"
          align="start"
          onKeyDown={onKeys}
          className="w-96 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
        >
          {breadcrumb ? (
            <div
              data-slot="field-picker-breadcrumb"
              className="border-border flex items-center gap-1.5 border-b px-2 py-1.5"
            >
              <button
                type="button"
                data-slot="field-picker-back"
                aria-label="Go back one level"
                title="Back (Left arrow)"
                onClick={back}
                className={PICKER_ICON_BUTTON}
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
                data-slot="field-picker-reset"
                aria-label="Back to the root type"
                title="Reset"
                onClick={reset}
                className={PICKER_ICON_BUTTON}
              >
                <RotateCcw aria-hidden="true" className="size-4" />
              </button>
            </div>
          ) : null}

          <Command
            shouldFilter={false}
            loop
            items={values}
            query={search}
            onQueryChange={setSearch}
            onItemHighlighted={(next) => setHighlighted(typeof next === 'string' ? next : '')}
          >
            <CommandInput ref={inputRef} placeholder={choosing ? 'Which type?' : searchPlaceholder} />
            <CommandList>
              {failure ? (
                <StateLine
                  state="error"
                  slotName="field-picker-error"
                  icon={TriangleAlert}
                  label={stateLine('error', { errorLabel }, failure)}
                />
              ) : choosing ? (
                <>
                  <CommandEmpty>
                    <StateLine state="empty" icon={SearchX} label={emptyLabel} pad="none" />
                  </CommandEmpty>
                  {targets.map((target) => (
                    <CommandItem
                      key={target}
                      value={target}
                      onSelect={() => descend(choosing, target)}
                      className="items-start"
                    >
                      <Link aria-hidden="true" className="mt-0.5 size-4 shrink-0 opacity-70" />
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{target}</span>
                        <span className="text-muted-foreground truncate text-xs">entity type</span>
                      </span>
                      <ChevronRight aria-hidden="true" className="size-4 shrink-0 opacity-50" />
                    </CommandItem>
                  ))}
                </>
              ) : !ready ? (
                <div
                  data-slot="field-picker-loading"
                  className="flex flex-col"
                  aria-busy="true"
                  aria-label={stateLine('loading', { loadingLabel })}
                >
                  {[0, 1, 2].map((row) => (
                    <div key={row} className="flex flex-col gap-1 px-2 py-1.5">
                      <Skeleton className="h-5 w-2/3" />
                      <Skeleton className="h-3 w-1/4" />
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    <StateLine state="empty" icon={SearchX} label={emptyLabel} pad="none" />
                  </CommandEmpty>
                  {rows.map((row) => {
                    const Glyph = ICONS[iconNameFor(row.dataType)] ?? FileText;
                    return (
                      <CommandItem
                        key={row.path}
                        value={row.path}
                        onSelect={() => activate(row)}
                        data-checked={row.path === value ? 'true' : undefined}
                        data-traversable={row.field?.traversable ? 'true' : undefined}
                        title={row.path}
                        className="items-start"
                      >
                        <Glyph aria-hidden="true" className="mt-0.5 size-4 shrink-0 opacity-70" />
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="flex min-w-0 items-center gap-1.5">
                            <span className="truncate">{row.label}</span>
                            {(showCode || repeated.has(row.label)) && row.code !== '' && row.code !== row.label ? (
                              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                                {row.code}
                              </span>
                            ) : null}
                          </span>
                          <span className="text-muted-foreground truncate text-xs">{row.sub}</span>
                        </span>
                        {row.field?.traversable ? (
                          <button
                            type="button"
                            tabIndex={-1}
                            data-slot="field-picker-descend"
                            aria-label={`Open ${row.label}`}
                            title="Open (Right arrow)"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.stopPropagation();
                              if (row.field) descendInto(row.field);
                            }}
                            className={PICKER_ICON_BUTTON}
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
        </PopoverContent>
      </Popover>

      {!readonly ? (
        <div className={cn('pointer-events-none absolute top-0 right-2 flex items-center gap-1', PICKER_TRAILING[size])}>
          {showClear ? (
            <button
              type="button"
              data-slot="field-picker-clear"
              aria-label="Clear the field"
              onClick={() => onValueChange?.('')}
              className={PICKER_ICON_BUTTON}
            >
              <X aria-hidden="true" className={PICKER_GLYPH[size]} />
            </button>
          ) : null}
          <ChevronDown aria-hidden="true" className={cn('shrink-0 opacity-50', PICKER_GLYPH[size])} />
        </div>
      ) : null}
    </div>
  );
}
