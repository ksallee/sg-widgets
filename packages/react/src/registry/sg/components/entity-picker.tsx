import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type {
  EntityRef,
  FieldSchema,
  FilterGroup,
  PickerRow,
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
  withSelectedPinned,
} from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronsUpDown, SearchX, TriangleAlert, X } from 'lucide-react';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { FieldValue } from '@/registry/sg/components/field-value';
import { Thumbnail } from '@/registry/sg/components/thumbnail';
import { UserAvatar } from '@/registry/sg/components/user-avatar';
import { cn } from '@/lib/utils';

export type EntityPickerSize = 'sm' | 'md' | 'lg';

/** Controls follow the input ladder of `docs/design-rules.md`. */
const PICKER_BOX: Record<EntityPickerSize, string> = {
  sm: 'min-h-8 px-2 py-1',
  md: 'min-h-9 px-3 py-1',
  lg: 'min-h-10 px-3 py-1',
};
const PICKER_GLYPH: Record<EntityPickerSize, string> = { sm: 'size-4', md: 'size-4', lg: 'size-5' };
/** A chip sits inside the control, so it takes the step below it. */
const PICKER_CHIP: Record<EntityPickerSize, EntityPickerSize> = { sm: 'sm', md: 'sm', lg: 'md' };

/** The bordered field the chips and the query input sit in. */
const PICKER_CONTROL =
  'border-input bg-background has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-background has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 relative flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-md border text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 has-aria-invalid:ring-2';
/** The combobox input: no box of its own, it borrows the control's. */
const PICKER_INPUT =
  'placeholder:text-muted-foreground relative min-w-8 flex-1 bg-transparent outline-none disabled:cursor-not-allowed';
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
export interface EntityPickerBaseProps
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
  size?: EntityPickerSize;
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

export interface EntityPickerProps extends EntityPickerBaseProps {
  /** The chosen row. A bare `{type, id}` is resolved on mount. */
  value?: EntityRef | null;
  onValueChange?: (value: EntityRef | null, row: PickerRow | null) => void;
}

/**
 * One entity, chosen by server-side search.
 *
 * A query past `minQueryLength` becomes one `contains` condition per word, `or`'d
 * across the type's display-name fields, and goes to `POST /entity/<type>/_search`
 * once per searched type. Under it the same search runs without the name condition,
 * so an open picker lists the rows worked on most recently. The combobox does no
 * filtering of its own: the server is the only authority on what matches. A response
 * from an abandoned query is dropped rather than shown, reads come from the query
 * cache, and every row is held under `Type:id` because a numeric id alone collides
 * across types.
 *
 * The secondary column is drawn by the field's data type through FieldValue, so a
 * status is a badge and a date is formatted.
 */
export function EntityPicker({
  entityTypes,
  client,
  value = null,
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
  placeholder = 'Search for an entity',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No entity matches.',
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
}: EntityPickerProps) {
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

  // A bare reference is resolved by one batched read, latched on the reference
  // itself, so swapping in a different bare one resolves that one too.
  useEffect(() => {
    if (value) search.hydrate([value]);
  }, [search, value]);

  const selectedRow = value ? (search.known.get(entityKey(value)) ?? null) : null;
  const chipEntity = value
    ? { type: value.type, id: value.id, name: selectedRow?.name || value.name || placeholderName(value) }
    : null;
  const options = withSelectedPinned(state.rows, value ? [value] : [], search.known);
  const polymorphic = entityTypes.length > 1;
  const hasSubLabel = Boolean(subLabelField || subLabel);
  const interactive = !disabled && !readonly;
  const showClear = clearable && Boolean(value) && interactive;
  const selectedKey = value ? entityKey(value) : '';
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
    if (target !== inputRef.current) {
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
    }
    setOpen(true);
  }

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

  function choose(key: string): void {
    if (key === LOAD_MORE) {
      pagingRef.current = true;
      search.loadMore();
      return;
    }
    const row = options.find((option) => entityKey(option) === key);
    if (!row) return;
    search.remember([row]);
    onValueChange?.({ type: row.type, id: row.id, name: row.name }, row);
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
    const chosen = selectedKey === key;
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
        data-checked={chosen ? 'true' : undefined}
        value={key}
        className={cn(PICKER_ROW, hasSubLabel && 'items-start')}
      >
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
      data-multiple="false"
      className={cn(
        'relative flex w-full min-w-0 items-center',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      {...rest}
    >
      <ComboboxPrimitive.Root
        items={keys}
        filter={null}
        openOnInputClick={false}
        autoHighlight
        disabled={disabled}
        value={selectedKey || null}
        onValueChange={(next) => choose(next ?? '')}
        // The chip shows the selection; the input never carries the item's key as text.
        itemToStringLabel={() => ''}
        inputValue={query}
        onInputValueChange={(next, details) => {
          if (details.reason === 'item-press') return;
          setQuery(next);
        }}
        open={open}
        onOpenChange={(next, details) => {
          // The load-more row is a press on an item, which the primitive reads as a
          // selection and closes on. Paging is not a selection.
          if (!next && pagingRef.current) {
            pagingRef.current = false;
            details.cancel();
            return;
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
          data-readonly={readonly ? 'true' : undefined}
          title={chipEntity?.name ?? placeholder}
          className={cn(PICKER_CONTROL, PICKER_BOX[size], readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
        >
          {chipEntity ? (
            <span data-slot="entity-picker-value" className="flex min-w-0 items-center gap-1.5">
              <EntityChip
                entity={chipEntity}
                thumbnail={selectedRow ? thumbOf(selectedRow) : null}
                size={PICKER_CHIP[size]}
              />
            </span>
          ) : null}
          <ComboboxPrimitive.Input
            ref={inputRef}
            data-slot="entity-picker-input"
            aria-invalid={invalid ? 'true' : undefined}
            aria-label={placeholder}
            readOnly={readonly || undefined}
            placeholder={chipEntity ? searchPlaceholder : placeholder}
            className={PICKER_INPUT}
          />
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
            <ComboboxPrimitive.Popup data-picker="entity" data-slot="entity-picker-content" className={PICKER_POPUP}>
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
                  onValueChange?.(null, null);
                  inputRef.current?.focus({ preventScroll: true });
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
              className="pointer-events-auto shrink-0 outline-none"
            >
              <ChevronsUpDown aria-hidden="true" className={cn('shrink-0 opacity-50', PICKER_GLYPH[size])} />
            </ComboboxPrimitive.Trigger>
          </div>
        )}
      </ComboboxPrimitive.Root>
    </div>
  );
}
