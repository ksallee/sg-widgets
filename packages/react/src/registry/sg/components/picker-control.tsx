import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode, RefObject } from 'react';
import type { ChipRow, PickerSummary } from '@sg-widgets/core';
import {
  holdsArmed,
  listStatus,
  NO_MATCH_LABEL,
  pickerKeyIntent,
  scrollHighlightedIntoView,
  stateLine,
  summariseSelection,
  watchOverflow,
} from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronDown, Search, SearchX, TriangleAlert, X } from 'lucide-react';
import {
  CHIP_GAP,
  LIST_STATUS,
  OVERFLOW_RESERVE,
  PICKER_ANCHORED_POPUP,
  PICKER_BOX,
  PICKER_CONTROL,
  PICKER_GLYPH,
  PICKER_ICON_BUTTON,
  PICKER_INPUT,
  PICKER_LIST,
  PICKER_PILL,
  PICKER_POPUP,
  PICKER_ROW,
  PICKER_SEARCH,
  PICKER_SEARCH_ROW,
  PICKER_TEXT_BOX,
  PICKER_TOKEN_INPUT,
  PICKER_TRAILING,
} from '@/registry/sg/components/picker-classes';
import { StateLine } from '@/registry/sg/components/state-line';
import { cn } from '@/lib/utils';

export type PickerControlSize = 'sm' | 'md' | 'lg';

/** The row a press on the last row of a page carries, rather than an item key. */
export const LOAD_MORE = '__load-more';

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

export interface PickerControlProps {
  /** The `data-slot` prefix every part of this picker carries. */
  slot: string;
  /** The `data-picker` the popup carries. */
  picker: string;
  /** Several keys may be chosen at once. */
  multiple?: boolean;
  /** The chosen keys, in order. A single picker passes none or one. */
  keys: string[];
  /** The keys the primitive has settled on. `LOAD_MORE` never reaches it. */
  onSelect: (keys: string[]) => void;
  /** One label per chosen key: the summary, the title and the measured row read it. */
  labels: string[];
  /** The `data-slot` of the chip row. Defaults to `<slot>-chips`. */
  chipsSlot?: string;
  /** The item keys the list offers, in order. */
  items: string[];
  /** One row of the list. */
  renderItem: (key: string) => ReactNode;
  /** One chip: its index, whether Backspace has armed it, whether the row hides it. */
  renderChip?: (index: number, armed: boolean, hidden: boolean) => ReactNode;
  /** What the control shows for the selection. */
  summary?: PickerSummary;
  /** Chips drawn before the rest becomes `+n`. `0` lets the row fit what it can. */
  max?: number;
  /** The value is a measured row of chips rather than the one chip of a single picker. */
  chipRow?: boolean;
  /** The control holds the caret. A summary control keeps it in the popup instead. */
  inline?: boolean;
  /** The caret gives its room to the chips. */
  tokenInput?: boolean;
  /** What the caret shows. */
  inputPlaceholder?: string;
  /** A summary control keeps a search row. A fixed set has nothing to search. */
  searchable?: boolean;
  /** The filled value is plain text, so the control keeps the reading inset in both states. */
  textValue?: boolean;
  /** What the chips look like, so a change to any of it re-measures the row. */
  rowKey?: string;
  size?: PickerControlSize;
  disabled?: boolean;
  /** The primitive takes no input. Wider than `disabled`: a loading picker is inert too. */
  inert?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Whether the popup is showing. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** What the caret holds. */
  query: string;
  onQueryChange: (query: string) => void;
  /** Remove the chip at `index`. Backspace walks the row through it. */
  onRemoveAt?: (index: number) => void;
  onClear?: () => void;
  /** The popup is as wide as the control it hangs off. */
  anchored?: boolean;
  loading?: boolean;
  error?: string | null;
  empty?: boolean;
  emptyLabel?: string;
  loadingLabel?: string;
  errorLabel?: string;
  /** A further page is there to be read. */
  hasMore?: boolean;
  onLoadMore?: () => void;
  clearLabel?: string;
  triggerLabel?: string;
  overflowLabel?: string;
  /** What the primitive writes into the input for an item. */
  itemToStringLabel?: (value: string) => string;
  /** Attributes the control carries on top of the shared ones. */
  controlProps?: React.HTMLAttributes<HTMLDivElement>;
}

/**
 * The control and the popup every picker in this registry wears.
 *
 * The box and its states, the press rule (a press anywhere on the control toggles the
 * list, the caret included), the outside-press guard, where the caret lands on
 * open, the keyboard model of core's `pickerKeyIntent`, the inline token field against
 * the summary trigger with its chip row, and the popup shell: the search row, the list,
 * the empty, loading and error block, and the load-more row. A picker supplies its rows,
 * its row renderer and its chip and nothing else.
 */
