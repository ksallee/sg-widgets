import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type {
  EntityRef,
  FieldSpec,
  FilterGroup,
  PickerRow as PickerRowData,
  SearchFieldSpec,
  SgContext,
  WireGroup,
} from '@sg-widgets/core';
import {
  createEntitySearch,
  entityKey,
  holdsArmed,
  NO_MATCH_LABEL,
  pathOf,
  pickerKeyIntent,
  placeholderName,
  rowThumbnail,
  scrollHighlightedIntoView,
  stateLine,
  withSelectedPinned,
} from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, SearchX, TriangleAlert, X } from 'lucide-react';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import {
  PICKER_ARMED,
  PICKER_BOX,
  PICKER_CHIP,
  PICKER_CONTROL,
  PICKER_GLYPH,
  PICKER_TRAILING,
  PICKER_ICON_BUTTON,
  PICKER_INPUT,
  PICKER_LIST,
  PICKER_POPUP,
  PICKER_ROW,
} from '@/registry/sg/components/picker-classes';
import { PickerRow } from '@/registry/sg/components/picker-row';
import { StateLine } from '@/registry/sg/components/state-line';
import { cn } from '@/lib/utils';

export type EntityPickerSize = 'sm' | 'md' | 'lg';

/** The row a press on the last row of a page carries, rather than an entity key. */
const LOAD_MORE = '__load-more';

