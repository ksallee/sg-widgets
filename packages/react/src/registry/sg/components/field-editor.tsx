import * as React from 'react';
import type { EditorKind, EntityRef, FieldSchema, SgContext, StatusRecord, UrlValue } from '@sg-widgets/core';
import { editorKindFor, editorNeedsContext, preferencesOf } from '@sg-widgets/core';
import { cn } from '@/lib/utils';
import { CheckboxEditor } from '@/registry/sg/components/checkbox-editor';
import { ColorEditor } from '@/registry/sg/components/color-editor';
import { DateEditor } from '@/registry/sg/components/date-editor';
import { DateTimeEditor } from '@/registry/sg/components/date-time-editor';
import { EntityMultiPicker } from '@/registry/sg/components/entity-multi-picker';
import { EntityPicker } from '@/registry/sg/components/entity-picker';
import { FieldValue } from '@/registry/sg/components/field-value';
import { ListSelect } from '@/registry/sg/components/list-select';
import { NumberEditor } from '@/registry/sg/components/number-editor';
import { StatusPicker } from '@/registry/sg/components/status-picker';
import { TextEditor } from '@/registry/sg/components/text-editor';
import { UrlEditor } from '@/registry/sg/components/url-editor';

export type FieldEditorMode = 'display' | 'edit';
export type FieldEditorSize = 'sm' | 'md' | 'lg';

/** The popups an editor opens. Each is portalled out of the widget's own tree. */
const POPUP = '[data-slot="popover-content"],[data-slot="select-content"],[data-picker]';

/**
 * True while focus is still somewhere the edit session owns. A popover, a select
 * popup and a picker list are portalled out of the widget, so containment alone is
 * not enough.
 */
function stillEditing(root: HTMLElement | null): boolean {
  const active = document.activeElement;
  if (!root || !(active instanceof HTMLElement)) return false;
  if (root.contains(active)) return true;
  return active.closest(POPUP) !== null;
}

/** The facts a teardown path needs, taken when the session opens and never re-read. */
interface EditSession {
  editable: boolean;
  root: HTMLElement | null;
}

/**
 * Whether the type's editor can be drawn. A picker reads through the context and
 * needs the schema to say what it offers: a status its entity type, a link its valid
 * types. Without either the field stays on the display half.
 */
