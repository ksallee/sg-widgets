/**
 * What a press on a table cell does, and how a cell's editor is drawn and focused.
 */
import { editorKindFor, type EditorPlacement } from './edit.js';

/** The pointer gesture that opens a cell's editor. */
export type EditGesture = 'click' | 'dblclick';

/** A press on a cell: a click, a double click, or Space while the cell has focus. */
export type CellGesture = 'click' | 'dblclick' | 'space';

export interface CellGestureInput {
  gesture: CellGesture;
  editOn: EditGesture;
  /** Shift, Ctrl or Meta held. */
  modified: boolean;
  /** The cell can be edited now. */
  editable: boolean;
  /** The cell is a checkbox: one press flips and writes it. */
  toggles: boolean;
  /** The cell's editor is open. */
  open: boolean;
}

/**
 * `edit` opens the cell's editor and leaves the selection; `toggle` writes the flipped
 * checkbox and leaves the selection; `select` hands the press to row selection; `none`
 * does nothing.
 */
export type CellGestureAction = 'edit' | 'toggle' | 'select' | 'none';

/**
 * What a press on a cell does. A checkbox flips on one click or Space in either mode.
 * Any other editable cell opens on the mode's gesture. A modified press, a press on a
 * cell that cannot be edited, and Space on any other cell belong to row selection. A
 * press inside an open editor is the editor's own.
 */
export function cellGestureAction(input: CellGestureInput): CellGestureAction {
  const { gesture, editOn, modified, editable, toggles, open } = input;
  if (open) return 'none';
  if (modified || !editable) return gesture === 'dblclick' ? 'none' : 'select';
  if (toggles) return gesture === 'dblclick' ? 'none' : 'toggle';
  if (gesture === 'space') return 'select';
  if (gesture === editOn) return 'edit';
  return gesture === 'click' ? 'select' : 'none';
}

export interface CellEditHintInput {
  editOn: EditGesture;
  /** The cell is a checkbox. */
  toggles?: boolean;
  /** Selected rows an edit in this row reaches. Under two names none. */
  bulkCount?: number;
}

/** The title an editable cell carries, naming the gesture that edits it. */
export function cellEditHint({ editOn, toggles = false, bulkCount = 0 }: CellEditHintInput): string {
  const reach = bulkCount > 1 ? ` all ${bulkCount} selected rows` : '';
  if (toggles) return `Click or press Space to toggle${reach}`;
  return `${editOn === 'click' ? 'Click' : 'Double-click'} or press Enter to edit${reach}`;
}

/** How an editor is drawn in a cell. */
export interface CellEditorShape {
  /** A number keeps its stepper buttons. */
  steppers: boolean;
  /** The value is selected on open, so typing replaces it. */
  selectText: boolean;
}

/**
 * A number edited in the cell is a bare field the width of the cell, its value
 * selected: steppers would take the width of a narrow column. Arrow keys still step.
 */
export function cellEditorShape(dataType: string, placement: EditorPlacement): CellEditorShape {
  const bare = placement === 'inline' && editorKindFor(dataType) === 'number';
  return { steppers: !bare, selectText: bare };
}

/**
 * Which of an editor's controls takes focus on open, by tag name in document order:
 * the first input or textarea, else the first button, else none (-1).
 */
export function editorFocusIndex(tags: readonly string[]): number {
  const upper = tags.map((tag) => tag.toUpperCase());
  const field = upper.findIndex((tag) => tag === 'INPUT' || tag === 'TEXTAREA');
  return field >= 0 ? field : upper.indexOf('BUTTON');
}
