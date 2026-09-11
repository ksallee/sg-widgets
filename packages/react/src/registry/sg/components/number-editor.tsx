import * as React from 'react';
import { NumberField } from '@base-ui/react/number-field';
import type { FieldSchema, ParseResult } from '@sg-widgets/core';
import {
  formatDuration,
  formatNumberInput,
  formatTimecode,
  formatTimecodeFrames,
  numberSteps,
  parseDurationInput,
  parseFloatInput,
  parseInteger,
  parseTimecodeInput,
  settleStep,
  stepNumber,
  toApiFloat,
  unformatNumberInput,
} from '@sg-widgets/core';
import { Minus, Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CONTROL_BOX, CONTROL_GLYPH, type ControlSize } from '@/registry/sg/components/control-classes';
import { FieldError } from '@/registry/sg/components/field-error';

export type NumberEditorSize = ControlSize;

/** A stepper is the square of the control it steps. */
const STEPPER: Record<NumberEditorSize, string> = {
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-10',
};

/** Pixels of drag one step of the scrub area costs. */
const SCRUB_PIXELS = 2;

/** Steps taken at once by Shift and by Page Up or Page Down. */
const SHIFT_STEPS = 10;
const PAGE_STEPS = 100;

interface Shape {
  hoursPerDay?: number;
  frameRate?: number;
  precision?: number;
  min?: number;
  max?: number;
  locale?: string;
}

/** The types whose input is a plain number, and so is written in the locale's marks. */
const LOCALE_TYPES = ['number', 'float', 'percent', 'currency'];

/**
 * The comfortable width of each numeric type, in `inline` form: eight characters of
 * number, eleven of timecode.
 */
const INLINE_WIDTH: Record<string, string> = {
  number: 'w-24',
  float: 'w-24',
  percent: 'w-24',
  currency: 'w-24',
  duration: 'w-24',
  timecode: 'w-28',
};

/** The stored value as the string the input shows. Each type round-trips through its own parse. */
function toDraft(value: unknown, dataType: string, shape: Shape): string {
  if (value === null || value === undefined || value === '') return '';
  const n = Number(value);
  switch (dataType) {
    case 'float':
    case 'currency':
      return Number.isFinite(n)
        ? formatNumberInput(n, {
            ...(shape.locale === undefined ? {} : { locale: shape.locale }),
            ...(shape.precision === undefined ? {} : { decimals: shape.precision }),
          })
        : String(value);
    case 'duration':
      // Hours and minutes, never days: a day rendering rounds and would not survive a
      // round trip through the parse. The working day is a parse unit only.
      return formatDuration(n);
    case 'timecode':
      return shape.frameRate === undefined ? formatTimecode(n) : formatTimecodeFrames(n, shape.frameRate);
    default:
      return Number.isFinite(n)
        ? formatNumberInput(n, shape.locale === undefined ? {} : { locale: shape.locale })
        : String(value);
  }
}

/** What the parsers read: the locale's group and decimal marks are undone first. */
function toDigits(raw: string, dataType: string, shape: Shape): string {
  if (!LOCALE_TYPES.includes(dataType)) return raw;
  return unformatNumberInput(raw, shape.locale);
}

