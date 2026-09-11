import type * as React from 'react';
import { useState } from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { statusLabel, usableStatuses } from '@sg-widgets/core';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export type ListSelectSize = 'sm' | 'md' | 'lg';

/**
 * The control ladder of `docs/design-rules.md`: 8 / 9 / 10. The height carries `!`
 * because the select trigger sets its own under a `data-size` selector.
 */
const BOX: Record<ListSelectSize, string> = {
  sm: 'h-8!',
  md: 'h-9!',
  lg: 'h-10!',
};

/** The sentinel the clear entry carries; the field itself is cleared with null. */
const CLEAR = '';

export interface ListSelectProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
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
  size?: ListSelectSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  /** A message from the caller. The list has nothing of its own to fail on. */
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  /** The label of the entry that clears the field. */
  clearLabel?: string;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * A `list` field.
 *
 * Despite the name the value is one bare string, and a write outside `valid_values`
 * is a 400 and case-sensitive, so the schema's vocabulary is the whole set a picker
 * may offer (field_types/list). With a project id the field's hidden values are
 * subtracted, which REST does not do on write.
 */
export function ListSelect({
  value = null,
  onValueChange,
  field = null,
  projectId,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder = 'Choose',
  clearLabel = 'Clear',
  open: openProp,
  onOpenChange,
  errorMessage,
  className,
  ...rest
}: ListSelectProps) {
  const options =
    projectId === undefined
      ? (field?.validValues ?? []).map((code) => ({ code, label: statusLabel(field ?? {}, code) }))
      : usableStatuses(field ?? {});
  const selected = value ?? CLEAR;
  // A row may hold a value outside the offered set; that is a legal stored value, so
  // it is shown as itself rather than dropped (probe 009).
  const label =
    value === null || value === undefined ? placeholder : (options.find((o) => o.code === value)?.label ?? value);

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const pick = (next: string | null): void => {
    const chosen = next === null || next === CLEAR ? null : next;
    if (chosen === value) return;
    onErrorChange?.(null);
    onValueChange?.(chosen);
  };

  return (
    <div
      data-slot="list-select"
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      <Select
        value={selected}
        onValueChange={pick}
        disabled={disabled || readonly}
        open={open}
        onOpenChange={(next: boolean) => setOpen(readonly || disabled ? false : next)}
      >
        <SelectTrigger
          className={cn('w-full', BOX[size])}
          aria-invalid={invalid}
          aria-label={field?.displayName}
          aria-required={field?.mandatory}
          data-placeholder={value === null || value === undefined ? '' : undefined}
        >
          <span data-slot="select-value" className="truncate">
            {label}
          </span>
        </SelectTrigger>
        <SelectContent>
          {field?.mandatory !== true ? <SelectItem value={CLEAR}>{clearLabel}</SelectItem> : null}
          {options.map((option) => (
            <SelectItem key={option.code} value={option.code}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
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
