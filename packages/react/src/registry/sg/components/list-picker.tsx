import type * as React from 'react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { FieldSchema, StatusOption } from '@sg-widgets/core';
import { matchesTokens, NO_ROWS_LABEL, statusLabel, usableStatuses } from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { PICKER_ROW } from '@/registry/sg/components/picker-classes';
import { PickerControl } from '@/registry/sg/components/picker-control';
import { PickerRow } from '@/registry/sg/components/picker-row';
import { cn } from '@/lib/utils';

export type ListPickerSize = 'sm' | 'md' | 'lg';

/** One offered value: the string a write sends, and the label the schema gives it. */
export type ListOption = StatusOption;

/** A row stands for a value, not an entity, so it carries a type of its own and no values. */
export const LIST_ROW_TYPE = 'ListValue';

export interface ListPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue' | 'slot'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;
  /** The stored string, one of the field's valid values, or null (field_types/list). */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
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
  size?: ListPickerSize;
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
  /** Offer a control that clears the value. A mandatory field is never clearable. */
  clearable?: boolean;
  clearLabel?: string;
  triggerLabel?: string;
  /** Draw the stored string as a row's right-aligned secondary, where it says more than the label. */
  showCode?: boolean;
  /** The muted line under a row's label. */
  subLabel?: (option: ListOption) => string;
  /** A row's right-aligned value, of the caller's own making. Wins over the code. */
  secondary?: (option: ListOption) => string;
  /** A caller's read is in flight: the list stands behind skeletons and the control is inert. */
  loading?: boolean;
  /** What a caller's read failed with, drawn in place of the list. */
  loadError?: string | null;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  errorMessage?: (message: string) => ReactNode;
  /** A row's leading mark. Given, every row carries one. */
  mark?: (option: ListOption) => ReactNode;
  /** The control's value. Drawn as plain text when the caller passes none. */
  valueChip?: (code: string) => ReactNode;
}

/**
 * One value of a `list` field, picked from the set its schema declares.
 *
 * Despite the name the value is one bare string, and a write outside `valid_values` is
 * a 400 and case-sensitive, so the schema's vocabulary is the whole set a picker may
 * offer (field_types/list). With a project id the field's hidden values are subtracted,
 * which REST does not do on write.
 *
 * The set is fixed and read once, so there is no search row unless a caller asks for
 * one, and the control is the base's summary trigger: the value reads as plain text,
 * the way a select does.
 */
export function ListPicker({
  value = null,
  onValueChange,
  field = null,
  projectId,
  options: given,
  slot = 'list-picker',
  picker = 'list',
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder = 'Choose',
  emptyLabel = NO_ROWS_LABEL,
  searchable = false,
  searchPlaceholder = 'Search values…',
  clearable = true,
  clearLabel = 'Clear the value',
  triggerLabel = 'Show the values',
  showCode = false,
  subLabel,
  secondary,
  loading = false,
  loadError = null,
  loadingLabel,
  errorLabel,
  open: openProp,
  onOpenChange,
  errorMessage,
  mark,
  valueChip,
  className,
  ref,
  ...rest
}: ListPickerProps) {
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
  const rows = value && !options.some((option) => option.code === value) ? [...options, { code: value, label: value }] : options;
  // The vocabulary is one read, so a search box narrows it here.
  const shown = searchable ? rows.filter((option) => matchesTokens(search, option.label, option.code)) : rows;
  const byCode = new Map(rows.map((option) => [option.code, option]));
  const labelOf = (code: string): string => byCode.get(code)?.label ?? code;

  const pick = (keys: string[]): void => {
    const chosen = keys[0] ?? null;
    if (chosen === value) return;
    onErrorChange?.(null);
    onValueChange?.(chosen);
  };

  const clear = (): void => {
    onErrorChange?.(null);
    onValueChange?.(null);
  };

  /** The right-aligned value: the caller's, else the stored string where it says more. */
  const secondaryOf = (option: ListOption): string | undefined => {
    if (secondary) return secondary(option) || undefined;
    return showCode && option.code !== option.label ? option.code : undefined;
  };

  function renderItem(code: string): ReactNode {
    const option = byCode.get(code);
    if (!option) return null;
    return (
      <ComboboxPrimitive.Item
        key={code}
        data-slot={`${slot}-option`}
        data-option={code}
        data-checked={code === value ? 'true' : undefined}
        value={code}
        className={PICKER_ROW}
      >
        <PickerRow
          row={{ type: LIST_ROW_TYPE, id: 0, name: option.label, values: {} }}
          query={searchable ? search : ''}
          thumbnail={mark ? 'image' : false}
          subLabel={subLabel?.(option)}
          secondary={secondaryOf(option)}
          size={size}
          glyph={mark?.(option)}
        />
      </ComboboxPrimitive.Item>
    );
  }

  return (
    <div
      ref={ref}
      data-slot={slot}
      data-size={size}
      data-loading={loading ? 'true' : undefined}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      <div className="relative flex w-full min-w-0 items-center">
        <PickerControl
          slot={slot}
          picker={picker}
          anchored
          keys={value ? [value] : []}
          onSelect={pick}
          labels={value ? [labelOf(value)] : []}
          items={shown.map((option) => option.code)}
          renderItem={renderItem}
          renderChip={() =>
            valueChip ? (
              valueChip(value ?? '')
            ) : (
              <span key="text" data-slot={`${slot}-text`} className="truncate">
                {labelOf(value ?? '')}
              </span>
            )
          }
          inline={false}
          textValue={!valueChip}
          searchable={searchable}
          size={size}
          disabled={disabled}
          inert={!readonly && (disabled || loading)}
          readonly={readonly}
          invalid={invalid}
          clearable={clearable && field?.mandatory !== true}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          open={open}
          onOpenChange={setOpen}
          query={search}
          onQueryChange={setSearch}
          onClear={clear}
          loading={loading}
          error={loadError}
          empty={shown.length === 0}
          emptyLabel={emptyLabel}
          loadingLabel={loadingLabel}
          errorLabel={errorLabel}
          clearLabel={clearLabel}
          triggerLabel={triggerLabel}
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
