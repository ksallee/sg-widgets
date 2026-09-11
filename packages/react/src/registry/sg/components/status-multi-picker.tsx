import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import type {
  ChipRow,
  PickerRow as PickerRowData,
  PickerSummary,
  SgContext,
  StatusOption,
  StatusRecord,
} from '@sg-widgets/core';
import {
  holdsArmed,
  matchesTokens,
  NO_MATCH_LABEL,
  pickerKeyIntent,
  scrollHighlightedIntoView,
  stateLine,
  summariseSelection,
} from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { ChevronDown, Search, SearchX, TriangleAlert, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import {
  CHIP_GAP,
  OVERFLOW_RESERVE,
  PICKER_ANCHORED_POPUP,
  PICKER_ARMED,
  PICKER_BOX,
  PICKER_CHIP as BADGE,
  PICKER_CONTROL,
  PICKER_GLYPH,
  PICKER_TRAILING,
  PICKER_ICON_BUTTON,
  PICKER_LIST,
  PICKER_PILL,
  PICKER_ROW,
  PICKER_SEARCH,
  PICKER_SEARCH_ROW,
  PICKER_TOKEN_INPUT,
} from '@/registry/sg/components/picker-classes';
import { PickerRow } from '@/registry/sg/components/picker-row';
import { StateLine } from '@/registry/sg/components/state-line';
import { StatusBadge, type StatusBadgeVariant } from '@/registry/sg/components/status-badge';

export type StatusMultiPickerSize = 'sm' | 'md' | 'lg';
/**
 * What the control shows for the selection. `both` is the old spelling of `chips`.
 * `icons` drops the labels and `names` reads the labels as one line of text.
 */

/** Every badge laid out, so a hidden one still reports the width it would take. */
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

export interface StatusMultiPickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** The widget context. The options and the status table are read through it, once per page. */
  context: SgContext;
  entityType: string;
  /** Offer the codes this project allows. */
  projectId?: number;
  /** Offer the codes every one of these projects allows. */
  projectIds?: number[];
  /** A list or status field other than the type's own. Project's is `sg_status`. */
  field?: string;
  /** The selected codes. */
  value?: string[];
  onValueChange?: (value: string[]) => void;
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
  /** Draw the code as the row's right-aligned secondary, when it says more than the label. */
  showCode?: boolean;
  /** The muted line under a row's label. */
  subLabel?: (option: StatusOption) => string;
  /** A row's right-aligned value, of the caller's own making. Wins over the code. */
  secondary?: (option: StatusOption) => string;
  /** What the control shows for the selection. */
  summary?: PickerSummary;
  /** What one selected status is drawn as. Orthogonal to how many the control shows. */
  badge?: StatusBadgeVariant;
  /** Badges drawn before the rest becomes `+n`. `0` lets the row fit what it can. */
  max?: number;
  /** The site the stock sprite is served from, passed to every badge. Defaults to the context's. */
  siteUrl?: string;
  size?: StatusMultiPickerSize;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

interface Loaded {
  loading: boolean;
  error: string | null;
  options: StatusOption[];
  statuses: ReadonlyMap<string, StatusRecord>;
}

const LOADING: Loaded = { loading: true, error: null, options: [], statuses: new Map() };

/**
 * One load, as a store. The read starts in a memo over the props and goes through the
 * context's cache, so it is never an effect re-firing on a "last seen" key.
 */
function statusOptionStore(
  context: SgContext,
  entityType: string,
  projectKey: string,
  field: string | undefined,
) {
  // The context's own services, so every widget on the page shares one schema read
  // and one status table.
  const schema = context.schema;
  const statuses = context.statuses;
  const ids = projectKey === '' ? [] : projectKey.split(',').map(Number);
  const [first] = ids;
  const options =
    first === undefined
      ? schema.statusOptions(entityType, undefined, field)
      : ids.length === 1
        ? schema.statusOptions(entityType, first, field)
        : schema.statusOptionsForProjects(entityType, ids, field);

  const listeners = new Set<() => void>();
  let snapshot = LOADING;
  const settle = (next: Loaded) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  void Promise.all([options, statuses.byCode()]).then(
    ([resolved, table]) => settle({ loading: false, error: null, options: resolved, statuses: table }),
    (error: unknown) =>
      settle({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        options: [],
        statuses: new Map(),
      }),
  );
  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: (): Loaded => snapshot,
  };
}

