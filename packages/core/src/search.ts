/**
 * The search model both search widgets share.
 *
 * `POST /entity/_text_search` matches a row when *every* whitespace-separated
 * word of the query appears in it, so "pub ad" finds "Published Ada"
 * (053_text_search_matching). The same rule drives what a result row bolds.
 *
 * The endpoint answers a thin row - name, the linked row's type and name, and a
 * status code - and has no `fields` parameter, so anything a result row shows
 * beyond that is a second read (post_entity_text_search). `hydrate` is that read,
 * one `search` per type over the page just returned.
 */
import type { HierarchyPath, SgClient, TextSearchRow } from './client.js';
import type { EntityRef, WireCondition } from './filter.js';
import { displayNameOf } from './schema.js';

/** The words the API matches on: whitespace-separated, empties dropped. */
export function searchWords(text: string): string[] {
  return text.trim().split(/\s+/).filter(Boolean);
}

/** One stretch of a label, either inside a matched word or outside every one. */
export interface MatchRun {
  text: string;
  match: boolean;
}

interface Range {
  start: number;
  end: number;
}

/**
 * Split a label into alternating plain and matched runs, one run per stretch.
 * Matching is case-insensitive and every word is highlighted wherever it occurs,
 * because that is what the server matched on. Overlapping words merge into one
 * run, so a run never nests and the runs always rebuild the label exactly.
 */
export function matchRuns(label: string, query: string): MatchRun[] {
  if (label.length === 0) return [];
  const words = searchWords(query);
  if (words.length === 0) return [{ text: label, match: false }];

  const haystack = label.toLowerCase();
  const ranges: Range[] = [];
  for (const word of words) {
    const needle = word.toLowerCase();
    let from = haystack.indexOf(needle);
    while (from !== -1) {
      ranges.push({ start: from, end: from + needle.length });
      from = haystack.indexOf(needle, from + 1);
    }
  }
  if (ranges.length === 0) return [{ text: label, match: false }];

  ranges.sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Range[] = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range.start <= last.end) last.end = Math.max(last.end, range.end);
    else merged.push({ ...range });
  }

  const runs: MatchRun[] = [];
  let cursor = 0;
  for (const range of merged) {
    if (range.start > cursor) runs.push({ text: label.slice(cursor, range.start), match: false });
    runs.push({ text: label.slice(range.start, range.end), match: true });
    cursor = range.end;
  }
  if (cursor < label.length) runs.push({ text: label.slice(cursor), match: false });
  return runs;
}

/** True when every word of the query appears in the text, the server's own rule. */
export function matchesEveryWord(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  return searchWords(query).every((word) => haystack.includes(word.toLowerCase()));
}

/* -------------------------------------------------------------------------- */
/* result rows                                                                */
/* -------------------------------------------------------------------------- */

/** One search result, with what a row needs to draw itself. */
export interface SearchHit {
  /** The row, `name` filled from the search answer. */
  ref: EntityRef;
  /** Status code, never a label. */
  status: string | null;
  /** The row `_text_search` also matched the words against, when the row links to one. */
  link: { type: string; name: string } | null;
  /** `image`, when the type has one. Presigned and short-lived (field_types/image). */
  image: string | null;
  /** The row's project, `name` being its `cached_display_name`. Null on a site-wide type. */
  project: EntityRef | null;
  /**
   * Attributes and relationships of the second read, in one map, so a row anatomy
   * reads any field a caller asked for. A relationship is unwrapped to its `data`.
   */
  values: Record<string, unknown>;
}

/** A hit with only what `_text_search` itself answers. */
export function toSearchHit(row: TextSearchRow): SearchHit {
  const [linkType, linkName] = row.links;
  return {
    ref: { type: row.type, id: row.id, name: row.name },
    status: row.status,
    link: linkType && linkName ? { type: linkType, name: linkName } : null,
    image: null,
    project: null,
    values: {},
  };
}

/**
 * Fill in what `_text_search` does not answer: one `search` per type over the ids
 * just returned. An unknown field name is dropped at 200, so asking every type for
 * `image`, `project` and whatever a row anatomy names is safe even where the type
 * carries none of it (probe 003).
 */
