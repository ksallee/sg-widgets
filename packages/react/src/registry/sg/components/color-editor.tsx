import type * as React from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { COLOR_SENTINEL, colorToHex, parseBgColor, parseColorInput, rgbToCss } from '@sg-widgets/core';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { CONTROL_BOX, type ControlSize } from '@/registry/sg/components/control-classes';
import { ValueEditor, useValueSession } from '@/registry/sg/components/value-editor';

export type ColorEditorSize = ControlSize;

/** The swatch is the square of the control beside it. */
const SWATCH: Record<ColorEditorSize, string> = {
  sm: 'size-8',
  md: 'size-9',
  lg: 'size-10',
};

export interface ColorEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'color' | 'defaultValue'> {
  /** The stored string: decimal `r,g,b`, or the pipeline-step token (field_types/color). */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
  size?: ColorEditorSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  /** Explain the pipeline-step token under the control. */
  hint?: boolean;
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * A `color` field.
 *
 * The stored form is decimal `r,g,b` with no spaces and no `#`; hex is rejected on
 * write and inside a filter, so a hex code typed here is converted before it is
 * emitted. `Task.color` also takes the token `pipeline_step`, which is the only way
 * to un-set it: a written null is a 400 (field_types/color).
 */
export function ColorEditor({
  value = null,
  onValueChange,
  field = null,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder = '255,128,0',
  hint = true,
  errorMessage,
  className,
  ...rest
}: ColorEditorProps) {
  const session = useValueSession<string | null, string>({
    value,
    format: (stored) => stored ?? '',
    parse: parseColorInput,
    onValueChange,
    onErrorChange,
    error,
    invalid,
  });

  // The swatch follows the draft, so a typed hex shows its colour before it is committed.
  const preview = parseColorInput(session.draft);
  const rgb = 'error' in preview || preview.value === null ? null : parseBgColor(preview.value);
  const sentinel = !('error' in preview) && preview.value === COLOR_SENTINEL;

  // The native picker answers in hex; the store wants the decimal triple.
  const pick = (event: React.ChangeEvent<HTMLInputElement>): void => {
    const result = parseColorInput(event.target.value);
    if ('error' in result) return;
    session.apply(result.value);
  };

  return (
    <ValueEditor
      slotName="color-editor"
      size={size}
      message={session.message}
      errorMessage={errorMessage}
      className={className}
      {...rest}
    >
      <div className="flex w-full min-w-0 items-center gap-2">
        <label
          data-slot="color-editor-swatch"
          title={disabled || readonly ? undefined : 'Pick a colour'}
          style={rgb ? { backgroundColor: rgbToCss(rgb) } : undefined}
          className={cn(
            'ring-border focus-within:ring-ring focus-within:ring-offset-background relative shrink-0 overflow-hidden rounded-md ring-1 transition-shadow duration-150 focus-within:ring-2 focus-within:ring-offset-2',
            SWATCH[size],
            rgb ? undefined : 'bg-muted',
            disabled || readonly ? 'cursor-default' : 'cursor-pointer',
          )}
        >
          <input
            type="color"
            value={colorToHex(rgb ? `${rgb.r},${rgb.g},${rgb.b}` : null) ?? '#808080'}
            disabled={disabled || readonly}
            aria-label={field?.displayName ? `${field.displayName} colour` : 'Colour'}
            className="absolute inset-0 size-full cursor-[inherit] opacity-0"
            onChange={pick}
          />
        </label>
        <Input
          value={session.draft}
          type="text"
          disabled={disabled}
          readOnly={readonly}
          placeholder={placeholder}
          className={cn('font-mono tabular-nums', CONTROL_BOX[size])}
          aria-invalid={session.invalid}
          aria-label={field?.displayName}
          aria-required={field?.mandatory}
          onChange={(event) => session.setDraft(event.target.value)}
          onFocus={session.onFocus}
          onBlur={session.onBlur}
          onKeyDown={session.onKeyDown}
        />
      </div>
      {hint && sentinel ? (
        <p data-slot="color-editor-note" className="text-muted-foreground text-xs">
          Takes the colour of the linked pipeline step.
        </p>
      ) : null}
    </ValueEditor>
  );
}
