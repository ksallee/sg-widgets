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
import { FieldError } from '@/registry/sg/components/field-error';

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
  const [draft, setDraft] = React.useState(value ?? '');
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const editing = React.useRef(false);
  const dayInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!editing.current) setDraft(value ?? '');
  }, [value]);

  const message = error ?? parseError;
  const isInvalid = invalid || message !== null;
  const day = toCalendarDate(value);

  const emit = (next: string | null): void => {
    setParseError(null);
    onErrorChange?.(null);
    setDraft(next ?? '');
    if (next === value) return;
    onValueChange?.(next);
  };

  /** Commits the typed day. Answers whether it parsed, so Enter knows to close. */
  const commit = (): boolean => {
    const result = toApiDate(draft);
    if ('error' in result) {
      setParseError(result.error);
      onErrorChange?.(result.error);
      return false;
    }
    emit(result.value);
    return true;
  };

  const pick = (picked: Date | undefined): void => {
    editing.current = false;
    setOpen(false);
    emit(fromCalendarDate(picked) || null);
  };

  // Losing focus because the control was removed from the page is not a commit.
  const onBlur = (event: React.FocusEvent<HTMLInputElement>): void => {
    if (!event.currentTarget.isConnected) return;
    editing.current = false;
    commit();
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== 'Escape') return;
    // The popover is portalled out of the widget, but React replays a synthetic event
    // up its own tree, so a key the editor answers is stopped here in both frameworks.
    event.stopPropagation();
    if (event.key === 'Enter') {
      if (!commit()) return;
      editing.current = false;
      setOpen(false);
      return;
    }
    setDraft(value ?? '');
    setParseError(null);
    onErrorChange?.(null);
    editing.current = false;
  };

  return (
    <div
      data-slot="date-editor"
      data-size={size}
      data-inline={inline ? 'true' : undefined}
      className={cn('flex w-full min-w-0 flex-col gap-2', inline && 'w-fit', className)}
      {...rest}
    >
      <Popover open={open} onOpenChange={(next) => setOpen(readonly || disabled ? false : next)}>
        <PopoverTrigger
          data-slot="date-editor-trigger"
          aria-label={field?.displayName ?? 'Pick a date'}
          aria-invalid={isInvalid}
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
            value={draft}
            type="text"
            data-slot="date-editor-day"
            disabled={disabled}
            readOnly={readonly}
            placeholder={placeholder}
            className={cn('tabular-nums', CONTROL_BOX[size])}
            aria-invalid={isInvalid}
            aria-label={field?.displayName ?? 'Date'}
            aria-required={field?.mandatory}
            onChange={(event) => setDraft(event.target.value)}
            onFocus={() => {
              editing.current = true;
            }}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          />
          <Calendar mode="single" className="p-0" selected={day} onSelect={pick} />
        </PopoverContent>
      </Popover>
      <FieldError message={message} errorMessage={errorMessage} />
    </div>
  );
}
