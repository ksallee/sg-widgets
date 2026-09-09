import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntityRef, HierarchyNode, HierarchyRef, SgClient } from '@sg-widgets/core';
import { hierarchyEntity } from '@sg-widgets/core';
import { ChevronRight, CircleAlert, Inbox, Loader } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EntityChip } from '@/registry/sg/components/entity-chip';

/** One loaded node, plus where it sits and what it knows about its children. */
export interface TreeNode {
  path: string;
  label: string;
  ref: HierarchyRef;
  hasChildren: boolean;
  /** Paths of the level below, once it has been read. */
  childPaths: string[];
  level: number;
}

function toNode(raw: HierarchyNode, level: number): TreeNode {
  return {
    path: raw.path,
    label: raw.label,
    ref: raw.ref,
    hasChildren: raw.hasChildren,
    childPaths: raw.children.map((child) => child.path),
    level,
  };
}

export interface EntityTreeProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect'> {
  /** Reads one level per call. Wrap it in a query cache so a reopened node costs nothing. */
  client: SgClient;
  /** Where the tree starts, `/Project/<id>`. */
  rootPath: string;
  /** Opens the tree down to this path on mount, one level per call. */
  seedPath?: string | null;
  /** Draws a checkbox per node and reports the checked rows. */
  checkable?: boolean;
  onCheckedChange?: (rows: EntityRef[]) => void;
  /** A node with nothing under it was chosen. */
  onSelect?: (node: TreeNode) => void;
  /** Shows a filter input that narrows the nodes already loaded. */
  filterable?: boolean;
  filterPlaceholder?: string;
  maxHeight?: string;
  emptyLabel?: string;
}

const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';

/**
 * A project's navigation tree, one level per call.
 *
 * `POST /hierarchy/_expand` answers one level: the node, and children carrying a label,
 * a ref and whether expanding them is worth it, so walking a project is one call per
 * node (post_hierarchy_expand). Which levels a project has is the site's own navigation
 * configuration and not a fixed hierarchy - the probed site's Shot path runs through
 * the field name `sg_sequence` (post_hierarchy_search) - so `seedPath` is followed by
 * taking whichever child is a prefix of it rather than by parsing the path.
 *
 * The filter narrows what is already loaded. It never asks the server, so a branch that
 * was never opened is not searched.
 */
