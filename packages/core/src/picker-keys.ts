/**
 * The keyboard model every picker shares.
 *
 * A picker is a token field: chips, a caret and a list. Backspace, Escape and the
 * arrows mean the same thing in all of them, and the rules live here so the two
 * frameworks cannot drift.
 */

/** What a keydown asks the control to do. */
export type PickerKeyIntent =
  /** The key is not the control's business. */
  | { kind: 'nothing' }
  /** Close the popup, clear the query and drop the armed chip. */
  | { kind: 'dismiss' }
  /** Highlight the chip at `index`. The next Backspace removes it. */
  | { kind: 'arm'; index: number }
  /** Remove the chip at `index`. */
  | { kind: 'remove'; index: number }
  /** Keep the list's highlighted row in view. */
  | { kind: 'follow' };

export interface PickerKeyState {
  /** The popup is showing. */
  open: boolean;
  /** Text in the search box. */
  query: string;
  /** Chips in the control. A single picker counts its value as one. */
  count: number;
  /** Index of the armed chip, or `null` when none is. */
  armed: number | null;
  /** The control takes edits. A disabled or readonly one takes none. */
  editable: boolean;
  /** Several keys may be chosen at once. */
  multiple: boolean;
}

/**
 * What a keydown means to a picker.
 *
 * Backspace in an empty query walks the chips of a multi picker the way token fields
 * do: the first arms the last chip, the second removes it, so a held key cannot empty
 * the field. A single picker holds one value and clears it in a press. Escape is the
 * control's business only while the popup shows; a closed picker leaves the key to
 * whatever encloses it.
 */
export function pickerKeyIntent(key: string, state: PickerKeyState): PickerKeyIntent {
  if (key === 'Escape') return state.open ? { kind: 'dismiss' } : { kind: 'nothing' };
  if (key === 'ArrowUp' || key === 'ArrowDown') return state.open ? { kind: 'follow' } : { kind: 'nothing' };
  if (key !== 'Backspace') return { kind: 'nothing' };
  if (!state.editable || state.query !== '' || state.count === 0) return { kind: 'nothing' };
  if (!state.multiple) return { kind: 'remove', index: state.count - 1 };
  const { armed } = state;
  if (armed !== null && armed >= 0 && armed < state.count) return { kind: 'remove', index: armed };
  return { kind: 'arm', index: state.count - 1 };
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

/** Another Backspace, and the modifiers a person holds to reach one. */
const HOLDS_ARMED = new Set(['Backspace', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock']);

/** Whether a key leaves the armed chip armed. Every other key disarms it. */
export function holdsArmed(key: string): boolean {
  return HOLDS_ARMED.has(key);
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
