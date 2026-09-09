/**
 * Tree model.
 *
 * The headless half of the tree widgets: nodes keyed by their path, one level
 * read at a time behind a loader, expand and collapse with a loading flag per
 * node, tri-state checkboxes that propagate both ways, single or multiple
 * selection, a focus cursor carrying the whole keyboard model, and a search that
 * opens the tree onto its hits. There is no framework in it: a Svelte widget wraps it
 * in `$state`, a React one in `useSyncExternalStore`, and neither reimplements
 * propagation, the cursor or type-ahead.
 *
 * `POST /hierarchy/_expand` answers one level: the node itself, and children
 * carrying a label, a ref and `has_children`, so walking a project is one call per
 * node (post_hierarchy_expand). Which levels a project has is the site's own
 * navigation configuration and not a fixed hierarchy - the probed site's Shot path
 * runs through the field name `sg_sequence` (post_hierarchy_search) - so a seed
 * path is followed by taking whichever child is a prefix of it rather than by
 * parsing the path.
 *
 * Searching is two endpoints, because neither does it alone: `_text_search` matches
 * the words and `hierarchy/_search` says where each hit sits, so the tree opens
 * along every answered path and marks the rows the words found
 * (post_entity_text_search, post_hierarchy_search).
 */
import type { HierarchyNode, HierarchyRef, SgClient } from './client.js';
import { hierarchyEntity } from './client.js';
import type { EntityRef, WireCondition } from './filter.js';
import type { SchemaService } from './schema-service.js';
import type { FieldLookup } from './search.js';
import { matchesEveryWord, scopeToProject } from './search.js';
import type { FieldSchema } from './schema.js';
import { statusFieldFor } from './schema.js';
import type { StatusService } from './status-service.js';
import type { StatusRecord } from './status.js';

/* -------------------------------------------------------------------------- */
/* nodes                                                                      */
/* -------------------------------------------------------------------------- */

/** One node of a level, as a loader hands it over. */
export interface TreeSourceNode {
  /** The key everything else is held under, and what the loader is called with. */
  path: string;
  label: string;
  ref: HierarchyRef;
  /** False when opening this node would return nothing. */
  hasChildren: boolean;
  /** Fields of the row the node stands for, flattened. */
  values?: Record<string, unknown>;
}

/** One level: the node that was opened, and the level below it. */
export interface TreeLevel {
  node: TreeSourceNode;
  children: TreeSourceNode[];
}

/** Reads one level. A node already read is never read again. */
export type TreeLoader = (path: string) => Promise<TreeLevel>;

/** A node in the tree, with where it sits. */
export interface TreeNode {
  path: string;
  label: string;
  ref: HierarchyRef;
  /** The row the node stands for, or null where it stands for a type or nothing. */
  entity: EntityRef | null;
  hasChildren: boolean;
  parentPath: string | null;
  /** Depth below the root, which is 0. */
  level: number;
  /** Fields of the row the node stands for, flattened. Empty until a loader fills it. */
  values: Record<string, unknown>;
}

export type TreeCheckState = 'checked' | 'mixed' | 'unchecked';
export type TreeSelectionMode = 'none' | 'single' | 'multiple';
export type TreeStatus = 'idle' | 'loading' | 'ready' | 'error';

/** One line of the visible list, with everything a row draws itself from. */
export interface TreeRow {
  node: TreeNode;
  expanded: boolean;
  /** True while this node's level is being read. */
  loading: boolean;
  checked: TreeCheckState;
  selected: boolean;
  /** True on the one node that owns the tab stop. */
  focused: boolean;
  /** True when the search placed this row, or its label holds every word. */
  match: boolean;
}

/** Everything a view renders. A new object on every change, so identity is the signal. */
export interface TreeState {
  rows: TreeRow[];
  status: TreeStatus;
  error: Error | null;
  /** Path of the focus cursor, or null before the root is read. */
  cursor: string | null;
  /** The text the tree is searching for. */
  search: string;
  /** True while a search is in flight. */
  searching: boolean;
  /** Paths of the rows the search marked, in visible order. */
  matches: string[];
  /** Paths whose box is fully checked, branches included. */
  checked: string[];
  selected: string[];
}

