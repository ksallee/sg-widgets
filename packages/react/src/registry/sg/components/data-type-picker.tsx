import type * as React from 'react';
import { useState } from 'react';
import type { StatusOption } from 'sg-widgets-core';
import { dataTypeLabel, dataTypeOptions, NO_ROWS_LABEL } from 'sg-widgets-core';
import { fieldGlyph } from '@/registry/sg/components/field-glyphs';
import { CHIP_BOX, CHIP_GLYPH, CHIP_PAD, CHIP_SPACING, LEAF_GLYPH } from '@/registry/sg/components/leaf-classes';
import { ListPicker } from '@/registry/sg/components/list-picker';
import { PICKER_CHIP, PICKER_TEXT_CHIP } from '@/registry/sg/components/picker-classes';
import { cn } from '@/lib/utils';

export type DataTypePickerSize = 'sm' | 'md' | 'lg';

export interface DataTypePickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'slot'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;
  /** The data types on offer, in the order they are listed. The caller decides the set. */
  types?: readonly string[];
  /** The chosen data type, by its API name, or `null` when nothing is chosen. */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  /** Labels of the caller's own, by API name. They win over the built-in ones. */
  labels?: Readonly<Record<string, string>>;
  placeholder?: string;
  /** Shown when no type is on offer. */
  emptyLabel?: string;
  /** Offer a search box, which narrows the set in the browser. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Offer a control that clears the value. */
  clearable?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Draw the API name as the row's right-aligned secondary, when it says more than the label. */
  showCode?: boolean;
  /** The muted line under a row's label. */
  subLabel?: (option: StatusOption) => string;
  /** A row's right-aligned value, of the caller's own making. Wins over the API name. */
  secondary?: (option: StatusOption) => string;
  size?: DataTypePickerSize;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

const NO_TYPES: readonly string[] = [];

/**
 * One field data type, picked from the set the caller offers.
 *
 * The list picker with the data type's glyph as a row's leading mark and a chip for
 * its value. The widget names no set of its own: which types a site lets a client
 * create is the caller's to say (019_create_fields).
 *
 * The value is the API name. A type outside the set still draws, under its label, and
 * a type this build has never heard of draws under the name it was given with the
 * document glyph, so a read-only control shows whatever a site's schema answered.
 */
export function DataTypePicker({
  types = NO_TYPES,
  value = null,
  onValueChange,
  labels,
  placeholder = 'Select a data type',
  emptyLabel = NO_ROWS_LABEL,
  searchable = false,
  searchPlaceholder = 'Search data types…',
  clearable = false,
  readonly = false,
  disabled = false,
  invalid = false,
  showCode = true,
  subLabel,
  secondary,
  size = 'md',
  open: openProp,
  onOpenChange,
  className,
  ref,
  ...rest
}: DataTypePickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  // A held type outside the set keeps a row of its own, labelled like the rest.
  const options = dataTypeOptions(types, { value, labels });
  const chip = PICKER_CHIP[size];

  return (
    <ListPicker
      ref={ref}
      slot="data-type-picker"
      picker="data-type"
      options={options}
      value={value || null}
      onValueChange={(next) => onValueChange?.(next)}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      searchable={searchable}
      searchPlaceholder={searchPlaceholder}
      clearable={clearable}
      clearLabel="Clear the data type"
      triggerLabel="Show the data types"
      readonly={readonly}
      disabled={disabled}
      invalid={invalid}
      showCode={showCode}
      subLabel={subLabel}
      secondary={secondary}
      size={size}
      open={open}
      onOpenChange={setOpen}
      className={className}
      valueChip={(code) => {
        const Glyph = fieldGlyph(code);
        return (
          <span
            key={code}
            data-slot="data-type-picker-chip"
            data-type={code}
            title={dataTypeLabel(code, labels)}
            className={cn(
              PICKER_TEXT_CHIP,
              CHIP_BOX[chip],
              CHIP_PAD[chip].text,
              CHIP_PAD[chip].lead,
              CHIP_SPACING[chip].glyph,
            )}
          >
            <Glyph aria-hidden="true" className={cn('shrink-0 opacity-70', CHIP_GLYPH[chip])} />
            <span className="truncate">{dataTypeLabel(code, labels)}</span>
          </span>
        );
      }}
      mark={(option) => {
        const Glyph = fieldGlyph(option.code);
        return <Glyph aria-hidden="true" className={LEAF_GLYPH[size]} />;
      }}
      {...rest}
    />
  );
}