function canDraw(
  kind: EditorKind,
  dataType: string,
  context: SgContext | undefined,
  field: FieldSchema | null,
): boolean {
  if (kind === 'none') return false;
  if (!editorNeedsContext(dataType)) return true;
  if (context === undefined) return false;
  return kind === 'status_list' ? Boolean(field?.entityType) : (field?.validTypes?.length ?? 0) > 0;
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
  /** The widget context: the site preferences, and what the display half reads. */
  context?: SgContext;
  /** The site's `hours_per_day` from `GET /preferences` (field_types/duration). Defaults to the context's. */
  hoursPerDay?: number;
  /** Frames per second, for the `HH:MM:SS:FF` form (field_types/timecode). Defaults to the context's. */
  frameRate?: number;
  /** Decimals on a float. */
  precision?: number;
  /** Shown before the value on a currency field. */
  symbol?: string;
  /**
   * The project the schema was read with. It subtracts a list field's hidden values
   * (probe 009), scopes a status picker to the codes the project allows, and scopes
   * an entity picker's search.
   */
  projectId?: number;
  /** IANA zone a typed wall-clock time is read in. Defaults to the context's, then to the runtime's. */
  timeZone?: string;
  /** Defaults to the context's. */
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
 * the other. A status, an entity link and a multi-entity link open their picker, which
 * reads through the context; without a context, or without the schema those pickers
 * need, the field stays on the display half, as a calculated column always does.
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
  context,
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
  // The site's preferences, with anything the caller named winning over them.
  const prefs = {
    ...preferencesOf(context),
    ...(hoursPerDay === undefined ? {} : { hoursPerDay }),
    ...(locale === undefined ? {} : { locale }),
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(frameRate === undefined ? {} : { frameRate }),
  };

  const type = dataType ?? field?.dataType ?? 'text';
  const kind = editorKindFor(String(type));
  /** Types a link field may point at. An entity picker has nothing to search without them. */
  const linkTypes = field?.validTypes ?? [];
  const hasEditor = canDraw(kind, String(type), context, field);
  const canEdit = hasEditor && !disabled && !readonly;

  const [ownMode, setOwnMode] = React.useState<FieldEditorMode>('display');
  const current = mode ?? ownMode;
  const editing = current === 'edit' && hasEditor;

  const root = React.useRef<HTMLDivElement>(null);
  const display = React.useRef<HTMLSpanElement>(null);
  const original = React.useRef<unknown>(null);
  // The editor below reports its parse error here. An edit session stays open while
  // one stands, because invalid input emits nothing and would otherwise be dropped.
  const liveError = React.useRef<string | null>(null);
  // The open session, and whether this component is still on the page. Both are read
  // by what runs after a commit -- a blur, a queued frame -- once the editor has gone.
  const session = React.useRef<EditSession | null>(null);
  const alive = React.useRef(true);
  React.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      session.current = null;
    };
  }, []);

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
    session.current = { editable, root: root.current };
    setMode('edit');
    // The control does not exist until the toggle has rendered.
    requestAnimationFrame(() => {
      if (!alive.current) return;
      root.current?.querySelector<HTMLElement>('input, textarea, [data-slot$="-trigger"]')?.focus({ preventScroll: true });
    });
  };

  const leave = (): void => {
    if (current === 'display') return;
    // Focus comes off the control before the control goes, so its own blur handler
    // commits what it holds while the editor is still on the page.
    const active = document.activeElement;
    if (active instanceof HTMLElement && root.current?.contains(active)) active.blur();
    session.current = null;
    liveError.current = null;
    setMode('display');
    requestAnimationFrame(() => {
      if (alive.current) display.current?.focus({ preventScroll: true });
    });
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
    if (session.current === null) return;
    // Enter on a control that opens its own popup opens it, and Enter in a picker's
    // search box chooses a row; the session stays until the popup is done with it.
    const target = event.target as HTMLElement | null;
    const inPopupControl = target?.closest('[data-slot$="-trigger"],[role="combobox"]') != null;
    // The editor commits on the same Enter, and its handler runs first on the way up.
    // The toggle waits a frame so that commit has settled before the control goes.
    if (event.key === 'Enter' && !inPopupControl && liveError.current === null && !(multiline && kind === 'text')) {
      requestAnimationFrame(() => {
        if (alive.current) leave();
      });
    }
    if (event.key === 'Escape') cancel();
  };

  // A press outside the session commits and closes it.
  const leaveRef = React.useRef(leave);
  leaveRef.current = leave;
  React.useEffect(() => {
    if (!editing || !editable) return;
    const onOutside = (event: PointerEvent): void => {
      const target = event.target as Element | null;
      if (target === null || root.current?.contains(target) || target.closest(POPUP) !== null) return;
      leaveRef.current();
    };
    document.addEventListener('pointerdown', onOutside, true);
    return () => document.removeEventListener('pointerdown', onOutside, true);
  }, [editing, editable]);

  const onEditBlur = (): void => {
    // The snapshot, never the props: the commit this blur follows may already have
    // taken the session away.
    const open = session.current;
    if (open === null || !open.editable) return;
    requestAnimationFrame(() => {
      if (!alive.current || session.current !== open) return;
      if (liveError.current === null && !stillEditing(open.root)) leave();
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
            hoursPerDay={prefs.hoursPerDay}
            frameRate={prefs.frameRate}
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
            timeZone={prefs.timeZone}
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
        ) : kind === 'color' ? (
          <ColorEditor
            value={value as string | null}
            onValueChange={emit}
            onErrorChange={noteError}
            {...shared}
          />
        ) : kind === 'status_list' && context ? (
          <StatusPicker
            context={context}
            entityType={field?.entityType ?? ''}
            field={field?.name}
            projectId={projectId}
            value={typeof value === 'string' ? value : undefined}
            onValueChange={(next: string | undefined) => emit(next ?? null)}
            size={size}
            disabled={disabled}
            readonly={readonly}
            invalid={invalid}
          />
        ) : kind === 'entity' && context ? (
          <EntityPicker
            context={context}
            entityTypes={linkTypes}
            projectId={projectId}
            value={(value ?? null) as EntityRef | null}
            onValueChange={(next: EntityRef | null) => emit(next)}
            size={size}
            disabled={disabled}
            readonly={readonly}
            invalid={invalid}
          />
        ) : kind === 'multi_entity' && context ? (
          <EntityMultiPicker
            context={context}
            entityTypes={linkTypes}
            projectId={projectId}
            value={Array.isArray(value) ? (value as EntityRef[]) : []}
            onValueChange={(next: EntityRef[]) => emit([...next])}
            size={size}
            disabled={disabled}
            readonly={readonly}
            invalid={invalid}
          />
        ) : null
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
            context={context}
            hoursPerDay={prefs.hoursPerDay}
            locale={prefs.locale}
            timeZone={prefs.timeZone}
            frameRate={prefs.frameRate}
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
          context={context}
          hoursPerDay={prefs.hoursPerDay}
          locale={prefs.locale}
          timeZone={prefs.timeZone}
          frameRate={prefs.frameRate}
          precision={precision}
          currencySymbol={symbol ?? '$'}
          emptyLabel={emptyLabel}
        />
      )}
    </div>
  );
}
