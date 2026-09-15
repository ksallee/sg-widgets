import type * as React from 'react';
import type { FieldSchema } from '@sg-widgets/core';
import { parseTextInput } from '@sg-widgets/core';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { CONTROL_BOX, CONTROL_PAD, type ControlSize } from '@/registry/sg/components/control-classes';
import { ValueEditor, useValueSession } from '@/registry/sg/components/value-editor';

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
  const session = useValueSession<string | null, string>({
    value,
    format: (stored) => stored ?? '',
    parse: parseTextInput,
    onValueChange,
    onErrorChange,
    error,
    invalid,
    // A newline is what Enter means in a textarea.
    commitOnEnter: !multiline,
  });

  return (
    <ValueEditor
      slotName="text-editor"
      size={size}
      message={session.message}
      errorMessage={errorMessage}
      className={className}
      {...rest}
    >
      {multiline ? (
        <Textarea
          value={session.draft}
          rows={rows}
          disabled={disabled}
          readOnly={readonly}
          placeholder={placeholder}
          className={CONTROL_PAD[size]}
          aria-invalid={session.invalid}
          aria-label={field?.displayName}
          aria-required={field?.mandatory}
          onChange={(event) => session.setDraft(event.target.value)}
          onFocus={session.onFocus}
          onBlur={session.onBlur}
          onKeyDown={session.onKeyDown}
        />
      ) : (
        <Input
          value={session.draft}
          type="text"
          disabled={disabled}
          readOnly={readonly}
          placeholder={placeholder}
          className={CONTROL_BOX[size]}
          aria-invalid={session.invalid}
          aria-label={field?.displayName}
          aria-required={field?.mandatory}
          onChange={(event) => session.setDraft(event.target.value)}
          onFocus={session.onFocus}
          onBlur={session.onBlur}
          onKeyDown={session.onKeyDown}
        />
      )}
    </ValueEditor>
  );
}
