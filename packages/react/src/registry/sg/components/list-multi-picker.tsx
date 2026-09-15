import type * as React from 'react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { FieldSchema, PickerSummary, StatusOption } from '@sg-widgets/core';
import { matchesTokens, NO_ROWS_LABEL, statusLabel, usableStatuses } from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  PICKER_ARMED,
  PICKER_ROW,
  PICKER_TEXT_CHIP,
  PICKER_TEXT_CHIP_BOX,
  PICKER_TEXT_CHIP_CROSS,
} from '@/registry/sg/components/picker-classes';
import { REMOVE_CONTROL } from '@/registry/sg/components/leaf-classes';
import { PickerControl } from '@/registry/sg/components/picker-control';
import { PickerRow } from '@/registry/sg/components/picker-row';
import { cn } from '@/lib/utils';

export type ListMultiPickerSize = 'sm' | 'md' | 'lg';

/** One offered value: the string a write sends, and the label the schema gives it. */
export type ListOption = StatusOption;

/** A row stands for a value, not an entity, so it carries a type of its own and no values. */
const LIST_ROW_TYPE = 'ListValue';

export interface ListMultiPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'slot'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;
  /** The chosen values, each one of the field's valid values (field_types/list). */
  value?: string[];
  onValueChange?: (value: string[]) => void;
  /** The field schema. Its valid values are the whole vocabulary a write may use. */
  field?: Pick<FieldSchema, 'displayName' | 'mandatory' | 'validValues' | 'displayValues' | 'hiddenValues'> | null;
  /**
   * The project the schema was read with. Given, the field's hidden values are
   * subtracted; REST does not enforce them on write, so the subtraction is the
   * client's (probe 009).
   */
  projectId?: number;
  /** The set on offer, of the caller's own making. Wins over the field's. */
  options?: ListOption[];
  /** The `data-slot` prefix every part of this picker carries. */
  slot?: string;
  /** The `data-picker` the popup carries. */
  picker?: string;
  size?: ListMultiPickerSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  /** A message from the caller. The list has nothing of its own to fail on. */
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  /** Shown when the list offers nothing. */
  emptyLabel?: string;
  /** Offer a search box. The set is fixed, so it is off. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Offer a control that clears the selection. A mandatory field is never clearable. */
  clearable?: boolean;
  clearLabel?: string;
  triggerLabel?: string;
  /** Draw the stored string as a row's right-aligned secondary, where it says more than the label. */
  showCode?: boolean;
  /** The muted line under a row's label. */
  subLabel?: (option: ListOption) => string;
  /** A row's right-aligned value, of the caller's own making. Wins over the code. */
  secondary?: (option: ListOption) => string;
  /** What the control shows for the selection. */
  summary?: PickerSummary;
  /** Chips drawn before the rest becomes `+n`. `0` lets the row fit what it can. */
  max?: number;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  errorMessage?: (message: string) => ReactNode;
}

/**
 * Several values of a `list` field, picked from the set its schema declares.
 *
 * The vocabulary is the field's `valid_values`, byte for byte: a value outside it is a
 * 400 and the comparison is case-sensitive (field_types/list). With a project id the
 * field's hidden values are subtracted, which REST does not do on write.
 *
 * The set is fixed and read once, so there is no search row unless a caller asks for
 * one. The control is the base's summary trigger, and a chosen value is a plain chip.
 */
