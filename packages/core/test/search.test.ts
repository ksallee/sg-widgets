import { describe, expect, it } from 'vitest';
import {
  hasMorePage,
  matchRuns,
  matchesEveryWord,
  prependRecent,
  projectOfPath,
  queryPlan,
  requestGate,
  searchTypeMap,
  searchView,
  searchWords,
} from '../src/search.js';

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

describe('searchTypeMap', () => {
  it('gives a bare list of names no filter', () => {
    expect(searchTypeMap(['Shot', 'Asset'])).toEqual({ Shot: null, Asset: null });
  });

  it('passes a map through untouched', () => {
    const map = { Shot: [['project', 'is', { type: 'Project', id: 7 }]] as never };
    expect(searchTypeMap(map)).toBe(map);
  });
});

describe('prependRecent', () => {
  const keyOf = (ref: { type: string; id: number }): string => `${ref.type}:${ref.id}`;

  it('leads with the new entry and drops the one it repeats', () => {
    const shot = { type: 'Shot', id: 1 };
    const asset = { type: 'Asset', id: 2 };
    expect(prependRecent([asset, shot], shot, 5, keyOf)).toEqual([shot, asset]);
  });

  it('cuts the list to the limit', () => {
    const made = [1, 2, 3].map((id) => ({ type: 'Shot', id }));
    expect(prependRecent(made, { type: 'Shot', id: 9 }, 2, keyOf)).toEqual([
      { type: 'Shot', id: 9 },
      { type: 'Shot', id: 1 },
    ]);
  });

  it('leaves the list it was given alone', () => {
    const made = [{ type: 'Shot', id: 1 }];
    prependRecent(made, { type: 'Shot', id: 2 }, 5, keyOf);
    expect(made).toEqual([{ type: 'Shot', id: 1 }]);
  });
});

describe('hasMorePage', () => {
  it('reads a full page as a sign of another one', () => {
    expect(hasMorePage(25, 25)).toBe(true);
    expect(hasMorePage(24, 25)).toBe(false);
    expect(hasMorePage(0, 25)).toBe(false);
  });
});

describe('projectOfPath', () => {
  it('reads the project a root path names', () => {
    expect(projectOfPath('/Project/70')).toBe(70);
    expect(projectOfPath('/Project/70/Shot')).toBe(70);
  });

  it('answers nothing on the site root', () => {
    expect(projectOfPath('/')).toBeNull();
    expect(projectOfPath('/Shot/1')).toBeNull();
  });
});

describe('queryPlan', () => {
  it('debounces a query with words in it', () => {
    expect(queryPlan('sh010', false)).toBe('debounce');
    expect(queryPlan('sh010', true)).toBe('debounce');
  });

  it('empties the list on an empty query, unless the widget reads on one', () => {
    expect(queryPlan('   ', false)).toBe('clear');
    expect(queryPlan('   ', true)).toBe('now');
  });
});

describe('searchView', () => {
  const state = { error: null, loading: false, count: 0, asked: true };

  it('puts the error first', () => {
    expect(searchView({ ...state, error: 'boom', loading: true, count: 3 })).toBe('error');
  });

  it('stands the skeletons in for a first page only', () => {
    expect(searchView({ ...state, loading: true })).toBe('loading');
    expect(searchView({ ...state, loading: true, count: 3 })).toBe('rows');
  });

  it('holds the empty line back until something has been asked for', () => {
    expect(searchView(state)).toBe('empty');
    expect(searchView({ ...state, asked: false })).toBe('rows');
  });
});

describe('requestGate', () => {
  it('drops an answer whose ticket was replaced', () => {
    const gate = requestGate();
    const first = gate.next();
    const second = gate.next();
    expect(gate.holds(first)).toBe(false);
    expect(gate.holds(second)).toBe(true);
  });

  it('cancels what is in flight without starting anything', () => {
    const gate = requestGate();
    const ticket = gate.next();
    gate.cancel();
    expect(gate.holds(ticket)).toBe(false);
    expect(gate.holds(gate.next())).toBe(true);
  });
});
