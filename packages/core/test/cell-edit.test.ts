import { describe, expect, it } from 'vitest';
import {
  cellEditHint,
  cellEditorShape,
  cellGestureAction,
  editorFocusIndex,
  type CellGesture,
  type CellGestureInput,
  type EditGesture,
} from '../src/cell-edit.js';

const base: CellGestureInput = {
  gesture: 'click',
  editOn: 'dblclick',
  modified: false,
  editable: true,
  toggles: false,
  open: false,
};

const act = (over: Partial<CellGestureInput>) => cellGestureAction({ ...base, ...over });

/** Every input the function can be handed. */
function everyInput(): CellGestureInput[] {
  const out: CellGestureInput[] = [];
  const bools = [false, true];
  for (const gesture of ['click', 'dblclick', 'space'] as CellGesture[])
    for (const editOn of ['click', 'dblclick'] as EditGesture[])
      for (const modified of bools)
        for (const editable of bools)
          for (const toggles of bools)
            for (const open of bools) out.push({ gesture, editOn, modified, editable, toggles, open });
  return out;
}

describe('cellGestureAction', () => {
  it('leaves a plain click to the row and opens on a double click, by default', () => {
    expect(act({ gesture: 'click' })).toBe('select');
    expect(act({ gesture: 'dblclick' })).toBe('edit');
  });

  it('opens on a plain click with editOn click, and ignores the double click after it', () => {
    expect(act({ gesture: 'click', editOn: 'click' })).toBe('edit');
    expect(act({ gesture: 'dblclick', editOn: 'click' })).toBe('none');
  });

  it('leaves a click with Shift, Ctrl or Meta to the row in either mode', () => {
    expect(act({ editOn: 'click', modified: true })).toBe('select');
    expect(act({ editOn: 'dblclick', modified: true })).toBe('select');
    expect(act({ editOn: 'click', modified: true, toggles: true })).toBe('select');
  });

  it('leaves a click on a cell that cannot be edited to the row', () => {
    expect(act({ editOn: 'click', editable: false })).toBe('select');
    expect(act({ gesture: 'dblclick', editable: false })).toBe('none');
    expect(act({ editOn: 'click', editable: false, toggles: true })).toBe('select');
  });

  it('does nothing for a press inside the open editor', () => {
    expect(act({ editOn: 'click', open: true })).toBe('none');
    expect(act({ gesture: 'dblclick', open: true })).toBe('none');
    expect(act({ gesture: 'space', toggles: true, open: true })).toBe('none');
  });

  it('toggles a checkbox on one click in either mode, and on Space', () => {
    expect(act({ toggles: true, editOn: 'click' })).toBe('toggle');
    expect(act({ toggles: true, editOn: 'dblclick' })).toBe('toggle');
    expect(act({ toggles: true, gesture: 'space' })).toBe('toggle');
    expect(act({ toggles: true, gesture: 'dblclick' })).toBe('none');
  });

  it('leaves Space to the row on a cell that is not a checkbox', () => {
    expect(act({ gesture: 'space' })).toBe('select');
    expect(act({ gesture: 'space', editOn: 'click' })).toBe('select');
    expect(act({ gesture: 'space', toggles: true, modified: true })).toBe('select');
  });

  describe('over every input', () => {
    const inputs = everyInput();

    it('never edits or toggles an open, locked or modified cell', () => {
      for (const input of inputs) {
        if (!input.open && input.editable && !input.modified) continue;
        expect(['select', 'none']).toContain(cellGestureAction(input));
      }
    });

    it('edits only on the mode gesture, and never a checkbox', () => {
      for (const input of inputs) {
        if (cellGestureAction(input) !== 'edit') continue;
        expect(input.gesture).toBe(input.editOn);
        expect(input.toggles).toBe(false);
      }
    });

    it('toggles only a checkbox, and on a click or Space alone', () => {
      for (const input of inputs) {
        if (cellGestureAction(input) !== 'toggle') continue;
        expect(input.toggles).toBe(true);
        expect(input.gesture).not.toBe('dblclick');
      }
    });

    it('never hands a double click to the row', () => {
      for (const input of inputs.filter((entry) => entry.gesture === 'dblclick')) {
        expect(cellGestureAction(input)).not.toBe('select');
      }
    });

    it('leaves Space with the row unless it toggles', () => {
      for (const input of inputs.filter((entry) => entry.gesture === 'space')) {
        expect(['select', 'toggle', 'none']).toContain(cellGestureAction(input));
      }
    });

    it('changes nothing but the editor gesture between the two modes', () => {
      for (const input of inputs.filter((entry) => entry.editOn === 'dblclick')) {
        const other = cellGestureAction({ ...input, editOn: 'click' });
        const mine = cellGestureAction(input);
        if (mine === other) continue;
        expect(input.gesture).not.toBe('space');
        expect(input.toggles).toBe(false);
      }
    });
  });
});

