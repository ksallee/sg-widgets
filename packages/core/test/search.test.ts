import { describe, expect, it } from 'vitest';
import { matchRuns, matchesEveryWord, searchWords } from '../src/search.js';

describe('searchWords', () => {
  it('splits on whitespace and drops the empties', () => {
    expect(searchWords('  pub   ke ')).toEqual(['pub', 'ke']);
    expect(searchWords('   ')).toEqual([]);
  });
});

describe('matchRuns', () => {
  it('marks every occurrence of every word, case-insensitively', () => {
    expect(matchRuns('Published Ada', 'pub ad')).toEqual([
      { text: 'Pub', match: true },
      { text: 'lished ', match: false },
      { text: 'Ad', match: true },
      { text: 'a', match: false },
    ]);
  });

  it('merges overlapping words into one run', () => {
    expect(matchRuns('abcdef', 'abc bcd')).toEqual([
      { text: 'abcd', match: true },
      { text: 'ef', match: false },
    ]);
  });

  it('rebuilds the label exactly, whatever the query', () => {
    const label = 'sh010_0010 comp';
    for (const query of ['', 'sh', 'sh 00 comp', 'zzz', '0']) {
      expect(
        matchRuns(label, query)
          .map((r) => r.text)
          .join(''),
      ).toBe(label);
    }
  });

  it('is one plain run when nothing matches or nothing is typed', () => {
    expect(matchRuns('Blue Moon', 'zzz')).toEqual([{ text: 'Blue Moon', match: false }]);
    expect(matchRuns('Blue Moon', '  ')).toEqual([{ text: 'Blue Moon', match: false }]);
    expect(matchRuns('', 'blue')).toEqual([]);
  });
});

describe('matchesEveryWord', () => {
  it('requires every word, in any order and any position', () => {
    expect(matchesEveryWord('Published Ada', 'pub ad')).toBe(true);
    expect(matchesEveryWord('Published Ada', 'ad pub')).toBe(true);
    expect(matchesEveryWord('Published Ada', 'pub zzz')).toBe(false);
    expect(matchesEveryWord('Published Ada', '')).toBe(true);
  });
});
