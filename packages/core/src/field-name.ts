/** The prefix the server puts in front of every custom field it creates. */
export const CUSTOM_FIELD_PREFIX = 'sg_';

/**
 * The programmatic name the server derives from a display name, or null for a blank one.
 *
 * The prefix, then the display name lowercased with each non-alphanumeric character
 * replaced by one underscore: no collapsing, no trimming, and a display name that already
 * starts with the prefix gets it twice (findings/019_create_fields). A display name that
 * is already taken comes back suffixed `_1`, `_2`, which this does not predict.
 *
 * Unmeasured, read literally: surrounding whitespace is kept, only ASCII letters and digits
 * count as alphanumeric (accented and non-Latin letters each become one underscore, per
 * code point), a leading digit stays, and a long name is not cut.
 */
export function predictFieldName(displayName: string): string | null {
  if (displayName.trim() === '') return null;
  const body = displayName.replace(/[A-Z]/g, (c) => c.toLowerCase()).replace(/[^a-z0-9]/gu, '_');
  return CUSTOM_FIELD_PREFIX + body;
}
