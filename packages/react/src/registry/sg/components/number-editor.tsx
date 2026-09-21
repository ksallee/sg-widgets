import * as React from 'react';
import { NumberField } from '@base-ui/react/number-field';
import type { FieldSchema, NumberShape } from 'sg-widgets-core';
import {
  numberDraft,
  numberSteps,
  numberWire,
  parseNumberInput,
  settleStep,
  stepNumber,
  storedNumber,
} from 'sg-widgets-core';
import { Minus, Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CONTROL_BOX, CONTROL_GLYPH, type ControlSize } from '@/registry/sg/components/control-classes';
import { ValueEditor, useValueSession } from '@/registry/sg/components/value-editor';

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

  const shape: NumberShape = { hoursPerDay, frameRate, precision, ...limits, locale };

  const session = useValueSession<number | string | null, string>({
    value,
    format: (stored) => numberDraft(stored, dataType, shape),
    parse: (draft) => {
      const result = parseNumberInput(draft, dataType, shape);
      return 'error' in result ? result : { value: numberWire(result.value, dataType) };
    },
    onValueChange,
    onErrorChange,
    error,
    invalid,
  });

  const prefix = dataType === 'currency' ? symbol : null;
  const suffix = dataType === 'percent' ? '%' : null;
  const stored = storedNumber(value);
  const name = label ?? field?.displayName ?? null;
  // A duration is stored as a whole number of minutes and the field names no unit, so
  // the number that will be written is shown outright (field_types/duration).
  const live = parseNumberInput(session.draft, dataType, shape);
  const hint =
    dataType === 'duration' && !('error' in live) && live.value !== null
      ? `${live.value} ${Math.abs(live.value) === 1 ? 'minute' : 'minutes'}`
      : null;

  /** A step reads what is in the input, so a typed `1h 30m` steps from ninety. */
  const stepBy = (direction: 1 | -1, multiplier: number): void => {
    if (disabled || readonly) return;
    const result = parseNumberInput(session.draft, dataType, shape);
    if ('error' in result) return;
    session.apply(numberWire(stepNumber(result.value, direction, { ...limits, multiplier }), dataType));
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
      if (next !== null) session.apply(numberWire(settleStep(stored, next, limits), dataType));
    }
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    session.onKeyDown(event);
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
    <ValueEditor
      slotName="number-editor"
      size={size}
      inline={inline}
      data-data-type={dataType}
      message={session.message}
      errorMessage={errorMessage}
      className={className}
      render={(rootProps, content) => (
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
          {...rootProps}
        >
          {content}
        </NumberField.Root>
      )}
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
                  value={session.draft}
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
                  aria-invalid={session.invalid}
                  aria-label={field?.displayName}
                  aria-required={field?.mandatory}
                  aria-valuenow={stored ?? undefined}
                  aria-valuemin={limits.min}
                  aria-valuemax={limits.max}
                  aria-valuetext={session.draft === '' ? undefined : session.draft}
                  onChange={(event) => session.setDraft(event.target.value)}
                  onFocus={session.onFocus}
                  onBlur={session.onBlur}
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
    </ValueEditor>
  );
}