describe('cellEditHint', () => {
  it('names the gesture for the mode', () => {
    expect(cellEditHint({ editOn: 'dblclick' })).toBe('Double-click or press Enter to edit');
    expect(cellEditHint({ editOn: 'click' })).toBe('Click or press Enter to edit');
  });

  it('names the selected rows an edit reaches', () => {
    expect(cellEditHint({ editOn: 'click', bulkCount: 3 })).toBe('Click or press Enter to edit all 3 selected rows');
    expect(cellEditHint({ editOn: 'dblclick', bulkCount: 2 })).toBe(
      'Double-click or press Enter to edit all 2 selected rows',
    );
  });

  it('says click or Space on a checkbox, in either mode', () => {
    expect(cellEditHint({ editOn: 'dblclick', toggles: true })).toBe('Click or press Space to toggle');
    expect(cellEditHint({ editOn: 'click', toggles: true, bulkCount: 4 })).toBe(
      'Click or press Space to toggle all 4 selected rows',
    );
  });

  it('ignores a bulk count under two', () => {
    expect(cellEditHint({ editOn: 'click', bulkCount: 1 })).toBe('Click or press Enter to edit');
  });
});

describe('cellEditorShape', () => {
  it('drops the steppers and selects the text of a number type in the cell', () => {
    for (const type of ['number', 'float', 'percent', 'currency', 'duration', 'timecode']) {
      expect(cellEditorShape(type, 'inline')).toEqual({ steppers: false, selectText: true });
    }
  });

  it('keeps the steppers in a popover', () => {
    expect(cellEditorShape('number', 'popover')).toEqual({ steppers: true, selectText: false });
  });

  it('leaves the other types as they are', () => {
    expect(cellEditorShape('text', 'inline')).toEqual({ steppers: true, selectText: false });
    expect(cellEditorShape('checkbox', 'inline')).toEqual({ steppers: true, selectText: false });
  });
});

describe('editorFocusIndex', () => {
  it('picks the field over a stepper drawn before it', () => {
    expect(editorFocusIndex(['BUTTON', 'INPUT', 'BUTTON'])).toBe(1);
    expect(editorFocusIndex(['button', 'textarea'])).toBe(1);
  });

  it('falls back to the first button, then to nothing', () => {
    expect(editorFocusIndex(['DIV', 'BUTTON', 'BUTTON'])).toBe(1);
    expect(editorFocusIndex(['DIV'])).toBe(-1);
    expect(editorFocusIndex([])).toBe(-1);
  });

  it('picks the first field, and a field whenever there is one, over every short list', () => {
    const tags = ['INPUT', 'TEXTAREA', 'BUTTON', 'DIV'];
    const lists: string[][] = [[]];
    for (let length = 1; length <= 4; length += 1) {
      for (const list of lists.filter((entry) => entry.length === length - 1)) {
        for (const tag of tags) lists.push([...list, tag]);
      }
    }
    for (const list of lists) {
      const at = editorFocusIndex(list);
      const field = list.findIndex((tag) => tag === 'INPUT' || tag === 'TEXTAREA');
      const button = list.indexOf('BUTTON');
      expect(at).toBe(field >= 0 ? field : button);
    }
  });
});
