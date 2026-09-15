/**
 * Option derivation for the schema pickers.
 *
 * Everything the entity-type picker, the field picker and the column picker need
 * to turn a schema read into a list of rows: which types a caller allows, which
 * fields may be selected, which may be descended into, and what a dotted path is
 * called. The widgets hold state and draw; they decide nothing here.
 */
import type { EntityTypeInfo } from './client.js';
import { isFilterable } from './field-types.js';
import type { FieldSchema } from './schema.js';
import type { PathSegment } from './schema-service.js';

/* -------------------------------------------------------------------------- */
/* search                                                                     */
/* -------------------------------------------------------------------------- */

/** Every whitespace-separated token of the query must appear in one of the haystacks. */
export function matchesTokens(query: string, ...haystacks: (string | undefined)[]): boolean {
  const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const text = haystacks.filter(Boolean).join(' ').toLowerCase();
  return tokens.every((token) => text.includes(token));
}

/* -------------------------------------------------------------------------- */
/* entity types                                                               */
/* -------------------------------------------------------------------------- */

export interface EntityTypeRestrictions {
  /** Codes a caller offers. Empty or absent means every type. */
  allow?: string[];
  /** Codes a caller withholds, applied after `allow`. */
  deny?: string[];
}

/**
 * The types a picker may offer, allow first and deny second.
 *
 * Applied to the derived list rather than to the read, so a caller narrowing the
 * set sees the list change with no second call. `/schema` is 12KB and holds every
 * enabled type, custom slots included (probe 002).
 */
export function filterEntityTypes(types: readonly EntityTypeInfo[], restrictions: EntityTypeRestrictions = {}): EntityTypeInfo[] {
  const allow = restrictions.allow?.length ? new Set(restrictions.allow) : undefined;
  const deny = restrictions.deny?.length ? new Set(restrictions.deny) : undefined;
  return types.filter((t) => (!allow || allow.has(t.name)) && !deny?.has(t.name));
}

/** What an entity-type picker draws: the rows on offer and the label a code takes. */
export interface EntityTypeOptions {
  /** Types on offer, `allow` first and `deny` second. */
  types: EntityTypeInfo[];
  /** Those the query matches, on display name or code. */
  shown: EntityTypeInfo[];
  /** A code's display name, or the code itself where the site offers no such type. */
  labelOf: (code: string) => string;
}

/**
 * The options both entity-type pickers derive from one schema read.
 *
 * The vocabulary is one read of 12KB (probe 002), so the query narrows the derived
 * list in the browser rather than asking for it again. `loaded` is `null` while the
 * read is in flight, which offers nothing and labels a code as itself.
 */
export function entityTypeOptions(
  loaded: readonly EntityTypeInfo[] | null,
  options: EntityTypeRestrictions & { query?: string } = {},
): EntityTypeOptions {
  const types = loaded ? filterEntityTypes(loaded, options) : [];
  const byName = new Map(types.map((t) => [t.name, t]));
  return {
    types,
    shown: types.filter((t) => matchesTokens(options.query ?? '', t.displayName, t.name)),
    labelOf: (code: string) => byName.get(code)?.displayName ?? code,
  };
}

/* -------------------------------------------------------------------------- */
/* dotted field paths                                                         */
/* -------------------------------------------------------------------------- */

/** One traversal step: the link field followed, and the type it landed on. */
export interface FieldHop {
  /** Field code on the type the hop leaves. */
  name: string;
  displayName: string;
  /** Type the hop lands on. */
  through: string;
}

/** `entity.Shot.code`: every hop names the type it travels through (field_types/entity). */
export function fieldPathOf(hops: readonly FieldHop[], name: string): string {
  return [...hops.flatMap((hop) => [hop.name, hop.through]), name].join('.');
}

/** The type each hop landed on, root first. A type already here is not descended into again. */
export function pathTypes(rootType: string, hops: readonly FieldHop[]): string[] {
  return [rootType, ...hops.map((hop) => hop.through)];
}

/** The type a picker is reading fields from after these hops. */
export function currentType(rootType: string, hops: readonly FieldHop[]): string {
  return hops.length > 0 ? (hops[hops.length - 1] as FieldHop).through : rootType;
}

/** A resolved path as a person reads it. */
export function friendlyFieldPath(segments: readonly PathSegment[], separator = ' › '): string {
  return segments.map((segment) => segment.displayName).join(separator);
}

/* -------------------------------------------------------------------------- */
/* field options                                                              */
/* -------------------------------------------------------------------------- */

/** A column a data source computes, offered alongside the real fields. */
export interface ExtraField {
  /** The value emitted when it is chosen. */
  name: string;
  displayName?: string;
}

export interface FieldPickerRestrictions {
  /** Allow descending through entity fields. Off by default. */
  deepLinks?: boolean;
  /** How many hops a path may take. Default 2. */
  maxDepth?: number;
  /** Data types a field must have to be selected. Traversal ignores this. */
  dataTypes?: string | string[];
  /** A field is selectable only if it declares link targets and one of them is here. Traversal ignores this. */
  validTypes?: string[];
  /** Full dotted paths to drop, so a root field and the same name behind a hop are separate. */
  exclude?: string[];
  /** Dotted prefixes to drop, along with everything beneath them. */
  hidePaths?: string[];
  /** Drop types the API refuses in a filter (017_filter_operators). */
  filterableOnly?: boolean;
  /** Synthetic entries offered at the root only. They bypass `dataTypes` and `validTypes`. */
  extraFields?: ExtraField[];
  /** Caller's own visibility test, receiving the schema and the candidate's full path. */
  filter?: (field: FieldSchema, path: string) => boolean;
}