/** A keyboard event, reduced to what the model reads. */
export interface TreeKey {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
}

export interface TreeSelectOptions {
  /** Add to the selection instead of replacing it. Ignored unless selection is `multiple`. */
  additive?: boolean;
}

export interface TreeOptions {
  loader: TreeLoader;
  /** Where the tree starts, `/Project/<id>` against the hierarchy loader. */
  rootPath: string;
  selection?: TreeSelectionMode;
  /** Places rows by text. Without one, a search marks the labels already loaded. */
  searcher?: TreeSearcher;
  /** Types a search covers. Default: the types the levels already read stand for. */
  searchTypes?: readonly string[];
  /** How many levels `expandAll` opens under a node. Default 3. */
  expandDepth?: number;
  /** How long a type-ahead buffer survives, in milliseconds. Default 800. */
  typeAheadMs?: number;
  /** The clock type-ahead measures on. */
  now?: () => number;
}

/** One row a search found, and where the tree puts it. */
export interface TreeSearchHit {
  ref: EntityRef;
  label: string;
  /** One path per level, root first; the last entry is the row itself. */
  incrementalPath: string[];
}

/** Matches words and answers where each hit sits. */
export type TreeSearcher = (text: string, entityTypes: readonly string[]) => Promise<TreeSearchHit[]>;

export interface TreeEngine {
  readonly rootPath: string;
  snapshot(): TreeState;
  subscribe(listener: () => void): () => void;
  /** A node already loaded, by path. */
  node(path: string): TreeNode | undefined;
  /** The paths of a node's level, once it has been read. */
  childPaths(path: string): string[];
  checkStateOf(path: string): TreeCheckState;
  /** Read the root and open it. */
  load(): Promise<void>;
  expand(path: string): Promise<void>;
  collapse(path: string): void;
  toggle(path: string): Promise<void>;
  /** Open every level down to a path, or to the deepest entry of an incremental path. */
  expandToPath(refs: string | readonly string[]): Promise<void>;
  /** Open every level under a node, breadth first, down to `depth`. */
  expandAll(path: string, depth?: number): Promise<void>;
  /** Move the focus cursor. A path outside the visible list is ignored. */
  focus(path: string): void;
  setChecked(path: string, on: boolean): void;
  toggleChecked(path: string): void;
  /** The rows the checked nodes stand for, in visible order. */
  checkedRefs(): EntityRef[];
  select(path: string, options?: TreeSelectOptions): void;
  clearSelection(): void;
  /**
   * Place every row the words match, open the tree onto them and mark them. An
   * empty text drops the marks and restores the expansion the search opened onto.
   */
  search(text: string): Promise<void>;
  /** True when the tree handled the key, which is when the caller stops it. */
  keyDown(event: TreeKey): boolean;
}

/** How deep `expandToPath` walks before it gives up. */
const MAX_SEED_DEPTH = 16;
/** Hits one search places. `_text_search` answers at most 25 rows a page (probe 053). */
const MAX_SEARCH_HITS = 25;
/** Levels one `expandAll` reads, whatever its depth. */
const MAX_EXPAND_READS = 64;

/**
 * A path in the one spelling both endpoints can be compared in.
 *
 * `_expand` writes the ungrouped bucket `<field>/<GroupType>/__none__` and `_search`
 * writes `<field>/__none__`, and both answer the same rows (064_hierarchy_expand_buckets).
 * A group type is capitalised where a field name is not, which is the same rule
 * `pathRefs` reads a path by.
 */
function canonicalPath(path: string): string {
  return path.replace(/\/[A-Z][A-Za-z0-9]*\/__none__(?=\/|$)/g, '/__none__');
}

