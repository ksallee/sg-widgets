import { describe, expect, it } from 'vitest';
import { fillWidths } from '../src/table-width.js';

describe('fillWidths', () => {
  it('gives the last column the width the others leave', () => {
    expect(fillWidths([40, 200, 150], 1000)).toEqual([40, 200, 760]);
  });

  it('changes nothing when the columns already fill or overflow the room', () => {
    expect(fillWidths([40, 200, 150], 390)).toEqual([40, 200, 150]);
    expect(fillWidths([40, 200, 150], 300)).toEqual([40, 200, 150]);
  });

  it('changes nothing before the room is known', () => {
    expect(fillWidths([40, 200], 0)).toEqual([40, 200]);
    expect(fillWidths([40, 200], Number.NaN)).toEqual([40, 200]);
  });

  it('answers no columns for none', () => {
    expect(fillWidths([], 800)).toEqual([]);
  });

  it('keeps whole pixels: the room is floored', () => {
    expect(fillWidths([100, 100], 450.6)).toEqual([100, 350]);
  });
});
