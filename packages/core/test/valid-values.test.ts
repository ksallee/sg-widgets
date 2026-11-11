import { describe, expect, it } from 'vitest';
import {
  addListValues,
  moveListValue,
  normalizeListValues,
  replaceListValue,
  splitListValues,
  statusTableOptions,
  syncListRows,
  type ListRow,
} from '../src/valid-values.js';

describe('normalizeListValues', () => {
  it('trims every value and drops the blank ones', () => {
    expect(normalizeListValues(['  Type A ', '', '   ', 'Type B\t'])).toEqual(['Type A', 'Type B']);
  });

  it('keeps the order it was given', () => {
    expect(normalizeListValues(['c', 'a', 'b'])).toEqual(['c', 'a', 'b']);
  });

  it('keeps a repeated value unless told otherwise', () => {
    expect(normalizeListValues(['a', 'b', 'a'])).toEqual(['a', 'b', 'a']);
  });

  it('keeps the first of a repeated value when unique', () => {
    expect(normalizeListValues(['a', 'b', ' a ', 'c', 'b'], { unique: true })).toEqual(['a', 'b', 'c']);
  });

  it('tells apart two values that differ by case', () => {
    expect(normalizeListValues(['Type A', 'type a'], { unique: true })).toEqual(['Type A', 'type a']);
  });

  it('keeps the space inside a value', () => {
    expect(normalizeListValues(['Full  CG'])).toEqual(['Full  CG']);
  });

  it('answers a new array', () => {
    const given = ['a'];
    expect(normalizeListValues(given)).not.toBe(given);
  });
});