/** True when `target` is the path itself or sits under it, in either spelling. */
function isUnder(path: string, target: string): boolean {
  const here = canonicalPath(path);
  const there = canonicalPath(target);
  return there === here || there.startsWith(`${here}/`);
}

function asError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

/** One node of `hierarchyExpand`, as the engine holds it. */
function fromHierarchy(raw: HierarchyNode): TreeSourceNode {
  return { path: raw.path, label: raw.label, ref: raw.ref, hasChildren: raw.hasChildren };
}

export function createTree(options: TreeOptions): TreeEngine {
  const { loader, rootPath } = options;
  const selectionMode: TreeSelectionMode = options.selection ?? 'single';
  const typeAheadMs = options.typeAheadMs ?? 800;
  const now = options.now ?? (() => Date.now());

  const nodes = new Map<string, TreeNode>();
  const levels = new Map<string, string[]>();
  const expanded = new Set<string>();
  const loading = new Set<string>();
  /** Nodes an `expandAll` is walking under, which read as busy while it runs. */
  const walking = new Set<string>();
  const pending = new Map<string, Promise<TreeNode | null>>();
  const checked = new Set<string>();
  const selected = new Set<string>();
  const matches = new Set<string>();
  const listeners = new Set<() => void>();

  let status: TreeStatus = 'idle';
  let error: Error | null = null;
  let cursor: string | null = null;
  let searchText = '';
  let searching = false;
  /** The expansion a search opened onto, restored when the text is cleared. */
  let beforeSearch: Set<string> | null = null;
  let searchToken = 0;
  let typed = '';
  let typedAt = 0;
  let state: TreeState = build();

  function emit(): void {
    state = build();
    for (const listener of listeners) listener();
  }

  /* the visible list ------------------------------------------------------ */

  function build(): TreeState {
    const rows: TreeRow[] = [];
    const marked: string[] = [];
    const walk = (path: string): void => {
      const node = nodes.get(path);
      if (!node) return;
      const match = matches.has(path);
      if (match) marked.push(path);
      rows.push({
        node,
        expanded: expanded.has(path),
        loading: loading.has(path) || walking.has(path),
        checked: checkStateOf(path),
        selected: selected.has(path),
        focused: cursor === path,
        match,
      });
      if (expanded.has(path)) for (const child of levels.get(path) ?? []) walk(child);
    };
    walk(rootPath);
    return {
      rows,
      status,
      error,
      cursor,
      search: searchText,
      searching,
      matches: marked,
      checked: [...checked],
      selected: [...selected],
    };
  }

  function visiblePaths(): string[] {
    return state.rows.map((row) => row.node.path);
  }

  /* reading --------------------------------------------------------------- */

  function ingest(level: TreeLevel): TreeNode {
    // The node was placed by the level above, so its depth and its parent are already known.
    const placed = nodes.get(level.node.path);
    const depth = placed?.level ?? 0;
    const own: TreeNode = {
      path: level.node.path,
      label: level.node.label,
      ref: level.node.ref,
      entity: hierarchyEntity(level.node.ref),
      hasChildren: level.node.hasChildren,
      parentPath: placed?.parentPath ?? null,
      level: depth,
      values: level.node.values ?? placed?.values ?? {},
    };
    nodes.set(own.path, own);
    const paths: string[] = [];
    for (const child of level.children) {
      // A placeholder child carries no path of its own and stands for an empty level
      // (post_hierarchy_expand); keeping it would key it over its own parent.
      if (child.path === own.path) continue;
      paths.push(child.path);
      nodes.set(child.path, {
        path: child.path,
        label: child.label,
        ref: child.ref,
        entity: hierarchyEntity(child.ref),
        hasChildren: child.hasChildren,
        parentPath: own.path,
        level: depth + 1,
        values: child.values ?? {},
      });
      // A level read under a checked branch arrives checked, so a box ticked before
      // its children existed still means what it said.
      if (checked.has(own.path)) checked.add(child.path);
    }
    levels.set(own.path, paths);
    return own;
  }

  async function read(path: string): Promise<TreeNode | null> {
    // A second opener joins the read in flight rather than starting another one.
    const running = pending.get(path);
    if (running) return running;
    const task = (async (): Promise<TreeNode | null> => {
      try {
        const level = await loader(path);
        const node = ingest(level);
        error = null;
        return node;
      } catch (thrown) {
        error = asError(thrown);
        if (path === rootPath) status = 'error';
        return null;
      } finally {
        pending.delete(path);
        loading.delete(path);
        emit();
      }
    })();
    pending.set(path, task);
    loading.add(path);
    emit();
    return task;
  }

  /** The root, read if it has not been. */
  async function root(): Promise<TreeNode | null> {
    const known = nodes.get(rootPath);
    if (known) return known;
    status = 'loading';
    emit();
    const node = await read(rootPath);
    if (node) {
      status = 'ready';
      if (cursor === null) cursor = rootPath;
      expanded.add(rootPath);
      emit();
    }
    return node;
  }

  /* checkboxes ------------------------------------------------------------ */

  function checkStateOf(path: string): TreeCheckState {
    if (checked.has(path)) return 'checked';
    const stack = [...(levels.get(path) ?? [])];
    while (stack.length > 0) {
      const next = stack.pop() as string;
      if (checked.has(next)) return 'mixed';
      stack.push(...(levels.get(next) ?? []));
    }
    return 'unchecked';
  }

  function spread(path: string, on: boolean): void {
    if (on) checked.add(path);
    else checked.delete(path);
    for (const child of levels.get(path) ?? []) spread(child, on);
  }

  /** A parent is checked when every child it has read is, and drops out otherwise. */
  function settleAncestors(path: string): void {
    let up = nodes.get(path)?.parentPath ?? null;
    while (up !== null) {
      const children = levels.get(up) ?? [];
      const all = children.length > 0 && children.every((child) => checked.has(child));
      if (all) checked.add(up);
      else checked.delete(up);
      up = nodes.get(up)?.parentPath ?? null;
    }
  }

  /* the cursor ------------------------------------------------------------ */

  function moveTo(index: number): void {
    const paths = visiblePaths();
    if (paths.length === 0) return;
    const clamped = Math.max(0, Math.min(index, paths.length - 1));
    const next = paths[clamped];
    if (next === undefined || next === cursor) return;
    cursor = next;
    emit();
  }

  /** The next visible node whose label starts with the buffer, wrapping past the cursor. */
  function typeAhead(char: string): boolean {
    const at = now();
    typed = at - typedAt > typeAheadMs ? char : typed + char;
    typedAt = at;
    // One letter pressed again walks the matches for that letter; a longer buffer may
    // still match where the cursor stands.
    const repeated = /^(.)\1*$/.test(typed);
    const needle = (repeated ? char : typed).toLowerCase();
    const paths = visiblePaths();
    if (paths.length === 0) return false;
    const from = Math.max(0, paths.indexOf(cursor ?? ''));
    const offset = repeated ? 1 : 0;
    for (let step = 0; step < paths.length; step += 1) {
      const path = paths[(from + offset + step) % paths.length] as string;
      if (nodes.get(path)?.label.toLowerCase().startsWith(needle)) {
        cursor = path;
        emit();
        return true;
      }
    }
    return false;
  }

  /* searching -------------------------------------------------------------- */

  /**
   * Open every level down to a path and answer the node it landed on. `done`
   * carries the paths already opened, so hits sharing a branch open it once.
   */
  async function walkTo(target: string, done: Set<string>): Promise<TreeNode | null> {
    let here = await root();
    if (!here) return null;
    for (let depth = 0; depth < MAX_SEED_DEPTH; depth += 1) {
      if (canonicalPath(here.path) === canonicalPath(target)) break;
      if (!done.has(here.path)) {
        done.add(here.path);
        await engine.expand(here.path);
      }
      const next = (levels.get(here.path) ?? []).find((path) => isUnder(path, target));
      if (next === undefined) break;
      const node = nodes.get(next);
      if (!node) break;
      here = node;
    }
    return here;
  }

  /** The types the levels already read stand for, which is what a search covers. */
  function searchTypes(): string[] {
    if (options.searchTypes) return [...options.searchTypes];
    const types = new Set<string>();
    for (const node of nodes.values()) {
      const entity = hierarchyEntity(node.ref);
      if (entity) types.add(entity.type);
      else if (node.ref.kind === 'entity_type' && typeof node.ref.value === 'string') types.add(node.ref.value);
    }
    // The root is the project itself, and a project is never a row under it.
    types.delete('Project');
    return [...types];
  }

  /** Loaded nodes whose label holds every word, which the server never answers for a folder. */
  function markLoaded(text: string): void {
    for (const node of nodes.values()) if (matchesEveryWord(node.label, text)) matches.add(node.path);
  }

  /* the engine ------------------------------------------------------------ */

  const engine: TreeEngine = {
    rootPath,

    snapshot(): TreeState {
      return state;
    },

    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    node(path: string): TreeNode | undefined {
      return nodes.get(path);
    },

    childPaths(path: string): string[] {
      return [...(levels.get(path) ?? [])];
    },

    checkStateOf,

    async load(): Promise<void> {
      await root();
    },

    async expand(path: string): Promise<void> {
      const node = nodes.get(path);
      if (!node || !node.hasChildren) return;
      expanded.add(path);
      emit();
      // `children` names the next paths (post_hierarchy_expand), so a level already
      // read is never read again.
      if (!levels.has(path)) await read(path);
    },

    collapse(path: string): void {
      if (!expanded.delete(path)) return;
      emit();
    },

    async toggle(path: string): Promise<void> {
      if (expanded.has(path)) engine.collapse(path);
      else await engine.expand(path);
    },

    async expandToPath(refs: string | readonly string[]): Promise<void> {
      const target = typeof refs === 'string' ? refs : (refs[refs.length - 1] ?? '');
      if (target.length === 0) return;
      const here = await walkTo(target, new Set());
      if (!here) return;
      cursor = here.path;
      emit();
    },

    async expandAll(path: string, depth: number = options.expandDepth ?? 3): Promise<void> {
      const start = nodes.get(path);
      if (!start || !start.hasChildren) return;
      walking.add(path);
      emit();
      try {
        let frontier = [path];
        let budget = MAX_EXPAND_READS;
        for (let level = 0; level < depth && frontier.length > 0 && budget > 0; level += 1) {
          const reads: Array<Promise<TreeNode | null>> = [];
          for (const here of frontier) {
            if (!nodes.get(here)?.hasChildren) continue;
            expanded.add(here);
            if (levels.has(here) || budget === 0) continue;
            budget -= 1;
            reads.push(read(here));
          }
          await Promise.all(reads);
          frontier = frontier.flatMap((here) => levels.get(here) ?? []);
        }
      } finally {
        walking.delete(path);
        emit();
      }
    },

    focus(path: string): void {
      if (!nodes.has(path) || cursor === path) return;
      cursor = path;
      emit();
    },

    setChecked(path: string, on: boolean): void {
      if (!nodes.has(path)) return;
      spread(path, on);
      settleAncestors(path);
      emit();
    },

    toggleChecked(path: string): void {
      engine.setChecked(path, checkStateOf(path) !== 'checked');
    },

    checkedRefs(): EntityRef[] {
      const refs: EntityRef[] = [];
      const walk = (path: string): void => {
        const node = nodes.get(path);
        if (!node) return;
        if (checked.has(path) && node.entity) refs.push(node.entity);
        for (const child of levels.get(path) ?? []) walk(child);
      };
      walk(rootPath);
      return refs;
    },

    select(path: string, selectOptions: TreeSelectOptions = {}): void {
      if (selectionMode === 'none' || !nodes.has(path)) return;
      if (selectionMode === 'multiple' && selectOptions.additive) {
        if (!selected.delete(path)) selected.add(path);
      } else if (selectionMode === 'multiple') {
        selected.clear();
        selected.add(path);
      } else {
        selected.clear();
        selected.add(path);
      }
      cursor = path;
      emit();
    },

    clearSelection(): void {
      if (selected.size === 0) return;
      selected.clear();
      emit();
    },

    async search(text: string): Promise<void> {
      const token = (searchToken += 1);
      searchText = text;
      matches.clear();
      if (text.trim().length === 0) {
        searching = false;
        if (beforeSearch) {
          expanded.clear();
          for (const path of beforeSearch) expanded.add(path);
          beforeSearch = null;
        }
        emit();
        return;
      }
      if (!options.searcher) {
        markLoaded(text);
        emit();
        return;
      }
      searching = true;
      emit();
      let hits: TreeSearchHit[] = [];
      try {
        hits = await options.searcher(text, searchTypes());
      } catch (thrown) {
        if (token !== searchToken) return;
        error = asError(thrown);
        searching = false;
        emit();
        return;
      }
      if (token !== searchToken) return;
      beforeSearch ??= new Set(expanded);
      const done = new Set<string>();
      const placed: string[] = [];
      for (const hit of hits.slice(0, MAX_SEARCH_HITS)) {
        const landed = await walkTo(hit.incrementalPath[hit.incrementalPath.length - 1] ?? '', done);
        if (token !== searchToken) return;
        if (landed?.entity?.type === hit.ref.type && landed.entity.id === hit.ref.id) placed.push(landed.path);
      }
      for (const path of placed) matches.add(path);
      // A folder is not a row, so the server never returns one; its label matches all the same.
      markLoaded(text);
      const first = placed[0];
      if (first !== undefined) cursor = first;
      searching = false;
      emit();
    },

    keyDown(event: TreeKey): boolean {
      const paths = visiblePaths();
      const index = paths.indexOf(cursor ?? '');
      const path = paths[index];
      const node = path === undefined ? undefined : nodes.get(path);
      switch (event.key) {
        case 'ArrowDown':
          moveTo(index + 1);
          return true;
        case 'ArrowUp':
          moveTo(index - 1);
          return true;
        case 'ArrowRight':
          if (!node) return false;
          if (node.hasChildren && !expanded.has(node.path)) void engine.expand(node.path);
          else if (expanded.has(node.path) && (levels.get(node.path)?.length ?? 0) > 0) moveTo(index + 1);
          return true;
        case 'ArrowLeft':
          if (!node) return false;
          if (expanded.has(node.path)) engine.collapse(node.path);
          else if (node.parentPath !== null) engine.focus(node.parentPath);
          return true;
        case 'Home':
          moveTo(0);
          return true;
        case 'End':
          moveTo(paths.length - 1);
          return true;
        case ' ':
          if (!node) return false;
          engine.toggleChecked(node.path);
          return true;
        case 'Enter':
          if (!node) return false;
          engine.select(node.path, { additive: event.ctrlKey === true || event.metaKey === true });
          return true;
        case '*': {
          // The ARIA tree pattern opens every branch at the focus level, not just this one.
          if (!node) return false;
          const level = node.parentPath === null ? [node.path] : (levels.get(node.parentPath) ?? [node.path]);
          for (const path of level) void engine.expandAll(path);
          return true;
        }
        default:
          if (event.key.length !== 1 || event.ctrlKey || event.metaKey || event.altKey) return false;
          return typeAhead(event.key);
      }
    },
  };

  return engine;
}