export async function hydrate(
  client: SgClient,
  rows: TextSearchRow[],
  options: {
    /** Fields on top of the identity ones, for a caller's own sub-label or secondary. */
    fields?: readonly string[] | undefined;
    /** Field holding the label. The display-name chain answers it when absent. */
    labelField?: string | undefined;
  } = {},
): Promise<SearchHit[]> {
  const hits = rows.map(toSearchHit);
  if (hits.length === 0) return hits;
  const byType = new Map<string, number[]>();
  for (const hit of hits) {
    const ids = byType.get(hit.ref.type);
    if (ids) ids.push(hit.ref.id);
    else byType.set(hit.ref.type, [hit.ref.id]);
  }
  const fields = [...new Set(['id', 'image', 'project', ...DISPLAY_FIELDS, ...(options.fields ?? [])])];
  const reads = await Promise.all(
    [...byType].map(async ([type, ids]) => {
      const filters = { logical_operator: 'and' as const, conditions: [['id', 'in', ids] as WireCondition] };
      const result = await client.search(type, {
        fields,
        filters,
        page: { size: ids.length },
      });
      return [type, result.data] as const;
    }),
  );
  const rowsById = new Map<string, { attributes: Record<string, unknown>; relationships: Record<string, { data: unknown }> }>();
  for (const [type, data] of reads) for (const row of data) rowsById.set(`${type}:${row.id}`, row);

  for (const hit of hits) {
    const row = rowsById.get(`${hit.ref.type}:${hit.ref.id}`);
    if (!row) continue;
    const values: Record<string, unknown> = { ...row.attributes };
    for (const [name, link] of Object.entries(row.relationships)) values[name] = link?.data ?? null;
    hit.values = values;
    const image = row.attributes['image'];
    hit.image = typeof image === 'string' ? image : null;
    const project = row.relationships['project']?.data as EntityRef | null | undefined;
    hit.project = project ?? null;
    const labelled = options.labelField === undefined ? undefined : values[options.labelField];
    const name = typeof labelled === 'string' && labelled.length > 0 ? labelled : displayNameOf(row.attributes);
    if (name) hit.ref = { ...hit.ref, name };
  }
  return hits;
}

/** The identity fields a type may be named by. Unknown ones are dropped at 200 (probe 003). */
const DISPLAY_FIELDS = ['cached_display_name', 'code', 'name', 'content'];

/* -------------------------------------------------------------------------- */
/* scoping                                                                    */
/* -------------------------------------------------------------------------- */

/** Enough of `SchemaService` to answer whether a type carries a field. */
export interface FieldLookup {
  field(entityType: string, name: string): Promise<{ name: string } | undefined>;
}

/**
 * Add a project condition to every searched type that has a `project` field.
 * A type without one 400s on the path rather than returning nothing: Project has
 * no `project` field at all (entity_types/Project) and neither does Step
 * (entity_types/Step), so the schema decides which types can be scoped.
 */
export async function scopeToProject(
  schema: FieldLookup,
  entityTypes: Record<string, WireCondition[] | null | undefined>,
  projectId: number,
): Promise<Record<string, WireCondition[]>> {
  const scoped = await Promise.all(
    Object.entries(entityTypes).map(async ([type, filter]) => {
      const conditions = [...(filter ?? [])];
      const project = await schema.field(type, 'project');
      if (project) conditions.push(['project', 'is', { type: 'Project', id: projectId }]);
      return [type, conditions] as const;
    }),
  );
  return Object.fromEntries(scoped);
}

/**
 * The pause a search widget leaves before it asks. Long enough that a typist does
 * not fire a request a letter, short enough to feel live.
 */
export const SEARCH_DEBOUNCE_MS = 250;

/** The page `_text_search` answers at its cap, which is also its default (probe 053). */
export const SEARCH_PAGE_SIZE = 25;

/**
 * The rows a hierarchy search asks for. Each hit costs one path lookup on top of the
 * search itself, so it asks for fewer than the endpoint allows.
 */
export const HIERARCHY_LEAF_LIMIT = 10;

/**
 * True when a further page may be there. A read carries no total and `links.next` is
 * emitted forever, so a full page is the only sign of another one (006_pagination).
 */
export function hasMorePage(count: number, size: number): boolean {
  return size > 0 && count >= size;
}

/** The project a tree root path names, or null on the site root. */
export function projectOfPath(path: string): number | null {
  const match = /^\/Project\/(\d+)/.exec(path);
  return match ? Number(match[1]) : null;
}

