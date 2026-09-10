import { describe, expect, it } from 'vitest';
import {
  createSortable,
  sortableAnnouncements,
  sortableDropIndex,
  sortableScrollStep,
  sortableStride,
  type SortableRect,
} from '../src/sortable.js';

const ids = ['code', 'status', 'due', 'artist', 'cut_in'];

/** Five rows of 32px with an 8px gap, starting at y=100. */
function rows(count = 5, height = 32, gap = 8, top = 100): SortableRect[] {
  return Array.from({ length: count }, (_, i) => ({
    top: top + i * (height + gap),
    bottom: top + i * (height + gap) + height,
    left: 0,
    right: 200,
  }));
}

describe('createSortable', () => {
  it('moves an entry and leaves the source alone', () => {
    const model = createSortable(ids);
    expect(model.moveTo(0, 2)).toEqual(['status', 'due', 'code', 'artist', 'cut_in']);
    expect(model.moveTo(4, 1)).toEqual(['code', 'cut_in', 'status', 'due', 'artist']);
    expect(model.ids).toEqual(ids);
  });

  it('leaves the order alone for an index off either end', () => {
    const model = createSortable(ids);
    expect(model.moveTo(0, -1)).toEqual(ids);
    expect(model.moveTo(0, 5)).toEqual(ids);
    expect(model.moveTo(-1, 2)).toEqual(ids);
    expect(model.moveTo(2, 2)).toEqual(ids);
  });

  it('moves one place by keyboard, and stops at the ends', () => {
    const model = createSortable(ids);
    expect(model.keyboardMove('due', 'up')).toEqual(['code', 'due', 'status', 'artist', 'cut_in']);
    expect(model.keyboardMove('due', 'down')).toEqual(['code', 'status', 'artist', 'due', 'cut_in']);
    expect(model.keyboardMove('code', 'up')).toEqual(ids);
    expect(model.keyboardMove('cut_in', 'down')).toEqual(ids);
    expect(model.keyboardMove('missing', 'down')).toEqual(ids);
  });

  it('announces a position as one of the count', () => {
    const model = createSortable(ids, { label: (id) => id.toUpperCase() });
    expect(model.pickedUp('status')).toBe('Picked up STATUS, position 2 of 5');
    expect(model.movedTo('status', 2)).toBe('Moved STATUS to position 3 of 5');
    expect(model.dropped('status')).toBe('Dropped STATUS');
    expect(model.cancelled()).toBe('Cancelled');
  });

  it('announces the id itself with no label', () => {
    expect(createSortable(ids).pickedUp('code')).toBe('Picked up code, position 1 of 5');
    expect(sortableAnnouncements.move('code', 4, 5)).toBe('Moved code to position 5 of 5');
  });
});

describe('sortableDropIndex', () => {
  const rects = rows();

  it('holds its place until a midpoint is crossed', () => {
    // Row 1 runs 140..172, midpoint 156; row 2 runs 180..212, midpoint 196.
    expect(sortableDropIndex(rects, 1, { x: 0, y: 156 })).toBe(1);
    expect(sortableDropIndex(rects, 1, { x: 0, y: 195 })).toBe(1);
    expect(sortableDropIndex(rects, 1, { x: 0, y: 197 })).toBe(2);
  });

  it('takes the last place whose midpoint is passed', () => {
    expect(sortableDropIndex(rects, 0, { x: 0, y: 300 })).toBe(4);
    expect(sortableDropIndex(rects, 0, { x: 0, y: 1000 })).toBe(4);
  });

  it('takes the first place whose midpoint is passed going up', () => {
    expect(sortableDropIndex(rects, 4, { x: 0, y: 115 })).toBe(0);
    expect(sortableDropIndex(rects, 4, { x: 0, y: 150 })).toBe(1);
    expect(sortableDropIndex(rects, 4, { x: 0, y: -50 })).toBe(0);
  });

  it('reads the other axis when horizontal', () => {
    const columns: SortableRect[] = [
      { top: 0, bottom: 40, left: 0, right: 100 },
      { top: 0, bottom: 40, left: 100, right: 200 },
      { top: 0, bottom: 40, left: 200, right: 300 },
    ];
    expect(sortableDropIndex(columns, 0, { x: 149, y: 20 }, 'horizontal')).toBe(0);
    expect(sortableDropIndex(columns, 0, { x: 151, y: 20 }, 'horizontal')).toBe(1);
    expect(sortableDropIndex(columns, 2, { x: 49, y: 20 }, 'horizontal')).toBe(0);
  });

  it('answers with the source for an index off the list', () => {
    expect(sortableDropIndex(rects, 9, { x: 0, y: 150 })).toBe(9);
    expect(sortableDropIndex([], 0, { x: 0, y: 0 })).toBe(0);
  });
});

describe('sortableStride', () => {
  it('is the distance to the next row, gap included', () => {
    expect(sortableStride(rows(), 0)).toBe(40);
    expect(sortableStride(rows(), 4)).toBe(40);
  });

  it('falls back to the row height for a list of one', () => {
    expect(sortableStride(rows(1), 0)).toBe(32);
    expect(sortableStride([], 0)).toBe(0);
  });
});

describe('sortableScrollStep', () => {
  const bounds: SortableRect = { top: 0, bottom: 400, left: 0, right: 200 };

  it('is zero away from the edges', () => {
    expect(sortableScrollStep(bounds, { x: 0, y: 200 })).toBe(0);
    expect(sortableScrollStep(bounds, { x: 0, y: 60 })).toBe(0);
    expect(sortableScrollStep(bounds, { x: 0, y: 340 })).toBe(0);
  });

  it('grows towards the edge and stops at the speed', () => {
    expect(sortableScrollStep(bounds, { x: 0, y: 24 })).toBeCloseTo(-6);
    expect(sortableScrollStep(bounds, { x: 0, y: 0 })).toBeCloseTo(-12);
    expect(sortableScrollStep(bounds, { x: 0, y: -100 })).toBeCloseTo(-12);
    expect(sortableScrollStep(bounds, { x: 0, y: 376 })).toBeCloseTo(6);
    expect(sortableScrollStep(bounds, { x: 0, y: 400 })).toBeCloseTo(12);
  });

  it('leaves a container shorter than two thresholds alone', () => {
    expect(sortableScrollStep({ top: 0, bottom: 80, left: 0, right: 200 }, { x: 0, y: 4 })).toBe(0);
  });

  it('reads the other axis when horizontal', () => {
    expect(sortableScrollStep(bounds, { x: 8, y: 200 }, { orientation: 'horizontal' })).toBeCloseTo(-10);
  });
});