/* -------------------------------------------------------------------------- */
/* the hierarchy adapter                                                      */
/* -------------------------------------------------------------------------- */

export interface HierarchyLoaderOptions {
  /** Field paths read for the rows the nodes of a level stand for. */
  fields?: readonly string[];
}

/**
 * `hierarchyExpand` as a tree loader.
 *
 * With `fields`, the rows a level's nodes stand for are read once per type over
 * the ids just returned, so a sub-label or a status comes back with the level
 * rather than one read per row. A name a type does not have is dropped at 200, so
 * one list of names serves every type (probe 003).
 */
export function hierarchyLoader(client: SgClient, options: HierarchyLoaderOptions = {}): TreeLoader {
  const wanted = [...new Set(['id', ...(options.fields ?? [])])];
  return async (path: string): Promise<TreeLevel> => {
    const answer = await client.hierarchyExpand(path);
    const children = (await ungrouped(client, answer)) ?? answer.children;
    const level: TreeLevel = { node: fromHierarchy(answer), children: children.map(fromHierarchy) };
    if (wanted.length > 1) await readValues(client, [level.node, ...level.children], wanted);
    return level;
  };
}

/** The segment sent to make the endpoint name the grouping field it expects. */
const FIELD_PROBE = '__field__';
/** `Unexpected field name in path: nope (expecting sg_sequence)` (post_hierarchy_expand). */
const EXPECTING = /expecting\s+([A-Za-z0-9_]+)/;

