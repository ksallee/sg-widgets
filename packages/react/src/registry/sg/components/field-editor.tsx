import * as React from 'react';
import type { FieldSchema, StatusRecord, UrlValue } from '@sg-widgets/core';
import { editorKindFor } from '@sg-widgets/core';
import { cn } from '@/lib/utils';
import { CheckboxEditor } from '@/registry/sg/components/checkbox-editor';
import { ColorEditor } from '@/registry/sg/components/color-editor';
import { DateEditor } from '@/registry/sg/components/date-editor';
import { DateTimeEditor } from '@/registry/sg/components/date-time-editor';
import { FieldValue } from '@/registry/sg/components/field-value';
import { ListSelect } from '@/registry/sg/components/list-select';
import { NumberEditor } from '@/registry/sg/components/number-editor';
import { TextEditor } from '@/registry/sg/components/text-editor';
import { UrlEditor } from '@/registry/sg/components/url-editor';

export type FieldEditorMode = 'display' | 'edit';
export type FieldEditorSize = 'sm' | 'md' | 'lg';

/**
 * True while focus is still somewhere the edit session owns. A popover and a select
 * popup are portalled out of the widget, so containment alone is not enough.
 */
function stillEditing(root: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (!root || !(active instanceof HTMLElement)) return false;
  if (root.contains(active)) return true;
  return active.closest('[data-slot="popover-content"],[data-slot="select-content"]') !== null;
}

export interface FieldEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** The raw attribute value, exactly as the API returned it. */
  value?: unknown;
  onValueChange?: (value: unknown) => void;
  /** The field's `data_type`. Falls back to the schema's, then to text. */
  dataType?: string;
  field?: FieldSchema | null;
  /** Which half is showing. Controlled when given, with `onModeChange`. */
  mode?: FieldEditorMode;
  onModeChange?: (mode: FieldEditorMode) => void;
  /** Display mode turns into edit mode on click or Enter. */
  editable?: boolean;
  /** `Status` rows by code, for the display half (probe 010). */
  statuses?: Record<string, StatusRecord> | null;
  /** The site's `hours_per_day` from `GET /preferences` (field_types/duration). */
  hoursPerDay?: number;
  /** Frames per second, for the `HH:MM:SS:FF` form (field_types/timecode). */
  frameRate?: number;
  /** Decimals on a float. */
  precision?: number;
  /** Shown before the value on a currency field. */
  symbol?: string;
  /** The project the schema was read with, for the hidden-value subtraction (probe 009). */
  projectId?: number;
  /** IANA zone a typed wall-clock time is read in. */
  timeZone?: string;
  locale?: string;
  /** A textarea instead of an input, on a text field. */
  multiline?: boolean;
  size?: FieldEditorSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  error?: string | null;
  onErrorChange?: (error: string | null) => void;
  placeholder?: string;
  /** What the display half shows for an unset value. */
  emptyLabel?: string;
  errorMessage?: (message: string) => React.ReactNode;
}

/**
 * One field, displayed or edited.
 *
 * The data type picks the editor, and the pair behind this toggle is the same one a
 * caller can use directly: FieldValue on the display half, the type's own editor on
 * the other. A field whose type has no editor here -- a status, an entity link, a
 * calculated column -- never leaves the display half.
 */