export function ListMultiPicker({
  value = [],
  onValueChange,
  field = null,
  projectId,
  options: given,
  slot = 'list-multi-picker',
  picker = 'list',
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder = 'Select values',
  emptyLabel = NO_ROWS_LABEL,
  searchable = false,
  searchPlaceholder = 'Search values…',
  clearable = true,
  clearLabel = 'Clear the values',
  triggerLabel = 'Show the values',
  showCode = false,
  subLabel,
  secondary,
  summary = 'ellipsis',
  max = 0,
  open: openProp,
  onOpenChange,
  errorMessage,
  className,
  ref,
  ...rest
}: ListMultiPickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [search, setSearch] = useState('');

  const options =
    given ??
    (projectId === undefined
      ? (field?.validValues ?? []).map((code) => ({ code, label: statusLabel(field ?? {}, code) }))
      : usableStatuses(field ?? {}));
  // A row may hold a value outside the offered set; that is a legal stored value, so it
  // keeps a row of its own, labelled with the value (probe 009).
  const rows = [
    ...options,
    ...value.filter((code) => !options.some((option) => option.code === code)).map((code) => ({ code, label: code })),
  ];
  // The vocabulary is one read, so a search box narrows it here.
  const shown = searchable ? rows.filter((option) => matchesTokens(search, option.label, option.code)) : rows;
  const byCode = new Map(rows.map((option) => [option.code, option]));
  const labelOf = (code: string): string => byCode.get(code)?.label ?? code;
  const interactive = !readonly && !disabled;

  const emit = (next: string[]): void => {
    onErrorChange?.(null);
    onValueChange?.(next);
  };

  const remove = (code: string): void => emit(value.filter((c) => c !== code));

  const removeAt = (index: number): void => {
    const code = value[index];
    if (code !== undefined) remove(code);
  };

  /** The right-aligned value: the caller's, else the stored string where it says more. */
  const secondaryOf = (option: ListOption): string | undefined => {
    if (secondary) return secondary(option) || undefined;
    return showCode && option.code !== option.label ? option.code : undefined;
  };

  function renderItem(code: string): ReactNode {
    const option = byCode.get(code);
    if (!option) return null;
    const chosen = value.includes(code);
    return (
      <ComboboxPrimitive.Item
        key={code}
        data-slot={`${slot}-option`}
        data-option={code}
        data-checked={chosen ? 'true' : undefined}
        value={code}
        className={PICKER_ROW}
      >
        <PickerRow
          indicatorSlot={`${slot}-check`}
          indicator={<Checkbox checked={chosen} tabIndex={-1} aria-hidden="true" className="pointer-events-none" />}
          row={{ type: LIST_ROW_TYPE, id: 0, name: option.label, values: {} }}
          query={searchable ? search : ''}
          thumbnail={false}
          subLabel={subLabel?.(option)}
          secondary={secondaryOf(option)}
          size={size}
        />
      </ComboboxPrimitive.Item>
    );
  }

  function renderChip(index: number, armed: boolean, hidden: boolean): ReactNode {
    const code = value[index];
    if (code === undefined) return null;
    return (
      <span
        key={code}
        data-slot={`${slot}-chip`}
        data-chip=""
        data-armed={armed ? 'true' : undefined}
        hidden={hidden}
        className={cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX[size], armed && PICKER_ARMED)}
      >
        <span className="truncate">{labelOf(code)}</span>
        {interactive ? (
          <button
            type="button"
            data-slot={`${slot}-remove`}
            aria-label={`Remove ${labelOf(code)}`}
            onClick={() => remove(code)}
            className={REMOVE_CONTROL}
          >
            <X aria-hidden="true" className={PICKER_TEXT_CHIP_CROSS[size]} />
          </button>
        ) : null}
      </span>
    );
  }

  return (
    <div
      ref={ref}
      data-slot={slot}
      data-size={size}
      data-summary={summary}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      <div className="relative flex w-full min-w-0 items-center">
        <PickerControl
          slot={slot}
          picker={picker}
          multiple
          anchored
          keys={value}
          onSelect={emit}
          labels={value.map(labelOf)}
          items={shown.map((option) => option.code)}
          renderItem={renderItem}
          renderChip={renderChip}
          chipRow
          inline={false}
          summary={summary}
          max={max}
          searchable={searchable}
          size={size}
          disabled={disabled}
          readonly={readonly}
          invalid={invalid}
          clearable={clearable && field?.mandatory !== true}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          open={open}
          onOpenChange={setOpen}
          query={search}
          onQueryChange={setSearch}
          onRemoveAt={removeAt}
          onClear={() => emit([])}
          empty={shown.length === 0}
          emptyLabel={emptyLabel}
          clearLabel={clearLabel}
          triggerLabel={triggerLabel}
          overflowLabel={`Show all ${value.length} values`}
          itemToStringLabel={labelOf}
          controlProps={{ 'aria-label': field?.displayName, 'aria-required': field?.mandatory }}
        />
      </div>
      {error
        ? (errorMessage?.(error) ?? (
            <p data-slot="field-editor-error" className="text-destructive text-xs">
              {error}
            </p>
          ))
        : null}
    </div>
  );
}
