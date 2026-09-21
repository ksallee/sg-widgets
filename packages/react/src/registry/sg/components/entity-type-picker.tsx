import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { EntityTypeInfo, SgContext } from '@sg-widgets/core';
import { entityTypeOptions, errorText, NO_MATCH_LABEL } from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
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
  /** The chosen type code. */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
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
  size?: EntityTypePickerSize;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

/**
 * One entity type, as a searchable combobox.
 *
 * The list is every type the site has enabled, display name first with the code
 * beneath it when the two differ. `allow` and `deny` narrow the derived options
 * rather than the read, so a caller switching sets sees the list change without a
 * refetch. The vocabulary is one read, so the query input narrows it in the browser.
 * A pick closes the list.
 */
export function EntityTypePicker({
  context,
  value = null,
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
        if (live) setFailure(errorText(error));
      });
    return () => {
      live = false;
    };
  }, [schema]);

  const options = entityTypeOptions(loaded, { allow, deny, query: search });
  const selected = value ? [value] : [];
  const byName = new Map(options.types.map((type) => [type.name, type]));

  function emit(next: string | null): void {
    onValueChange?.(next);
  }

  function renderItem(code: string): ReactNode {
    const type = byName.get(code);
    if (!type) return null;
    const chosen = value === code;
    return (
      <ComboboxPrimitive.Item
        key={code}
        data-slot="entity-type-picker-option"
        data-entity-type={code}
        data-checked={chosen ? 'true' : undefined}
        data-selected-type={chosen ? 'true' : undefined}
        value={code}
        className={cn(PICKER_ROW, 'items-start')}
      >
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
      data-multiple="false"
      className={cn('relative flex w-full min-w-0 items-center', className)}
      {...rest}
    >
      <PickerControl
        slot="entity-type-picker"
        picker="entity-type"
        keys={selected}
        onSelect={(keys) => emit(keys[0] ?? null)}
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
            </span>
          );
        }}
        summary="ellipsis"
        chipRow
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
        onRemoveAt={() => emit(null)}
        onClear={() => emit(null)}
        loading={loaded === null}
        error={failure}
        empty={options.shown.length === 0}
        emptyLabel={emptyLabel}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        triggerLabel="Show the entity types"
      />
    </div>
  );
}