export function FieldEditor({
  value = null,
  onValueChange,
  dataType,
  field = null,
  mode,
  onModeChange,
  editable = false,
  statuses = null,
  hoursPerDay,
  frameRate,
  precision,
  symbol,
  projectId,
  timeZone,
  locale,
  multiline = false,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  error = null,
  onErrorChange,
  placeholder,
  emptyLabel = 'empty',
  errorMessage,
  className,
  ...rest
}: FieldEditorProps) {
  const type = dataType ?? field?.dataType ?? 'text';
  const kind = editorKindFor(String(type));
  // Status and entity fields are edited by the picker widgets, not here.
  const canEdit = kind !== 'none' && !disabled && !readonly;

  const [ownMode, setOwnMode] = React.useState<FieldEditorMode>('display');
  const current = mode ?? ownMode;
  const editing = current === 'edit' && kind !== 'none';

  const root = React.useRef<HTMLDivElement>(null);
  const display = React.useRef<HTMLSpanElement>(null);
  const original = React.useRef<unknown>(null);
  // The editor below reports its parse error here. An edit session stays open while
  // one stands, because invalid input emits nothing and would otherwise be dropped.
  const liveError = React.useRef<string | null>(null);

  const noteError = (next: string | null): void => {
    liveError.current = next;
    onErrorChange?.(next);
  };

  const setMode = (next: FieldEditorMode): void => {
    if (current === next) return;
    setOwnMode(next);
    onModeChange?.(next);
  };

  const enter = (): void => {
    if (!canEdit || current === 'edit') return;
    original.current = value;
    setMode('edit');
    // The control does not exist until the toggle has rendered.
    requestAnimationFrame(() => {
      root.current?.querySelector<HTMLElement>('input, textarea, [data-slot="select-trigger"]')?.focus({ preventScroll: true });
    });
  };

  const leave = (): void => {
    if (current === 'display') return;
    liveError.current = null;
    setMode('display');
    requestAnimationFrame(() => display.current?.focus({ preventScroll: true }));
  };

  const cancel = (): void => {
    // Nothing has been emitted yet: an editor emits on Enter or on losing focus.
    onValueChange?.(original.current);
    leave();
  };

  const onDisplayKeyDown = (event: React.KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      enter();
    }
  };

  const onEditKeyDown = (event: React.KeyboardEvent): void => {
    if (!editable) return;
    // The editor commits on the same Enter, and its handler runs first on the way up.
    // The toggle waits a frame so that commit has settled before the control goes.
    if (event.key === 'Enter' && liveError.current === null && !(multiline && kind === 'text')) {
      requestAnimationFrame(leave);
    }
    if (event.key === 'Escape') cancel();
  };

  const onEditBlur = (): void => {
    if (!editable) return;
    requestAnimationFrame(() => {
      if (liveError.current === null && !stillEditing(root.current)) leave();
    });
  };

  const emit = (next: unknown): void => onValueChange?.(next);

  const shared = {
    field,
    size,
    disabled,
    readonly,
    invalid,
    error,
    errorMessage,
  } as const;

  return (
    <div
      ref={root}
      data-slot="field-editor"
      data-data-type={type}
      data-mode={editing ? 'edit' : 'display'}
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      onKeyDown={editing ? onEditKeyDown : undefined}
      onBlur={editing ? onEditBlur : undefined}
      {...rest}
    >
      {editing ? (
        kind === 'text' ? (
          <TextEditor
            value={value as string | null}
            onValueChange={emit}
            multiline={multiline}
            onErrorChange={noteError}
            placeholder={placeholder}
            {...shared}
          />
        ) : kind === 'number' ? (
          <NumberEditor
            value={value as number | string | null}
            onValueChange={emit}
            dataType={type as 'number'}
            precision={precision}
            hoursPerDay={hoursPerDay}
            frameRate={frameRate}
            symbol={symbol ?? '$'}
            onErrorChange={noteError}
            placeholder={placeholder}
            {...shared}
          />
        ) : kind === 'checkbox' ? (
          <CheckboxEditor value={value === true} onValueChange={emit} placeholder={placeholder} {...shared} />
        ) : kind === 'date' ? (
          <DateEditor
            value={value as string | null}
            onValueChange={emit}
            onErrorChange={noteError}
            {...shared}
          />
        ) : kind === 'date_time' ? (
          <DateTimeEditor
            value={value as string | null}
            onValueChange={emit}
            timeZone={timeZone}
            onErrorChange={noteError}
            {...shared}
          />
        ) : kind === 'list' ? (
          <ListSelect value={value as string | null} onValueChange={emit} projectId={projectId} {...shared} />
        ) : kind === 'url' ? (
          <UrlEditor
            value={value as UrlValue | null}
            onValueChange={emit}
            onErrorChange={noteError}
            {...shared}
          />
        ) : (
          <ColorEditor
            value={value as string | null}
            onValueChange={emit}
            onErrorChange={noteError}
            {...shared}
          />
        )
      ) : editable && canEdit ? (
        <span
          ref={display}
          role="button"
          tabIndex={0}
          data-slot="field-editor-display"
          aria-label={field?.displayName ? `Edit ${field.displayName}` : 'Edit'}
          className="focus-visible:ring-ring focus-visible:ring-offset-background hover:bg-accent hover:text-accent-foreground flex w-full min-w-0 cursor-text items-center rounded-md px-2 py-1.5 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          onClick={enter}
          onKeyDown={onDisplayKeyDown}
        >
          <FieldValue
            value={value}
            dataType={String(type)}
            field={field}
            statuses={statuses}
            hoursPerDay={hoursPerDay}
            locale={locale}
            precision={precision}
            currencySymbol={symbol ?? '$'}
            emptyLabel={emptyLabel}
          />
        </span>
      ) : (
        <FieldValue
          value={value}
          dataType={String(type)}
          field={field}
          statuses={statuses}
          hoursPerDay={hoursPerDay}
          locale={locale}
          precision={precision}
          currencySymbol={symbol ?? '$'}
          emptyLabel={emptyLabel}
        />
      )}
    </div>
  );
}
