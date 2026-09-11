import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import type {
  ChipRow,
  EntityRef,
  FieldSpec,
  FilterGroup,
  PickerRow as PickerRowData,
  PickerSummary,
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
  summariseSelection,
  withSelectedPinned,
} from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, Search, SearchX, TriangleAlert, X } from 'lucide-react';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import {
  CHIP_GAP,
  OVERFLOW_RESERVE,
  PICKER_ARMED,
  PICKER_BOX,
  PICKER_CHIP,
  PICKER_CONTROL,
  PICKER_GLYPH,
  PICKER_TRAILING,
  PICKER_ICON_BUTTON,
  PICKER_LIST,
  PICKER_PILL,
  PICKER_POPUP,
  PICKER_ROW,
  PICKER_SEARCH,
  PICKER_SEARCH_ROW,
  PICKER_TOKEN_INPUT,
} from '@/registry/sg/components/picker-classes';
import { PickerRow } from '@/registry/sg/components/picker-row';
import { StateLine } from '@/registry/sg/components/state-line';
import { cn } from '@/lib/utils';

export type EntityMultiPickerSize = 'sm' | 'md' | 'lg';

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
/** The row a press on the last row of a page carries, rather than an entity key. */
const LOAD_MORE = '__load-more';

/** Everything both entity pickers take. They differ only in the shape of the value. */
export interface EntityMultiPickerBaseProps
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
  onValueChange?: (value: EntityRef[], rows: PickerRowData[]) => void;
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
  context,
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
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
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
    if (!next) setArmedChip(null);
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState('');
  /** The chip a Backspace has highlighted. The next one removes it. */
  const [armedChip, setArmedChip] = useState<number | null>(null);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
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
      thumbnail: row ? rowThumbnail(row.values, { thumbnail }) : null,
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

  /** The caller's own sub-label. Absent, the row reads `subLabelField` itself. */
  function subLabelOf(row: PickerRowData): string | undefined {
    return subLabel ? subLabel(row) : undefined;
  }

  /** The caller's own secondary, and the type on a polymorphic list that names no field. */
  function customSecondary(row: PickerRowData): string | undefined {
    if (secondary) return secondary(row);
    return !pathOf(secondaryField) && polymorphic ? row.type : undefined;
  }

  function rowFor(key: string): PickerRowData | null {
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

  // A chip removed from under the highlight takes it with it.
  const armed = armedChip !== null && armedChip < value.length ? armedChip : null;

  /**
   * Backspace, Escape and the arrows. The primitive's own handler runs after this
   * one, so a key this picker owns is prevented rather than shared.
   */
  function onKey(event: React.KeyboardEvent<HTMLInputElement>): void {
    const intent = pickerKeyIntent(event.key, {
      open,
      query,
      count: value.length,
      armed,
      editable: interactive,
    });
    if (!holdsArmed(event.key)) setArmedChip(null);
    switch (intent.kind) {
      case 'dismiss':
        setOpen(false);
        setQuery('');
        return;
      case 'arm':
        event.preventDefault();
        setArmedChip(intent.index);
        return;
      case 'remove': {
        event.preventDefault();
        const chip = value[intent.index];
        if (chip) emit(value.filter((other) => entityKey(other) !== entityKey(chip)));
        return;
      }
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

  function choose(keys: string[]): void {
    if (keys.includes(LOAD_MORE)) {
      pagingRef.current = true;
      search.loadMore();
      return;
    }
    const rows = keys.map(rowFor).filter((row): row is PickerRowData => row !== null);
    search.remember(rows);
    emit(rows.map((row) => ({ type: row.type, id: row.id, name: row.name })));
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
    const chosen = selected.has(key);
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
        // Down stops at the last row rather than wrapping, as it does on Bits UI.
        loopFocus={false}
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
          data-empty={value.length === 0 ? '' : undefined}
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
                      context={context}
                      siteUrl={site}
                      removable={interactive}
                      onRemove={() => emit(value.filter((other) => entityKey(other) !== entityKey(chip.ref)))}
                      data-chip=""
                      data-armed={armed === index ? 'true' : undefined}
                      hidden={row.ready && index >= plan.shown.length}
                      className={cn('shrink-0', armed === index && PICKER_ARMED)}
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
              onKeyDown={onKey}
              className={PICKER_TOKEN_INPUT}
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
                    onKeyDown={onKey}
                    className={PICKER_SEARCH}
                  />
                </div>
              )}
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
