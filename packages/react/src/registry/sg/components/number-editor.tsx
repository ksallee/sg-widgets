import * as React from 'react';
import type { FieldSchema, ParseResult } from '@sg-widgets/core';
import {
  formatDuration,
  formatFloat,
  formatTimecode,
  formatTimecodeFrames,
  parseDurationInput,
  parseFloatInput,
  parseInteger,
  parseTimecodeInput,
  toApiFloat,
} from '@sg-widgets/core';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type NumberEditorSize = 'sm' | 'md' | 'lg';

/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
const BOX: Record<NumberEditorSize, string> = {
  sm: 'h-8',
  md: 'h-9',
  lg: 'h-10',
};

interface Shape {
  hoursPerDay?: number;
  frameRate?: number;
  precision?: number;
  min?: number;
  max?: number;
}

/** The stored value as the string the input shows. Each type round-trips through its own parse. */
function toDraft(value: unknown, dataType: string, shape: Shape): string {
  if (value === null || value === undefined || value === '') return '';
  switch (dataType) {
    case 'float':
    case 'currency':
      return formatFloat(value as string, shape.precision === undefined ? {} : { decimals: shape.precision });
    case 'duration':
      // Hours and minutes, never days: a day rendering rounds and would not survive a
      // round trip through the parse. The working day is a parse unit only.
      return formatDuration(Number(value));
    case 'timecode':
      return shape.frameRate === undefined
        ? formatTimecode(Number(value))
        : formatTimecodeFrames(Number(value), shape.frameRate);
    default:
      return String(value);
  }
}

function parseFor(raw: string, dataType: string, shape: Shape): ParseResult<number | null> {
  switch (dataType) {
    case 'float':
    case 'currency':
      return parseFloatInput(raw, shape.precision === undefined ? {} : { precision: shape.precision });
    case 'duration':
      return parseDurationInput(raw, shape.hoursPerDay === undefined ? {} : { hoursPerDay: shape.hoursPerDay });
    case 'timecode':
      return parseTimecodeInput(raw, shape.frameRate === undefined ? {} : { frameRate: shape.frameRate });
    default: {
      const bounds: { min?: number; max?: number } = {};
      if (shape.min !== undefined) bounds.min = shape.min;
      if (shape.max !== undefined) bounds.max = shape.max;
      return parseInteger(raw, bounds);
    }
  }
}

/**
 * The wire value. A `float` goes as a decimal string because an Integer is refused
 * on write and JSON cannot spell `2.0`; every other type is a bare number
 * (field_types/float, number, percent, duration, timecode).
 */
function toWire(parsed: number | null, dataType: string): number | string | null {
  if (parsed === null) return null;
  return dataType === 'float' ? toApiFloat(parsed) : parsed;
}

export interface NumberEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** The stored value. A float arrives quoted, the rest as bare numbers (field_types/float). */
  value?: number | string | null;
  onValueChange?: (value: number | string | null) => void;
  /** Which numeric type is being edited. Picks the parse, the format and the affix. */
  dataType?: 'number' | 'float' | 'percent' | 'duration' | 'timecode' | 'currency';
  field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
  /** Decimals kept on a float. The store itself keeps six (field_types/float). */
  precision?: number;
  /** The site's `hours_per_day` from `GET /preferences`, for the `d` unit (field_types/duration). */
  hoursPerDay?: number;
  /** Frames per second, for the `HH:MM:SS:FF` form (field_types/timecode). */
  frameRate?: number;
  /** Shown before the value on a currency field. */
  symbol?: string;
  /** Show the stored form under the control, e.g. the minutes behind a duration. */
  hint?: boolean;
  min?: number;
  max?: number;
  size?: NumberEditorSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * The numeric family.
 *
 * One control covers six data types because they differ only in what they accept: a
 * `number`, a `percent` and a `timecode` take whole numbers, a `float` is rounded to
 * six decimals on write, a `duration` is minutes, and a `timecode` is milliseconds.
 * Nothing is clamped server-side, so the bounds here are the client's
 * (sg-groundtruth `findings/field_types/*`).
 */
export function NumberEditor({
  value = null,
  onValueChange,
  dataType = 'number',
  field = null,
  precision,
  hoursPerDay,
  frameRate,
  symbol = '$',
  hint: showHint = false,
  min,
  max,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder,
  errorMessage,
  className,
  ...rest
}: NumberEditorProps) {
  const shape: Shape = { hoursPerDay, frameRate, precision, min, max };
  const [draft, setDraft] = React.useState(() => toDraft(value, dataType, shape));
  const [parseError, setParseError] = React.useState<string | null>(null);
  const editing = React.useRef(false);
  const incoming = toDraft(value, dataType, shape);

  React.useEffect(() => {
    if (!editing.current) setDraft(incoming);
  }, [incoming]);

  const message = error ?? parseError;
  const isInvalid = invalid || message !== null;
  const prefix = dataType === 'currency' ? symbol : null;
  const suffix = dataType === 'percent' ? '%' : null;
  // A duration is stored as a whole number of minutes and the field names no unit, so
  // the number that will be written is shown outright (field_types/duration).
  const live = parseFor(draft, dataType, shape);
  const hint =
    dataType === 'duration' && !('error' in live) && live.value !== null
      ? `${live.value} ${Math.abs(live.value) === 1 ? 'minute' : 'minutes'}`
      : null;

  const commit = (): void => {
    const result = parseFor(draft, dataType, shape);
    if ('error' in result) {
      setParseError(result.error);
      onErrorChange?.(result.error);
      return;
    }
    setParseError(null);
    onErrorChange?.(null);
    const wire = toWire(result.value, dataType);
    setDraft(toDraft(wire, dataType, shape));
    if (wire === value) return;
    onValueChange?.(wire);
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
      setDraft(toDraft(value, dataType, shape));
      setParseError(null);
      onErrorChange?.(null);
    }
  };

  return (
    <div
      data-slot="number-editor"
      data-size={size}
      data-data-type={dataType}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      <div className="relative flex w-full min-w-0 items-center">
        {prefix ? (
          <span
            aria-hidden="true"
            data-slot="number-editor-affix"
            className="text-muted-foreground pointer-events-none absolute left-2.5 text-sm select-none"
          >
            {prefix}
          </span>
        ) : null}
        <Input
          value={draft}
          type="text"
          inputMode={dataType === 'duration' || dataType === 'timecode' ? 'text' : 'decimal'}
          disabled={disabled}
          readOnly={readonly}
          placeholder={placeholder}
          className={cn('tabular-nums', BOX[size], prefix && 'pl-7', suffix && 'pr-7')}
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
        {suffix ? (
          <span
            aria-hidden="true"
            data-slot="number-editor-affix"
            className="text-muted-foreground pointer-events-none absolute right-2.5 text-sm select-none"
          >
            {suffix}
          </span>
        ) : null}
      </div>
      {showHint && hint ? (
        <p data-slot="number-editor-hint" className="text-muted-foreground text-xs tabular-nums">
          {hint}
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
