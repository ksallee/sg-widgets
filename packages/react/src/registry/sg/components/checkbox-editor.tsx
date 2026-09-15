import type * as React from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { CONTROL_HEIGHT, type ControlSize } from '@/registry/sg/components/control-classes';
import { FieldError } from '@/registry/sg/components/field-error';

export type CheckboxEditorSize = ControlSize;

/** The switch primitive carries two sizes; the third reuses the larger one. */
const SWITCH: Record<CheckboxEditorSize, 'sm' | 'default'> = {
  sm: 'sm',
  md: 'default',
  lg: 'default',
};

export interface CheckboxEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** Two-state and never null: an untouched row already reads false (field_types/checkbox). */
  value?: boolean;
  onValueChange?: (value: boolean) => void;
  field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
  size?: CheckboxEditorSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  /** A message from the caller. The switch has nothing of its own to fail on. */
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  /** The two words shown beside the switch. */
  labels?: { on: string; off: string };
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * A `checkbox` field.
 *
 * The type is two-state and never null: a row that was never touched already reads
 * false, a written null is a 400, and `false` is the only off state there is
 * (field_types/checkbox). So this control has no empty state and no clear affordance.
 */
export function CheckboxEditor({
  value = false,
  onValueChange,
  field = null,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder,
  labels = { on: 'Yes', off: 'No' },
  errorMessage,
  className,
  ...rest
}: CheckboxEditorProps) {
  const checked = value === true;
  const label = checked ? labels.on : labels.off;

  // `false` is the only off state: null is unwritable on this type (field_types/checkbox).
  const toggle = (next: boolean): void => {
    if (readonly || disabled) return;
    onErrorChange?.(null);
    onValueChange?.(next);
  };

  return (
    <div
      data-slot="checkbox-editor"
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      <div className={cn('flex w-full min-w-0 items-center gap-2', CONTROL_HEIGHT[size])}>
        <Switch
          size={SWITCH[size]}
          checked={checked}
          disabled={disabled || readonly}
          aria-readonly={readonly}
          aria-invalid={invalid}
          aria-label={field?.displayName ?? placeholder ?? label}
          onCheckedChange={toggle}
          // Disabled wins over readonly, so a control that is both still reads inert.
          className={readonly && !disabled ? 'data-disabled:cursor-default data-disabled:opacity-100' : undefined}
        />
        <span aria-hidden="true" className="truncate text-sm select-none">
          {label}
        </span>
      </div>
      <FieldError message={error} errorMessage={errorMessage} />
    </div>
  );
}