export function EntityTree({
  client,
  rootPath,
  seedPath = null,
  checkable = false,
  onCheckedChange,
  onSelect,
  filterable = false,
  filterPlaceholder = 'Filter loaded nodes',
  maxHeight = '24rem',
  emptyLabel = 'Nothing under this project',
  className,
  ...rest
}: EntityTreeProps) {
  const [nodes, setNodes] = useState<Record<string, TreeNode>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [cursor, setCursor] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const started = useRef(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const reading = useRef<Record<string, boolean>>({});

  const read = useCallback(
    async (path: string, level: number): Promise<TreeNode | null> => {
      if (reading.current[path]) return null;
      reading.current[path] = true;
      setBusy((was) => ({ ...was, [path]: true }));
      try {
        const answer = await client.hierarchyExpand(path);
        const own = toNode(answer, level);
        setNodes((was) => {
          const next = { ...was, [path]: own };
          for (const child of answer.children) next[child.path] = toNode(child, level + 1);
          return next;
        });
        setError(null);
        return own;
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        return null;
      } finally {
        reading.current[path] = false;
        setBusy((was) => ({ ...was, [path]: false }));
      }
    },
    [client],
  );

  const open = useCallback(
    async (path: string): Promise<void> => {
      const node = nodes[path];
      setExpanded((was) => ({ ...was, [path]: true }));
      // One level per call, and `children` names the next paths (post_hierarchy_expand),
      // so a level already read is never read again.
      if (node && node.childPaths.length === 0 && node.hasChildren) await read(path, node.level);
    },
    [nodes, read],
  );

  const close = useCallback((path: string): void => {
    setExpanded((was) => ({ ...was, [path]: false }));
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const root = await read(rootPath, 0);
      if (!root) return;
      setCursor(rootPath);
      setExpanded((was) => ({ ...was, [rootPath]: true }));
      if (!seedPath || seedPath === rootPath) return;
      // The path shape is the site's own navigation configuration, not a fixed hierarchy
      // (post_hierarchy_search), so the walk follows whichever child is a prefix of the seed.
      let here = root;
      for (let depth = 0; depth < 12; depth += 1) {
        const child: string | undefined = here.childPaths.find((p) => seedPath === p || seedPath.startsWith(`${p}/`));
        if (!child) return;
        setExpanded((was) => ({ ...was, [child]: true }));
        setCursor(child);
        if (child === seedPath) return;
        const loaded = await read(child, here.level + 1);
        if (!loaded) return;
        here = loaded;
      }
    })();
  }, [read, rootPath, seedPath]);

  useEffect(() => {
    const rows: EntityRef[] = [];
    for (const [path, on] of Object.entries(checked)) {
      const entity = on ? hierarchyEntity(nodes[path]?.ref) : null;
      if (entity) rows.push(entity);
    }
    onCheckedChange?.(rows);
    // The callback is the caller's; the checked set and the nodes are what move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checked, nodes]);

  /* the visible list ------------------------------------------------------ */

  const parents = useMemo(() => {
    const map: Record<string, string> = {};
    for (const node of Object.values(nodes)) for (const child of node.childPaths) map[child] = node.path;
    return map;
  }, [nodes]);

  /** Paths kept by the filter: every match, and every ancestor that leads to one. */
  const kept = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    if (!needle) return null;
    const keep = new Set<string>();
    for (const node of Object.values(nodes)) {
      if (!node.label.toLowerCase().includes(needle)) continue;
      keep.add(node.path);
      let up = parents[node.path];
      while (up) {
        keep.add(up);
        up = parents[up];
      }
    }
    return keep;
  }, [filter, nodes, parents]);

  const visible = useMemo(() => {
    const out: TreeNode[] = [];
    const walk = (path: string): void => {
      const node = nodes[path];
      if (!node) return;
      if (kept && !kept.has(path)) return;
      out.push(node);
      // While filtering, a branch that leads to a match is open whatever its own state.
      if (expanded[path] || kept) for (const child of node.childPaths) walk(child);
    };
    walk(rootPath);
    return out;
  }, [nodes, expanded, kept, rootPath]);

  /* keyboard -------------------------------------------------------------- */

  function moveTo(index: number): void {
    const node = visible[Math.max(0, Math.min(index, visible.length - 1))];
    if (node) setCursor(node.path);
  }

  function activate(node: TreeNode): void {
    if (node.hasChildren) void (expanded[node.path] ? close(node.path) : open(node.path));
    else onSelect?.(node);
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    const index = visible.findIndex((node) => node.path === cursor);
    const node = visible[index];
    if (!node) return;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        moveTo(index + 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        moveTo(index - 1);
        break;
      case 'ArrowRight':
        event.preventDefault();
        if (node.hasChildren && !expanded[node.path]) void open(node.path);
        else moveTo(index + 1);
        break;
      case 'ArrowLeft': {
        event.preventDefault();
        if (node.hasChildren && expanded[node.path]) close(node.path);
        else {
          const up = parents[node.path];
          if (up) setCursor(up);
        }
        break;
      }
      case 'Home':
        event.preventDefault();
        moveTo(0);
        break;
      case 'End':
        event.preventDefault();
        moveTo(visible.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        activate(node);
        break;
    }
  }

  useEffect(() => {
    // The cursor is a roving tabindex, so the focused row follows it.
    if (!cursor) return;
    const root = rootRef.current;
    if (!root || !root.contains(document.activeElement)) return;
    root.querySelector<HTMLElement>(`[data-path="${CSS.escape(cursor)}"]`)?.focus();
  }, [cursor, visible]);

  return (
    <div
      ref={rootRef}
      data-slot="entity-tree"
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      {filterable ? (
        <Input
          type="search"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          placeholder={filterPlaceholder}
          aria-label={filterPlaceholder}
          data-slot="entity-tree-filter"
        />
      ) : null}

      <div
        data-slot="entity-tree-scroll"
        style={{ maxHeight }}
        className="border-border w-full overflow-auto rounded-md border p-1"
      >
        {error ? (
          <p className={cn(stateClass, 'text-destructive')}>
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {error}
          </p>
        ) : visible.length === 0 && busy[rootPath] ? (
          <div className="flex flex-col gap-2 p-1">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <p className={stateClass}>
            <Inbox aria-hidden="true" className="size-4 shrink-0" />
            {emptyLabel}
          </p>
        ) : (
          <ul role="tree" aria-label="Project hierarchy" onKeyDown={onKeyDown} className="flex flex-col">
            {visible.map((node) => {
              const entity = hierarchyEntity(node.ref);
              return (
                <li
                  key={node.path}
                  role="none"
                  className="flex items-center gap-1.5"
                  style={{ paddingLeft: `${node.level * 16}px` }}
                >
                  {checkable ? (
                    <Checkbox
                      aria-label={`Select ${node.label}`}
                      checked={checked[node.path] === true}
                      onCheckedChange={() => setChecked((was) => ({ ...was, [node.path]: !was[node.path] }))}
                      className="shrink-0"
                    />
                  ) : null}
                  <div
                    role="treeitem"
                    data-path={node.path}
                    aria-level={node.level + 1}
                    aria-expanded={node.hasChildren ? expanded[node.path] === true : undefined}
                    aria-selected={cursor === node.path}
                    tabIndex={cursor === node.path ? 0 : -1}
                    onClick={() => {
                      setCursor(node.path);
                      activate(node);
                    }}
                    className={cn(
                      'focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 flex-1 cursor-default items-center gap-1.5 rounded-md px-2 py-1.5 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
                      cursor === node.path ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
                    )}
                  >
                    {node.hasChildren ? (
                      busy[node.path] ? (
                        <Loader aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
                      ) : (
                        <ChevronRight
                          aria-hidden="true"
                          className={cn(
                            'size-4 shrink-0 transition-transform duration-150 ease-out',
                            expanded[node.path] && 'rotate-90',
                          )}
                        />
                      )
                    ) : (
                      <span aria-hidden="true" className="size-4 shrink-0" />
                    )}
                    {entity ? (
                      <EntityChip
                        entity={{ ...entity, name: node.label }}
                        size="sm"
                        className="border-none bg-transparent px-0"
                      />
                    ) : (
                      <span className="truncate" title={node.label}>
                        {node.label}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