/**
 * Several statuses, picked from the codes a project offers.
 *
 * The options are `valid_values` minus the project's `hidden_values`, read with
 * `project_id`; over several projects they are the intersection of those sets. REST
 * does not enforce `hidden_values` on write, so the subtraction is the client's job
 * (probe 009). A selected code the option set does not carry keeps a row of its own,
 * labelled with the code, so a selection is never dropped from the display.
 *
 * A status list has no substring operator, so there is no server-side type-ahead over
 * it: the vocabulary is read once and the query input narrows it in the browser
 * (field_types/status_list).
 *
 * A row is the shared picker row of rule 9, after its checkbox: the status icon as the
 * leading glyph, the display label with the matched runs bold, and the code
 * right-aligned. The badge stays in the control, where a status is a value rather than
 * a row.
 */
export function StatusMultiPicker({
  context,
  entityType,
  projectId,
  projectIds,
  field,
  value = [],
  onValueChange,
  placeholder = 'Select statuses',
  searchPlaceholder = 'Search statuses…',
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
  clearable = true,
  readonly = false,
  disabled = false,
  invalid = false,
  showCode = true,
  subLabel,
  secondary,
  summary = 'ellipsis',
  badge = 'both',
  max = 0,
  siteUrl,
  size = 'md',
  open: openProp,
  onOpenChange,
  className,
  ref,
  ...rest
}: StatusMultiPickerProps) {
  const site = siteUrl ?? context.siteUrl;
  const projectKey = (projectIds ?? (projectId === undefined ? [] : [projectId])).join(',');
  const store = useMemo(
    () => statusOptionStore(context, entityType, projectKey, field),
    // The services are what the store reads through, and they outlive a context copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.schema, context.statuses, entityType, projectKey, field],
  );
  const query = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    if (!next) setArmedChip(null);
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [search, setSearch] = useState('');
  /** The chip a Backspace has highlighted. The next one removes it. */
  const [armedChip, setArmedChip] = useState<number | null>(null);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const badgesRef = useRef<HTMLSpanElement | null>(null);

  // `display_values` is the only other source of a label, so the options carry it to the badge.
  const badgeField = { displayValues: Object.fromEntries(query.options.map((o) => [o.code, o.label])) };
  // A stored code outside the usable set is legal, so it keeps a row of its own (probe 009).
  const rows = [
    ...query.options,
    ...value.filter((code) => !query.options.some((o) => o.code === code)).map((code) => ({ code, label: code })),
  ];
  // A status list has no substring operator, so the vocabulary is read once and the
  // search box narrows it here (field_types/status_list).
  const shown = rows.filter((option) => matchesTokens(search, option.label, option.code));
  const byCode = new Map(rows.map((option) => [option.code, option]));

  /**
   * A chip control is a token field, with the caret beside the badges. A summary
   * control is a trigger, and keeps its search box at the top of the popup instead.
   */
  const inline = summary === 'chips';

  // Read-only wins over disabled and over the loading window.
  const inert = !readonly && (disabled || query.loading);
  const interactive = !readonly && !inert;
  const showClear = clearable && value.length > 0 && !readonly && !disabled;

  /** What the badges look like, so a change to any of it re-measures the row. */
  const rowKey = `${size}|${summary}|${badge}|${interactive}|${value.map((code) => byCode.get(code)?.label ?? code).join(', ')}`;
  const row = useChipRow(summary === 'ellipsis', rowKey, controlRef, badgesRef);
  const plan = summariseSelection(value, (code) => byCode.get(code)?.label ?? code, {
    summary,
    // A bare icon is half a badge wide, so a fixed cap fits twice as many.
    max: badge === 'icon' ? max * 2 : max,
    fit: row.fit,
  });

  function remove(code: string): void {
    onValueChange?.(value.filter((c) => c !== code));
  }

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

  // The search box narrows the list here, so the rows change under the highlight;
  // the list follows it.
  useEffect(() => {
    if (!open) return;
    scrollHighlightedIntoView(listRef.current);
  }, [open, shown.length]);

  // A chip removed from under the highlight takes it with it.
  const armed = armedChip !== null && armedChip < value.length ? armedChip : null;

  /**
   * Backspace, Escape and the arrows. The primitive's own handler runs after this
   * one, so a key this picker owns is prevented rather than shared.
   */
  function onKey(event: React.KeyboardEvent<HTMLInputElement>): void {
    const intent = pickerKeyIntent(event.key, {
      open,
      query: search,
      count: value.length,
      armed,
      editable: interactive,
    });
    if (!holdsArmed(event.key)) setArmedChip(null);
    switch (intent.kind) {
      case 'dismiss':
        setOpen(false);
        setSearch('');
        return;
      case 'arm':
        event.preventDefault();
        setArmedChip(intent.index);
        return;
      case 'remove': {
        event.preventDefault();
        const code = value[intent.index];
        if (code !== undefined) remove(code);
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

  const statusBadge = (code: string, variant: StatusBadgeVariant, removable: boolean) => (
    <StatusBadge
      code={code}
      status={query.statuses.get(code) ?? null}
      field={badgeField}
      variant={variant}
      size={BADGE[size]}
      siteUrl={site}
      removable={removable}
      onRemove={remove}
      removeLabel={`Remove ${byCode.get(code)?.label ?? code}`}
      className="min-w-0"
    />
  );

  const chip = (code: string, index: number) => (
    <span
      key={code}
      data-slot="status-multi-picker-chip"
      data-chip=""
      data-armed={armed === index ? 'true' : undefined}
      hidden={row.ready && index >= plan.shown.length}
      className={cn('flex min-w-0 shrink-0 items-center', armed === index && cn(PICKER_ARMED, 'rounded-sm'))}
    >
      {statusBadge(code, badge, interactive)}
    </span>
  );

  let note: ReactNode = null;
  if (query.error !== null) {
    note = (
      <StateLine
        state="error"
        slotName="status-multi-picker-error"
        icon={TriangleAlert}
        label={stateLine('error', { errorLabel }, query.error)}
      />
    );
  } else if (query.loading) {
    note = (
      <div
        data-slot="status-multi-picker-loading"
        className="flex flex-col gap-2"
        aria-busy="true"
        aria-label={stateLine('loading', { loadingLabel })}
      >
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    );
  } else if (shown.length === 0) {
    note = (
      <StateLine
        state="empty"
        slotName="status-multi-picker-empty"
        icon={SearchX}
        label={emptyLabel}
      />
    );
  }

  /** The shared row a status is drawn as. There is no entity behind a code, so it carries no values. */
  const rowOf = (option: StatusOption): PickerRowData => ({
    type: 'Status',
    id: 0,
    name: option.label,
    values: {},
  });

  /** The right-aligned value: the caller's, else the code when it says more than the label. */
  const secondaryOf = (option: StatusOption): string | undefined => {
    if (secondary) return secondary(option) || undefined;
    return showCode && option.code !== option.label ? option.code : undefined;
  };

  function renderRow(code: string): ReactNode {
    const option = byCode.get(code);
    if (!option) return null;
    const chosen = value.includes(code);
    return (
      <ComboboxPrimitive.Item
        key={code}
        data-slot="status-multi-picker-option"
        data-status-code={code}
        data-selected-status={chosen ? 'true' : undefined}
        value={code}
        className={PICKER_ROW}
      >
        <span data-slot="status-multi-picker-check" className="flex h-5 shrink-0 items-center">
          <Checkbox checked={chosen} tabIndex={-1} aria-hidden="true" className="pointer-events-none" />
        </span>
        <PickerRow
          row={rowOf(option)}
          query={search}
          subLabel={subLabel?.(option)}
          secondary={secondaryOf(option)}
          size={size}
          context={context}
          glyph={
            <StatusBadge
              code={code}
              status={query.statuses.get(code) ?? null}
              field={badgeField}
              variant="glyph"
              size={size}
              siteUrl={site}
            />
          }
        />
      </ComboboxPrimitive.Item>
    );
  }

  return (
    <div
      ref={ref}
      data-slot="status-multi-picker"
      data-size={size}
      data-summary={summary}
      data-badge={badge}
      data-loading={query.loading ? 'true' : undefined}
      className={cn('relative flex w-full min-w-0 items-center', className)}
      {...rest}
    >
      <ComboboxPrimitive.Root
        multiple
        items={shown.map((option) => option.code)}
        filter={null}
        openOnInputClick={false}
        autoHighlight
        // Down stops at the last row rather than wrapping, as it does on Bits UI.
        loopFocus={false}
        disabled={inert}
        value={value}
        onValueChange={(next) => onValueChange?.(next)}
        inputValue={search}
        onInputValueChange={(next, details) => {
          if (details.reason === 'item-press') return;
          setSearch(next);
        }}
        open={open}
        onOpenChange={(next, details) => {
          // A press on a row is a tick, not a commit: the popup stays open so several
          // statuses can be ticked from one query.
          if (!next && details.reason === 'item-press') {
            details.cancel();
            return;
          }
          setOpen(interactive ? next : false);
          if (!next) setSearch('');
        }}
      >
        <div
          ref={controlRef}
          data-slot="status-multi-picker-control"
      onPointerDown={openFromControl}
      role="group"
          aria-disabled={inert ? 'true' : undefined}
          data-invalid={invalid && !inline ? 'true' : undefined}
          data-readonly={readonly ? 'true' : undefined}
          data-empty={value.length === 0 ? '' : undefined}
          title={plan.title || placeholder}
          className={cn(PICKER_CONTROL, PICKER_BOX[size], plan.oneLine && 'flex-nowrap', readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
        >
          {value.length > 0 ? (
            <span
              data-slot="status-multi-picker-value"
              className="flex min-w-0 items-center gap-1.5"
            >
              {summary === 'count' ? (
                <span data-slot="status-multi-picker-count" className="truncate">
                  {plan.countLabel}
                </span>
              ) : (
                /*
                  Whole badges only: the row measures itself and hides the ones that do not
                  fit, so nothing is ever cut in half. `+n` follows the last one drawn.
                  No stylesheet here gives `[hidden]` a display rule, so the row does.
                */
                <span
                  ref={badgesRef}
                  data-slot="status-multi-picker-badges"
                  className={cn(
                    'flex min-w-0 items-center gap-1.5 [&>[hidden]]:hidden',
                    plan.oneLine ? 'flex-nowrap overflow-hidden' : 'flex-wrap',
                    row.ready ? undefined : 'invisible',
                  )}
                >
                  {value.map((code, index) => chip(code, index))}
                  {plan.overflow > 0 ? (
                    <button
                      type="button"
                      data-slot="status-multi-picker-overflow"
                      title={plan.title}
                      aria-label={`Show all ${value.length} statuses`}
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
            <span data-slot="status-multi-picker-placeholder" className="text-muted-foreground truncate">
              {placeholder}
            </span>
          )}
          {inline ? (
            <ComboboxPrimitive.Input
              ref={inputRef}
              data-slot="status-multi-picker-input"
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
              data-picker="status"
              data-slot="status-multi-picker-content"
              className={PICKER_ANCHORED_POPUP}
            >
              {inline ? null : (
                <div data-slot="status-multi-picker-search" className={PICKER_SEARCH_ROW}>
                  <Search aria-hidden="true" className="size-4 shrink-0 opacity-50" />
                  <ComboboxPrimitive.Input
                    ref={inputRef}
                    data-slot="status-multi-picker-input"
                    aria-label={searchPlaceholder}
                    placeholder={searchPlaceholder}
                    onKeyDown={onKey}
                    className={PICKER_SEARCH}
                  />
                </div>
              )}
              <ComboboxPrimitive.List ref={listRef} data-slot="status-multi-picker-list" className={PICKER_LIST}>
                {note ?? ((code: string) => renderRow(code))}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>

        {readonly ? null : (
          <div className={cn('pointer-events-none absolute top-0 right-2 flex items-center gap-1', PICKER_TRAILING[size])}>
            {showClear ? (
              <button
                type="button"
                data-slot="status-multi-picker-clear"
                aria-label="Clear the statuses"
                onClick={() => {
                  onValueChange?.([]);
                  if (inline) inputRef.current?.focus({ preventScroll: true });
                }}
                className={PICKER_ICON_BUTTON}
              >
                <X aria-hidden="true" className={PICKER_GLYPH[size]} />
              </button>
            ) : null}
            <ComboboxPrimitive.Trigger
              data-slot="status-multi-picker-trigger"
              aria-label="Show the statuses"
              disabled={inert}
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
