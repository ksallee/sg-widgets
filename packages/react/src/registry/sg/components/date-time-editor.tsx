import * as React from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { fromApiDateTime, timeZoneName, toApiDateTime } from '@sg-widgets/core';
import { CalendarIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type DateTimeEditorSize = 'sm' | 'md' | 'lg';

/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
const BOX: Record<DateTimeEditorSize, string> = {
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-10',
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

function toCalendarDate(value: string): Date | undefined {
  const m = DATE_ONLY.exec(value.trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromCalendarDate(value: Date | undefined): string {
  if (!value) return '';
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
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
  errorMessage,
  className,
  ...rest
}: DateTimeEditorProps) {
  const zoneOptions = timeZone === undefined ? {} : { timeZone };
  const zone = timeZoneName(timeZone);
  const local = fromApiDateTime(value, zoneOptions);
  const incomingDate = local?.date ?? '';
  const incomingTime = local === null ? '' : showSeconds ? local.timeWithSeconds : local.time;
  // The button reads the stored instant, so it answers a commit and never a draft.
  const label = local === null ? null : `${incomingDate} ${incomingTime}`;

  const [dateDraft, setDateDraft] = React.useState(incomingDate);
  const [timeDraft, setTimeDraft] = React.useState(incomingTime);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const editing = React.useRef(false);
  const dateInput = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing.current) return;
    setDateDraft(incomingDate);
    setTimeDraft(incomingTime);
  }, [incomingDate, incomingTime]);

  const message = error ?? parseError;
  const isInvalid = invalid || message !== null;
  const day = toCalendarDate(dateDraft);

  /** Commits both drafts. Answers whether they parsed, so Enter knows to close. */
  const commitWith = (date: string, time: string): boolean => {
    const result = toApiDateTime(date, time, zoneOptions);
    if ('error' in result) {
      setParseError(result.error);
      onErrorChange?.(result.error);
      return false;
    }
    setParseError(null);
    onErrorChange?.(null);
    const next = fromApiDateTime(result.value, zoneOptions);
    setDateDraft(next?.date ?? '');
    setTimeDraft(next === null ? '' : showSeconds ? next.timeWithSeconds : next.time);
    if (result.value === value) return true;
    onValueChange?.(result.value);
    return true;
  };

  const commit = (): boolean => commitWith(dateDraft, timeDraft);

  // A picked day leaves the popover open: the time is the other half of the value.
  const pick = (picked: Date | undefined): void => {
    const next = fromCalendarDate(picked);
    setDateDraft(next);
    commitWith(next, timeDraft);
  };

  const reset = (): void => {
    setDateDraft(incomingDate);
    setTimeDraft(incomingTime);
    setParseError(null);
    onErrorChange?.(null);
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
    reset();
    editing.current = false;
  };

  return (
    <div
      data-slot="date-time-editor"
      data-size={size}
      data-inline={inline ? 'true' : undefined}
      className={cn('flex w-full min-w-0 flex-col gap-2', inline && 'w-fit', className)}
      {...rest}
    >
      <Popover open={open} onOpenChange={(next) => setOpen(readonly || disabled ? false : next)}>
        <PopoverTrigger
          data-slot="date-time-editor-trigger"
          aria-label={field?.displayName ?? 'Pick a date and time'}
          aria-invalid={isInvalid}
          aria-disabled={disabled ? 'true' : undefined}
          data-readonly={readonly ? 'true' : undefined}
          disabled={disabled}
          title={value ?? undefined}
          className={cn(
            buttonVariants({ variant: 'outline', size: 'sm' }),
            'w-full justify-start gap-1.5 font-normal tabular-nums',
            BOX[size],
            !label && 'text-muted-foreground',
          )}
        >
          <CalendarIcon aria-hidden="true" className="size-4 shrink-0" />
          <span className="truncate">{label ?? placeholder}</span>
        </PopoverTrigger>
        <PopoverContent align="start" className="flex w-auto flex-col gap-3 p-3" initialFocus={dateInput}>
          <Input
            ref={dateInput}
            value={dateDraft}
            type="text"
            data-slot="date-time-editor-date"
            disabled={disabled}
            readOnly={readonly}
            placeholder={placeholder}
            className={cn('tabular-nums', BOX[size])}
            aria-invalid={isInvalid}
            aria-label={field?.displayName ?? 'Date'}
            aria-required={field?.mandatory}
            onChange={(event) => setDateDraft(event.target.value)}
            onFocus={() => {
              editing.current = true;
            }}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          />
          <Calendar mode="single" className="p-0" selected={day} onSelect={pick} />
          <Input
            value={timeDraft}
            type="time"
            data-slot="date-time-editor-time"
            step={showSeconds ? 1 : undefined}
            disabled={disabled}
            readOnly={readonly}
            className={cn('tabular-nums', BOX[size])}
            aria-invalid={isInvalid}
            aria-label="Time"
            onChange={(event) => setTimeDraft(event.target.value)}
            onFocus={() => {
              editing.current = true;
            }}
            onBlur={onBlur}
            onKeyDown={onKeyDown}
          />
        </PopoverContent>
      </Popover>
      {hint && !inline ? (
        <p data-slot="date-time-editor-zone" className="text-muted-foreground truncate text-xs">
          Local time in {zone}, stored as UTC.
        </p>
      ) : null}
      {message
        ? (errorMessage?.(message) ?? (
            <p data-slot="field-editor-error" className="text-destructive text-xs">
              {message}
            </p>
          ))
        : null}
    </div>
  );
}
