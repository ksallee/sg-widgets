import { describe, expect, it } from 'vitest';
import {
  ERROR_LABEL,
  errorText,
  LOADING_LABEL,
  NO_MATCH_LABEL,
  NO_ROWS_LABEL,
  stateLine,
} from '../src/state.js';

describe('stateLine', () => {
  it('shows the widget label for an empty state', () => {
    expect(stateLine('empty', { emptyLabel: NO_MATCH_LABEL })).toBe('No match');
  });

  it('falls back to the rows label when a widget names none', () => {
    expect(stateLine('empty', {})).toBe(NO_ROWS_LABEL);
  });

  it('names the loading state for a reader who cannot see skeletons', () => {
    expect(stateLine('loading', {})).toBe(LOADING_LABEL);
    expect(stateLine('loading', { loadingLabel: 'Reading Shots' })).toBe('Reading Shots');
  });

  it('shows what the read said when the caller names no error label', () => {
    expect(stateLine('error', {}, 'Flow PT API error 503')).toBe('Flow PT API error 503');
  });

  it("replaces the read's message with the caller's error label", () => {
    expect(stateLine('error', { errorLabel: 'Could not read Shots' }, 'API error 503')).toBe(
      'Could not read Shots',
    );
  });

  it('never leaves an error state blank', () => {
    expect(stateLine('error', {})).toBe(ERROR_LABEL);
    expect(stateLine('error', {}, '   ')).toBe(ERROR_LABEL);
    expect(stateLine('error', {}, null)).toBe(ERROR_LABEL);
  });

  it('trims what the read said', () => {
    expect(stateLine('error', {}, ' timeout ')).toBe('timeout');
  });
});

describe('errorText', () => {
  it("gives an Error's message", () => {
    expect(errorText(new Error('Flow PT API error 503'))).toBe('Flow PT API error 503');
  });

  it('renders anything else as itself', () => {
    expect(errorText('timeout')).toBe('timeout');
    expect(errorText(404)).toBe('404');
    expect(errorText(null)).toBe('null');
  });

  it('feeds a state line, so a rejection is never a blank block', () => {
    expect(stateLine('error', {}, errorText(new Error(' timeout ')))).toBe('timeout');
    expect(stateLine('error', {}, errorText(new Error('')))).toBe(ERROR_LABEL);
  });
});
