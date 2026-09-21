/**
 * The session every leaf value editor runs on, and the box it stands in.
 *
 * Text, number, url, colour, date and date-time differ in what they parse, what
 * they write back into their control, and what sits beside it. Everything else is
 * the same in all six and lives here: the draft, the commit on blur and on Enter,
 * the Escape that restores, the parse error and the message it becomes, and the
 * invalid reading the control wears. An editor supplies a parse and a format for
 * its own type and draws its own control and extras.
 *
 * The checkbox is not one of them: it has no draft, so it writes on the toggle.
 */
import * as React from 'react';
import type { ParseResult } from 'sg-widgets-core';
import { cn } from '@/lib/utils';
import { type ControlSize } from '@/registry/sg/components/control-classes';
import { FieldError } from '@/registry/sg/components/field-error';

/** The root box every value editor wears. */
export const VALUE_EDITOR_ROOT = 'flex w-full min-w-0 flex-col gap-2';

export interface ValueSessionOptions<TValue, TDraft> {
  /** The stored value. */
  value: TValue;
  /** The stored value as the draft the control shows. */
  format: (value: TValue) => TDraft;
  /** The draft as a stored value, or the reason it was refused. */
  parse: (draft: TDraft) => ParseResult<TValue>;
  /** Writes a committed value out. Called only when it differs from the stored one. */
  onValueChange?: ((value: TValue) => void) | undefined;
  onErrorChange?: ((error: string | null) => void) | undefined;
  /** A message from the caller, shown in place of the parse error. */
  error?: string | null;
  /** Forced invalid state. A failed parse sets it on its own. */
  invalid?: boolean;
  /** Whether a value is the stored one and so is not emitted. Default is `Object.is`. */
  same?: (next: TValue, current: TValue) => boolean;
  /** Enter commits. False where a newline is what Enter means. */
  commitOnEnter?: boolean;
  /** Stop Enter and Escape going up the tree, for a control drawn in a portal. */
  stopKeys?: boolean;
  /** After Enter, with whether the parse held. */
  onEnter?: ((committed: boolean) => void) | undefined;
  /** After Escape. */
  onEscape?: (() => void) | undefined;
}

export interface ValueSession<TValue, TDraft> {
  draft: TDraft;
  setDraft: (draft: TDraft) => void;
  /** Whether the control has focus. A blur that follows a teardown reads it. */
  editing: React.RefObject<boolean>;
  message: string | null;
  invalid: boolean;
  /** Takes a value that needs no parse: a picked colour, a picked day, a step. */
  apply: (value: TValue) => void;
  /** Parses the draft and takes it. Answers whether it parsed, so Enter knows. */
  commit: (override?: TDraft) => boolean;
  /** Back to the stored value, with nothing left to report. */
  reset: () => void;
  onFocus: () => void;
  onBlur: (event: React.FocusEvent<HTMLElement>) => void;
  onKeyDown: (event: React.KeyboardEvent) => void;
}

/** A draft is a string or a record of them, so its identity is not what says it changed. */
function draftKey(draft: unknown): string {
  return typeof draft === 'string' ? draft : JSON.stringify(draft);
}

export function useValueSession<TValue, TDraft>(options: ValueSessionOptions<TValue, TDraft>): ValueSession<TValue, TDraft> {
  const { value, format, parse, onValueChange, onErrorChange } = options;
  const same = options.same ?? ((next: TValue, current: TValue) => Object.is(next, current));

  const incoming = format(value);
  const [draft, setDraft] = React.useState(incoming);
  const [parseError, setParseError] = React.useState<string | null>(null);
  // The control is uncontrolled while it has focus, so typing is never fought by an
  // incoming value; an outside change lands as soon as the control is left.
  const editing = React.useRef(false);
  const latest = React.useRef(incoming);
  latest.current = incoming;

  const key = draftKey(incoming);
  React.useEffect(() => {
    if (!editing.current) setDraft(latest.current);
  }, [key]);

  const message = options.error ?? parseError;
  const invalid = (options.invalid ?? false) || message !== null;

  const clear = (): void => {
    setParseError(null);
    onErrorChange?.(null);
  };

  const apply = (next: TValue): void => {
    clear();
    setDraft(format(next));
    if (same(next, value)) return;
    onValueChange?.(next);
  };

  const commit = (override?: TDraft): boolean => {
    const source = override === undefined ? draft : override;
    if (override !== undefined) setDraft(override);
    const result = parse(source);
    if ('error' in result) {
      setParseError(result.error);
      onErrorChange?.(result.error);
      return false;
    }
    apply(result.value);
    return true;
  };

  const reset = (): void => {
    setDraft(format(value));
    clear();
  };

  return {
    draft,
    setDraft,
    editing,
    message,
    invalid,
    apply,
    commit,
    reset,
    onFocus: () => {
      editing.current = true;
    },
    // Losing focus because the control was removed from the page is not a commit.
    onBlur: (event: React.FocusEvent<HTMLElement>) => {
      if (!event.currentTarget.isConnected) return;
      editing.current = false;
      commit();
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return;
      // A portalled control replays its keys up the owner's tree, so a key the
      // editor answers is stopped where it is answered.
      if (options.stopKeys) event.stopPropagation();
      if (event.key === 'Enter') {
        if (options.commitOnEnter === false) return;
        const committed = commit();
        options.onEnter?.(committed);
        return;
      }
      reset();
      options.onEscape?.();
    },
  };
}

/** The attributes and classes the box carries, whatever element draws it. */
export type ValueEditorRootProps = Omit<React.HTMLAttributes<HTMLElement>, 'defaultValue'>;

export interface ValueEditorProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'defaultValue'> {
  /** The editor's own `data-slot` name. */
  slotName: string;
  size?: ControlSize;
  /** The row form: the control takes the width of its value. */
  inline?: boolean;
  /** The message under the control, or null when there is nothing to say. */
  message?: string | null;
  errorMessage?: (message: string) => React.ReactNode;
  /**
   * Draws the root with the attributes and classes the box carries. The number
   * editor's root is Base UI's NumberField, which owns its own pointer.
   */
  render?: (props: ValueEditorRootProps, children: React.ReactNode) => React.ReactNode;
  children?: React.ReactNode;
  [key: `data-${string}`]: unknown;
}

/**
 * The box a value editor stands in: the control and its extras, then the error
 * line.
 */
export function ValueEditor({
  slotName,
  size = 'md',
  inline = false,
  message = null,
  errorMessage,
  render,
  children,
  className,
  ...rest
}: ValueEditorProps): React.ReactNode {
  const props = {
    'data-slot': slotName,
    'data-size': size,
    'data-inline': inline ? 'true' : undefined,
    className: cn(VALUE_EDITOR_ROOT, inline && 'w-fit', className),
    ...rest,
  } as ValueEditorRootProps;
  const content = (
    <>
      {children}
      <FieldError message={message} errorMessage={errorMessage} />
    </>
  );
  return render ? render(props, content) : <div {...props}>{content}</div>;
}
