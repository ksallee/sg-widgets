import * as React from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { fromApiDateTime, timeZoneName, toApiDateTime } from '@sg-widgets/core';
import { CalendarIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { CONTROL_BOX, CONTROL_GLYPH, type ControlSize } from '@/registry/sg/components/control-classes';
import { fromCalendarDate, toCalendarDate } from '@/registry/sg/components/editor-calendar';
import { ValueEditor, useValueSession } from '@/registry/sg/components/value-editor';

export type DateTimeEditorSize = ControlSize;

/** The two halves of an instant, as the popover holds them. */
interface InstantDraft {
  date: string;
  time: string;
}

export interface DateTimeEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** The stored instant, UTC `YYYY-MM-DDTHH:MM:SSZ` at second resolution (field_types/date_time). */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
  /** IANA zone the typed wall-clock time is read in. Defaults to the runtime's. */
  timeZone?: string;
  /** Name the zone under the button. */
  hint?: boolean;
  /** The row form: the button takes the width of its value and the zone line goes. */
  inline?: boolean;
  /** Seconds in the time input. The store keeps them; most fields do not need them. */
  showSeconds?: boolean;
  size?: DateTimeEditorSize;
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
 * A `date_time` field.
 *
 * The store is UTC `YYYY-MM-DDTHH:MM:SSZ`: a written offset is normalised away and a
 * zoneless string is taken as UTC, not as site-local, so the wall-clock time typed
 * here is converted before it is emitted and converted back to show
 * (field_types/date_time). The zone that conversion uses is named under the button.
 *
 * One anatomy everywhere: a button carrying the stored instant, over a popover holding
 * the typed day, the calendar and the time. `inline` only sizes the button to its value
 * and drops the zone line.
 */
export function DateTimeEditor({
  value = null,
  onValueChange,
  field = null,
  timeZone,
  hint = true,
  inline = false,
  showSeconds = false,
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
}: DateTimeEditorProps) {
  const zoneOptions = timeZone === undefined ? {} : { timeZone };
  const zone = timeZoneName(timeZone);
  const local = fromApiDateTime(value, zoneOptions);
  // The button reads the stored instant, so it answers a commit and never a draft.
  const label = local === null ? null : `${local.date} ${showSeconds ? local.timeWithSeconds : local.time}`;

  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);
  const open = openProp ?? uncontrolledOpen;
  const dateInput = React.useRef<HTMLInputElement>(null);

  const setOpen = (next: boolean): void => {
    const wanted = readonly || disabled ? false : next;
    if (wanted === open) return;
    setUncontrolledOpen(wanted);
    onOpenChange?.(wanted);
  };

  const session = useValueSession<string | null, InstantDraft>({
    value,
    format: (stored) => {
      const next = fromApiDateTime(stored, zoneOptions);
      return {
        date: next?.date ?? '',
        time: next === null ? '' : showSeconds ? next.timeWithSeconds : next.time,
      };
    },
    parse: (draft) => toApiDateTime(draft.date, draft.time, zoneOptions),
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

  const day = toCalendarDate(session.draft.date);

  // A picked day leaves the popover open: the time is the other half of the value.
  const pick = (picked: Date | undefined): void => {
    session.commit({ ...session.draft, date: fromCalendarDate(picked) });
  };

  return (
    <ValueEditor
      slotName="date-time-editor"
      size={size}
      inline={inline}
      message={session.message}
      errorMessage={errorMessage}
      className={className}
      {...rest}
    >
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          data-slot="date-time-editor-trigger"
          aria-label={field?.displayName ?? 'Pick a date and time'}
          aria-invalid={session.invalid}
          aria-disabled={disabled ? 'true' : undefined}
          data-readonly={readonly ? 'true' : undefined}
          disabled={disabled}
          title={value ?? undefined}
          className={cn(
            buttonVariants({ variant: 'outline' }),
            'w-full justify-start gap-1.5 font-normal tabular-nums',
            CONTROL_BOX[size],
            !label && 'text-muted-foreground',
          )}
        >
          <CalendarIcon aria-hidden="true" className={cn(CONTROL_GLYPH[size], 'shrink-0')} />
          <span className="truncate">{label ?? placeholder}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-auto flex-col gap-3 p-3" initialFocus={dateInput}>
          <Input
            ref={dateInput}
            value={session.draft.date}
            type="text"
            data-slot="date-time-editor-date"
            disabled={disabled}
            readOnly={readonly}
            placeholder={placeholder}
            className={cn('tabular-nums', CONTROL_BOX[size])}
            aria-invalid={session.invalid}
            aria-label={field?.displayName ?? 'Date'}
            aria-required={field?.mandatory}
            onChange={(event) => session.setDraft({ ...session.draft, date: event.target.value })}
            onFocus={session.onFocus}
            onBlur={session.onBlur}
            onKeyDown={session.onKeyDown}
          />
          <Calendar mode="single" className="p-0" selected={day} onSelect={pick} />
          <Input
            value={session.draft.time}
            type="time"
            data-slot="date-time-editor-time"
            step={showSeconds ? 1 : undefined}
            disabled={disabled}
            readOnly={readonly}
            className={cn('tabular-nums', CONTROL_BOX[size])}
            aria-invalid={session.invalid}
            aria-label="Time"
            onChange={(event) => session.setDraft({ ...session.draft, time: event.target.value })}
            onFocus={session.onFocus}
            onBlur={session.onBlur}
            onKeyDown={session.onKeyDown}
          />
        </PopoverContent>
      </Popover>
      {hint && !inline ? (
        <p data-slot="date-time-editor-zone" className="text-muted-foreground truncate text-xs">
          Local time in {zone}, stored as UTC.
        </p>
      ) : null}
    </ValueEditor>
  );
}
