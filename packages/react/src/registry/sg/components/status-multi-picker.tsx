import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import type { ChipRow, PickerSummary, SgClient, StatusOption, StatusRecord } from '@sg-widgets/core';
import { createSchemaService, createStatusService, matchesTokens, summariseSelection } from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { ChevronsUpDown, Search, SearchX, TriangleAlert, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/registry/sg/components/status-badge';

export type StatusMultiPickerSize = 'sm' | 'md' | 'lg';
/**
 * What the control shows for the selection. `both` is the old spelling of `chips`.
 * `icons` drops the labels and `names` reads the labels as one line of text.
 */
export type StatusMultiPickerSummary = PickerSummary | 'icons' | 'names' | 'both';

/** Controls follow the input ladder of `docs/design-rules.md`. */
const PICKER_BOX: Record<StatusMultiPickerSize, string> = {
  sm: 'min-h-8 px-2 py-1',
  md: 'min-h-9 px-3 py-1',
  lg: 'min-h-10 px-3 py-1',
};
const PICKER_GLYPH: Record<StatusMultiPickerSize, string> = {
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};
/** A badge inside a control sits one step down the leaf ladder. */
const BADGE: Record<StatusMultiPickerSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

/** The bordered field the badges and the query input sit in. */
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
/** Room the `+n` pill needs beside the badges, so it is never the thing that overflows. */
const OVERFLOW_RESERVE = 40;
/** The badge row's `gap-1.5`, carried by every measured width. */
const CHIP_GAP = 6;

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
/** The popup surface, matching the popover item of each registry. */
const PICKER_POPUP =
  'bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 ring-foreground/10 z-50 w-(--anchor-width) min-w-56 origin-(--transform-origin) overflow-hidden rounded-lg shadow-md ring-1 outline-hidden duration-100';
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

export interface StatusMultiPickerProps {
  /** The site to read from. Wrap it in `createQueryCache` so widgets on a page share one read. */
  client: SgClient;
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
  emptyLabel?: string;
  clearable?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Show the raw code instead of the label. The other one stays in the tooltip. */
  showCode?: boolean;
  /** What the control shows for the selection. */
  summary?: StatusMultiPickerSummary;
  /** Badges drawn before the rest becomes `+n`. `0` lets the row fit what it can. */
  max?: number;
  /** The site the stock sprite is served from, passed to every badge. */
  siteUrl?: string;
  size?: StatusMultiPickerSize;
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
 * cache the client carries, so it is never an effect re-firing on a "last seen" key.
 */
function statusOptionStore(
  client: SgClient,
  entityType: string,
  projectKey: string,
  field: string | undefined,
) {
  const schema = createSchemaService(client);
  const statuses = createStatusService(client);
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
 */
export function StatusMultiPicker({
  client,
  entityType,
  projectId,
  projectIds,
  field,
  value = [],
  onValueChange,
  placeholder = 'Select statuses',
  searchPlaceholder = 'Search statuses…',
  emptyLabel = 'No status matches.',
  clearable = true,
  readOnly = false,
  disabled = false,
  invalid = false,
  showCode = false,
  summary = 'ellipsis',
  max = 0,
  siteUrl,
  size = 'md',
  className,
}: StatusMultiPickerProps) {
  const projectKey = (projectIds ?? (projectId === undefined ? [] : [projectId])).join(',');
  const store = useMemo(
    () => statusOptionStore(client, entityType, projectKey, field),
    [client, entityType, projectKey, field],
  );
  const query = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const controlRef = useRef<HTMLDivElement | null>(null);
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

  /** `both` is the old spelling of `chips`, and `icons` fits twice as many. */
  const mode: PickerSummary =
    summary === 'both' || summary === 'icons' || summary === 'names' ? 'chips' : summary;
  /**
   * A badge control is a token field, with the caret beside the badges. A summary
   * control is a trigger, and keeps its search box at the top of the popup instead.
   */
  const inline = summary !== 'ellipsis' && summary !== 'count' && summary !== 'names';
  /** What the badges look like, so a change to any of it re-measures the row. */
  const rowKey = `${size}|${summary}|${showCode}|${value.map((code) => byCode.get(code)?.label ?? code).join(', ')}`;
  const row = useChipRow(mode === 'ellipsis', rowKey, controlRef, badgesRef);
  const plan = summariseSelection(value, (code) => byCode.get(code)?.label ?? code, {
    summary: mode,
    max: summary === 'icons' ? max * 2 : max,
    fit: row.fit,
  });

  // Read-only wins over disabled and over the loading window.
  const inert = !readOnly && (disabled || query.loading);
  const interactive = !readOnly && !inert;
  const showClear = clearable && value.length > 0 && !readOnly && !disabled;

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

  const badge = (code: string, variant: 'both' | 'icon') => (
    <StatusBadge
      code={code}
      status={query.statuses.get(code) ?? null}
      field={badgeField}
      variant={variant}
      size={BADGE[size]}
      label={showCode ? 'code' : 'name'}
      siteUrl={siteUrl}
      className="min-w-0"
    />
  );

  const chip = (code: string, index: number) => (
    <span
      key={code}
      data-slot="status-multi-picker-chip"
      data-chip=""
      hidden={row.ready && index >= plan.shown.length}
      className="flex min-w-0 shrink-0 items-center gap-1"
    >
      {badge(code, summary === 'icons' ? 'icon' : 'both')}
      {interactive && summary !== 'icons' ? (
        <button
          type="button"
          data-slot="status-multi-picker-remove"
          aria-label={`Remove ${byCode.get(code)?.label ?? code}`}
          onClick={() => onValueChange?.(value.filter((c) => c !== code))}
          className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm opacity-60 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      ) : null}
    </span>
  );

  let note: ReactNode = null;
  if (query.error !== null) {
    note = (
      <div data-slot="status-multi-picker-error" className={cn(PICKER_NOTE, 'text-destructive')}>
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{query.error}</span>
      </div>
    );
  } else if (query.loading) {
    note = (
      <div data-slot="status-multi-picker-loading" className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    );
  } else if (shown.length === 0) {
    note = (
      <div data-slot="status-multi-picker-empty" className={cn(PICKER_NOTE, 'text-muted-foreground')}>
        <SearchX aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{emptyLabel}</span>
      </div>
    );
  }

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
        {badge(code, 'both')}
      </ComboboxPrimitive.Item>
    );
  }

  return (
    <div
      data-slot="status-multi-picker"
      data-size={size}
      data-summary={summary}
      data-loading={query.loading ? 'true' : undefined}
      className={cn('relative flex w-full min-w-0 items-center', className)}
    >
      <ComboboxPrimitive.Root
        multiple
        items={shown.map((option) => option.code)}
        filter={null}
        openOnInputClick={false}
        autoHighlight
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
          data-readonly={readOnly ? 'true' : undefined}
          title={plan.title || placeholder}
          className={cn(PICKER_CONTROL, PICKER_BOX[size], plan.oneLine && 'flex-nowrap', readOnly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
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
              ) : summary === 'names' ? (
                <span data-slot="status-multi-picker-names" className="truncate">
                  {plan.title}
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
              readOnly={readOnly || undefined}
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
              data-picker="status"
              data-slot="status-multi-picker-content"
              className={PICKER_POPUP}
            >
              {inline ? null : (
                <div data-slot="status-multi-picker-search" className={PICKER_SEARCH_ROW}>
                  <Search aria-hidden="true" className="size-4 shrink-0 opacity-50" />
                  <ComboboxPrimitive.Input
                    ref={inputRef}
                    data-slot="status-multi-picker-input"
                    aria-label={searchPlaceholder}
                    placeholder={searchPlaceholder}
                    className={PICKER_SEARCH}
                  />
                </div>
              )}
              <ComboboxPrimitive.List data-slot="status-multi-picker-list" className={PICKER_LIST}>
                {note ?? ((code: string) => renderRow(code))}
              </ComboboxPrimitive.List>
            </ComboboxPrimitive.Popup>
          </ComboboxPrimitive.Positioner>
        </ComboboxPrimitive.Portal>

        {readOnly ? null : (
          <div className="pointer-events-none absolute right-2 flex items-center gap-1">
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