export interface FieldOption {
  /** Full dotted path from the root type. This is the emitted value. */
  path: string;
  /** Field code on the type it lives on. */
  name: string;
  displayName: string;
  dataType: string;
  /** The row may be chosen as the value. */
  selectable: boolean;
  /** The row descends. */
  traversable: boolean;
  /** Types a traversable row may descend into, minus the ones already on the path. */
  targets: string[];
  /** A synthetic entry rather than a schema field. */
  computed: boolean;
}

export interface FieldOptionsInput extends FieldPickerRestrictions {
  rootType: string;
  /** Hops already taken. Empty at the root. */
  hops?: readonly FieldHop[];
}

const DEFAULT_MAX_DEPTH = 2;

function asSet(value: string | string[] | undefined): Set<string> | undefined {
  if (value === undefined) return undefined;
  const list = typeof value === 'string' ? [value] : value;
  return list.length > 0 ? new Set(list) : undefined;
}

/**
 * The types a field may be descended into from here.
 *
 * Only a single `entity` field: a dotted path through a `multi_entity` field reads
 * back nothing, 200 with the key absent from `attributes` (probe 016). A type
 * already on the path is dropped, so `project.Project.users.HumanUser.projects`
 * cannot loop.
 */
export function traversalTargets(
  field: Pick<FieldSchema, 'dataType' | 'validTypes'>,
  input: { rootType: string; hops?: readonly FieldHop[]; deepLinks?: boolean; maxDepth?: number },
): string[] {
  if (!input.deepLinks) return [];
  if (field.dataType !== 'entity') return [];
  const hops = input.hops ?? [];
  if (hops.length >= (input.maxDepth ?? DEFAULT_MAX_DEPTH)) return [];
  const visited = new Set(pathTypes(input.rootType, hops));
  return (field.validTypes ?? []).filter((type) => !visited.has(type));
}

/**
 * The rows a field picker shows for one type at one depth.
 *
 * `dataTypes` and `validTypes` bind what may be *selected*; a link field stays on
 * the list so a restricted picker can still reach a nested field of the wanted
 * type. Every other restriction hides the row outright and is measured against
 * the full dotted path, so excluding a root field leaves the same name behind a
 * hop alone. Computed entries come first, then the schema fields by display name.
 */
export function deriveFieldOptions(fields: Record<string, FieldSchema>, input: FieldOptionsInput): FieldOption[] {
  const hops = input.hops ?? [];
  const atRoot = hops.length === 0;
  const wantedTypes = asSet(input.dataTypes);
  const wantedTargets = asSet(input.validTypes);
  const excluded = new Set(input.exclude ?? []);
  const hidden = input.hidePaths ?? [];

  const options: FieldOption[] = [];

  if (atRoot) {
    for (const extra of input.extraFields ?? []) {
      options.push({
        path: extra.name,
        name: extra.name,
        displayName: extra.displayName ?? extra.name,
        dataType: '',
        selectable: true,
        traversable: false,
        targets: [],
        computed: true,
      });
    }
  }

  const real: FieldOption[] = [];
  for (const [name, field] of Object.entries(fields)) {
    const path = fieldPathOf(hops, name);
    if (excluded.has(path)) continue;
    if (hidden.some((prefix) => path === prefix || path.startsWith(`${prefix}.`))) continue;
    if (input.filterableOnly && !isFilterable(field.dataType)) continue;
    if (input.filter && !input.filter(field, path)) continue;

    const targets = traversalTargets(field, input);
    const selectable =
      (!wantedTypes || wantedTypes.has(field.dataType)) &&
      (!wantedTargets || (field.validTypes ?? []).some((type) => wantedTargets.has(type)));
    if (!selectable && targets.length === 0) continue;

    real.push({
      path,
      name,
      displayName: field.displayName,
      dataType: field.dataType,
      selectable,
      traversable: targets.length > 0,
      targets,
      computed: false,
    });
  }
  real.sort((a, b) => a.displayName.localeCompare(b.displayName) || a.name.localeCompare(b.name));

  return [...options, ...real];
}

/** Rows matching the search box. */
export function searchFieldOptions(options: readonly FieldOption[], query: string): FieldOption[] {
  if (!query.trim()) return [...options];
  return options.filter((option) => matchesTokens(query, option.displayName, option.name, option.dataType));
}

/* -------------------------------------------------------------------------- */
/* chosen columns                                                             */
/* -------------------------------------------------------------------------- */

/** The list with `path` appended, or dropped when it is already there. */
export function toggleFieldPath(paths: readonly string[], path: string): string[] {
  return paths.includes(path) ? paths.filter((entry) => entry !== path) : [...paths, path];
}

/** The list with the entry at `from` moved to `to`. An index off either end leaves the order alone. */
export function moveFieldPath(paths: readonly string[], from: number, to: number): string[] {
  const next = [...paths];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved as string);
  return next;
}
