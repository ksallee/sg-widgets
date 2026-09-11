import * as React from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { parseTextInput } from '@sg-widgets/core';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { CONTROL_BOX, type ControlSize } from '@/registry/sg/components/control-classes';
import { FieldError } from '@/registry/sg/components/field-error';

export type TextEditorSize = ControlSize;

export interface TextEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onInput' | 'defaultValue'> {
  /** The stored string, or null. There is no empty string in the store (field_types/text). */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  /** The field schema, for the label and the placeholder. */
  field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
  /** A textarea instead of a single-line input. Newlines survive a one-line field either way. */
  multiline?: boolean;
  rows?: number;
  size?: TextEditorSize;
  disabled?: boolean;
  readonly?: boolean;
  /** Forced invalid state. A failed parse sets it on its own. */
  invalid?: boolean;
  /** A message from the caller, shown in place of the parse error. */
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  /** Renders the message. Default is a small destructive line under the control. */
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * A `text` field.
 *
 * Both ends of the value are stripped on write and an empty string is stored as null,
 * so clearing the input and clearing the field are the same act; there is no "set but
 * blank" state to round-trip (field_types/text).
 */
export function TextEditor({
  value = null,
  onValueChange,
  field = null,
  multiline = false,
  rows = 3,
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
}: TextEditorProps) {
  const [draft, setDraft] = React.useState(value ?? '');
  const [parseError, setParseError] = React.useState<string | null>(null);
  // The input is uncontrolled while it has focus, so typing is never fought by an
  // incoming value; an outside change lands as soon as the field is left.
  const editing = React.useRef(false);

  React.useEffect(() => {
    if (!editing.current) setDraft(value ?? '');
  }, [value]);

  const message = error ?? parseError;
  const isInvalid = invalid || message !== null;

  const commit = (): void => {
    const result = parseTextInput(draft);
    if ('error' in result) {
      setParseError(result.error);
      onErrorChange?.(result.error);
      return;
    }
    setParseError(null);
    onErrorChange?.(null);
    setDraft(result.value ?? '');
    if (result.value === value) return;
    onValueChange?.(result.value);
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter' && !multiline) commit();
    if (event.key === 'Escape') {
      setDraft(value ?? '');
      setParseError(null);
      onErrorChange?.(null);
    }
  };

  const onFocus = (): void => {
    editing.current = true;
  };

  // Losing focus because the control was removed from the page is not a commit.
  const onBlur = (event: React.FocusEvent<HTMLElement>): void => {
    if (!event.currentTarget.isConnected) return;
    editing.current = false;
    commit();
  };

  return (
    <div
      data-slot="text-editor"
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      {multiline ? (
        <Textarea
          value={draft}
          rows={rows}
          disabled={disabled}
          readOnly={readonly}
          placeholder={placeholder}
          aria-invalid={isInvalid}
          aria-label={field?.displayName}
          aria-required={field?.mandatory}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
      ) : (
        <Input
          value={draft}
          type="text"
          disabled={disabled}
          readOnly={readonly}
          placeholder={placeholder}
          className={CONTROL_BOX[size]}
          aria-invalid={isInvalid}
          aria-label={field?.displayName}
          aria-required={field?.mandatory}
          onChange={(event) => setDraft(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
      )}
      <FieldError message={message} errorMessage={errorMessage} />
    </div>
  );
}
