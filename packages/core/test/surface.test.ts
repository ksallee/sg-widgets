/** What the package's entry points hand out, which a publish then freezes. */
import { describe, expect, it } from 'vitest';
import manifest from '../package.json';
import * as core from '../src/index.js';
import * as mock from '../src/mock.js';
import { collectionView } from '../src/paging.js';
import { searchView } from '../src/search.js';
import type { WidgetState } from '../src/state.js';

describe('the root entry', () => {
  it('leaves the mock site on the mock entry', () => {
    expect(Object.keys(mock)).toContain('MockClient');
    for (const name of ['MockClient', 'MOCK_NOW']) expect(Object.keys(core)).not.toContain(name);
  });

  it('keeps the url spelling of an entity type to itself', () => {
    expect(Object.keys(core)).not.toContain('pluralPath');
  });

  it('formats a timecode through one function', () => {
    expect(Object.keys(core)).not.toContain('formatTimecodeFrames');
    expect(Object.keys(core)).toContain('formatTimecode');
  });

  it('names the search rule once', () => {
    for (const name of ['queryTokens', 'highlightRuns', 'matchesTokens']) expect(Object.keys(core)).not.toContain(name);
    for (const name of ['searchWords', 'matchRuns', 'matchesEveryWord']) expect(Object.keys(core)).toContain(name);
  });
});

describe('what a widget is showing', () => {
  it('is one union, whatever answered it', () => {
    const empty: WidgetState = searchView({ error: null, loading: false, count: 0, asked: true });
    const rows: WidgetState = collectionView(
      {
        rows: [{ type: 'Version', id: 1, attributes: {}, relationships: {} }],
        status: 'ready',
        error: null,
        hasMore: false,
        total: 1,
        filters: null,
        sort: [],
        mode: 'infinite',
        page: 1,
        pageSize: 50,
      },
      1,
    );
    expect([empty, rows]).toEqual(['empty', 'rows']);
  });
});

describe('what npm publishes', () => {
  it('carries the metadata an npm page shows', () => {
    expect(manifest.license).toBe('MIT');
    expect(manifest.homepage).toBe('https://sg-widgets.vercel.app');
    expect(manifest.repository).toEqual({
      type: 'git',
      url: 'git+https://github.com/ksallee/sg-widgets.git',
      directory: 'packages/core',
    });
    expect(manifest.bugs).toEqual({ url: 'https://github.com/ksallee/sg-widgets/issues' });
    expect(manifest.keywords).toContain('shotgrid');
    expect(manifest.engines).toEqual({ node: '>=22' });
  });

  it('ships the readme and the licence, and publishes under a public scope', () => {
    expect(manifest.files).toEqual(expect.arrayContaining(['dist', 'README.md', 'LICENSE']));
    expect(manifest.publishConfig).toEqual({ access: 'public' });
    expect(manifest.exports['./package.json']).toBe('./package.json');
  });
});
