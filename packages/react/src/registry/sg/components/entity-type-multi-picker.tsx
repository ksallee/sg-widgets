import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { EntityTypeInfo, PickerSummary, SgContext } from 'sg-widgets-core';
import { entityTypeOptions, errorText, NO_MATCH_LABEL } from 'sg-widgets-core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  PICKER_ARMED,
  PICKER_ROW,
  PICKER_TEXT_CHIP,
  PICKER_TEXT_CHIP_BOX,
  PICKER_TEXT_CHIP_CROSS,
} from '@/registry/sg/components/picker-classes';
import { REMOVE_CONTROL } from '@/registry/sg/components/leaf-classes';
import { PickerControl } from '@/registry/sg/components/picker-control';

export type EntityTypeMultiPickerSize = 'sm' | 'md' | 'lg';

export interface EntityTypeMultiPickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** The widget context. The site's enabled types are read through it, once per page. */
  context: SgContext;
  /** The chosen type codes, in the order they were ticked. */
  value?: string[];
  onValueChange?: (value: string[]) => void;
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
  /** What the control shows for the selection. */
  summary?: PickerSummary;
  /** Chips drawn before the rest becomes `+n`. `0` draws every chip. */
  max?: number;
  size?: EntityTypeMultiPickerSize;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * Several entity types, as a searchable combobox.
 *
 * The list is every type the site has enabled, display name first with the code
 * beneath it when the two differ, and a checkbox on every row. `allow` and `deny`
 * narrow the derived options rather than the read, so a caller switching sets sees
 * the list change without a refetch. The vocabulary is one read, so the query input
 * narrows it in the browser. A pick keeps the list open.
 */
export function EntityTypeMultiPicker({
  context,
  value = [],
  onValueChange,
  allow,
  deny,
  placeholder = 'Select entity types',
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
}: EntityTypeMultiPickerProps) {
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
        if (live) setFailure(errorText(error));
      });
    return () => {
      live = false;
    };
  }, [schema]);

  const options = entityTypeOptions(loaded, { allow, deny, query: search });
  const selected = value;
  const byName = new Map(options.types.map((type) => [type.name, type]));
  /**
   * A chip control is a token field, with the caret beside the chips. A control
   * summarising its selection is a trigger, and keeps its search box at the top of
   * the popup instead.
   */
  const inline = summary === 'chips';
  const interactive = !readonly && !disabled;

  function emit(next: string[]): void {
    onValueChange?.(next);
  }

  function remove(code: string): void {
    emit(selected.filter((c) => c !== code));
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
        data-selected-type={chosen ? 'true' : undefined}
        value={code}
        className={cn(PICKER_ROW, 'items-start')}
      >
        <span data-slot="entity-type-picker-check" className="flex h-5 shrink-0 items-center">
          <Checkbox checked={chosen} tabIndex={-1} aria-hidden="true" className="pointer-events-none" />
        </span>
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
      data-multiple="true"
      data-summary={summary}
      className={cn('relative flex w-full min-w-0 items-center', className)}
      {...rest}
    >
      <PickerControl
        slot="entity-type-picker"
        picker="entity-type-multi"
        multiple
        keys={selected}
        onSelect={emit}
        labels={selected.map(options.labelOf)}
        items={options.shown.map((type) => type.name)}
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
              <span className="truncate">{options.labelOf(code)}</span>
              {interactive ? (
                <button
                  type="button"
                  data-slot="entity-type-picker-remove"
                  aria-label={`Remove ${options.labelOf(code)}`}
                  onClick={() => remove(code)}
                  className={REMOVE_CONTROL}
                >
                  <X aria-hidden="true" className={PICKER_TEXT_CHIP_CROSS[size]} />
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
        onClear={() => emit([])}
        loading={loaded === null}
        error={failure}
        empty={options.shown.length === 0}
        emptyLabel={emptyLabel}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        triggerLabel="Show the entity types"
        overflowLabel={`Show all ${selected.length} types`}
      />
    </div>
  );
}
