/**
 * Tree model.
 *
 * The headless half of the tree widgets: nodes keyed by their path, one level
 * read at a time behind a loader, expand and collapse with a loading flag per
 * node, tri-state checkboxes that propagate both ways, single or multiple
 * selection, a focus cursor carrying the whole keyboard model, and a filter over
 * the nodes already loaded. There is no framework in it: a Svelte widget wraps it
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
 */
import type { HierarchyNode, HierarchyRef, SgClient } from './client.js';
import { hierarchyEntity } from './client.js';
import type { EntityRef, WireCondition } from './filter.js';
import type { SchemaService } from './schema-service.js';
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
}

/** Everything a view renders. A new object on every change, so identity is the signal. */
export interface TreeState {
  rows: TreeRow[];
  status: TreeStatus;
  error: Error | null;
  /** Path of the focus cursor, or null before the root is read. */
  cursor: string | null;
  filter: string;
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
  /** How long a type-ahead buffer survives, in milliseconds. Default 800. */
  typeAheadMs?: number;
  /** The clock type-ahead measures on. */
  now?: () => number;
}

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
  /** Move the focus cursor. A path outside the visible list is ignored. */
  focus(path: string): void;
  setChecked(path: string, on: boolean): void;
  toggleChecked(path: string): void;
  /** The rows the checked nodes stand for, in visible order. */
  checkedRefs(): EntityRef[];
  select(path: string, options?: TreeSelectOptions): void;
  clearSelection(): void;
  /** Narrow the loaded nodes. An ancestor of a match is kept. */
  setFilter(text: string): void;
  /** True when the tree handled the key, which is when the caller stops it. */
  keyDown(event: TreeKey): boolean;
}

/** How deep `expandToPath` walks before it gives up. */
const MAX_SEED_DEPTH = 16;

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
  const pending = new Map<string, Promise<TreeNode | null>>();
  const checked = new Set<string>();
  const selected = new Set<string>();
  const listeners = new Set<() => void>();

  let status: TreeStatus = 'idle';
  let error: Error | null = null;
  let cursor: string | null = null;
  let filter = '';
  let typed = '';
  let typedAt = 0;
  let state: TreeState = build();

  function emit(): void {
    state = build();
    for (const listener of listeners) listener();
  }

  /* the visible list ------------------------------------------------------ */

  /** Paths the filter keeps: every match, and every ancestor that leads to one. */
  function keptPaths(): Set<string> | null {
    const needle = filter.trim().toLowerCase();
    if (needle.length === 0) return null;
    const keep = new Set<string>();
    for (const node of nodes.values()) {
      if (!node.label.toLowerCase().includes(needle)) continue;
      keep.add(node.path);
      let up = node.parentPath;
      while (up !== null) {
        keep.add(up);
        up = nodes.get(up)?.parentPath ?? null;
      }
    }
    return keep;
  }

  function build(): TreeState {
    const kept = keptPaths();
    const rows: TreeRow[] = [];
    const walk = (path: string): void => {
      const node = nodes.get(path);
      if (!node) return;
      if (kept && !kept.has(path)) return;
      rows.push({
        node,
        expanded: expanded.has(path),
        loading: loading.has(path),
        checked: checkStateOf(path),
        selected: selected.has(path),
        focused: cursor === path,
      });
      // While filtering, a branch that leads to a match is open whatever its own state.
      if (expanded.has(path) || kept) for (const child of levels.get(path) ?? []) walk(child);
    };
    walk(rootPath);
    return {
      rows,
      status,
      error,
      cursor,
      filter,
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
      let here = await root();
      if (!here) return;
      for (let depth = 0; depth < MAX_SEED_DEPTH; depth += 1) {
        if (here.path === target) break;
        await engine.expand(here.path);
        const next = (levels.get(here.path) ?? []).find((p) => target === p || target.startsWith(`${p}/`));
        if (next === undefined) break;
        const node = nodes.get(next);
        if (!node) break;
        here = node;
      }
      cursor = here.path;
      emit();
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

    setFilter(text: string): void {
      if (text === filter) return;
      filter = text;
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
    const level: TreeLevel = { node: fromHierarchy(answer), children: answer.children.map(fromHierarchy) };
    if (wanted.length > 1) await readValues(client, [level.node, ...level.children], wanted);
    return level;
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
