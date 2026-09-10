import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import type {
  ChipRow,
  EntityRef,
  FieldSchema,
  FilterGroup,
  PickerRow,
  PickerSummary,
  SchemaService,
  SearchFieldSpec,
  SgClient,
  StatusRecord,
  StatusService,
  WireGroup,
} from '@sg-widgets/core';
import {
  createEntitySearch,
  createSchemaService,
  createStatusService,
  entityKey,
  highlightRuns,
  isEmptyValue,
  placeholderName,
  renderKindFor,
  summariseSelection,
  withSelectedPinned,
} from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronsUpDown, Search, SearchX, TriangleAlert, X } from 'lucide-react';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { FieldValue } from '@/registry/sg/components/field-value';
import { Thumbnail } from '@/registry/sg/components/thumbnail';
import { UserAvatar } from '@/registry/sg/components/user-avatar';
import { cn } from '@/lib/utils';

export type EntityMultiPickerSize = 'sm' | 'md' | 'lg';

/** Controls follow the input ladder of `docs/design-rules.md`. */
const PICKER_BOX: Record<EntityMultiPickerSize, string> = {
  sm: 'min-h-8 px-2 py-1',
  md: 'min-h-9 px-3 py-1',
  lg: 'min-h-10 px-3 py-1',
};
const PICKER_GLYPH: Record<EntityMultiPickerSize, string> = { sm: 'size-4', md: 'size-4', lg: 'size-5' };
/** A chip sits inside the control, so it takes the step below it. */
const PICKER_CHIP: Record<EntityMultiPickerSize, EntityMultiPickerSize> = { sm: 'sm', md: 'sm', lg: 'md' };

/** The bordered field the chips and the query input sit in. */
const PICKER_CONTROL =
  'border-input bg-background has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-background has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 data-invalid:border-destructive data-invalid:ring-destructive/20 dark:data-invalid:ring-destructive/40 relative flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-md border text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 has-aria-invalid:ring-2 data-invalid:ring-2';
/** The caret inside a token field: no box of its own, it borrows the control's. */
const PICKER_INPUT =
  'placeholder:text-muted-foreground relative min-w-[2ch] flex-1 bg-transparent outline-none disabled:cursor-not-allowed';
/** The search box a summary trigger keeps in its popup instead. */
const PICKER_SEARCH_ROW = 'border-border flex items-center gap-1.5 border-b px-3';
const PICKER_SEARCH =
  'placeholder:text-muted-foreground h-9 w-full min-w-0 bg-transparent text-sm outline-none disabled:cursor-not-allowed';
/** The `+n` pill. A press on it opens the list, where the hidden ones are. */
const PICKER_PILL =
  'text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm text-xs tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2';
/** Room the `+n` pill needs beside the chips, so it is never the thing that overflows. */
const OVERFLOW_RESERVE = 40;
/** The chip row's `gap-1.5`, carried by every measured width. */
const CHIP_GAP = 6;

/** Every chip laid out, so a hidden one still reports the width it would take. */
function measureChips(row: HTMLElement): number[] {
  const drawn = [...row.querySelectorAll<HTMLElement>('[data-chip]')];
  const was = drawn.map((chip) => chip.hidden);
  for (const chip of drawn) chip.hidden = false;
  const out = drawn.map((chip) => Math.ceil(chip.getBoundingClientRect().width) + CHIP_GAP);
  drawn.forEach((chip, i) => {
    chip.hidden = was[i] ?? false;
  });
  return out;
}

/**
 * A chip row that knows its own size: the widths once per selection and once more
 * when the fonts land, the room on every resize. `ready` is false until it knows
 * both, so the row is drawn invisible rather than in the wrong place.
 */
