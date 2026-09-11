/**
 * The keyboard model every picker shares.
 *
 * A picker is a token field: chips, a caret and a list. The chips take the caret one at
 * a time, and Backspace, the arrows and Escape mean the same thing in all of them, so
 * the rules live here and the two frameworks cannot drift.
 */

/** What a keydown asks the control to do. */
export type PickerKeyIntent =
  /** The key is not the control's business. */
  | { kind: 'nothing' }
  /** Close the popup, clear the query and give the caret back to the input. */
  | { kind: 'dismiss' }
  /** Put the caret on the chip at `index`, or back in the input when `null`. */
  | { kind: 'focus'; index: number | null }
  /** Remove the chip at `index`, then take `then`: a chip, or the input when `null`. */
  | { kind: 'remove'; index: number; then: number | null }
  /** Give the caret back to the input and write `key` into the query. */
  | { kind: 'type'; key: string }
  /** Give the caret back to the input and show the list. */
  | { kind: 'open' }
  /** Keep the list's highlighted row in view. */
  | { kind: 'follow' };

export interface PickerKeyState {
  /** The popup is showing. */
  open: boolean;
  /** Text in the search box. */
  query: string;
  /** Chips in the control. A single picker counts its value as one. */
  count: number;
  /** Index of the chip holding the caret, or `null` while the input holds it. */
  focused: number | null;
  /** The control takes edits. A disabled or readonly one takes none. */
  editable: boolean;
  /** Several keys may be chosen at once. */
  multiple: boolean;
}

/** A key that writes one character, as against a named key like `Enter` or `Tab`. */
const printable = (key: string): boolean => key.length === 1 && key !== ' ';

/**
 * What a keydown means to a picker.
 *
 * From the input, Backspace and `ArrowLeft` in an empty query reach the chips of a multi
 * picker rather than the text, and a single picker clears its one value in a press. From
 * a chip, the arrows walk the row, Backspace and Delete take the chip and leave the caret
 * on its neighbour, `ArrowDown` shows the list, and anything a person would type gives
 * the caret back to the input. Escape is the control's business only while the popup
 * shows; a closed picker leaves the key to whatever encloses it.
 */
export function pickerKeyIntent(key: string, state: PickerKeyState): PickerKeyIntent {
  const { open, query, count, editable, multiple } = state;
  const focused = state.focused !== null && state.focused >= 0 && state.focused < count ? state.focused : null;

  if (key === 'Escape') return open ? { kind: 'dismiss' } : { kind: 'nothing' };

  if (focused !== null) {
    if (!editable) return { kind: 'nothing' };
    if (key === 'ArrowLeft') return { kind: 'focus', index: Math.max(0, focused - 1) };
    if (key === 'ArrowRight') return { kind: 'focus', index: focused + 1 < count ? focused + 1 : null };
    if (key === 'Backspace' || key === 'Delete') {
      return { kind: 'remove', index: focused, then: count > 1 ? Math.min(focused, count - 2) : null };
    }
    if (key === 'ArrowDown') return { kind: 'open' };
    if (printable(key)) return { kind: 'type', key };
    if (key === 'Enter' || key === ' ') return { kind: 'focus', index: null };
    return { kind: 'nothing' };
  }

  if (key === 'ArrowUp' || key === 'ArrowDown') return open ? { kind: 'follow' } : { kind: 'nothing' };
  if (!editable || query !== '' || count === 0) return { kind: 'nothing' };
  if (!multiple) return key === 'Backspace' ? { kind: 'remove', index: count - 1, then: null } : { kind: 'nothing' };
  if (key === 'Backspace' || key === 'ArrowLeft') return { kind: 'focus', index: count - 1 };
  return { kind: 'nothing' };
}

/** What a keydown asks a search box to do. */
export type SearchKeyIntent =
  /** The key is not the search box's business. */
  | { kind: 'nothing' }
  /** Clear the query and the rows it answered, and keep the caret where it is. */
  | { kind: 'clear' };

export interface SearchKeyState {
  /** Text in the search box. */
  query: string;
}

/**
 * What a keydown means to a search box. Escape is the search box's business only while
 * the query has text; an empty one leaves the key to the shell, as a closed picker does.
 */
export function searchKeyIntent(key: string, state: SearchKeyState): SearchKeyIntent {
  if (key !== 'Escape') return { kind: 'nothing' };
  return state.query.length > 0 ? { kind: 'clear' } : { kind: 'nothing' };
}

/**
 * Put the caret on one chip of a row.
 *
 * Every chip is taken out of the tab order, so the row is walked with the arrows and Tab
 * still leaves the control. A chip the measured row hides takes no caret, and the input
 * keeps it; the model still counts the chip as the one a Backspace removes.
 */
export function focusChip(row: Element | null | undefined, index: number | null): boolean {
  const chips = row ? [...row.querySelectorAll<HTMLElement>('[data-chip]')] : [];
  for (const chip of chips) chip.tabIndex = -1;
  const one = index === null ? null : chips[index];
  if (!one || one.hidden || !one.focus) return false;
  one.focus({ preventScroll: true });
  return true;
}

/**
 * Keep the list's highlighted row in view.
 *
 * `nearest` moves the scroller by the least it can and leaves the page under a
 * fixed popup where it is. Both primitives mark the row with `data-highlighted`.
 */
export function scrollHighlightedIntoView(list: Element | null | undefined): boolean {
  const row = list?.querySelector<HTMLElement>('[data-highlighted]');
  if (!row?.scrollIntoView) return false;
  row.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return true;
}
