import * as React from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { toApiDate } from '@sg-widgets/core';
import { CalendarIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CONTROL_BOX, CONTROL_GLYPH, type ControlSize } from '@/registry/sg/components/control-classes';
import { fromCalendarDate, toCalendarDate } from '@/registry/sg/components/editor-calendar';
import { ValueEditor, useValueSession } from '@/registry/sg/components/value-editor';

export type DateEditorSize = ControlSize;

export interface DateEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** The stored day, exactly `YYYY-MM-DD`, with no time and no zone (field_types/date). */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
  /** The row form: the button takes the width of its value. */
  inline?: boolean;
  size?: DateEditorSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  /** Whether the calendar popover is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * A `date` field.
 *
 * The value is exactly `YYYY-MM-DD`: no time, no zone, and the API validates the day
 * rather than only parsing it, so `2026-02-30` is refused here too. A timestamp is
 * never a date on this type (field_types/date).
 *
 * One anatomy everywhere: a button carrying the stored day, over a popover holding the
 * typed day and the calendar. `inline` only sizes the button to its value.
 */
export function DateEditor({
  value = null,
  onValueChange,
  field = null,
  inline = false,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder = 'YYYY-MM-DD',
  open: openProp,
  onOpenChange,
  errorMessage,
  className,
  ...rest
}: DateEditorProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = openProp ?? uncontrolledOpen;
  const dayInput = React.useRef<HTMLInputElement>(null);

  const setOpen = (next: boolean): void => {
    const wanted = readonly || disabled ? false : next;
    if (wanted === open) return;
    setUncontrolledOpen(wanted);
    onOpenChange?.(wanted);
  };

  const session = useValueSession<string | null, string>({
    value,
    format: (stored) => stored ?? '',
    parse: toApiDate,
    onValueChange,
    onErrorChange,
    error,
    invalid,
    stopKeys: true,
    onEnter: (committed) => {
      if (!committed) return;
      session.editing.current = false;
      setOpen(false);
    },
    onEscape: () => {
      session.editing.current = false;
    },
  });

  const day = toCalendarDate(value);

  const pick = (picked: Date | undefined): void => {
    session.editing.current = false;
    setOpen(false);
    session.apply(fromCalendarDate(picked) || null);
  };

  return (
    <ValueEditor
      slotName="date-editor"
      size={size}
      inline={inline}
      message={session.message}
      errorMessage={errorMessage}
      className={className}
      {...rest}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-slot="date-editor-trigger"
          aria-label={field?.displayName ?? 'Pick a date'}
          aria-invalid={session.invalid}
          aria-disabled={disabled ? 'true' : undefined}
          data-readonly={readonly ? 'true' : undefined}
          disabled={disabled}
          title={value ?? undefined}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'w-full justify-start gap-1.5 font-normal tabular-nums',
            CONTROL_BOX[size],
            !value && 'text-muted-foreground',
          )}
        >
          <CalendarIcon aria-hidden="true" className={cn(CONTROL_GLYPH[size], 'shrink-0')} />
          <span className="truncate">{value ?? placeholder}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-auto flex-col gap-3 p-3" initialFocus={dayInput}>
          <Input
            ref={dayInput}
            value={session.draft}
            type="text"
            data-slot="date-editor-day"
            disabled={disabled}
            readOnly={readonly}
            placeholder={placeholder}
            className={cn('tabular-nums', CONTROL_BOX[size])}
            aria-invalid={session.invalid}
            aria-label={field?.displayName ?? 'Date'}
            aria-required={field?.mandatory}
            onChange={(event) => session.setDraft(event.target.value)}
            onFocus={session.onFocus}
            onBlur={session.onBlur}
            onKeyDown={session.onKeyDown}
          />
          <Calendar mode="single" className="p-0" selected={day} onSelect={pick} />
        </PopoverContent>
      </Popover>
    </ValueEditor>
  );
}