/**
 * The rows a grouped level hides, or null when there are none to find.
 *
 * A grouping field with no rows hides every row under it: the level answers one
 * `empty` child and no bucket, although the `__none__` path under it answers all of
 * them (064_hierarchy_expand_buckets). The field that path runs through is whatever
 * the site's navigation groups by, and the 400 the endpoint answers a bogus segment
 * names it (post_hierarchy_expand). The bucket is asked for in `_search`'s spelling,
 * `<field>/__none__`, which needs no group type and answers the same rows.
 */
async function ungrouped(client: SgClient, answer: HierarchyNode): Promise<HierarchyNode[] | null> {
  const only = answer.children.length === 1 ? answer.children[0] : undefined;
  if (!only || only.ref.kind !== 'empty') return null;
  // Grouping sits directly under the type folder, and a bucket never groups again.
  if (answer.ref.kind !== 'entity_type' || answer.path.includes('__none__')) return null;
  let field: string | null = null;
  try {
    await client.hierarchyExpand(`${answer.path}/${FIELD_PROBE}`);
  } catch (thrown) {
    field = EXPECTING.exec(asError(thrown).message)?.[1] ?? null;
  }
  if (field === null) return null;
  try {
    const bucket = await client.hierarchyExpand(`${answer.path}/${field}/__none__`);
    const rows = bucket.children.filter((child) => child.ref.kind !== 'empty');
    return rows.length > 0 ? rows : null;
  } catch {
    return null;
  }
}

