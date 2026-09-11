/**
 * The empty, loading and error states of `docs/design-rules.md` rule 5.
 *
 * Every data widget takes the same three labels and draws the same block. The
 * defaults are here so the two registries cannot drift and a studio that wants
 * its own wording sets one prop per widget. A translation seam belongs at this
 * boundary; until a non-English studio asks for one, these are the strings.
 */

/** The three states a data widget draws instead of its rows. */
export type WidgetState = 'empty' | 'loading' | 'error';

/** What a data widget calls its empty, loading and error states. */
export interface StateLabels {
  /** Shown when the read or the query returned nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
}

/** A query matched nothing. */
export const NO_MATCH_LABEL = 'No match';

/** A read returned nothing. */
export const NO_ROWS_LABEL = 'No rows';

/** A list of what the caller has picked holds nothing. */
export const NOTHING_CHOSEN_LABEL = 'Nothing chosen';

/** A read is in flight. */
export const LOADING_LABEL = 'Loading…';

/** A read failed and said nothing a reader can use. */
export const ERROR_LABEL = 'Something went wrong';

/**
 * The line a state block shows.
 *
 * An error falls back to what the read said and then to a fixed line, so a
 * failure is never a blank block; a caller's `errorLabel` replaces both.
 */
export function stateLine(
  state: WidgetState,
  labels: StateLabels,
  message?: string | null,
): string {
  if (state === 'loading') return labels.loadingLabel ?? LOADING_LABEL;
  if (state === 'error') return labels.errorLabel ?? (message?.trim() ? message.trim() : ERROR_LABEL);
  return labels.emptyLabel ?? NO_ROWS_LABEL;
}

/**
 * What a failed read said, as a line. An `Error` gives its message; anything else
 * a promise rejected with is rendered as itself, so a thrown string still reads.
 */
export function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
