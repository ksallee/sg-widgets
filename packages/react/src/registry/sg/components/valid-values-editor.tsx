import type * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import type { ListRow, SgContext } from 'sg-widgets-core';
import { addListValues, moveListValue, replaceListValue, splitListValues, syncListRows } from 'sg-widgets-core';
import { GripVerticalIcon, PlusIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSortable } from '@/registry/sg/components/sortable';
import { StatusMultiPicker } from '@/registry/sg/components/status-multi-picker';
import { cn } from '@/lib/utils';

export type ValidValuesEditorSize = 'sm' | 'md' | 'lg';

/** The data types whose schema carries valid values. */
export type ValidValuesDataType = 'list' | 'status_list';

/**
 * A row is its icon buttons and its inset, and the box adds its border, so a box of
 * one row stands on the control ladder of `docs/design-rules.md`: 28, 32 and 36.
 */
const ACTION: Record<ValidValuesEditorSize, 'icon-xs' | 'icon-sm'> = {
  sm: 'icon-xs',
  md: 'icon-xs',
  lg: 'icon-sm',
};
const ROW_BOX: Record<ValidValuesEditorSize, string> = {
  sm: 'p-px',
  md: 'p-0.75',
  lg: 'p-0.75',
};
/** The line a row's text stands on, as high as the buttons beside it. */
const LINE: Record<ValidValuesEditorSize, string> = { sm: 'h-6', md: 'h-6', lg: 'h-7' };
/** The slot the add row's glyph takes, so its text starts where a row's does. */
const LEAD: Record<ValidValuesEditorSize, string> = { sm: 'size-6', md: 'size-6', lg: 'size-7' };

const BOX =
  'border-input bg-background has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-background data-invalid:border-destructive data-invalid:ring-destructive/20 dark:data-invalid:ring-destructive/40 flex w-full min-w-0 flex-col rounded-lg border text-sm shadow-xs transition-colors duration-150 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-offset-2 data-invalid:ring-2';
const ROW =
  'bg-background flex min-w-0 items-center gap-2 rounded-md data-[dragging]:z-10 data-[dragging]:opacity-90 data-[dragging]:shadow-md data-[drop-target]:bg-accent/40';
const INPUT =
  'placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none disabled:cursor-not-allowed';

export interface ValidValuesEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;
  /** The field's data type: an ordered list of strings, or status codes. */
  dataType?: ValidValuesDataType;
  /** The valid values: strings in drop-down order, or status codes. */
  value?: string[];
  onValueChange?: (value: string[]) => void;
  /** The widget context. A status list picks from the site's statuses through it; without one its codes are typed. */
  context?: SgContext;
  /** Drop a value the list already holds. Off: a repeated value is kept. */
  unique?: boolean;
  /** Shown in the add row, or in an empty status picker. */
  placeholder?: string;
  /** Shown in a read-only editor that holds no value. */
  emptyLabel?: string;
  size?: ValidValuesEditorSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  className?: string;
}

const NO_VALUES: string[] = [];

/**
 * The valid values of a `list` or a `status_list` field.
 *
 * A list's values are bare strings, and their order is the order of the drop-down. A
 * write is compared to them byte for byte, case and a trailing space included, so a
 * value is trimmed where it is defined and a blank one is dropped (field_types/list).
 * Each value is a row that is typed in, dragged and removed, and a text of several
 * lines pasted anywhere becomes one row per line.
 *
 * A status list's values are status codes. With a context they are picked from the
 * site's Status table, each drawn as the site draws it, and their order carries no
 * meaning. Without one there is no table to read, and the codes are typed as a list's are.
 */