function useChipRow(
  active: boolean,
  rowKey: string,
  controlRef: RefObject<HTMLDivElement | null>,
  chipsRef: RefObject<HTMLSpanElement | null>,
): { fit: ChipRow | undefined; ready: boolean } {
  const [available, setAvailable] = useState(0);
  const [widths, setWidths] = useState<number[]>([]);
  const [measured, setMeasured] = useState(false);

  useLayoutEffect(() => {
    const control = controlRef.current;
    if (!active || !control) return;
    const room = (): void => {
      const style = getComputedStyle(control);
      setAvailable(control.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    };
    const observer = new ResizeObserver(room);
    observer.observe(control);
    room();
    return () => observer.disconnect();
  }, [active, controlRef]);

  useLayoutEffect(() => {
    const row = chipsRef.current;
    if (!active || !row) {
      setMeasured(false);
      return;
    }
    setWidths(measureChips(row));
    setMeasured(true);
    let live = true;
    // A chip drawn in the fallback font is not the chip the row ends up with.
    void document.fonts?.ready.then(() => {
      const current = chipsRef.current;
      if (live && current) setWidths(measureChips(current));
    });
    return () => {
      live = false;
    };
  }, [active, rowKey, chipsRef]);

  const settled = measured && available > 0;
  return {
    fit: active && settled ? { widths, available, reserve: OVERFLOW_RESERVE } : undefined,
    ready: !active || settled,
  };
}
/** The popup surface, matching the popover item of each registry. */
const PICKER_POPUP =
  'bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 ring-foreground/10 z-50 w-96 max-w-[calc(100vw-2rem)] origin-(--transform-origin) overflow-hidden rounded-lg shadow-md ring-1 outline-hidden duration-100';
/** The scrolling list inside the popup. */
const PICKER_LIST = 'no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto p-1 outline-none';
/** One row. Highlight and selection share one colour, per `docs/design-rules.md`. */
const PICKER_ROW =
  'data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';
/** The centred line every empty, loading and error state uses. */
const PICKER_NOTE = 'flex items-center justify-center gap-1.5 py-6 text-center text-sm';
/** The clear control, shared by every picker in this registry. */
const PICKER_ICON_BUTTON =
  'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]';

/** The row a press on the last row of a page carries, rather than an entity key. */
const LOAD_MORE = '__load-more';

interface SecondaryPlan {
  /** The secondary field's schema, per searched type. */
  fields: Record<string, FieldSchema | undefined>;
  /** `Status` rows by code, read only when the field is a status (probe 010). */
  statuses: Record<string, StatusRecord> | null;
}

const NO_SECONDARY: SecondaryPlan = { fields: {}, statuses: null };

/**
 * What the secondary column draws with: one field read per searched type through the
 * cached schema service, as a store, so the read starts in a memo over the props and
 * never in an effect with a "last seen" key.
 */
function secondaryPlanStore(
  schema: SchemaService,
  statusTable: StatusService,
  types: string[],
  name: string | undefined,
  onError: (error: Error) => void,
) {
  const listeners = new Set<() => void>();
  let snapshot = NO_SECONDARY;
  if (name) {
    void Promise.all(types.map((type) => schema.field(type, name)))
      .then(async (found) => {
        const fields = Object.fromEntries(types.map((type, i) => [type, found[i]]));
        const status = found.some((field) => field && renderKindFor(field.dataType) === 'status');
        snapshot = { fields, statuses: status ? Object.fromEntries(await statusTable.byCode()) : null };
        for (const listener of listeners) listener();
      })
      .catch((error: unknown) => onError(error instanceof Error ? error : new Error(String(error))));
  }
  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: (): SecondaryPlan => snapshot,
  };
}

