import { describe, expect, it } from 'vitest';
import { holdsArmed, pickerKeyIntent, type PickerKeyState } from '../src/picker-keys.js';

function state(over: Partial<PickerKeyState> = {}): PickerKeyState {
  return { open: true, query: '', count: 3, armed: null, editable: true, multiple: true, ...over };
}

describe('pickerKeyIntent', () => {
  it('arms the last chip on the first Backspace and removes it on the second', () => {
    expect(pickerKeyIntent('Backspace', state())).toEqual({ kind: 'arm', index: 2 });
    expect(pickerKeyIntent('Backspace', state({ armed: 2 }))).toEqual({ kind: 'remove', index: 2 });
  });

  it('leaves a Backspace alone while the query has text', () => {
    expect(pickerKeyIntent('Backspace', state({ query: 'sh0' }))).toEqual({ kind: 'nothing' });
    expect(pickerKeyIntent('Backspace', state({ query: 'sh0', armed: 2 }))).toEqual({ kind: 'nothing' });
  });

  it('leaves a Backspace alone with no chip to take, and on a control that takes no edits', () => {
    expect(pickerKeyIntent('Backspace', state({ count: 0 }))).toEqual({ kind: 'nothing' });
    expect(pickerKeyIntent('Backspace', state({ editable: false }))).toEqual({ kind: 'nothing' });
    expect(pickerKeyIntent('Backspace', state({ multiple: false, count: 0 }))).toEqual({ kind: 'nothing' });
  });

  it('clears a single picker in one press, armed or not', () => {
    expect(pickerKeyIntent('Backspace', state({ multiple: false, count: 1 }))).toEqual({ kind: 'remove', index: 0 });
    expect(pickerKeyIntent('Backspace', state({ multiple: false, count: 1, armed: 0 }))).toEqual({
      kind: 'remove',
      index: 0,
    });
  });

  it('arms a multi picker holding one chip rather than removing it', () => {
    expect(pickerKeyIntent('Backspace', state({ count: 1 }))).toEqual({ kind: 'arm', index: 0 });
    expect(pickerKeyIntent('Backspace', state({ count: 1, armed: 0 }))).toEqual({ kind: 'remove', index: 0 });
  });

  it('arms the last chip again when the armed index is past the end', () => {
    expect(pickerKeyIntent('Backspace', state({ count: 2, armed: 5 }))).toEqual({ kind: 'arm', index: 1 });
  });

  it('works the same with the popup closed', () => {
    expect(pickerKeyIntent('Backspace', state({ open: false }))).toEqual({ kind: 'arm', index: 2 });
  });

  it('dismisses on Escape only while the popup shows', () => {
    expect(pickerKeyIntent('Escape', state())).toEqual({ kind: 'dismiss' });
    expect(pickerKeyIntent('Escape', state({ open: false }))).toEqual({ kind: 'nothing' });
  });

  it('follows the highlight on the arrows only while the popup shows', () => {
    expect(pickerKeyIntent('ArrowDown', state())).toEqual({ kind: 'follow' });
    expect(pickerKeyIntent('ArrowUp', state())).toEqual({ kind: 'follow' });
    expect(pickerKeyIntent('ArrowUp', state({ open: false }))).toEqual({ kind: 'nothing' });
  });

  it('has nothing to say about any other key', () => {
    for (const key of ['a', 'Enter', 'Tab', 'Delete', 'Home']) {
      expect(pickerKeyIntent(key, state({ armed: 2 }))).toEqual({ kind: 'nothing' });
    }
  });
});

describe('holdsArmed', () => {
  it('holds through another Backspace and the modifiers', () => {
    for (const key of ['Backspace', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock']) {
      expect(holdsArmed(key)).toBe(true);
    }
  });

  it('drops on anything a person types or navigates with', () => {
    for (const key of ['a', 'Enter', 'ArrowLeft', 'ArrowDown', 'Escape', 'Tab']) {
      expect(holdsArmed(key)).toBe(false);
    }
  });
});