export function PickerControl({
  slot,
  picker,
  multiple = false,
  keys,
  onSelect,
  labels,
  chipsSlot,
  items,
  renderItem,
  renderChip,
  summary = 'chips',
  max = 0,
  chipRow = false,
  inline = true,
  tokenInput = true,
  inputPlaceholder,
  searchable = true,
  textValue = false,
  rowKey,
  size = 'md',
  disabled = false,
  inert = disabled,
  readonly = false,
  invalid = false,
  clearable = true,
  placeholder = '',
  searchPlaceholder = 'Search…',
  open,
  onOpenChange,
  query,
  onQueryChange,
  onRemoveAt,
  onClear,
  anchored = false,
  loading = false,
  error = null,
  empty = false,
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
  hasMore = false,
  onLoadMore,
  clearLabel = 'Clear the selection',
  triggerLabel = 'Show the options',
  overflowLabel,
  itemToStringLabel,
  controlProps,
}: PickerControlProps) {
  const controlRef = useRef<HTMLDivElement | null>(null);
  const [listEl, setListEl] = useState<HTMLDivElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const setList = useCallback((node: HTMLDivElement | null) => {
    listRef.current = node;
    setListEl(node);
  }, []);
  // The list writes the overflow variables the fade reads, which are Base UI's own.
  useEffect(() => watchOverflow(listEl), [listEl]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const chipsRef = useRef<HTMLSpanElement | null>(null);
  /** The chip a Backspace has highlighted. The next one removes it. */
  const [armedChip, setArmedChip] = useState<number | null>(null);
  /** A press on the load-more row is not a selection, and must not close the popup. */
  const pagingRef = useRef(false);

  const loadingText = stateLine('loading', { loadingLabel });
  const interactive = !readonly && !inert;
  const showClear = clearable && labels.length > 0 && !readonly && !disabled;
  /** Only a multi control's row weighs itself; a single one draws its chip and stops. */
  const fitted = chipRow && multiple && summary === 'ellipsis';
  const row = useChipRow(fitted, rowKey ?? `${size}|${summary}|${labels.join(', ')}`, controlRef, chipsRef);
  const plan = summariseSelection(labels, (label) => label, { summary, max, fit: row.fit });
  const counted = summary === 'count' && chipRow && multiple;
  // A chip removed from under the highlight takes it with it.
  const armed = armedChip !== null && armedChip < labels.length ? armedChip : null;
  // A chip removed from under the highlight takes it with it; a chip added later must
  // not inherit an index that outlived its chip.
  useEffect(() => {
    if (armedChip !== null && armedChip >= labels.length) setArmedChip(null);
  }, [armedChip, labels.length]);

  function setOpen(next: boolean): void {
    const wanted = interactive ? next : false;
    if (!wanted) {
      setArmedChip(null);
      onQueryChange('');
    }
    onOpenChange(wanted);
  }

  /** A press anywhere in the field opens the list, and a token field takes the caret. */
  function openFromControl(event: ReactPointerEvent<HTMLDivElement>): void {
    if (!interactive) return;
    const target = event.target as HTMLElement | null;
    // The chip's remove control, the clear control and the chevron own their own press.
    if (target?.closest('button')) return;
    const onCaret = target === inputRef.current;
    if (inline && !onCaret) {
      event.preventDefault();
      inputRef.current?.focus({ preventScroll: true });
    }
    // A press anywhere on the control toggles the list, the caret included; typing opens it again.
    setOpen(!open);
  }

  // A summary trigger has no caret of its own, so the popup's search box takes it.
  useEffect(() => {
    if (!open || inline) return;
    inputRef.current?.focus({ preventScroll: true });
  }, [open, inline]);

  // A load-more page appends rows under the highlighted one, and a new query
  // replaces them all; either way the list follows the highlight.
  useEffect(() => {
    if (!open) return;
    scrollHighlightedIntoView(listRef.current);
  }, [open, items.length]);

  /**
   * Backspace, Escape and the arrows. The primitive's own handler runs after this
   * one, so a key this picker owns is prevented rather than shared.
   */
  function onKey(event: React.KeyboardEvent<HTMLInputElement>): void {
    const intent = pickerKeyIntent(event.key, {
      open,
      query,
      count: labels.length,
      armed,
      editable: interactive,
      multiple,
    });
    if (!holdsArmed(event.key)) setArmedChip(null);
    switch (intent.kind) {
      case 'dismiss':
        setOpen(false);
        return;
      case 'arm':
        event.preventDefault();
        setArmedChip(intent.index);
        return;
      case 'remove':
        event.preventDefault();
        onRemoveAt?.(intent.index);
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

  function choose(next: string[]): void {
    if (next.includes(LOAD_MORE)) {
      pagingRef.current = true;
      onLoadMore?.();
      return;
    }
    onSelect(next);
  }

  function closing(next: boolean, details: { reason?: string; event?: unknown; cancel: () => void }): void {
    // A press on a row of a multi list is a tick, not a commit: the popup stays open
    // so several rows can be ticked from one query, and paging is not a selection.
    if (!next && ((multiple && details.reason === 'item-press') || pagingRef.current)) {
      pagingRef.current = false;
      details.cancel();
      return;
    }
    // A summary control holds no input, so the click that opened it lands outside the
    // popup a moment later; a press on the control is never a dismissal.
    if (!next && details.reason === 'outside-press') {
      const target = (details.event as Event | undefined)?.target as Node | null | undefined;
      if (target && controlRef.current?.contains(target)) {
        details.cancel();
        return;
      }
    }
    setOpen(next);
  }

  const caret = (
    <ComboboxPrimitive.Input
      ref={inputRef}
      data-slot={`${slot}-input`}
      aria-invalid={invalid ? 'true' : undefined}
      aria-label={placeholder}
      readOnly={readonly || undefined}
      placeholder={inputPlaceholder ?? (labels.length > 0 ? '' : placeholder)}
      onKeyDown={onKey}
      className={tokenInput ? PICKER_TOKEN_INPUT : PICKER_INPUT}
    />
  );

  const control = (
    <div
      ref={controlRef}
      data-slot={`${slot}-control`}
      onPointerDown={openFromControl}
      role="group"
      aria-disabled={inert ? 'true' : undefined}
      data-multiple={multiple ? 'true' : undefined}
      data-invalid={invalid && !inline ? 'true' : undefined}
      data-readonly={readonly ? 'true' : undefined}
      data-empty={labels.length === 0 ? '' : undefined}
      title={plan.title || placeholder}
      className={cn(
        PICKER_CONTROL,
        (textValue ? PICKER_TEXT_BOX : PICKER_BOX)[size],
        plan.oneLine && 'flex-nowrap',
        readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8',
      )}
      {...controlProps}
    >
      {labels.length > 0 ? (
        <span data-slot={`${slot}-value`} className="flex min-w-0 items-center gap-1.5">
          {counted ? (
            <span data-slot={`${slot}-count`} className="truncate">
              {plan.countLabel}
            </span>
          ) : chipRow ? (
            /*
              Whole chips only: the row measures itself and hides the ones that do not
              fit, so nothing is ever cut in half. `+n` follows the last one drawn.
              No stylesheet here gives `[hidden]` a display rule, so the row does.
            */
            <span
              ref={chipsRef}
              data-slot={chipsSlot ?? `${slot}-chips`}
              className={cn(
                'flex min-w-0 items-center gap-1.5 [&>[hidden]]:hidden',
                plan.oneLine ? 'flex-nowrap overflow-hidden' : 'flex-wrap',
                row.ready ? undefined : 'invisible',
              )}
            >
              {labels.map((_label, index) =>
                renderChip?.(index, armed === index, row.ready && index >= plan.shown.length),
              )}
              {plan.overflow > 0 ? (
                <button
                  type="button"
                  data-slot={`${slot}-overflow`}
                  title={plan.title}
                  aria-label={overflowLabel ?? `Show all ${labels.length} selected`}
                  onClick={() => setOpen(true)}
                  className={PICKER_PILL}
                >
                  +{plan.overflow}
                </button>
              ) : null}
            </span>
          ) : (
            renderChip?.(0, armed === 0, false)
          )}
        </span>
      ) : inline ? null : (
        <span data-slot={`${slot}-placeholder`} className="text-muted-foreground truncate">
          {placeholder}
        </span>
      )}
      {inline ? caret : null}
    </div>
  );

  let note: ReactNode = null;
  if (error !== null && error !== '') {
    note = (
      <StateLine
        state="error"
        slotName={`${slot}-error`}
        icon={TriangleAlert}
        label={stateLine('error', { errorLabel }, error)}
      />
    );
  } else if (loading) {
    note = (
      <div
        data-slot={`${slot}-loading`}
        className="flex flex-col"
        aria-busy="true"
        aria-label={loadingText}
      >
        {[0, 1, 2].map((one) => (
          <div key={one} className="flex items-center px-2 py-1.5">
            <Skeleton className="h-5 w-full" />
          </div>
        ))}
      </div>
    );
  } else if (empty) {
    note = <StateLine state="empty" slotName={`${slot}-empty`} icon={SearchX} label={emptyLabel} />;
  }

  function drawRow(key: string): ReactNode {
    if (key !== LOAD_MORE) return renderItem(key);
    return (
      <ComboboxPrimitive.Item
        key={LOAD_MORE}
        data-slot={`${slot}-more`}
        value={LOAD_MORE}
        className={cn(PICKER_ROW, 'text-muted-foreground justify-center text-xs')}
      >
        {loading ? loadingText : 'Load more'}
      </ComboboxPrimitive.Item>
    );
  }

  // Fixed, and anchored to the whole control rather than to the input: the list
  // scrolls its highlighted row into view on mount, and an absolute wrapper still
  // at the page origin would drag the page there with it.
  const list = (
    <ComboboxPrimitive.Portal>
      <ComboboxPrimitive.Positioner
        positionMethod="fixed"
        anchor={controlRef}
        align="start"
        sideOffset={4}
        className="isolate z-50"
      >
        <ComboboxPrimitive.Popup
          data-picker={picker}
          data-slot={`${slot}-content`}
          className={anchored ? PICKER_ANCHORED_POPUP : PICKER_POPUP}
        >
          {inline ? null : searchable ? (
            <div data-slot={`${slot}-search`} className={PICKER_SEARCH_ROW}>
              <Search aria-hidden="true" className="size-4 shrink-0 opacity-50" />
              <ComboboxPrimitive.Input
                ref={inputRef}
                data-slot={`${slot}-input`}
                aria-label={searchPlaceholder}
                placeholder={searchPlaceholder}
                onKeyDown={onKey}
                className={PICKER_SEARCH}
              />
            </div>
          ) : (
            /* Nothing to search, and still the one caret: it holds the focus and the keys. */
            <ComboboxPrimitive.Input
              ref={inputRef}
              data-slot={`${slot}-input`}
              aria-label={placeholder}
              readOnly
              onKeyDown={onKey}
              className="sr-only"
            />
          )}
          <div
            data-slot={`${slot}-status`}
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className={LIST_STATUS}
          >
            {listStatus(
              { loading, count: items.length, error, asked: true },
              { emptyLabel, loadingLabel, errorLabel },
            )}
          </div>
          <ComboboxPrimitive.List ref={setList} data-slot={`${slot}-list`} className={PICKER_LIST}>
            {note ?? ((key: string) => drawRow(key))}
          </ComboboxPrimitive.List>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );

  const actions = readonly ? null : (
    <div className={cn('pointer-events-none absolute top-0 right-2 flex items-center gap-1', PICKER_TRAILING[size])}>
      {showClear ? (
        <button
          type="button"
          data-slot={`${slot}-clear`}
          aria-label={clearLabel}
          onClick={() => {
            onClear?.();
            if (inline) inputRef.current?.focus({ preventScroll: true });
          }}
          className={PICKER_ICON_BUTTON}
        >
          <X aria-hidden="true" className={PICKER_GLYPH[size]} />
        </button>
      ) : null}
      <ComboboxPrimitive.Trigger
        data-slot={`${slot}-trigger`}
        aria-label={triggerLabel}
        disabled={inert}
        className={PICKER_ICON_BUTTON}
      >
        <ChevronDown aria-hidden="true" className={PICKER_GLYPH[size]} />
      </ComboboxPrimitive.Trigger>
    </div>
  );

  const offered = hasMore ? [...items, LOAD_MORE] : items;
  const typing = (next: string, reason: string): void => {
    if (reason === 'item-press') return;
    onQueryChange(next);
    // Typing asks for the list: a press may have closed it a moment ago.
    if (reason === 'input-change' && interactive && !open) setOpen(true);
  };

  return multiple ? (
    <ComboboxPrimitive.Root
      multiple
      items={offered}
      filter={null}
      openOnInputClick={false}
      autoHighlight
      // Down stops at the last row rather than wrapping, as it does on Bits UI.
      loopFocus={false}
      disabled={inert}
      value={keys}
      onValueChange={(next) => choose(next)}
      itemToStringLabel={itemToStringLabel}
      inputValue={query}
      onInputValueChange={(next, details) => typing(next, details.reason)}
      open={open}
      onOpenChange={(next, details) => closing(next, details)}
    >
      {control}
      {list}
      {actions}
    </ComboboxPrimitive.Root>
  ) : (
    <ComboboxPrimitive.Root
      items={offered}
      filter={null}
      openOnInputClick={false}
      autoHighlight
      // Down stops at the last row rather than wrapping, as it does on Bits UI.
      loopFocus={false}
      disabled={inert}
      value={keys[0] ?? null}
      onValueChange={(next) => choose(next === null || next === undefined ? [] : [next])}
      itemToStringLabel={itemToStringLabel}
      inputValue={query}
      onInputValueChange={(next, details) => typing(next, details.reason)}
      open={open}
      onOpenChange={(next, details) => closing(next, details)}
    >
      {control}
      {list}
      {actions}
    </ComboboxPrimitive.Root>
  );
}