/* -------------------------------------------------------------------------- */
/* the search adapter                                                         */
/* -------------------------------------------------------------------------- */

export interface HierarchySearcherOptions {
  /** Answers whether a type carries `project`, so the words are scoped to it. */
  schema?: FieldLookup;
  /** Rows the text search asks for. Each one costs a path lookup. Default 10. */
  limit?: number;
}

/**
 * `_text_search` and `hierarchy/_search` chained, as a tree searcher.
 *
 * The hierarchy endpoint takes an entity and answers where it sits rather than
 * matching words, so the words go to `_text_search` first and each hit is then
 * asked for its path (post_hierarchy_search). A root path naming a project scopes
 * the words to it, on every type that carries a `project` field.
 */
export function hierarchySearcher(
  client: SgClient,
  rootPath: string,
  options: HierarchySearcherOptions = {},
): TreeSearcher {
  const limit = options.limit ?? 10;
  const projectId = /^\/Project\/(\d+)/.exec(rootPath)?.[1];
  return async (text: string, entityTypes: readonly string[]): Promise<TreeSearchHit[]> => {
    if (entityTypes.length === 0) return [];
    let types: Record<string, WireCondition[] | null> = Object.fromEntries(entityTypes.map((type) => [type, null]));
    if (projectId !== undefined && options.schema) types = await scopeToProject(options.schema, types, Number(projectId));
    const found = await client.textSearch(text, types, { size: limit, number: 1 });
    const placed = await Promise.all(
      found.map((row) =>
        client
          .hierarchySearch(rootPath, { type: row.type, id: row.id })
          .then((answers) => answers[0] ?? null)
          // A row the tree has no place for under this root is not a hit.
          .catch(() => null),
      ),
    );
    return placed.flatMap((path) =>
      path ? [{ ref: path.ref, label: path.label, incrementalPath: path.incrementalPath }] : [],
    );
  };
}