describe('splitListValues', () => {
  it('reads one value per line', () => {
    expect(splitListValues('VFX\n2D\nFull CG')).toEqual(['VFX', '2D', 'Full CG']);
  });

  it('reads every line ending', () => {
    expect(splitListValues('a\r\nb\rc\nd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('trims the lines and drops the blank ones', () => {
    expect(splitListValues('\n  a  \n\n \t \nb\n')).toEqual(['a', 'b']);
  });

  it('reads one line as one value, commas and all', () => {
    expect(splitListValues('Look Dev, final')).toEqual(['Look Dev, final']);
  });

  it('reads nothing in an empty text', () => {
    expect(splitListValues('')).toEqual([]);
    expect(splitListValues(' \n ')).toEqual([]);
  });

  it('drops a repeated line when unique', () => {
    expect(splitListValues('a\nb\na', { unique: true })).toEqual(['a', 'b']);
  });
});

describe('replaceListValue', () => {
  it('rewrites the value at an index, trimmed', () => {
    expect(replaceListValue(['a', 'b', 'c'], 1, '  B ')).toEqual(['a', 'B', 'c']);
  });

  it('removes the value when the text is blank', () => {
    expect(replaceListValue(['a', 'b', 'c'], 1, '   ')).toEqual(['a', 'c']);
  });

  it('puts every line of a pasted text in the place of the one value', () => {
    expect(replaceListValue(['a', 'b', 'c'], 1, 'x\ny\n\nz')).toEqual(['a', 'x', 'y', 'z', 'c']);
  });

  it('appends at the index past the end', () => {
    expect(replaceListValue(['a'], 1, 'b\nc')).toEqual(['a', 'b', 'c']);
  });

  it('leaves the list alone for an index outside it', () => {
    expect(replaceListValue(['a'], 5, 'b')).toEqual(['a']);
    expect(replaceListValue(['a'], -1, 'b')).toEqual(['a']);
  });

  it('keeps the earlier of two equal values when unique', () => {
    expect(replaceListValue(['a', 'b', 'c'], 2, 'a', { unique: true })).toEqual(['a', 'b']);
    expect(replaceListValue(['a', 'b', 'c'], 0, 'c', { unique: true })).toEqual(['c', 'b']);
  });

  it('does not change the list it was given', () => {
    const given = ['a', 'b'];
    replaceListValue(given, 0, 'x');
    expect(given).toEqual(['a', 'b']);
  });
});

describe('addListValues', () => {
  it('appends one value', () => {
    expect(addListValues(['a'], ' b ')).toEqual(['a', 'b']);
  });

  it('appends every line of a pasted text, in order', () => {
    expect(addListValues(['a'], 'b\r\nc\n\nd')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('adds nothing for a blank text', () => {
    expect(addListValues(['a'], '  ')).toEqual(['a']);
  });

  it('adds only what the list does not hold when unique', () => {
    expect(addListValues(['a', 'b'], 'b\nc\nc', { unique: true })).toEqual(['a', 'b', 'c']);
  });
});

describe('moveListValue', () => {
  it('moves a value to another place', () => {
    expect(moveListValue(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a']);
    expect(moveListValue(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
  });

  it('leaves the list alone for a place outside it', () => {
    expect(moveListValue(['a', 'b'], 0, 2)).toEqual(['a', 'b']);
    expect(moveListValue(['a', 'b'], -1, 0)).toEqual(['a', 'b']);
    expect(moveListValue(['a', 'b'], 1, 1)).toEqual(['a', 'b']);
  });
});

describe('syncListRows', () => {
  const rows = (...pairs: Array<[string, string]>): ListRow[] => pairs.map(([key, value]) => ({ key, value }));
  const keys = (list: readonly ListRow[]): string[] => list.map((row) => row.key);

  it('gives every value a key of its own', () => {
    const made = syncListRows([], ['a', 'b', 'a']);
    expect(made.map((row) => row.value)).toEqual(['a', 'b', 'a']);
    expect(new Set(keys(made)).size).toBe(3);
  });

  it('answers the rows it was given when nothing changed', () => {
    const held = syncListRows([], ['a', 'b']);
    expect(syncListRows(held, ['a', 'b'])).toBe(held);
  });

  it('keeps a row\'s key through an edit in place', () => {
    const held = rows(['k1', 'a'], ['k2', 'b'], ['k3', 'c']);
    expect(syncListRows(held, ['a', 'B', 'c'])).toEqual(rows(['k1', 'a'], ['k2', 'B'], ['k3', 'c']));
  });

  it('keeps every key through a move', () => {
    const held = rows(['k1', 'a'], ['k2', 'b'], ['k3', 'c']);
    expect(syncListRows(held, ['b', 'c', 'a'])).toEqual(rows(['k2', 'b'], ['k3', 'c'], ['k1', 'a']));
  });

  it('keeps the keys of the rows left after a removal', () => {
    const held = rows(['k1', 'a'], ['k2', 'b'], ['k3', 'c']);
    expect(syncListRows(held, ['a', 'c'])).toEqual(rows(['k1', 'a'], ['k3', 'c']));
  });

  it('mints a key no row holds for a value that is new', () => {
    const held = rows(['k1', 'a'], ['k2', 'b']);
    const next = syncListRows(held, ['a', 'b', 'c']);
    expect(keys(next).slice(0, 2)).toEqual(['k1', 'k2']);
    expect(['k1', 'k2']).not.toContain(next[2]?.key);
  });

  it('never hands out a key twice, repeated values included', () => {
    const held = syncListRows([], ['a', 'a', 'b']);
    const next = syncListRows(held, ['b', 'a', 'x', 'a', 'y']);
    expect(new Set(keys(next)).size).toBe(5);
    expect(next.map((row) => row.value)).toEqual(['b', 'a', 'x', 'a', 'y']);
  });

  it('keeps the edited row\'s key when the edit makes it equal to another row', () => {
    const held = rows(['k1', 'a'], ['k2', 'b']);
    expect(syncListRows(held, ['a', 'a'])).toEqual(rows(['k1', 'a'], ['k2', 'a']));
  });
});

describe('statusTableOptions', () => {
  it('offers every status of the site, by code and name', () => {
    expect(
      statusTableOptions([
        { id: 1, code: 'ip', name: 'In Progress', bgColor: null, icon: null },
        { id: 2, code: 'fin', name: 'Final', bgColor: '25,118,27', icon: null },
      ]),
    ).toEqual([
      { code: 'ip', label: 'In Progress' },
      { code: 'fin', label: 'Final' },
    ]);
  });

  it('labels a status with no name by its code', () => {
    expect(statusTableOptions([{ id: 1, code: 'zz', name: '', bgColor: null, icon: null }])).toEqual([
      { code: 'zz', label: 'zz' },
    ]);
  });

  it('offers a code once and never an empty one', () => {
    expect(
      statusTableOptions([
        { id: 1, code: 'ip', name: 'In Progress', bgColor: null, icon: null },
        { id: 2, code: 'ip', name: 'Again', bgColor: null, icon: null },
        { id: 3, code: '', name: 'Blank', bgColor: null, icon: null },
      ]),
    ).toEqual([{ code: 'ip', label: 'In Progress' }]);
  });
});
