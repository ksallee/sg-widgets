import { describe, expect, it } from 'vitest';
import { countLine, listStatus, overflowEdges, SEARCHING_LABEL } from '../src/list-chrome.js';

describe('listStatus', () => {
  it('announces a failure ahead of anything else', () => {
    expect(listStatus({ loading: true, count: 3, error: 'Bad gateway' })).toBe('Bad gateway');
    expect(listStatus({ loading: false, count: 0, error: 'Bad gateway' }, { errorLabel: 'Search is down' })).toBe(
      'Search is down',
    );
  });

  it('announces a read in flight, then what it answered', () => {
    expect(listStatus({ loading: true, count: 0 })).toBe(SEARCHING_LABEL);
    expect(listStatus({ loading: false, count: 1 })).toBe('1 result');
    expect(listStatus({ loading: false, count: 12 })).toBe('12 results');
  });

  it('announces an answer of nothing with the widget’s own empty line', () => {
    expect(listStatus({ loading: false, count: 0 })).toBe('No rows');
    expect(listStatus({ loading: false, count: 0 }, { emptyLabel: 'No match' })).toBe('No match');
  });

  it('stays silent until something has been asked for', () => {
    expect(listStatus({ loading: false, count: 0, asked: false })).toBe('');
  });
});

describe('countLine', () => {
  it('counts one row in the singular', () => {
    expect(countLine(0)).toBe('0 results');
    expect(countLine(1)).toBe('1 result');
    expect(countLine(2)).toBe('2 results');
  });
});

describe('overflowEdges', () => {
  it('reads nothing past either edge of a list that fits', () => {
    expect(overflowEdges(0, 200, 200)).toEqual({ start: 0, end: 200 - 200 });
  });

  it('reads the room above and below what is on show', () => {
    expect(overflowEdges(0, 500, 200)).toEqual({ start: 0, end: 300 });
    expect(overflowEdges(120, 500, 200)).toEqual({ start: 120, end: 180 });
    expect(overflowEdges(300, 500, 200)).toEqual({ start: 300, end: 0 });
  });

  it('never reads a negative edge, whatever a rubber-band scroll reports', () => {
    expect(overflowEdges(-40, 500, 200)).toEqual({ start: 0, end: 340 });
    expect(overflowEdges(340, 500, 200)).toEqual({ start: 340, end: 0 });
  });
});