/** Everything both entity pickers take. They differ only in the shape of the value. */
export interface EntityPickerBaseProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onError'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** Types to search. One for a homogeneous picker, several for a polymorphic one. */
  entityTypes: string[];
  /** The widget context. Every read goes through it, so widgets on a page share one cache. */
  context: SgContext;
  /** Field holding the row label. Defaults to the display-name chain. */
  labelField?: string;
  /**
   * Extra fields the query is matched against, on top of the display-name chain. A
   * function is called with the query, so a field is searched only when it suits it.
   */
  searchFields?: SearchFieldSpec[] | ((query: string) => SearchFieldSpec[]);
  /** Field shown right-aligned, drawn by its data type. A path, or a resolved column. */
  secondaryField?: FieldSpec | null;
  /** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
  secondary?: (row: PickerRowData) => string;
  /** Field shown under the label: a path, or a resolved column. */
  subLabelField?: FieldSpec | null;
  /** The muted line of the caller's own making. Wins over `subLabelField`. */
  subLabel?: (row: PickerRowData) => string;
  /** Field holding the thumbnail URL. `false` hides the leading slot. */
  thumbnail?: string | false;
  roundThumbnail?: boolean;
  /** Show the row's `code` beside the label when the two differ. */
  showCode?: boolean;
  /** The site the status sprite is served from, for a secondary that is a status. Defaults to the context's. */
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
  /** Shown when the query matches nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
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
  onValueChange?: (value: EntityRef | null, row: PickerRowData | null) => void;
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
  context,
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
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
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

  // The context's own services, so every widget on the page shares one schema read
  // and one status table.
  const schema = context.schema;
  const site = siteUrl ?? context.siteUrl;

  const [search] = useState(() =>
    createEntitySearch({
      client: context.client,
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
    if (!next) setArmedChip(false);
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState('');
  /** True once a Backspace has highlighted the chip. The next one clears it. */
  const [armedChip, setArmedChip] = useState(false);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
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
      client: context.client,
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
  }, [search, context.client, schema, shape]);

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

  /** The caller's own sub-label. Absent, the row reads `subLabelField` itself. */
  function subLabelOf(row: PickerRowData): string | undefined {
    return subLabel ? subLabel(row) : undefined;
  }

  /** The caller's own secondary, and the type on a polymorphic list that names no field. */
  function customSecondary(row: PickerRowData): string | undefined {
    if (secondary) return secondary(row);
    return !pathOf(secondaryField) && polymorphic ? row.type : undefined;
  }

  // Nothing to arm once the value is gone.
  const armed = armedChip && Boolean(value);

  function clear(): void {
    onValueChange?.(null, null);
    inputRef.current?.focus({ preventScroll: true });
  }

  /**
   * Backspace, Escape and the arrows. The primitive's own handler runs after this
   * one, so a key this picker owns is prevented rather than shared.
   */
  function onKey(event: React.KeyboardEvent<HTMLInputElement>): void {
    const intent = pickerKeyIntent(event.key, {
      open,
      query,
      count: value ? 1 : 0,
      armed: armed ? 0 : null,
      editable: interactive,
    });
    if (!holdsArmed(event.key)) setArmedChip(false);
    switch (intent.kind) {
      case 'dismiss':
        setOpen(false);
        setQuery('');
        return;
      case 'arm':
        event.preventDefault();
        setArmedChip(true);
        return;
      case 'remove':
        event.preventDefault();
        clear();
        return;
      case 'follow':
        // The highlight moves after this handler, so the list follows it a frame later.
        requestAnimationFrame(() => scrollHighlightedIntoView(listRef.current));
        return;
      default:
        // A closed picker leaves Escape alone: the primitive would clear the value.
        if (event.key === 'Escape') {
          (event as { preventBaseUIHandler?: () => void }).preventBaseUIHandler?.();
        }
    }
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

  // A load-more page appends rows under the highlighted one, and a new query
  // replaces them all; either way the list follows the highlight.
  useEffect(() => {
    if (!open) return;
    scrollHighlightedIntoView(listRef.current);
  }, [open, state.rows.length]);

  const loadingText = stateLine('loading', { loadingLabel });
  let note: ReactNode = null;
  if (state.error) {
    note = (
      <StateLine
        state="error"
        slotName="entity-picker-error"
        icon={TriangleAlert}
        label={stateLine('error', { errorLabel }, state.error.message)}
      />
    );
  } else if (state.loading && options.length === 0) {
    note = (
      <div
        data-slot="entity-picker-loading"
        className="flex flex-col gap-2"
        aria-busy="true"
        aria-label={loadingText}
      >
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    );
  } else if (options.length === 0) {
    note = (
      <StateLine state="empty" slotName="entity-picker-empty" icon={SearchX} label={emptyLabel} />
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
          {state.loading ? loadingText : 'Load more'}
        </ComboboxPrimitive.Item>
      );
    }
    const row = byKey.get(key);
    if (!row) return null;
    const chosen = selectedKey === key;
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
        <PickerRow
          row={row}
          query={state.query}
          thumbnail={thumbnail}
          roundThumbnail={roundThumbnail}
          showCode={showCode}
          subLabelField={subLabelField}
          subLabel={subLabelOf(row)}
          secondaryField={secondaryField}
          secondary={customSecondary(row)}
          size={size}
          context={context}
          siteUrl={site}
        />
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
        // Down stops at the last row rather than wrapping, as it does on Bits UI.
        loopFocus={false}
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
          data-empty={chipEntity ? undefined : ''}
          title={chipEntity?.name ?? placeholder}
          className={cn(PICKER_CONTROL, PICKER_BOX[size], readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
        >
          {chipEntity ? (
            <span data-slot="entity-picker-value" className="flex min-w-0 items-center gap-1.5">
              <EntityChip
                entity={chipEntity}
                thumbnail={selectedRow ? rowThumbnail(selectedRow.values, { thumbnail }) : null}
                size={PICKER_CHIP[size]}
                context={context}
                siteUrl={site}
                data-armed={armed ? 'true' : undefined}
                className={armed ? PICKER_ARMED : undefined}
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
            onKeyDown={onKey}
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
              <ComboboxPrimitive.List ref={listRef} data-slot="entity-picker-list" className={PICKER_LIST}>
                {note ?? ((key: string) => renderRow(key))}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>

        {readonly ? null : (
          <div className={cn('pointer-events-none absolute top-0 right-2 flex items-center gap-1', PICKER_TRAILING[size])}>
            {showClear ? (
              <button
                type="button"
                data-slot="entity-picker-clear"
                aria-label="Clear the selection"
                onClick={clear}
                className={PICKER_ICON_BUTTON}
              >
                <X aria-hidden="true" className={PICKER_GLYPH[size]} />
              </button>
            ) : null}
            <ComboboxPrimitive.Trigger
              data-slot="entity-picker-trigger"
              aria-label="Show the options"
              disabled={disabled}
              className={PICKER_ICON_BUTTON}
            >
              <ChevronDown aria-hidden="true" className={PICKER_GLYPH[size]} />
            </ComboboxPrimitive.Trigger>
          </div>
        )}
      </ComboboxPrimitive.Root>
    </div>
  );
}