export function ValidValuesEditor({
  dataType = 'list',
  value = NO_VALUES,
  onValueChange,
  context,
  unique = false,
  placeholder,
  emptyLabel = 'No values',
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  className,
  ref,
  ...rest
}: ValidValuesEditorProps) {
  /** Status codes are picked where there is a site to read them from, and typed otherwise. */
  const picked = dataType === 'status_list' && context !== undefined;
  const editable = !disabled && !readonly;

  // The rows keep their keys from one value to the next, so an edit and a move keep
  // the row's element, and with it the focus.
  const [held, setHeld] = useState<ListRow[]>(() => syncListRows([], value));
  const rows = syncListRows(held, value);
  if (rows !== held) setHeld(rows);

  /** What is typed in a row and not yet committed, by row key. */
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState('');
  const boxRef = useRef<HTMLDivElement | null>(null);
  /** Where the caret goes once the rows are drawn again. */
  const [caret, setCaret] = useState<{ index: number } | null>(null);

  useEffect(() => {
    if (!caret) return;
    const inputs = boxRef.current?.querySelectorAll<HTMLInputElement>('input') ?? [];
    inputs[Math.max(0, Math.min(caret.index, inputs.length - 1))]?.focus({ preventScroll: true });
  }, [caret]);

  function commit(next: string[]): void {
    if (next.length === value.length && next.every((item, index) => item === value[index])) return;
    onValueChange?.(next);
  }

  function textOf(row: ListRow): string {
    return drafts[row.key] ?? row.value;
  }

  function dropDraft(key: string): string | undefined {
    const draft = drafts[key];
    if (draft !== undefined) {
      setDrafts((all) => {
        const { [key]: _dropped, ...kept } = all;
        return kept;
      });
    }
    return draft;
  }

  /** The row's draft becomes its value: trimmed, removed when blank, one row per line. */
  function commitRow(key: string): void {
    const index = rows.findIndex((row) => row.key === key);
    const draft = dropDraft(key);
    if (index < 0 || draft === undefined) return;
    commit(replaceListValue(value, index, draft, { unique }));
  }

  function add(text: string): void {
    setAdding('');
    if (text.trim() !== '') commit(addListValues(value, text, { unique }));
  }

  /** The caret in the row at `index`, or in the add row past the last one. */
  function focusAt(index: number): void {
    setCaret({ index });
  }

  function removeAt(index: number): void {
    const row = rows[index];
    if (row) dropDraft(row.key);
    commit(value.filter((_, at) => at !== index));
  }

  function move(index: number, delta: number): void {
    const to = index + delta;
    if (to < 0 || to >= value.length) return;
    commit(moveListValue(value, index, to));
    focusAt(to);
  }

  /** A paste of several lines, merged into the text at the caret. One line is the input's own. */
  function pasted(event: React.ClipboardEvent<HTMLInputElement>): string | null {
    const text = event.clipboardData.getData('text');
    if (!/[\r\n]/.test(text)) return null;
    event.preventDefault();
    const input = event.currentTarget;
    const from = input.selectionStart ?? input.value.length;
    const to = input.selectionEnd ?? input.value.length;
    return input.value.slice(0, from) + text + input.value.slice(to);
  }

  const { ref: sortableRef, dragging, announcement } = useSortable<HTMLDivElement>({
    ids: rows.map((row) => row.key),
    onOrderChange: (order) => commit(order.map((key) => rows.find((row) => row.key === key)?.value ?? '')),
    label: (key) => rows.find((row) => row.key === key)?.value ?? key,
    disabled: !editable,
  });

  /** Alt and an arrow move the row holding focus, from its grip or from its text. */
  function onMoveKeys(event: React.KeyboardEvent, index: number): boolean {
    // The sortable owns the arrow keys while it carries a row.
    if (dragging !== null || !event.altKey) return false;
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return false;
    event.preventDefault();
    move(index, event.key === 'ArrowUp' ? -1 : 1);
    return true;
  }

  function onRowKeys(event: React.KeyboardEvent<HTMLInputElement>, row: ListRow, index: number): void {
    if (onMoveKeys(event, index)) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      const lines = splitListValues(textOf(row)).length;
      commitRow(row.key);
      focusAt(index + lines);
    } else if (event.key === 'Escape' && drafts[row.key] !== undefined) {
      event.stopPropagation();
      dropDraft(row.key);
    } else if (event.key === 'Backspace' && textOf(row) === '') {
      event.preventDefault();
      removeAt(index);
      focusAt(index - 1);
    }
  }

  function onRowPaste(event: React.ClipboardEvent<HTMLInputElement>, row: ListRow, index: number): void {
    const text = pasted(event);
    if (text === null) return;
    dropDraft(row.key);
    commit(replaceListValue(value, index, text, { unique }));
    focusAt(index + splitListValues(text).length);
  }

  function onAddKeys(event: React.KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      add(adding);
    } else if (event.key === 'Backspace' && adding === '' && value.length > 0) {
      event.preventDefault();
      focusAt(value.length - 1);
    }
  }

  function onAddPaste(event: React.ClipboardEvent<HTMLInputElement>): void {
    const text = pasted(event);
    if (text !== null) add(text);
  }

  return (
    <div
      ref={ref}
      data-slot="valid-values-editor"
      data-type={dataType}
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col', className)}
      {...rest}
    >
      {picked && context ? (
        <StatusMultiPicker
          context={context}
          value={value}
          onValueChange={commit}
          summary="chips"
          placeholder={placeholder ?? 'Select statuses'}
          size={size}
          disabled={disabled}
          readonly={readonly}
          invalid={invalid}
        />
      ) : (
        <>
          <div
            ref={boxRef}
            data-slot="valid-values-editor-box"
            data-invalid={invalid ? 'true' : undefined}
            data-empty={value.length === 0 ? 'true' : undefined}
            aria-disabled={disabled || undefined}
            className={cn(BOX, disabled && 'pointer-events-none opacity-50')}
          >
            <div data-slot="valid-values-editor-rows" role="list" className="flex min-w-0 flex-col" ref={sortableRef}>
              {rows.map((row, index) => (
                <div
                  key={row.key}
                  data-slot="valid-values-editor-row"
                  data-sortable-id={row.key}
                  data-value={row.value}
                  role="listitem"
                  className={cn(ROW, ROW_BOX[size])}
                >
                  {editable ? (
                    <>
                      <Button
                        variant="ghost"
                        size={ACTION[size]}
                        data-slot="valid-values-editor-grip"
                        data-sortable-handle="true"
                        onKeyDown={(event) => {
                          onMoveKeys(event, index);
                        }}
                        aria-label={`Reorder ${row.value}`}
                        title="Drag to reorder, or press Space and use the arrow keys"
                        className="cursor-grab touch-none active:cursor-grabbing"
                      >
                        <GripVerticalIcon />
                      </Button>
                      <input
                        data-slot="valid-values-editor-input"
                        type="text"
                        value={textOf(row)}
                        aria-label={`Value ${index + 1}`}
                        aria-invalid={invalid || undefined}
                        autoComplete="off"
                        spellCheck={false}
                        className={cn(INPUT, LINE[size])}
                        onChange={(event) => {
                          const text = event.currentTarget.value;
                          setDrafts((all) => ({ ...all, [row.key]: text }));
                        }}
                        onBlur={() => commitRow(row.key)}
                        onKeyDown={(event) => onRowKeys(event, row, index)}
                        onPaste={(event) => onRowPaste(event, row, index)}
                      />
                      <Button
                        variant="ghost"
                        size={ACTION[size]}
                        data-slot="valid-values-editor-remove"
                        aria-label={`Remove ${row.value}`}
                        onClick={() => {
                          removeAt(index);
                          focusAt(index);
                        }}
                      >
                        <XIcon />
                      </Button>
                    </>
                  ) : (
                    <span className={cn('flex min-w-0 items-center px-2', LINE[size])}>
                      <span className="truncate" title={row.value}>
                        {row.value}
                      </span>
                    </span>
                  )}
                </div>
              ))}
            </div>
            {editable ? (
              <div data-slot="valid-values-editor-add" className={cn('flex min-w-0 items-center gap-2', ROW_BOX[size])}>
                <span className={cn('text-muted-foreground flex shrink-0 items-center justify-center', LEAD[size])}>
                  <PlusIcon aria-hidden="true" className="size-4" />
                </span>
                <input
                  data-slot="valid-values-editor-add-input"
                  type="text"
                  value={adding}
                  placeholder={placeholder ?? 'Add a value'}
                  aria-label="Add a value"
                  aria-invalid={invalid || undefined}
                  autoComplete="off"
                  spellCheck={false}
                  className={cn(INPUT, LINE[size])}
                  onChange={(event) => setAdding(event.currentTarget.value)}
                  onBlur={() => add(adding)}
                  onKeyDown={onAddKeys}
                  onPaste={onAddPaste}
                />
              </div>
            ) : value.length === 0 ? (
              <div data-slot="valid-values-editor-empty" className={cn('flex min-w-0 items-center', ROW_BOX[size])}>
                <span className={cn('text-muted-foreground flex min-w-0 items-center px-2', LINE[size])}>
                  <span className="truncate">{emptyLabel}</span>
                </span>
              </div>
            ) : null}
          </div>
          <div
            data-slot="valid-values-editor-live-region"
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="sr-only"
          >
            {announcement}
          </div>
        </>
      )}
    </div>
  );
}
