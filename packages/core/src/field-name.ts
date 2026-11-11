/** The prefix the server puts in front of every custom field it creates. */
export const CUSTOM_FIELD_PREFIX = 'sg_';

/**
 * Whether a display name holds a character outside ASCII. The server discards such a name
 * whole when it derives the programmatic name (findings/117_field_types_and_names).
 */
export function hasNonAscii(displayName: string): boolean {
  return /[^\u0000-\u007F]/u.test(displayName);
}

/**
 * The programmatic name the server derives from a display name, or null when it cannot be
 * predicted: a blank display name, or a non-ASCII one without its data type.
 *
 * An ASCII display name gives the prefix, then the name lowercased with each character
 * outside `[a-z0-9_]` replaced by one underscore. Nothing is trimmed, collapsed or cut, a
 * leading digit stays, and a prefix already there is doubled (findings/019_create_fields,
 * findings/117_field_types_and_names).
 *
 * One non-ASCII character anywhere and the server ignores the display name: the field is
 * `sg_<data_type>`. That is measured on a `currency` field and inferred for the other types.
 * A name already taken comes back suffixed `_1`, `_2`, and a name a retired field holds is
 * refused; neither is predicted here.
 */
export function predictFieldName(displayName: string, dataType?: string): string | null {
  if (displayName.trim() === '') return null;
  if (hasNonAscii(displayName)) return dataType ? CUSTOM_FIELD_PREFIX + dataType : null;
  return CUSTOM_FIELD_PREFIX + displayName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
}