/** Everything both entity pickers take. They differ only in the shape of the value. */
export interface EntityMultiPickerBaseProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onError'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** Types to search. One for a homogeneous picker, several for a polymorphic one. */
  entityTypes: string[];
  /** A cached client. Every read goes through it. */
  client: SgClient;
  /** Field holding the row label. Defaults to the display-name chain. */
  labelField?: string;
  /**
   * Extra fields the query is matched against, on top of the display-name chain. A
   * function is called with the query, so a field is searched only when it suits it.
   */
  searchFields?: SearchFieldSpec[] | ((query: string) => SearchFieldSpec[]);
  /** Field shown right-aligned, drawn by its data type. Nothing is shown without it. */
  secondaryField?: string;
  /** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
  secondary?: (row: PickerRow) => string;
  /** Field shown under the label. Defaults to the type when several types are searched. */
  subLabelField?: string;
  subLabel?: (row: PickerRow) => string;
  /** Field holding the thumbnail URL. `false` hides the leading slot. */
  thumbnail?: string | false;
  roundThumbnail?: boolean;
  /** Show the row's `code` beside the label when the two differ. */
  showCode?: boolean;
  /** The site the status sprite is served from, for a secondary that is a status. */
  siteUrl?: string;
  /** Extra fields to request, so a caller's own sub-label or secondary can be read. */
  fields?: string[];
  /** Pre-filter merged into every search with `and`. */
  filters?: FilterGroup | WireGroup | null;
  /** Sugar for a project condition. Skipped on a type with no project link. */
  projectId?: number;
  /** Rows to keep out of the results. Pushed into the server filter as `id not_in`. */
  exclude?: EntityRef[];
  minQueryLength?: number;
  pageSize?: number;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** What the control shows for the selection. */
  summary?: PickerSummary;
  /** Chips drawn before the rest becomes `+n`. `0` draws every chip. */
  max?: number;
  size?: EntityMultiPickerSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  debounceMs?: number;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export interface EntityMultiPickerProps extends EntityMultiPickerBaseProps {
  /** The chosen rows. Bare `{type, id}` members are resolved on mount. */
  value?: EntityRef[];
  onValueChange?: (value: EntityRef[], rows: PickerRow[]) => void;
}

/**
 * Several entities, chosen by server-side search.
 *
 * The same request model as the single picker: one `contains` condition per word,
 * `or`'d across the type's display-name fields, one `POST /entity/<type>/_search`
 * per searched type, no filtering in the browser, abandoned responses dropped, and
 * the same search without the name condition while nothing is typed. The option list
 * is the results followed by any selected row they do not hold, so a selection is
 * always there to be unticked, and every row is held under `Type:id`.
 *
 * The secondary column is drawn by the field's data type through FieldValue, so a
 * status is a badge and a date is formatted.
 */