/** One read per type over the level, flattened onto the nodes that asked for it. */
async function readValues(client: SgClient, level: TreeSourceNode[], fields: string[]): Promise<void> {
  const byType = new Map<string, number[]>();
  for (const node of level) {
    const entity = hierarchyEntity(node.ref);
    if (!entity) continue;
    const ids = byType.get(entity.type);
    if (ids) ids.push(entity.id);
    else byType.set(entity.type, [entity.id]);
  }
  if (byType.size === 0) return;
  const reads = await Promise.all(
    [...byType].map(async ([type, ids]) => {
      const filters = { logical_operator: 'and' as const, conditions: [['id', 'in', ids] as WireCondition] };
      const result = await client.search(type, { filters, fields, page: { size: ids.length } });
      return [type, result.data] as const;
    }),
  );
  const rows = new Map<string, Record<string, unknown>>();
  for (const [type, data] of reads) {
    for (const row of data) {
      const values: Record<string, unknown> = { ...row.attributes, id: row.id };
      for (const [name, link] of Object.entries(row.relationships ?? {})) values[name] = link?.data ?? null;
      rows.set(`${type}:${row.id}`, values);
    }
  }
  for (const node of level) {
    const entity = hierarchyEntity(node.ref);
    const values = entity ? rows.get(`${entity.type}:${entity.id}`) : undefined;
    if (values) node.values = values;
  }
}

