/**
 * How a reference and a field path are presented.
 *
 * Two pure functions widgets share: where a row lives in the web app, and the
 * label a dotted path carries above a value.
 */
import type { EntityRef } from './filter.js';
import type { PathSegment } from './schema-service.js';

/** Trailing slashes off, so a site url composes with an absolute path. */
export function normalizeSiteUrl(siteUrl: string | null | undefined): string {
  if (siteUrl === null || siteUrl === undefined) return '';
  return String(siteUrl).trim().replace(/\/+$/, '');
}

/**
 * The web app's page for one row.
 *
 * `Project.landing_page_url` is the only detail address the API hands out, and it
 * is the site-relative path `/detail/Project/<id>` with the site url left to the
 * caller (entity_types/Project). Every other type takes the same shape by a
 * convention the API does not document: on the test site `/detail/<Type>/<id>`
 * answers 302 to `/user/login` carrying itself as `return_path`, so the route
 * resolves before authentication decides.
 *
 * Answers null when there is no site to link into or no row to link to.
 */
export function entityDetailUrl(siteUrl: string | null | undefined, ref: EntityRef | null | undefined): string | null {
  const site = normalizeSiteUrl(siteUrl);
  if (site.length === 0 || !ref || !ref.type || !Number.isFinite(ref.id)) return null;
  return `${site}/detail/${ref.type}/${ref.id}`;
}

/** The character between the hops of a path label. */
export const PATH_SEPARATOR = ' › ';

export interface PathLabelOptions {
  /**
   * Name the type a hop travels through when the hop's field links several types.
   * Default true.
   */
  typeWhenAmbiguous?: boolean;
  /** Display names by schema type name, from `entityTypes()`. */
  typeLabels?: Record<string, string>;
  separator?: string;
}

/**
 * The label of a resolved path.
 *
 * A hop names its field, and the type only when the field's `valid_types` holds
 * more than one: `sg_task.Task.sg_status_list` reads `Task › Status`, while
 * `note_links.Shot.sg_sequence` reads `Link › Shot › Sequence` because the same
 * field could have gone to an Asset. A projection resolves a dotted path against
 * that `valid_types` list (probe 059), so the ambiguity the label spells out is
 * the one the read itself has to settle.
 */
export function pathLabel(segments: readonly PathSegment[], options: PathLabelOptions = {}): string {
  const withType = options.typeWhenAmbiguous ?? true;
  const parts: string[] = [];
  for (const segment of segments) {
    parts.push(segment.displayName);
    if (segment.through === undefined) continue;
    if (withType && (segment.field.validTypes?.length ?? 0) > 1) {
      parts.push(options.typeLabels?.[segment.through] ?? segment.through);
    }
  }
  return parts.join(options.separator ?? PATH_SEPARATOR);
}
