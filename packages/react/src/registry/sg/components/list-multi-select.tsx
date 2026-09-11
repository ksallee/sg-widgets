import type * as React from 'react';
import { useState } from 'react';
import type { ReactNode } from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { matchesTokens, statusLabel, usableStatuses } from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  PICKER_ARMED,
  PICKER_ROW,
  PICKER_TEXT_CHIP,
  PICKER_TEXT_CHIP_BOX,
} from '@/registry/sg/components/picker-classes';
import { PickerControl } from '@/registry/sg/components/picker-control';
import { cn } from '@/lib/utils';

export type ListMultiSelectSize = 'sm' | 'md' | 'lg';

export interface ListMultiSelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
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
  size?: ListMultiSelectSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  /** A message from the caller. The list has nothing of its own to fail on. */
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * Several values of a `list` field.
 *
 * The vocabulary is the field's `valid_values`, byte for byte: a value outside it is
 * a 400 and the comparison is case-sensitive (field_types/list). With a project id
 * the field's hidden values are subtracted, which REST does not do on write.
 */
export function ListMultiSelect({
  value = [],
  onValueChange,
  field = null,
  projectId,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder = 'Select values',
  searchPlaceholder = 'Search values…',
  emptyLabel = 'No value.',
  open: openProp,
  onOpenChange,
  errorMessage,
  className,
  ...rest
}: ListMultiSelectProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [search, setSearch] = useState('');

  const options =
    projectId === undefined
      ? (field?.validValues ?? []).map((code) => ({ code, label: statusLabel(field ?? {}, code) }))
      : usableStatuses(field ?? {});
  // The vocabulary is one read, so the search box narrows it here.
  const shown = options.filter((option) => matchesTokens(search, option.label, option.code));
  const interactive = !readonly && !disabled;

  // A row may hold a value outside the offered set; that is a legal stored value, so
  // it is shown as itself rather than dropped (probe 009).
  const labelOf = (code: string): string => options.find((option) => option.code === code)?.label ?? code;

  const emit = (next: string[]): void => {
    onErrorChange?.(null);
    onValueChange?.(next);
  };

  const remove = (code: string): void => emit(value.filter((c) => c !== code));

  const removeAt = (index: number): void => {
    const code = value[index];
    if (code !== undefined) remove(code);
  };

  const byCode = new Map(options.map((option) => [option.code, option]));

  function renderItem(code: string): ReactNode {
    const option = byCode.get(code);
    if (!option) return null;
    const chosen = value.includes(code);
    return (
      <ComboboxPrimitive.Item
        key={code}
        data-slot="list-multi-select-option"
        data-option={code}
        data-checked={chosen ? 'true' : undefined}
        value={code}
        className={PICKER_ROW}
      >
        <span data-slot="list-multi-select-check" className="flex h-5 shrink-0 items-center">
          <Checkbox checked={chosen} tabIndex={-1} aria-hidden="true" className="pointer-events-none" />
        </span>
        <span className="min-w-0 flex-1 truncate">{option.label}</span>
      </ComboboxPrimitive.Item>
    );
  }

  return (
    <div
      data-slot="list-multi-select"
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      <div className="relative flex w-full min-w-0 items-center">
        <PickerControl
          slot="list-multi-select"
          picker="list"
          multiple
          anchored
          keys={value}
          onSelect={emit}
          labels={value.map(labelOf)}
          items={shown.map((option) => option.code)}
          renderItem={renderItem}
          renderChip={(index, armed, hidden) => {
            const code = value[index];
            if (code === undefined) return null;
            return (
              <span
                key={code}
                data-slot="list-multi-select-chip"
                data-chip=""
                data-armed={armed ? 'true' : undefined}
                hidden={hidden}
                className={cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX[size], armed && PICKER_ARMED)}
              >
                <span className="truncate">{labelOf(code)}</span>
                {interactive ? (
                  <button
                    type="button"
                    data-slot="list-multi-select-remove"
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
          chipRow
          inline={false}
          clearable={false}
          size={size}
          disabled={disabled}
          readonly={readonly}
          invalid={invalid}
          placeholder={placeholder}
          searchPlaceholder={searchPlaceholder}
          open={open}
          onOpenChange={setOpen}
          query={search}
          onQueryChange={setSearch}
          onRemoveAt={removeAt}
          empty={shown.length === 0}
          emptyLabel={emptyLabel}
          triggerLabel="Show the values"
          overflowLabel={`Show all ${value.length} values`}
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
