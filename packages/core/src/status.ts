/**
 * Statuses.
 *
 * Usable statuses for a project are `valid_values` minus `hidden_values`, read with
 * `project_id`. REST does not enforce `hidden_values` on write, so the subtraction is
 * the client's job. A row may hold a code outside the usable set; that is a legal
 * stored value, not corruption (probe 009, field_types/status_list).
 */
import type { FieldSchema } from './schema.js';

export interface StatusOption {
  code: string;
  label: string;
}

/** Codes a picker should offer for the project the schema was read with. */
export function usableStatuses(field: Pick<FieldSchema, 'validValues' | 'hiddenValues' | 'displayValues'>): StatusOption[] {
  const hidden = new Set(field.hiddenValues ?? []);
  return (field.validValues ?? [])
    .filter((code) => !hidden.has(code))
    .map((code) => ({ code, label: statusLabel(field, code) }));
}

/** Codes usable in every one of several projects: the intersection of their usable sets, in the first schema's order. */
export function intersectStatuses(fields: Array<Pick<FieldSchema, 'validValues' | 'hiddenValues' | 'displayValues'>>): StatusOption[] {
  const [first, ...rest] = fields;
  if (!first) return [];
  const others = rest.map((f) => new Set(usableStatuses(f).map((s) => s.code)));
  return usableStatuses(first).filter((s) => others.every((set) => set.has(s.code)));
}

export function statusLabel(field: Pick<FieldSchema, 'displayValues'>, code: string): string {
  return field.displayValues?.[code] ?? code;
}

/**
 * Status entity as `GET /entity/statuses?fields=code,name,bg_color,icon` returns it,
 * flattened. `bg_color` is comma-separated decimal RGB (`"25,118,27"`), never hex.
 */
export interface StatusRecord {
  id: number;
  code: string;
  name: string;
  bgColor: string | null;
  icon: StatusIcon | null;
}

/** Icon entity. `displayType` picks one of three renderings (probe 010). */
export type StatusIcon =
  | { displayType: 'image_map'; imageMapKey: string }
  | { displayType: 'image'; dataUrl: string }
  | { displayType: 'html'; html: string };

export interface Rgb { r: number; g: number; b: number }

/** Parse `"25,118,27"` into channels. Returns null for anything else, including hex. */
export function parseBgColor(value: string | null | undefined): Rgb | null {
  if (!value) return null;
  const parts = value.split(',').map((p) => Number(p.trim()));
  if (parts.length !== 3 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return null;
  const [r, g, b] = parts as [number, number, number];
  return { r, g, b };
}

export function rgbToCss({ r, g, b }: Rgb): string {
  return `rgb(${r} ${g} ${b})`;
}

/** WCAG relative luminance, for choosing a readable foreground on a status badge. */
export function relativeLuminance({ r, g, b }: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Black or white, whichever contrasts more with the given colour. */
export function foregroundFor(rgb: Rgb): 'black' | 'white' {
  return relativeLuminance(rgb) > 0.4 ? 'black' : 'white';
}
