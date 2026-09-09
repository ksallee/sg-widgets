import * as React from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { toApiDate } from '@sg-widgets/core';
import { CalendarIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type DateEditorSize = 'sm' | 'md' | 'lg';

/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
const BOX: Record<DateEditorSize, string> = {
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-10',
};

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` as a calendar day, or undefined when the string is not one (field_types/date). */
function toCalendarDate(value: string | null | undefined): Date | undefined {
  const m = DATE_ONLY.exec(String(value ?? '').trim());
  if (!m) return undefined;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromCalendarDate(value: Date | undefined): string {
  if (!value) return '';
  const pad = (n: number, width = 2) => String(n).padStart(width, '0');
  return `${pad(value.getFullYear(), 4)}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

export interface DateEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** The stored day, exactly `YYYY-MM-DD`, with no time and no zone (field_types/date). */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
  size?: DateEditorSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * A `date` field.
 *
 * The value is exactly `YYYY-MM-DD`: no time, no zone, and the API validates the day
 * rather than only parsing it, so `2026-02-30` is refused here too. A timestamp is
 * never a date on this type (field_types/date).
 */
export function DateEditor({
  value = null,
  onValueChange,
  field = null,
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
}: DateEditorProps) {
  const [draft, setDraft] = React.useState(value ?? '');
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  const editing = React.useRef(false);

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

  const commit = (): void => {
    const result = toApiDate(draft);
    if ('error' in result) {
      setParseError(result.error);
      onErrorChange?.(result.error);
      return;
    }
    emit(result.value);
  };

  const pick = (picked: Date | undefined): void => {
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
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') {
      setDraft(value ?? '');
      setParseError(null);
      onErrorChange?.(null);
    }
  };

  return (
    <div
      data-slot="date-editor"
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      <div className="flex w-full min-w-0 items-center gap-2">
        <Input
          value={draft}
          type="text"
          disabled={disabled}
          readOnly={readonly}
          placeholder={placeholder}
          className={cn('tabular-nums', BOX[size])}
          aria-invalid={isInvalid}
          aria-label={field?.displayName}
          aria-required={field?.mandatory}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={() => {
            editing.current = true;
          }}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger
            disabled={disabled || readonly}
            aria-label="Pick a date"
            className={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'shrink-0', BOX[size])}
          >
            <CalendarIcon aria-hidden="true" className="size-4" />
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar mode="single" selected={day} onSelect={pick} />
          </PopoverContent>
        </Popover>
      </div>
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