export function EntityMultiPicker({
  entityTypes,
  client,
  value = [],
  onValueChange,
  labelField,
  searchFields,
  secondaryField,
  secondary,
  subLabelField,
  subLabel,
  thumbnail = 'image',
  roundThumbnail = false,
  showCode = false,
  siteUrl,
  fields,
  filters = null,
  projectId,
  exclude,
  minQueryLength = 0,
  pageSize = 20,
  placeholder = 'Search for entities',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No entity matches.',
  summary = 'ellipsis',
  max = 0,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  clearable = true,
  debounceMs = 250,
  open: openProp,
  onOpenChange,
  onError,
  className,
  ref,
  ...rest
}: EntityMultiPickerProps) {
  const errorRef = useRef(onError);
  errorRef.current = onError;

  // One schema service for the widget. The controller shares it, so a type's fields
  // are read once however many times they are asked for.
  const schema = useMemo(() => createSchemaService(client), [client]);
  const statusTable = useMemo(() => createStatusService(client), [client]);
  const secondaryStore = useMemo(
    () =>
      secondaryPlanStore(schema, statusTable, entityTypes, secondaryField, (error) =>
        errorRef.current?.(error),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema, statusTable, entityTypes.join(','), secondaryField],
  );

  const [search] = useState(() =>
    createEntitySearch({
      client,
      schema,
      entityTypes,
      labelField,
      searchFields,
      secondaryField,
      subLabelField,
      thumbnail,
      fields,
      filters,
      projectId,
      exclude,
      minQueryLength,
      pageSize,
      debounceMs,
      onError: (error: Error) => errorRef.current?.(error),
    }),
  );
  const state = useSyncExternalStore(search.subscribe, () => search.state, () => search.state);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState('');
  const controlRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chipsRef = useRef<HTMLSpanElement | null>(null);
  /** A press on the load-more row is not a selection, and must not close the popup. */
  const pagingRef = useRef(false);

  // The serialised request, so a caller passing fresh array literals every render
  // does not restart the search.
  const shape = JSON.stringify([
    entityTypes,
    labelField,
    searchFields,
    secondaryField,
    subLabelField,
    thumbnail,
    fields,
    filters,
    projectId,
    exclude,
    minQueryLength,
    pageSize,
    debounceMs,
  ]);

  useEffect(() => {
    search.update({
      client,
      schema,
      entityTypes,
      labelField,
      searchFields,
      secondaryField,
      subLabelField,
      thumbnail,
      fields,
      filters,
      projectId,
      exclude,
      minQueryLength,
      pageSize,
      debounceMs,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, client, schema, shape]);

  useEffect(() => () => search.dispose(), [search]);

  // The search runs for an open picker only: the list is what the popup shows, and
  // a closed one has nobody to show it to.
  useEffect(() => {
    if (open) search.setQuery(query);
  }, [search, open, query]);

  // Bare references are resolved by one batched read per type, latched on the
  // references themselves, so a later set of bare ones resolves too.
  useEffect(() => {
    if (value.length > 0) search.hydrate(value);
  }, [search, value]);

  const selectedKeys = value.map(entityKey);
  const selected = new Set(selectedKeys);
  const chips = value.map((ref) => {
    const row = search.known.get(entityKey(ref));
    return {
      ref,
      entity: { type: ref.type, id: ref.id, name: row?.name || ref.name || placeholderName(ref) },
      thumbnail: row ? thumbOf(row) : null,
    };
  });
  /**
   * A chip control is a token field, with the caret beside the chips. A summary
   * control is a trigger, and keeps its search box at the top of the popup instead.
   */
  const inline = summary === 'chips';
  /** What the chips look like, so a change to any of it re-measures the row. */
  const rowKey = `${size}|${summary}|${chips.map((chip) => `${chip.entity.name}:${chip.thumbnail ?? ''}`).join(', ')}`;
  const row = useChipRow(summary === 'ellipsis', rowKey, controlRef, chipsRef);
  const plan = summariseSelection(chips, (chip) => chip.entity.name, { summary, max, fit: row.fit });
  // Search results first, selected rows appended, so a selection stays deselectable
  // whatever the query, and even when a search returns nothing at all.
  const options = withSelectedPinned(state.rows, value, search.known);
  const polymorphic = entityTypes.length > 1;
  const hasSubLabel = Boolean(subLabelField || subLabel);
  const interactive = !disabled && !readonly;
  const showClear = clearable && value.length > 0 && interactive;
  /** An id is a code, and codes are the mono treatment of `docs/design-rules.md`. */
  const secondaryIsId = secondaryField === 'id';
  const secondaryPlan = useSyncExternalStore(
    secondaryStore.subscribe,
    secondaryStore.snapshot,
    secondaryStore.snapshot,
  );

  /** A press anywhere in the field opens the list and puts the caret in the input. */
  function openFromControl(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!interactive) return;
    const target = event.target as HTMLElement | null;
    // The chip's remove control, the clear control and the chevron own their own press.
    if (target?.closest('button')) return;
    if (inline && target !== inputRef.current) {
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
    }
    setOpen(true);
  }

  // A summary trigger has no caret of its own, so the popup's search box takes it.
  useEffect(() => {
    if (!open || inline) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [open, inline]);

  function thumbOf(row: PickerRow): string | null {
    if (thumbnail === false) return null;
    const raw = row.values[thumbnail ?? 'image'];
    return typeof raw === 'string' ? raw : null;
  }

  function subLabelOf(row: PickerRow): string {
    if (subLabel) return subLabel(row);
    if (subLabelField) {
      const raw = row.values[subLabelField];
      return raw === null || raw === undefined ? '' : String(raw);
    }
    return '';
  }

  /** The programmatic name, when it says something the label does not. */
  function codeOf(row: PickerRow): string {
    if (!showCode) return '';
    const raw = row.values['code'];
    return typeof raw === 'string' && raw.length > 0 && raw !== row.name ? raw : '';
  }

  /** The id is on the row itself, not among the attributes a read returns. */
  function secondaryValue(row: PickerRow): unknown {
    if (!secondaryField) return null;
    return secondaryField === 'id' ? row.id : row.values[secondaryField];
  }

  function secondaryType(row: PickerRow): string {
    return secondaryPlan.fields[row.type]?.dataType ?? (secondaryIsId ? 'number' : 'text');
  }

  function isPerson(row: PickerRow): boolean {
    return row.type === 'HumanUser' || row.type === 'ApiUser';
  }

  function rowFor(key: string): PickerRow | null {
    return options.find((option) => entityKey(option) === key) ?? search.known.get(key) ?? null;
  }

  function emit(refs: EntityRef[]): void {
    onValueChange?.(
      refs,
      refs.map(
        (ref) =>
          search.known.get(entityKey(ref)) ?? {
            type: ref.type,
            id: ref.id,
            name: ref.name || placeholderName(ref),
            values: {},
          },
      ),
    );
  }

  function choose(keys: string[]): void {
    if (keys.includes(LOAD_MORE)) {
      pagingRef.current = true;
      search.loadMore();
      return;
    }
    const rows = keys.map(rowFor).filter((row): row is PickerRow => row !== null);
    search.remember(rows);
    emit(rows.map((row) => ({ type: row.type, id: row.id, name: row.name })));
  }

  const keys = [...options.map(entityKey), ...(state.hasMore ? [LOAD_MORE] : [])];
  const byKey = new Map(options.map((row) => [entityKey(row), row]));

  let note: ReactNode = null;
  if (state.error) {
    note = (
      <div data-slot="entity-picker-error" className={cn(PICKER_NOTE, 'text-destructive')}>
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{state.error.message}</span>
      </div>
    );
  } else if (state.loading && options.length === 0) {
    note = (
      <div data-slot="entity-picker-loading" className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    );
  } else if (options.length === 0) {
    note = (
      <div data-slot="entity-picker-empty" className={cn(PICKER_NOTE, 'text-muted-foreground')}>
        <SearchX aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{emptyLabel}</span>
      </div>
    );
  }

  function renderRow(key: string): ReactNode {
    if (key === LOAD_MORE) {
      return (
        <ComboboxPrimitive.Item
          key={LOAD_MORE}
          data-slot="entity-picker-more"
          value={LOAD_MORE}
          className={cn(PICKER_ROW, 'text-muted-foreground justify-center text-xs')}
        >
          {state.loading ? 'Loading…' : 'Load more'}
        </ComboboxPrimitive.Item>
      );
    }
    const row = byKey.get(key);
    if (!row) return null;
    const chosen = selected.has(key);
    const sub = subLabelOf(row);
    const code = codeOf(row);
    const custom = secondary ? secondary(row) : !secondaryField && polymorphic ? row.type : '';
    const raw = secondaryValue(row);
    return (
      <ComboboxPrimitive.Item
        key={key}
        data-slot="entity-picker-option"
        data-entity-type={row.type}
        data-entity-id={row.id}
        data-selected-entity={chosen ? 'true' : undefined}
        value={key}
        className={cn(PICKER_ROW, hasSubLabel && 'items-start')}
      >
        <span data-slot="entity-picker-check" className="flex h-5 shrink-0 items-center">
          <Checkbox checked={chosen} tabIndex={-1} aria-hidden="true" className="pointer-events-none" />
        </span>
        {thumbnail === false ? null : (
          <span data-slot="entity-picker-leading" className="flex shrink-0 items-center">
            {isPerson(row) ? (
              <UserAvatar
                name={row.name}
                image={thumbOf(row)}
                size={size}
                apiUser={row.type === 'ApiUser'}
                inactive={row.values['sg_status_list'] === 'dis'}
              />
            ) : (
              <Thumbnail
                src={thumbOf(row)}
                aspect="square"
                size={size}
                className={roundThumbnail ? 'rounded-full' : undefined}
              />
            )}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span data-slot="entity-picker-label" className="flex min-w-0 items-center gap-1.5" title={row.name}>
            <span className="truncate">
              {highlightRuns(row.name, state.query).map((run, i) => (
                <span key={i} className={run.match ? 'font-semibold' : undefined}>
                  {run.text}
                </span>
              ))}
            </span>
            {code ? (
              <span data-slot="entity-picker-code" className="text-muted-foreground shrink-0 font-mono text-xs">
                {code}
              </span>
            ) : null}
          </span>
          {sub ? (
            // Highlighted too, so a row matched on its login or its email shows why.
            <span data-slot="entity-picker-sub-label" className="text-muted-foreground truncate text-xs">
              {highlightRuns(sub, state.query).map((run, i) => (
                <span key={i} className={run.match ? 'font-semibold' : undefined}>
                  {run.text}
                </span>
              ))}
            </span>
          ) : null}
        </span>
        {custom ? (
          <span data-slot="entity-picker-secondary" className="text-muted-foreground shrink-0 text-xs">
            {custom}
          </span>
        ) : secondaryField && !isEmptyValue(raw) ? (
          <span
            data-slot="entity-picker-secondary"
            className={cn(
              'text-muted-foreground flex shrink-0 items-center text-xs',
              secondaryIsId && 'font-mono tabular-nums',
            )}
          >
            <FieldValue
              value={raw}
              dataType={secondaryType(row)}
              field={secondaryPlan.fields[row.type] ?? null}
              statuses={secondaryPlan.statuses}
              siteUrl={siteUrl}
              className="w-auto justify-end text-xs"
            />
          </span>
        ) : null}
      </ComboboxPrimitive.Item>
    );
  }

  return (
    <div
      ref={ref}
      data-slot="entity-picker"
      data-size={size}
      data-multiple="true"
      data-summary={summary}
      className={cn(
        'relative flex w-full min-w-0 items-center',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      {...rest}
    >
      <ComboboxPrimitive.Root
        multiple
        items={keys}
        filter={null}
        openOnInputClick={false}
        autoHighlight
        disabled={disabled}
        value={selectedKeys}
        onValueChange={(next) => choose(next)}
        inputValue={query}
        onInputValueChange={(next, details) => {
          if (details.reason === 'item-press') return;
          setQuery(next);
        }}
        open={open}
        onOpenChange={(next, details) => {
          // A press on a row is a tick, not a commit: the popup stays open so several
          // rows can be ticked from one query, and paging is not a selection either.
          if (!next && (details.reason === 'item-press' || pagingRef.current)) {
            pagingRef.current = false;
            details.cancel();
            return;
          }
          // A summary control holds no input, so the click that opened it lands outside
          // the popup a moment later; a press on the control is never a dismissal.
          if (!next && details.reason === 'outside-press') {
            const target = (details.event as Event | undefined)?.target as Node | null | undefined;
            if (target && controlRef.current?.contains(target)) {
              details.cancel();
              return;
            }
          }
          setOpen(interactive ? next : false);
          if (!next) setQuery('');
        }}
      >
        <div
          ref={controlRef}
          data-slot="entity-picker-control"
      onPointerDown={openFromControl}
      role="group"
          aria-disabled={disabled ? 'true' : undefined}
          data-invalid={invalid && !inline ? 'true' : undefined}
          data-readonly={readonly ? 'true' : undefined}
          title={plan.title || placeholder}
          className={cn(PICKER_CONTROL, PICKER_BOX[size], plan.oneLine && 'flex-nowrap', readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
        >
          {value.length > 0 ? (
            <span
              data-slot="entity-picker-value"
              className="flex min-w-0 items-center gap-1.5"
            >
              {summary === 'count' ? (
                <span data-slot="entity-picker-count" className="truncate">
                  {plan.countLabel}
                </span>
              ) : (
                /*
                  Whole chips only: the row measures itself and hides the ones that do not
                  fit, so nothing is ever cut in half. `+n` follows the last one drawn.
                  No stylesheet here gives `[hidden]` a display rule, so the row does.
                */
                <span
                  ref={chipsRef}
                  data-slot="entity-picker-chips"
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 [&>[hidden]]:hidden',
                    plan.oneLine ? 'flex-nowrap overflow-hidden' : 'flex-wrap',
                    row.ready ? undefined : 'invisible',
                  )}
                >
                  {chips.map((chip, index) => (
                    <EntityChip
                      key={entityKey(chip.ref)}
                      entity={chip.entity}
                      thumbnail={chip.thumbnail}
                      size={PICKER_CHIP[size]}
                      removable={interactive}
                      onRemove={() => emit(value.filter((other) => entityKey(other) !== entityKey(chip.ref)))}
                      data-chip=""
                      hidden={row.ready && index >= plan.shown.length}
                      className="shrink-0"
                    />
                  ))}
                  {plan.overflow > 0 ? (
                    <button
                      type="button"
                      data-slot="entity-picker-overflow"
                      title={plan.title}
                      aria-label={`Show all ${chips.length} selected`}
                      onClick={() => setOpen(true)}
                      className={PICKER_PILL}
                    >
                      +{plan.overflow}
                    </button>
                  ) : null}
                </span>
              )}
            </span>
          ) : inline ? null : (
            <span data-slot="entity-picker-placeholder" className="text-muted-foreground truncate">
              {placeholder}
            </span>
          )}
          {inline ? (
            <ComboboxPrimitive.Input
              ref={inputRef}
              data-slot="entity-picker-input"
              aria-invalid={invalid ? 'true' : undefined}
              aria-label={placeholder}
              readOnly={readonly || undefined}
              placeholder={value.length > 0 ? '' : placeholder}
              className={PICKER_INPUT}
            />
          ) : null}
        </div>

        {/*
          Fixed, and anchored to the whole control rather than to the input: the list
          scrolls its highlighted row into view on mount, and an absolute wrapper still
          at the page origin would drag the page there with it.
        */}
        <ComboboxPrimitive.Portal>
          <ComboboxPrimitive.Positioner
            positionMethod="fixed"
            anchor={controlRef}
            align="start"
            sideOffset={4}
            className="isolate z-50"
          >
            <ComboboxPrimitive.Popup
              data-picker="entity-multi"
              data-slot="entity-picker-content"
              className={PICKER_POPUP}
            >
              {inline ? null : (
                <div data-slot="entity-picker-search" className={PICKER_SEARCH_ROW}>
                  <Search aria-hidden="true" className="size-4 shrink-0 opacity-50" />
                  <ComboboxPrimitive.Input
                    ref={inputRef}
                    data-slot="entity-picker-input"
                    aria-label={searchPlaceholder}
                    placeholder={searchPlaceholder}
                    className={PICKER_SEARCH}
                  />
                </div>
              )}
              <ComboboxPrimitive.List data-slot="entity-picker-list" className={PICKER_LIST}>
                {note ?? ((key: string) => renderRow(key))}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>

        {readonly ? null : (
          <div className="pointer-events-none absolute right-2 flex items-center gap-1">
            {showClear ? (
              <button
                type="button"
                data-slot="entity-picker-clear"
                aria-label="Clear the selection"
                onClick={() => {
                  emit([]);
                  if (inline) inputRef.current?.focus({ preventScroll: true });
                }}
                className={PICKER_ICON_BUTTON}
              >
                <X aria-hidden="true" className={PICKER_GLYPH[size]} />
              </button>
            ) : null}
            <ComboboxPrimitive.Trigger
              data-slot="entity-picker-trigger"
              aria-label="Show the options"
              disabled={disabled}
              className="focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            >
              <ChevronsUpDown aria-hidden="true" className={cn('shrink-0 opacity-50', PICKER_GLYPH[size])} />
            </ComboboxPrimitive.Trigger>
          </div>
        )}
      </ComboboxPrimitive.Root>
    </div>
  );
}
