import type * as React from 'react';
import type { FieldSchema, UrlValue, UrlWriteValue } from 'sg-widgets-core';
import { parseUrlInput } from 'sg-widgets-core';
import { Input } from '@/components/ui/input';
import { CONTROL_BOX, type ControlSize } from '@/registry/sg/components/control-classes';
import { ValueEditor, useValueSession } from '@/registry/sg/components/value-editor';

export type UrlEditorSize = ControlSize;

/** The two halves of a web link, as the control holds them. */
interface LinkDraft {
  url: string;
  name: string;
}

export interface UrlEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** The stored object. Only the web-link shape is edited here (field_types/url). */
  value?: UrlValue | null;
  onValueChange?: (value: UrlWriteValue | null) => void;
  field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
  size?: UrlEditorSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  /** The placeholder of the second input. */
  namePlaceholder?: string;
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * A `url` field, as a web link.
 *
 * The only accepted write is an object holding `url`: a bare string is a 400, the url
 * itself is validated, and a raw space is the one character measured to fail. With no
 * name the field reads back the whole url as its name. Uploads mint an Attachment
 * through a separate flow and are out of scope here (field_types/url).
 */
export function UrlEditor({
  value = null,
  onValueChange,
  field = null,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder = 'https://example.com/plate.mov',
  namePlaceholder = 'Name',
  errorMessage,
  className,
  ...rest
}: UrlEditorProps) {
  const session = useValueSession<UrlWriteValue | null, LinkDraft>({
    // The stored object carries more than a link; the two edited halves are all this reads.
    value: value as UrlWriteValue | null,
    format: (stored) => ({ url: stored?.url ?? '', name: stored?.name ?? '' }),
    parse: (draft) => parseUrlInput(draft.url, draft.name),
    onValueChange,
    onErrorChange,
    error,
    invalid,
    // A committed link is a fresh object, so every commit is a write.
    same: () => false,
  });

  // A local value carries paths and no url at all; uploads and local paths are not
  // edited here, so the control says so rather than showing an empty box
  // (field_types/url).
  const localOnly = value?.link_type === 'local';

  return (
    <ValueEditor
      slotName="url-editor"
      size={size}
      message={session.message}
      errorMessage={errorMessage}
      className={className}
      {...rest}
    >
      <div className="flex w-full min-w-0 flex-col gap-2">
        <Input
          value={session.draft.url}
          type="text"
          data-slot="url-editor-url"
          disabled={disabled || localOnly}
          readOnly={readonly}
          placeholder={placeholder}
          className={CONTROL_BOX[size]}
          aria-invalid={session.invalid}
          aria-label={field?.displayName}
          aria-required={field?.mandatory}
          onChange={(event) => session.setDraft({ ...session.draft, url: event.target.value })}
          onFocus={session.onFocus}
          onBlur={session.onBlur}
          onKeyDown={session.onKeyDown}
        />
        <Input
          value={session.draft.name}
          type="text"
          data-slot="url-editor-name"
          disabled={disabled || localOnly}
          readOnly={readonly}
          placeholder={namePlaceholder}
          className={CONTROL_BOX[size]}
          aria-invalid={session.invalid}
          aria-label="Link name"
          onChange={(event) => session.setDraft({ ...session.draft, name: event.target.value })}
          onFocus={session.onFocus}
          onBlur={session.onBlur}
          onKeyDown={session.onKeyDown}
        />
      </div>
      {localOnly ? (
        <p data-slot="url-editor-note" className="text-muted-foreground text-xs">
          This value is a local path. Only web links are edited here.
        </p>
      ) : null}
    </ValueEditor>
  );
}
