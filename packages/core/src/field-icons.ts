/**
 * A glyph per field data type.
 *
 * The name is a lucide icon name in kebab case, so both UI packages resolve the
 * same glyph from their own icon package. Types with no obvious glyph share a
 * document, which is also the answer for a data type this build does not know.
 */
import type { DataType } from './field-types.js';

const ICONS: Readonly<Record<DataType, string>> = {
  text: 'type',
  number: 'hash',
  float: 'hash',
  percent: 'percent',
  currency: 'circle-dollar-sign',
  duration: 'timer',
  timecode: 'timer',
  footage: 'ruler',
  checkbox: 'square-check',
  date: 'calendar',
  date_time: 'calendar-clock',
  list: 'list',
  status_list: 'circle-dot',
  entity: 'link',
  multi_entity: 'link-2',
  tag_list: 'tag',
  entity_type: 'shapes',
  image: 'image',
  url: 'globe',
  color: 'palette',
  uuid: 'fingerprint',
  jsonb: 'braces',
  calculated: 'sigma',
  summary: 'sigma',
  serializable: 'file-text',
  password: 'key-round',
  pivot_column: 'file-text',
};

/** The catch-all glyph, used for a data type this build does not know. */
export const DEFAULT_FIELD_ICON = 'file-text';

/** The lucide icon name for a field's data type. */
export function iconNameFor(dataType: string): string {
  return ICONS[dataType as DataType] ?? DEFAULT_FIELD_ICON;
}

/** Every icon name this module can return, for a UI package's name-to-component map. */
export const FIELD_ICON_NAMES: readonly string[] = [
  ...new Set([...Object.values(ICONS), DEFAULT_FIELD_ICON]),
].sort();
