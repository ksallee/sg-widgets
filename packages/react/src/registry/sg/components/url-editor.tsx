import * as React from 'react';
import type { FieldSchema, UrlValue, UrlWriteValue } from '@sg-widgets/core';
import { parseUrlInput } from '@sg-widgets/core';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

export type UrlEditorSize = 'sm' | 'md' | 'lg';

/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
const BOX: Record<UrlEditorSize, string> = {
  sm: 'h-8 px-2',
  md: 'h-9 px-3',
  lg: 'h-10 px-3',
};

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
  const incomingUrl = value?.url ?? '';
  const incomingName = value?.name ?? '';
  const [urlDraft, setUrlDraft] = React.useState(incomingUrl);
  const [nameDraft, setNameDraft] = React.useState(incomingName);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const editing = React.useRef(false);

  React.useEffect(() => {
    if (editing.current) return;
    setUrlDraft(incomingUrl);
    setNameDraft(incomingName);
  }, [incomingUrl, incomingName]);

  const message = error ?? parseError;
  const isInvalid = invalid || message !== null;
  // A local value carries paths and no url at all; uploads and local paths are not
  // edited here, so the control says so rather than showing an empty box
  // (field_types/url).
  const localOnly = value?.link_type === 'local';

  const commit = (): void => {
    const result = parseUrlInput(urlDraft, nameDraft);
    if ('error' in result) {
      setParseError(result.error);
      onErrorChange?.(result.error);
      return;
    }
    setParseError(null);
    onErrorChange?.(null);
    setUrlDraft(result.value?.url ?? '');
    setNameDraft(result.value?.name ?? '');
    onValueChange?.(result.value);
  };

  const reset = (): void => {
    setUrlDraft(incomingUrl);
    setNameDraft(incomingName);
    setParseError(null);
    onErrorChange?.(null);
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter') commit();
    if (event.key === 'Escape') reset();
  };

  const onFocus = (): void => {
    editing.current = true;
  };

  // Losing focus because the control was removed from the page is not a commit.
  const onBlur = (event: React.FocusEvent<HTMLInputElement>): void => {
    if (!event.currentTarget.isConnected) return;
    editing.current = false;
    commit();
  };

  return (
    <div
      data-slot="url-editor"
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      <div className="flex w-full min-w-0 flex-col gap-2">
        <Input
          value={urlDraft}
          type="text"
          data-slot="url-editor-url"
          disabled={disabled || localOnly}
          readOnly={readonly}
          placeholder={placeholder}
          className={BOX[size]}
          aria-invalid={isInvalid}
          aria-label={field?.displayName}
          aria-required={field?.mandatory}
          onChange={(event) => setUrlDraft(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
        <Input
          value={nameDraft}
          type="text"
          data-slot="url-editor-name"
          disabled={disabled || localOnly}
          readOnly={readonly}
          placeholder={namePlaceholder}
          className={BOX[size]}
          aria-invalid={isInvalid}
          aria-label="Link name"
          onChange={(event) => setNameDraft(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
      </div>
      {localOnly ? (
        <p data-slot="url-editor-note" className="text-muted-foreground text-xs">
          This value is a local path. Only web links are edited here.
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