function parseFor(raw: string, dataType: string, shape: Shape): ParseResult<number | null> {
  const text = toDigits(raw, dataType, shape);
  switch (dataType) {
    case 'float':
    case 'currency':
      return parseFloatInput(text, shape.precision === undefined ? {} : { precision: shape.precision });
    case 'duration':
      return parseDurationInput(text, shape.hoursPerDay === undefined ? {} : { hoursPerDay: shape.hoursPerDay });
    case 'timecode':
      return parseTimecodeInput(text, shape.frameRate === undefined ? {} : { frameRate: shape.frameRate });
    default: {
      const bounds: { min?: number; max?: number } = {};
      if (shape.min !== undefined) bounds.min = shape.min;
      if (shape.max !== undefined) bounds.max = shape.max;
      return parseInteger(text, bounds);
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

/** The stored value as the number the steppers and the spinbutton role work on. */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export interface NumberEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** The stored value. A float arrives quoted, the rest as bare numbers (field_types/float). */
  value?: number | string | null;
  onValueChange?: (value: number | string | null) => void;
  /** Which numeric type is being edited. Picks the parse, the format, the affix and the step. */
  dataType?: 'number' | 'float' | 'percent' | 'duration' | 'timecode' | 'currency';
  field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
  /** Decimals kept on a float. The store itself keeps six (field_types/float). */
  precision?: number;
  /** The site's `hours_per_day` from `GET /preferences`, for the `d` unit (field_types/duration). */
  hoursPerDay?: number;
  /** Frames per second, for the `HH:MM:SS:FF` form and the one-frame step (field_types/timecode). */
  frameRate?: number;
  /** Shown before the value on a currency field. */
  symbol?: string;
  /** Show the stored form under the control, e.g. the minutes behind a duration. */
  hint?: boolean;
  /** Compact for one row of a form or a filter: a fixed width for the type, no hint. */
  inline?: boolean;
  min?: number;
  max?: number;
  /** What one step moves. Defaults to the step the data type reads in. */
  step?: number;
  /** Name the control and let a drag across that name change the value. */
  scrub?: boolean;
  /** The name over a scrub area. Defaults to the field's display name. */
  label?: string;
  /** Locale the value is written in. Defaults to the runtime's. */
  locale?: string;
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
 * The numeric family, as a number field.
 *
 * One control covers six data types because they differ only in what they accept: a
 * `number`, a `percent` and a `timecode` take whole numbers, a `float` is rounded to
 * six decimals on write, a `duration` is minutes, and a `timecode` is milliseconds.
 * Nothing is clamped server-side, so the bounds here are the client's
 * (sg-groundtruth `findings/field_types/*`).
 *
 * The steppers, the pointer hold and the scrub area come from Base UI's NumberField;
 * the input stays this widget's own, because a typed `1h 30m` is not a number until
 * core's parsers have read it.
 *
 * `inline` is the form a row of a table or a filter takes: the width the type needs, the
 * steppers inside the input rather than beside it, and nothing under the control.
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
  inline = false,
  min,
  max,
  step,
  scrub = false,
  label,
  locale,
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
  const inputId = React.useId();
  const fallback = numberSteps(dataType, frameRate === undefined ? {} : { frameRate });
  const limits: { step: number; min?: number; max?: number } = { step: step ?? fallback.step };
  const low = min ?? fallback.min;
  const high = max ?? fallback.max;
  if (low !== undefined) limits.min = low;
  if (high !== undefined) limits.max = high;

  const shape: Shape = { hoursPerDay, frameRate, precision, ...limits, locale };
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
  const stored = toNumber(value);
  const name = label ?? field?.displayName ?? null;
  // A duration is stored as a whole number of minutes and the field names no unit, so
  // the number that will be written is shown outright (field_types/duration).
  const live = parseFor(draft, dataType, shape);
  const hint =
    dataType === 'duration' && !('error' in live) && live.value !== null
      ? `${live.value} ${Math.abs(live.value) === 1 ? 'minute' : 'minutes'}`
      : null;

  const apply = (parsed: number | null): void => {
    setParseError(null);
    onErrorChange?.(null);
    const wire = toWire(parsed, dataType);
    setDraft(toDraft(wire, dataType, shape));
    if (wire === value) return;
    onValueChange?.(wire);
  };

  const commit = (): void => {
    const result = parseFor(draft, dataType, shape);
    if ('error' in result) {
      setParseError(result.error);
      onErrorChange?.(result.error);
      return;
    }
    apply(result.value);
  };

  /** A step reads what is in the input, so a typed `1h 30m` steps from ninety. */
  const stepBy = (direction: 1 | -1, multiplier: number): void => {
    if (disabled || readonly) return;
    const result = parseFor(draft, dataType, shape);
    if ('error' in result) return;
    apply(stepNumber(result.value, direction, { ...limits, multiplier }));
  };

  // Base UI owns the pointer: the hold that repeats, the scrub, the boundary at which a
  // stepper goes disabled. The arithmetic stays core's, so both frameworks land on the
  // same number.
  const onRootValueChange = (next: number | null, details: { reason: string; event?: unknown }): void => {
    if (details.reason === 'increment-press' || details.reason === 'decrement-press') {
      const shift = (details.event as { shiftKey?: boolean } | undefined)?.shiftKey === true;
      stepBy(details.reason === 'increment-press' ? 1 : -1, shift ? SHIFT_STEPS : 1);
      return;
    }
    if (details.reason === 'scrub' || details.reason === 'wheel') {
      if (next !== null) apply(settleStep(stored, next, limits));
    }
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') {
      setDraft(toDraft(value, dataType, shape));
      setParseError(null);
      onErrorChange?.(null);
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      stepBy(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey ? SHIFT_STEPS : 1);
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault();
      stepBy(event.key === 'PageUp' ? 1 : -1, PAGE_STEPS);
    }
  };

  // Readonly keeps the value at full contrast and takes the affordances away.
  const steppers = !readonly;
  // Inline is a row of a table or a filter, where the row's width is spoken for: the
  // steppers move inside the input rather than widen the control.
  const stepperClass = cn(
    buttonVariants({ variant: inline ? 'ghost' : 'outline' }),
    'select-none',
    inline ? 'absolute right-0.5 z-10 h-3.5 w-5 rounded-sm p-0' : STEPPER[size],
  );
  const glyphClass = inline ? 'size-3' : CONTROL_GLYPH[size];
  const padRight = suffix && inline && steppers ? 'pr-12' : suffix ? 'pr-7' : inline && steppers ? 'pr-6' : undefined;

  return (
    <NumberField.Root
      id={inputId}
      value={stored}
      onValueChange={onRootValueChange}
      min={limits.min}
      max={limits.max}
      step={limits.step}
      largeStep={limits.step * SHIFT_STEPS}
      smallStep={limits.step}
      disabled={disabled}
      readOnly={readonly}
      locale={locale}
      data-slot="number-editor"
      data-size={size}
      data-data-type={dataType}
      data-inline={inline ? 'true' : undefined}
      className={cn('flex w-full min-w-0 flex-col gap-2', inline && 'w-fit', className)}
      {...rest}
    >
      {scrub && name ? (
        <NumberField.ScrubArea
          data-slot="number-editor-scrub-area"
          pixelSensitivity={SCRUB_PIXELS}
          className="text-muted-foreground w-fit cursor-ew-resize text-xs font-medium select-none"
        >
          <span data-slot="number-editor-label">{name}</span>
          <NumberField.ScrubAreaCursor />
        </NumberField.ScrubArea>
      ) : null}
      <NumberField.Group
        data-slot="number-editor-group"
        className={cn('flex w-full min-w-0 items-center gap-2', inline && 'relative')}
      >
        {steppers ? (
          <NumberField.Decrement
            data-slot="number-editor-decrement"
            aria-label="Decrease"
            className={cn(stepperClass, inline && 'bottom-0.5')}
          >
            <Minus className={glyphClass} />
          </NumberField.Decrement>
        ) : null}
        <div data-slot="number-editor-field" className="relative flex w-full min-w-0 items-center">
          {prefix ? (
            <span
              aria-hidden="true"
              data-slot="number-editor-affix"
              className="text-muted-foreground pointer-events-none absolute left-2.5 text-sm select-none"
            >
              {prefix}
            </span>
          ) : null}
          <NumberField.Input
            render={(inputProps) => {
              const {
                value: _value,
                onChange: _onChange,
                onKeyDown: _onKeyDown,
                onBlur: _onBlur,
                onFocus: _onFocus,
                onPaste: _onPaste,
                ...owned
              } = inputProps;
              return (
                <Input
                  {...owned}
                  aria-roledescription={undefined}
                  value={draft}
                  type="text"
                  role="spinbutton"
                  inputMode={dataType === 'duration' || dataType === 'timecode' ? 'text' : 'decimal'}
                  disabled={disabled}
                  readOnly={readonly}
                  placeholder={placeholder}
                  className={cn(
                    'tabular-nums',
                    CONTROL_BOX[size],
                    prefix && 'pl-7',
                    padRight,
                    inline && 'shrink-0',
                    inline && (INLINE_WIDTH[dataType] ?? 'w-24'),
                  )}
                  aria-invalid={isInvalid}
                  aria-label={field?.displayName}
                  aria-required={field?.mandatory}
                  aria-valuenow={stored ?? undefined}
                  aria-valuemin={limits.min}
                  aria-valuemax={limits.max}
                  aria-valuetext={draft === '' ? undefined : draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onFocus={() => {
                    editing.current = true;
                  }}
                  onBlur={(event) => {
                    // Losing focus because the control was removed from the page is not a commit.
                    if (!event.currentTarget.isConnected) return;
                    editing.current = false;
                    commit();
                  }}
                  onKeyDown={onKeyDown}
                />
              );
            }}
          />
          {suffix ? (
            <span
              aria-hidden="true"
              data-slot="number-editor-affix"
              className={cn(
                'text-muted-foreground pointer-events-none absolute text-sm select-none',
                inline && steppers ? 'right-7' : 'right-2.5',
              )}
            >
              {suffix}
            </span>
          ) : null}
        </div>
        {steppers ? (
          <NumberField.Increment
            data-slot="number-editor-increment"
            aria-label="Increase"
            className={cn(stepperClass, inline && 'top-0.5')}
          >
            <Plus className={glyphClass} />
          </NumberField.Increment>
        ) : null}
      </NumberField.Group>
      {showHint && hint && !inline ? (
        <p data-slot="number-editor-hint" className="text-muted-foreground text-xs tabular-nums">
          {hint}
        </p>
      ) : null}
      <FieldError message={message} errorMessage={errorMessage} />
    </NumberField.Root>
  );
}