/**
 * What a search does with the query it now holds: empty the list, ask at once, or
 * ask once the pause has elapsed.
 *
 * A widget that browses rather than matching reads on an empty query too, which is
 * what `readsEmpty` says; nothing is debounced there, because no one is typing.
 */
export type QueryPlan = 'clear' | 'now' | 'debounce';

export function queryPlan(query: string, readsEmpty: boolean): QueryPlan {
  if (query.trim().length > 0) return 'debounce';
  return readsEmpty ? 'now' : 'clear';
}

/** Which of the four things a search list shows in place of its rows. */
export type SearchView = 'error' | 'loading' | 'empty' | 'rows';

export interface SearchViewState {
  /** What the failed read said, or null. */
  error: string | null;
  loading: boolean;
  /** Rows on show. */
  count: number;
  /** An empty list is the empty line only once something has been asked for. */
  asked: boolean;
}

/**
 * What a search list draws. The skeletons stand for a first page only: a page on the
 * way under rows already on screen leaves those rows where they are.
 */
export function searchView(state: SearchViewState): SearchView {
  if (state.error !== null && state.error !== '') return 'error';
  if (state.loading && state.count === 0) return 'loading';
  if (state.count === 0 && state.asked) return 'empty';
  return 'rows';
}

/**
 * The ticket an answer has to still hold to be written.
 *
 * A search cancels by taking the next ticket: whatever is in flight then holds a
 * stale one and is dropped rather than landing over the query that replaced it.
 */
export interface RequestGate {
  /** Take the next ticket. Every earlier one is stale from here on. */
  next: () => number;
  /** Drop whatever is in flight without starting anything. */
  cancel: () => void;
  /** True while `ticket` is the one that may write. */
  holds: (ticket: number) => boolean;
}

export function requestGate(): RequestGate {
  let current = 0;
  return {
    next: () => (current += 1),
    cancel: () => {
      current += 1;
    },
    holds: (ticket: number) => ticket === current,
  };
}

/** The types to search, as the map `_text_search` takes: bare names carry no filter. */
export function searchTypeMap(
  types: string[] | Record<string, WireCondition[] | null>,
): Record<string, WireCondition[] | null> {
  return Array.isArray(types) ? Object.fromEntries(types.map((type) => [type, null])) : types;
}

/**
 * A list of what was picked before, newest first: the new entry leads, the one it
 * repeats is dropped, and the list is cut to `limit`.
 */
export function prependRecent<T>(recents: readonly T[], picked: T, limit: number, keyOf: (item: T) => string): T[] {
  const key = keyOf(picked);
  return [picked, ...recents.filter((item) => keyOf(item) !== key)].slice(0, limit);
}

/* -------------------------------------------------------------------------- */
/* hierarchy paths                                                            */
/* -------------------------------------------------------------------------- */

/**
 * The rows a tree path runs through, root first.
 *
 * A path is read left to right. A capitalised segment names the type the level
 * below is drawn from; `<Type>/<id>` and `<field>/<Type>/<id>` are a row of that
 * type, and a bare `id/<n>` is a row of the type the last folder named. The path
 * runs through field names such as `sg_sequence`, because the tree follows the
 * site's own navigation configuration rather than a fixed hierarchy
 * (post_hierarchy_search).
 */
export function pathRefs(path: string | string[]): EntityRef[] {
  const deepest = Array.isArray(path) ? (path[path.length - 1] ?? '') : path;
  const segments = deepest.split('/').filter(Boolean);
  const refs: EntityRef[] = [];
  let folder: string | null = null;
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i] as string;
    const next = segments[i + 1];
    if (segment === 'id' && next !== undefined && folder) {
      refs.push({ type: folder, id: Number(next) });
      i += 1;
      continue;
    }
    if (!/^[A-Z][A-Za-z0-9]*$/.test(segment)) continue;
    if (next !== undefined && /^\d+$/.test(next)) {
      // A grouping such as `sg_sequence/Sequence/23` is a row on the way, and it
      // does not change the type the leaves below it are drawn from.
      refs.push({ type: segment, id: Number(next) });
      i += 1;
      continue;
    }
    folder = segment;
  }
  return refs;
}

/** The breadcrumb a hierarchy row shows: the path rendered for a person, then the row. */
export function breadcrumb(path: HierarchyPath): string[] {
  const above = path.pathLabel ? path.pathLabel.split(' > ').filter(Boolean) : [];
  return [...above, path.label];
}