/* -------------------------------------------------------------------------- */
/* what a row draws with                                                      */
/* -------------------------------------------------------------------------- */

/** The schemas a tree row needs, one entry per type the tree has shown. */
export interface TreeFieldPlan {
  /** The type's own status field, when it has a real one. */
  status: Record<string, FieldSchema | null>;
  /** The secondary column's field, per type. */
  secondary: Record<string, FieldSchema | null>;
  /** `Status` rows by code, read once and only when a status is on show (probe 010). */
  statuses: Record<string, StatusRecord> | null;
}

/**
 * The status field and the secondary field of every type a tree shows.
 *
 * A type's status field is whichever field is a `status_list`. Project's
 * `sg_status` is a plain `list` with no Status row behind its values, so it
 * carries no badge (entity_types/Project, probe 009).
 */
export async function resolveTreeFields(
  schema: SchemaService,
  statusTable: StatusService,
  types: readonly string[],
  secondaryField?: string,
): Promise<TreeFieldPlan> {
  const plan: TreeFieldPlan = { status: {}, secondary: {}, statuses: null };
  await Promise.all(
    types.map(async (type) => {
      const fields = await schema.fields(type);
      const status = statusFieldFor(type, fields);
      plan.status[type] = typeof status === 'string' || status.dataType !== 'status_list' ? null : status;
      plan.secondary[type] = secondaryField ? (fields[secondaryField] ?? null) : null;
    }),
  );
  const onShow =
    Object.values(plan.status).some((field) => field !== null) ||
    Object.values(plan.secondary).some((field) => field?.dataType === 'status_list');
  if (onShow) plan.statuses = Object.fromEntries(await statusTable.byCode());
  return plan;
}

/** The field names a level is read under so a row can show a status: the two the API uses. */
export const TREE_STATUS_FIELDS = ['sg_status_list', 'sg_status'] as const;
