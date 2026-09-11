import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { EntityTypeInfo, PickerSummary, SgContext } from '@sg-widgets/core';
import { filterEntityTypes, matchesTokens, NO_MATCH_LABEL } from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  PICKER_ARMED,
  PICKER_ROW,
  PICKER_TEXT_CHIP,
  PICKER_TEXT_CHIP_BOX,
} from '@/registry/sg/components/picker-classes';
import { PickerControl } from '@/registry/sg/components/picker-control';

export type EntityTypePickerSize = 'sm' | 'md' | 'lg';

export interface EntityTypePickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** The widget context. The site's enabled types are read through it, once per page. */
  context: SgContext;
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
  /** Show the code under the display name where the two differ. */
  showCode?: boolean;
  /** What the control shows for the selection in multi mode. */
  summary?: PickerSummary;
  /** Chips drawn before the rest becomes `+n`. `0` draws every chip. */
  max?: number;
  size?: EntityTypePickerSize;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
  context,
  value = null,
  multiple = false,
  onValueChange,
  allow,
  deny,
  placeholder = 'Select an entity type',
  searchPlaceholder = 'Search types…',
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
  clearable = true,
  readonly = false,
  disabled = false,
  invalid = false,
  showCode = true,
  summary = 'ellipsis',
  max = 0,
  size = 'md',
  open: openProp,
  onOpenChange,
  className,
  ref,
  ...rest
}: EntityTypePickerProps) {
  // The context's own service, so every widget on the page shares one schema read.
  const schema = context.schema;
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [search, setSearch] = useState('');
  const [loaded, setLoaded] = useState<EntityTypeInfo[] | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

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
  /**
   * A chip control is a token field, with the caret beside the chips. A multi
   * control summarising its selection is a trigger, and keeps its search box at the
   * top of the popup instead. A single picker is always a token field.
   */
  const inline = !multiple || summary === 'chips';
  const interactive = !readonly && !disabled;

  function emit(next: string | string[] | null): void {
    onValueChange?.(next);
  }

  function remove(code: string): void {
    emit(multiple ? selected.filter((c) => c !== code) : null);
  }

  function removeAt(index: number): void {
    const code = selected[index];
    if (code !== undefined) remove(code);
  }

  function renderItem(code: string): ReactNode {
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

  return (
    <div
      ref={ref}
      data-slot="entity-type-picker"
      data-size={size}
      data-multiple={multiple ? 'true' : 'false'}
      data-summary={multiple ? summary : undefined}
      className={cn('relative flex w-full min-w-0 items-center', className)}
      {...rest}
    >
      <PickerControl
        slot="entity-type-picker"
        picker="entity-type"
        multiple={multiple}
        keys={selected}
        onSelect={(keys) => emit(multiple ? keys : (keys[0] ?? null))}
        labels={selected.map(labelOf)}
        items={shown.map((type) => type.name)}
        renderItem={renderItem}
        renderChip={(index, armed, hidden) => {
          const code = selected[index];
          if (code === undefined) return null;
          return (
            <span
              key={code}
              data-slot="entity-type-picker-chip"
              data-chip=""
              data-armed={armed ? 'true' : undefined}
              hidden={hidden}
              className={cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX[size], armed && PICKER_ARMED)}
            >
              <span className="truncate">{labelOf(code)}</span>
              {multiple && interactive ? (
                <button
                  type="button"
                  data-slot="entity-type-picker-remove"
                  aria-label={`Remove ${labelOf(code)}`}
                  onClick={() => remove(code)}
                  className="hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm opacity-60 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
                >
                  <X aria-hidden="true" className="size-3" />
                </button>
              ) : null}
            </span>
          );
        }}
        summary={summary}
        max={max}
        chipRow
        inline={inline}
        size={size}
        disabled={disabled}
        readonly={readonly}
        invalid={invalid}
        clearable={clearable}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        open={open}
        onOpenChange={setOpen}
        query={search}
        onQueryChange={setSearch}
        onRemoveAt={removeAt}
        onClear={() => emit(multiple ? [] : null)}
        loading={loaded === null}
        error={failure}
        empty={shown.length === 0}
        emptyLabel={emptyLabel}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        triggerLabel="Show the entity types"
        overflowLabel={`Show all ${selected.length} types`}
      />
    </div>
  );
}
