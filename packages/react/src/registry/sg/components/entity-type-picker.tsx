import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import type { EntityTypeInfo, PickerSummary, SchemaService } from '@sg-widgets/core';
import { filterEntityTypes, matchesTokens, summariseSelection } from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { ChevronsUpDown, SearchX, TriangleAlert, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type EntityTypePickerSize = 'sm' | 'md' | 'lg';

/** Controls follow the input ladder of `docs/design-rules.md`. */
const PICKER_BOX: Record<EntityTypePickerSize, string> = {
  sm: 'min-h-8 px-2 py-1',
  md: 'min-h-9 px-3 py-1',
  lg: 'min-h-10 px-3 py-1',
};
const PICKER_GLYPH: Record<EntityTypePickerSize, string> = {
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};

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
/** A chosen type in the control. A type is a code, not a row, so it has no thumbnail. */
const PICKER_TEXT_CHIP =
  'bg-muted text-foreground flex h-6 min-w-0 shrink-0 items-center gap-1 rounded-sm px-1.5 text-xs';

export interface EntityTypePickerProps {
  /** Reads the site's enabled types. Build it once per app with `createSchemaService`. */
  schema: SchemaService;
  /** A type code in single mode, an array of them in multi mode. */
  value?: string | string[] | null;
  multiple?: boolean;
  onValueChange?: (value: string | string[] | null) => void;
  /** Codes on offer. Empty or absent means every enabled type. */
  allow?: string[];
  /** Codes withheld, applied after `allow`. */
  deny?: string[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  clearable?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Show the code under the display name where the two differ. */
  showCode?: boolean;
  /** What the control shows for the selection in multi mode. */
  summary?: PickerSummary;
  /** Chips drawn before the rest becomes `+n`. `0` draws every chip. */
  max?: number;
  size?: EntityTypePickerSize;
  className?: string;
}

/**
 * One entity type, or several, as a searchable combobox.
 *
 * The list is every type the site has enabled, display name first with the code
 * beneath it when the two differ. `allow` and `deny` narrow the derived options
 * rather than the read, so a caller switching modes sees the list change without a
 * refetch. The vocabulary is one read, so the query input narrows it in the browser.
 * Multi mode keeps the popup open and ticks the chosen rows.
 */
export function EntityTypePicker({
  schema,
  value = null,
  multiple = false,
  onValueChange,
  allow,
  deny,
  placeholder = 'Select an entity type',
  searchPlaceholder = 'Search types…',
  emptyLabel = 'No entity type matches.',
  clearable = true,
  readOnly = false,
  disabled = false,
  invalid = false,
  showCode = true,
  summary = 'ellipsis',
  max = 0,
  size = 'md',
  className,
}: EntityTypePickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState<EntityTypeInfo[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const controlRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // One read per site, cached by the schema service: `/schema` is 12KB and holds
  // every enabled type (probe 002). Allow and deny are applied to the derived list
  // below, so narrowing them re-filters with no second call.
  useEffect(() => {
    let live = true;
    schema
      .entityTypes()
      .then((types) => {
        if (live) setLoaded(types);
      })
      .catch((error: unknown) => {
        if (live) setFailure(error instanceof Error ? error.message : String(error));
      });
    return () => {
      live = false;
    };
  }, [schema]);

  const selected = multiple ? ((value as string[] | null) ?? []) : value ? [value as string] : [];
  const types = loaded ? filterEntityTypes(loaded, { allow, deny }) : [];
  const shown = types.filter((t) => matchesTokens(search, t.displayName, t.name));
  const byName = new Map(types.map((t) => [t.name, t]));
  const labelOf = (code: string) => byName.get(code)?.displayName ?? code;
  const plan = summariseSelection(selected, labelOf, { summary, max });
  const interactive = !readOnly && !disabled;
  const showClear = clearable && selected.length > 0 && interactive;

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

  function emit(next: string | string[] | null): void {
    onValueChange?.(next);
  }

  let note: ReactNode = null;
  if (failure) {
    note = (
      <div data-slot="entity-type-picker-error" className={cn(PICKER_NOTE, 'text-destructive')}>
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{failure}</span>
      </div>
    );
  } else if (loaded === null) {
    note = (
      <div data-slot="entity-type-picker-loading" className="flex flex-col gap-2">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    );
  } else if (shown.length === 0) {
    note = (
      <div data-slot="entity-type-picker-empty" className={cn(PICKER_NOTE, 'text-muted-foreground')}>
        <SearchX aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{emptyLabel}</span>
      </div>
    );
  }

  function renderRow(code: string): ReactNode {
    const type = byName.get(code);
    if (!type) return null;
    const chosen = selected.includes(code);
    return (
      <ComboboxPrimitive.Item
        key={code}
        data-slot="entity-type-picker-option"
        data-entity-type={code}
        data-checked={!multiple && chosen ? 'true' : undefined}
        data-selected-type={chosen ? 'true' : undefined}
        value={code}
        className={cn(PICKER_ROW, 'items-start')}
      >
        {multiple ? (
          <span data-slot="entity-type-picker-check" className="flex h-5 shrink-0 items-center">
            <Checkbox checked={chosen} tabIndex={-1} aria-hidden="true" className="pointer-events-none" />
          </span>
        ) : null}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate">{type.displayName}</span>
          {showCode && type.name !== type.displayName ? (
            <span data-slot="entity-type-picker-code" className="text-muted-foreground truncate font-mono text-xs">
              {type.name}
            </span>
          ) : null}
        </span>
      </ComboboxPrimitive.Item>
    );
  }

  const control = (
    <div
      ref={controlRef}
      data-slot="entity-type-picker-control"
      onPointerDown={openFromControl}
      role="group"
      aria-disabled={disabled ? 'true' : undefined}
      data-readonly={readOnly ? 'true' : undefined}
      title={plan.title || placeholder}
      className={cn(PICKER_CONTROL, PICKER_BOX[size], plan.oneLine && 'flex-nowrap', readOnly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
    >
      {selected.length > 0 ? (
        <span
          data-slot="entity-type-picker-value"
          className="flex min-w-0 items-center gap-1.5"
        >
          {summary === 'count' && multiple ? (
            <span data-slot="entity-type-picker-count" className="truncate">
              {plan.countLabel}
            </span>
          ) : (
            <>
              {/* The chips clip rather than shrink, so `+n` always says how many are hidden. */}
              <span
                data-slot="entity-type-picker-chips"
                className={cn(
                  'flex min-w-0 items-center gap-1.5',
                  plan.oneLine ? 'overflow-hidden' : 'flex-wrap',
                )}
              >
                {plan.shown.map((code) => (
                  <span key={code} data-slot="entity-type-picker-chip" className={PICKER_TEXT_CHIP}>
                    <span className="truncate">{labelOf(code)}</span>
                    {multiple && interactive ? (
                      <button
                        type="button"
                        data-slot="entity-type-picker-remove"
                        aria-label={`Remove ${labelOf(code)}`}
                        onClick={() => emit(selected.filter((c) => c !== code))}
                        className="hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm opacity-60 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
                      >
                        <X aria-hidden="true" className="size-3" />
                      </button>
                    ) : null}
                  </span>
                ))}
              </span>
              {plan.overflow > 0 ? (
                <span
                  data-slot="entity-type-picker-overflow"
                  className="text-muted-foreground shrink-0 text-xs tabular-nums"
                >
                  +{plan.overflow}
                </span>
              ) : null}
            </>
          )}
        </span>
      ) : null}
      <ComboboxPrimitive.Input
        ref={inputRef}
        data-slot="entity-type-picker-input"
        aria-invalid={invalid ? 'true' : undefined}
        aria-label={placeholder}
        readOnly={readOnly || undefined}
        placeholder={selected.length > 0 ? searchPlaceholder : placeholder}
        className={PICKER_INPUT}
      />
    </div>
  );

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
          data-picker="entity-type"
          data-slot="entity-type-picker-content"
          className={PICKER_POPUP}
        >
          <ComboboxPrimitive.List data-slot="entity-type-picker-list" className={PICKER_LIST}>
            {note ?? ((code: string) => renderRow(code))}
          </ComboboxPrimitive.List>
        </ComboboxPrimitive.Popup>
      </ComboboxPrimitive.Positioner>
    </ComboboxPrimitive.Portal>
  );

  const actions = readOnly ? null : (
    <div className="pointer-events-none absolute right-2 flex items-center gap-1">
      {showClear ? (
        <button
          type="button"
          data-slot="entity-type-picker-clear"
          aria-label="Clear the selection"
          onClick={() => {
            emit(multiple ? [] : null);
            inputRef.current?.focus({ preventScroll: true });
          }}
          className={PICKER_ICON_BUTTON}
        >
          <X aria-hidden="true" className={PICKER_GLYPH[size]} />
        </button>
      ) : null}
      <ComboboxPrimitive.Trigger
        data-slot="entity-type-picker-trigger"
        aria-label="Show the entity types"
        disabled={disabled}
        className="pointer-events-auto shrink-0 outline-none"
      >
        <ChevronsUpDown aria-hidden="true" className={cn('shrink-0 opacity-50', PICKER_GLYPH[size])} />
      </ComboboxPrimitive.Trigger>
    </div>
  );

  const codes = shown.map((type) => type.name);
  const query = (next: string, reason: string) => {
    if (reason === 'item-press') return;
    setSearch(next);
  };

  return (
    <div
      data-slot="entity-type-picker"
      data-size={size}
      data-multiple={multiple ? 'true' : 'false'}
      data-summary={multiple ? summary : undefined}
      className={cn('relative flex w-full min-w-0 items-center', className)}
    >
      {multiple ? (
        <ComboboxPrimitive.Root
          multiple
          items={codes}
          filter={null}
          openOnInputClick={false}
          autoHighlight
          disabled={disabled}
          inputValue={search}
          onInputValueChange={(next, details) => query(next, details.reason)}
          open={open}
          value={selected}
          onValueChange={(next) => emit(next)}
          onOpenChange={(next, details) => {
            // A press on a row is a tick, not a commit: the popup stays open so
            // several types can be ticked from one query.
            if (!next && details.reason === 'item-press') {
              details.cancel();
              return;
            }
            setOpen(interactive ? next : false);
            if (!next) setSearch('');
          }}
        >
          {control}
          {list}
          {actions}
        </ComboboxPrimitive.Root>
      ) : (
        <ComboboxPrimitive.Root
          items={codes}
          filter={null}
          openOnInputClick={false}
          autoHighlight
          disabled={disabled}
          inputValue={search}
          onInputValueChange={(next, details) => query(next, details.reason)}
          open={open}
          value={(value as string | null) ?? null}
          onValueChange={(next) => emit(next)}
          onOpenChange={(next) => {
            setOpen(interactive ? next : false);
            if (!next) setSearch('');
          }}
        >
          {control}
          {list}
          {actions}
        </ComboboxPrimitive.Root>
      )}
    </div>
  );
}
