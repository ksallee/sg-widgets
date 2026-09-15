import { describe, expect, it } from 'vitest';
import { pickerKeyIntent, searchKeyIntent, type PickerKeyState } from '../src/picker-keys.js';

function state(over: Partial<PickerKeyState> = {}): PickerKeyState {
  return { open: true, query: '', count: 3, focused: null, editable: true, multiple: true, ...over };
}

describe('pickerKeyIntent, from the input', () => {
  it('reaches the last chip on Backspace and on ArrowLeft', () => {
    expect(pickerKeyIntent('Backspace', state())).toEqual({ kind: 'focus', index: 2 });
    expect(pickerKeyIntent('ArrowLeft', state())).toEqual({ kind: 'focus', index: 2 });
  });

  it('leaves a Backspace alone while the query has text', () => {
    expect(pickerKeyIntent('Backspace', state({ query: 'sh0' }))).toEqual({ kind: 'nothing' });
    expect(pickerKeyIntent('ArrowLeft', state({ query: 'sh0' }))).toEqual({ kind: 'nothing' });
  });

  it('leaves a Backspace alone with no chip to take, and on a control that takes no edits', () => {
    expect(pickerKeyIntent('Backspace', state({ count: 0 }))).toEqual({ kind: 'nothing' });
    expect(pickerKeyIntent('Backspace', state({ editable: false }))).toEqual({ kind: 'nothing' });
    expect(pickerKeyIntent('Backspace', state({ multiple: false, count: 0 }))).toEqual({ kind: 'nothing' });
  });

  it('clears a single picker in one press and leaves its other keys alone', () => {
    expect(pickerKeyIntent('Backspace', state({ multiple: false, count: 1 }))).toEqual({
      kind: 'remove',
      index: 0,
      then: null,
    });
    expect(pickerKeyIntent('ArrowLeft', state({ multiple: false, count: 1 }))).toEqual({ kind: 'nothing' });
    expect(pickerKeyIntent('Delete', state({ multiple: false, count: 1 }))).toEqual({ kind: 'nothing' });
  });

  it('reaches the one chip of a multi picker rather than removing it', () => {
    expect(pickerKeyIntent('Backspace', state({ count: 1 }))).toEqual({ kind: 'focus', index: 0 });
  });

  it('works the same with the popup closed', () => {
    expect(pickerKeyIntent('Backspace', state({ open: false }))).toEqual({ kind: 'focus', index: 2 });
  });

  it('has nothing to say about Delete, Enter or a character', () => {
    for (const key of ['Delete', 'Enter', 'Tab', 'a', ' ', 'ArrowRight']) {
      expect(pickerKeyIntent(key, state())).toEqual({ kind: 'nothing' });
    }
  });
});

describe('pickerKeyIntent, from a chip', () => {
  const onChip = (over: Partial<PickerKeyState> = {}) => state({ focused: 1, ...over });

  it('walks the row on the arrows and steps off the last chip into the input', () => {
    expect(pickerKeyIntent('ArrowLeft', onChip())).toEqual({ kind: 'focus', index: 0 });
    expect(pickerKeyIntent('ArrowRight', onChip())).toEqual({ kind: 'focus', index: 2 });
    expect(pickerKeyIntent('ArrowLeft', onChip({ focused: 0 }))).toEqual({ kind: 'focus', index: 0 });
    expect(pickerKeyIntent('ArrowRight', onChip({ focused: 2 }))).toEqual({ kind: 'focus', index: null });
  });

  it('removes on Backspace and on Delete, and takes the neighbour', () => {
    expect(pickerKeyIntent('Backspace', onChip())).toEqual({ kind: 'remove', index: 1, then: 1 });
    expect(pickerKeyIntent('Delete', onChip())).toEqual({ kind: 'remove', index: 1, then: 1 });
    expect(pickerKeyIntent('Backspace', onChip({ focused: 2 }))).toEqual({ kind: 'remove', index: 2, then: 1 });
    expect(pickerKeyIntent('Backspace', onChip({ focused: 0, count: 1 }))).toEqual({
      kind: 'remove',
      index: 0,
      then: null,
    });
  });

  it('gives the caret back on Enter and Space, and writes a character through', () => {
    expect(pickerKeyIntent('Enter', onChip())).toEqual({ kind: 'focus', index: null });
    expect(pickerKeyIntent(' ', onChip())).toEqual({ kind: 'focus', index: null });
    expect(pickerKeyIntent('a', onChip())).toEqual({ kind: 'type', key: 'a' });
    expect(pickerKeyIntent('7', onChip())).toEqual({ kind: 'type', key: '7' });
  });

  it('shows the list on ArrowDown', () => {
    expect(pickerKeyIntent('ArrowDown', onChip())).toEqual({ kind: 'open' });
    expect(pickerKeyIntent('ArrowDown', onChip({ open: false }))).toEqual({ kind: 'open' });
  });

  it('ignores a chip index past the end and reads as the input', () => {
    expect(pickerKeyIntent('Backspace', state({ focused: 5 }))).toEqual({ kind: 'focus', index: 2 });
  });

  it('leaves every key alone on a control that takes no edits', () => {
    for (const key of ['Backspace', 'Delete', 'ArrowLeft', 'a']) {
      expect(pickerKeyIntent(key, onChip({ editable: false }))).toEqual({ kind: 'nothing' });
    }
  });

  it('has nothing to say about ArrowUp or Tab', () => {
    expect(pickerKeyIntent('ArrowUp', onChip())).toEqual({ kind: 'nothing' });
    expect(pickerKeyIntent('Tab', onChip())).toEqual({ kind: 'nothing' });
  });
});

describe('pickerKeyIntent, the popup', () => {
  it('dismisses on Escape only while the popup shows', () => {
    expect(pickerKeyIntent('Escape', state())).toEqual({ kind: 'dismiss' });
    expect(pickerKeyIntent('Escape', state({ open: false }))).toEqual({ kind: 'nothing' });
    expect(pickerKeyIntent('Escape', state({ focused: 1 }))).toEqual({ kind: 'dismiss' });
  });

  it('follows the highlight on the arrows only while the popup shows', () => {
    expect(pickerKeyIntent('ArrowDown', state())).toEqual({ kind: 'follow' });
    expect(pickerKeyIntent('ArrowUp', state())).toEqual({ kind: 'follow' });
    expect(pickerKeyIntent('ArrowUp', state({ open: false }))).toEqual({ kind: 'nothing' });
  });
});

describe('searchKeyIntent', () => {
  it('clears a query on Escape', () => {
    expect(searchKeyIntent('Escape', { query: 'sh010' })).toEqual({ kind: 'clear' });
    expect(searchKeyIntent('Escape', { query: ' ' })).toEqual({ kind: 'clear' });
  });

  it('leaves an Escape with no query to the shell', () => {
    expect(searchKeyIntent('Escape', { query: '' })).toEqual({ kind: 'nothing' });
  });

  it('leaves every other key alone', () => {
    for (const key of ['Enter', 'Backspace', 'ArrowDown', 'ArrowUp', 'Tab', 'a']) {
      expect(searchKeyIntent(key, { query: 'sh010' })).toEqual({ kind: 'nothing' });
    }
  });
});
