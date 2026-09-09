import type * as React from 'react';
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntityRef, HierarchyNode, SgClient, WireCondition } from '@sg-widgets/core';
import {
  breadcrumb,
  createSchemaService,
  hierarchyEntity,
  hydrate,
  matchRuns,
  pathRefs,
  scopeToProject,
} from '@sg-widgets/core';
import {
  Box,
  ChevronRight,
  Clapperboard,
  Film,
  Folder,
  ListChecks,
  Search,
  Tag,
  TriangleAlert,
  User,
  Video,
} from 'lucide-react';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Types to search, either bare names or names with a filter each. */
export type HierarchicalSearchTypes = string[] | Record<string, WireCondition[] | null>;

/** A row of the list: a path found by searching, or a node of the level being browsed. */
export interface HierarchicalSearchRow {
  /** The row's own label, the last crumb. */
  label: string;
  /** The crumbs above it, project first when the search answered one. */
  crumbs: string[];
  /** The row itself, when it is an entity rather than a type folder. */
  ref: EntityRef | null;
  /** Every row the path runs through, root first. */
  path: EntityRef[];
  /** The tree path to feed back to `hierarchyExpand`. */
  nodePath: string;
  hasChildren: boolean;
  selectable: boolean;
}

/** Leaf types a drill-down usually ends on. */
export const HIERARCHICAL_SEARCH_TYPES = ['Shot', 'Asset', 'Sequence', 'Task'];

const DEBOUNCE_MS = 250;
/** Each hit costs one path lookup, so the search asks for fewer rows than the endpoint allows. */
const LEAF_LIMIT = 10;

const GLYPHS = {
  Shot: Clapperboard,
  Asset: Box,
  Sequence: Film,
  Version: Video,
  Task: ListChecks,
  HumanUser: User,
  Project: Folder,
} as const;

function typeMap(types: HierarchicalSearchTypes): Record<string, WireCondition[] | null> {
  return Array.isArray(types) ? Object.fromEntries(types.map((t) => [t, null])) : types;
}

/** The project a root path names, for scoping the text search that finds the leaves. */
function projectOf(rootPath: string): number | null {
  const match = /^\/Project\/(\d+)/.exec(rootPath);
  return match ? Number(match[1]) : null;
}

function glyphFor(row: HierarchicalSearchRow) {
  if (!row.ref) return Folder;
  return GLYPHS[row.ref.type as keyof typeof GLYPHS] ?? Tag;
}

export interface HierarchicalSearchProps {
  /** Where rows come from. Wrap it in `createQueryCache` once for the whole app. */
  client: SgClient;
  /** Where the tree starts, `/Project/<id>` for one project or `/` for the site. */
  rootPath?: string;
  /** Types a search may end on. Browsing reaches every level whatever this says. */
  entityTypes?: HierarchicalSearchTypes;
  onSelect?: (entity: EntityRef, path: EntityRef[]) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Drill down to one row, by browsing the navigation tree or by searching it.
 *
 * Browsing is `hierarchy/_expand`, one call a level: `children` names the next paths
 * and `hasChildren` says which are worth opening. Searching cannot go through the
 * same endpoint, because `hierarchy/_search` takes an entity and answers where it
 * sits rather than matching words (post_hierarchy_search). So the words go to
 * `_text_search` and each hit is then asked for its path, which is what makes a
 * result a breadcrumb. The path runs through field names such as `sg_sequence`,
 * because the tree follows the site's own navigation configuration.
 */
export function HierarchicalSearch({
  client,
  rootPath = '/',
  entityTypes = HIERARCHICAL_SEARCH_TYPES,
  onSelect,
  placeholder = 'Search the hierarchy…',
  className,
}: HierarchicalSearchProps) {
  const schema = useMemo(() => createSchemaService(client), [client]);

  const [query, setQueryState] = useState('');
  const [rows, setRows] = useState<HierarchicalSearchRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** Where browsing is, and the labels of every level above it. */
  const [here, setHere] = useState(rootPath);
  const [trail, setTrail] = useState<Array<{ label: string; path: string }>>([]);

  const requestId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const searching = query.trim().length > 0;
  const empty = !loading && failure === null && rows.length === 0;

  const browseRow = useCallback(
    (node: HierarchyNode, crumbs: string[]): HierarchicalSearchRow => {
      const ref = hierarchyEntity(node.ref);
      const allowed = Object.keys(typeMap(entityTypes));
      return {
        label: node.label,
        crumbs,
        ref: ref ? { ...ref, name: node.label } : null,
        path: pathRefs(node.path),
        nodePath: node.path,
        hasChildren: node.hasChildren,
        selectable: ref !== null && allowed.includes(ref.type),
      };
    },
    [entityTypes],
  );

  /** Open one level of the tree. `children` names the next paths (post_hierarchy_expand). */
  const browse = useCallback(
    async (path: string, crumbs: Array<{ label: string; path: string }>): Promise<void> => {
      const id = (requestId.current += 1);
      setLoading(true);
      setFailure(null);
      try {
        const node = await client.hierarchyExpand(path);
        if (id !== requestId.current) return;
        setHere(path);
        setTrail(crumbs);
        setRows(node.children.map((child) => browseRow(child, [...crumbs.map((c) => c.label), node.label])));
      } catch (error) {
        if (id !== requestId.current) return;
        setFailure(error instanceof Error ? error.message : String(error));
        setRows([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [browseRow, client],
  );

  /**
   * Find the leaves, then ask where each one sits. The hierarchy endpoint takes an
   * entity and answers its path, so the words are matched by `_text_search` first
   * (post_hierarchy_search).
   */
  const search = useCallback(
    async (text: string): Promise<void> => {
      const id = (requestId.current += 1);
      setLoading(true);
      setFailure(null);
      try {
        let types = typeMap(entityTypes);
        const projectId = projectOf(rootPath);
        if (projectId !== null) types = await scopeToProject(schema, types, projectId);
        const found = await client.textSearch(text, types, { size: LEAF_LIMIT, number: 1 });
        const hits = await hydrate(client, found);
        const paths = await Promise.all(
          hits.map((hit) =>
            client
              .hierarchySearch(rootPath, hit.ref)
              .then((answers) => answers[0] ?? null)
              .catch(() => null),
          ),
        );
        if (id !== requestId.current) return;
        setRows(
          paths.flatMap((path, i) => {
            const hit = hits[i];
            // A row the tree has no place for under this root is not a result.
            if (!path || !hit) return [];
            const crumbs = breadcrumb(path);
            return [
              {
                label: crumbs[crumbs.length - 1] as string,
                crumbs: crumbs.slice(0, -1),
                ref: { ...hit.ref, name: path.label },
                path: pathRefs(path.incrementalPath),
                nodePath: path.incrementalPath[path.incrementalPath.length - 1] ?? rootPath,
                hasChildren: false,
                selectable: true,
              },
            ];
          }),
        );
      } catch (error) {
        if (id !== requestId.current) return;
        setFailure(error instanceof Error ? error.message : String(error));
        setRows([]);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    [client, entityTypes, rootPath, schema],
  );

  const setQuery = useCallback(
    (text: string): void => {
      setQueryState(text);
      clearTimeout(timer.current);
      // Bumping the id cancels an answer already in flight for the text just replaced.
      requestId.current += 1;
      setRows([]);
      setLoading(true);
      if (text.trim().length === 0) {
        void browse(here, trail);
        return;
      }
      timer.current = setTimeout(() => void search(text), DEBOUNCE_MS);
    },
    [browse, here, search, trail],
  );

  const drill = useCallback(
    (row: HierarchicalSearchRow): void => {
      if (!row.hasChildren || searching) return;
      void browse(row.nodePath, [...trail, { label: row.label, path: here }]);
    },
    [browse, here, searching, trail],
  );

  const up = useCallback((): void => {
    if (searching || trail.length === 0) return;
    const parent = trail[trail.length - 1];
    if (!parent) return;
    void browse(parent.path, trail.slice(0, -1));
  }, [browse, searching, trail]);

  const activate = useCallback(
    (row: HierarchicalSearchRow): void => {
      if (row.selectable && row.ref) {
        onSelect?.(row.ref, row.path);
        return;
      }
      drill(row);
    },
    [drill, onSelect],
  );

  /**
   * Left and Right walk the tree the way Up and Down walk a level. The row under the
   * cursor is read off the DOM because the command list owns it, and both frameworks
   * mark it the same way.
   */
  const onKeydown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (searching) return;
    if (event.key === 'ArrowLeft' || (event.key === 'Backspace' && query.length === 0)) {
      event.preventDefault();
      up();
      return;
    }
    if (event.key !== 'ArrowRight') return;
    const root = event.currentTarget;
    // cmdk marks an unselected row `data-selected="false"` where bits-ui omits it; `aria-selected` is the same in both.
    const nodePath = root.querySelector('[data-slot="command-item"][aria-selected="true"]')?.getAttribute('data-node-path');
    const item = rows.find((r) => r.nodePath === nodePath);
    if (!item?.hasChildren) return;
    event.preventDefault();
    drill(item);
  };

  useEffect(() => {
    void browse(rootPath, []);
    // Only a new root reopens the tree; drilling calls `browse` itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rootPath, client]);

  return (
    <div data-slot="hierarchical-search" className={cn('w-full', className)}>
      {/* Server-side matching only, so the list never filters what came back. */}
      <Command shouldFilter={false} className="border-border rounded-md border" onKeyDown={onKeydown}>
        <CommandInput value={query} placeholder={placeholder} onValueChange={setQuery} />
        <CommandList data-sg-search-list>
          {failure !== null ? (
            <div
              data-slot="search-error"
              className="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-sm"
            >
              <TriangleAlert aria-hidden="true" className="size-4" />
              <span className="truncate">{failure}</span>
            </div>
          ) : loading && rows.length === 0 ? (
            <div data-slot="search-loading" className="flex flex-col gap-2 p-1" aria-busy="true">
              {[0, 1, 2].map((line) => (
                <div key={line} className="flex items-center gap-2 px-2 py-1.5">
                  <Skeleton className="size-6 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-2.5 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : empty ? (
            <div
              data-slot="search-empty"
              className="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-sm"
            >
              <Search aria-hidden="true" className="size-4" />
              <span>{searching ? 'Nothing matches every word' : 'Nothing below this level'}</span>
            </div>
          ) : (
            <CommandGroup heading={searching ? 'Results' : trail.map((c) => c.label).join(' › ') || 'Tree'}>
              {!searching && trail.length > 0 ? (
                <CommandItem value="up" data-slot="search-up" onSelect={up}>
                  <span className="text-muted-foreground flex size-6 shrink-0 items-center justify-center">
                    <ChevronRight aria-hidden="true" className="size-4 rotate-180" />
                  </span>
                  <span className="text-muted-foreground min-w-0 flex-1 truncate text-sm">Back</span>
                </CommandItem>
              ) : null}
              {rows.map((item) => {
                const Glyph = glyphFor(item);
                return (
                  <CommandItem
                    key={item.nodePath}
                    value={item.nodePath}
                    data-node-path={item.nodePath}
                    data-entity-type={item.ref?.type}
                    data-entity-id={item.ref?.id}
                    data-selectable={item.selectable ? 'true' : 'false'}
                    onSelect={() => activate(item)}
                  >
                    <span className="text-muted-foreground flex size-6 shrink-0 items-center justify-center">
                      <Glyph aria-hidden="true" className="size-4" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span
                        data-slot="search-breadcrumb"
                        className="truncate"
                        title={[...item.crumbs, item.label].join(' › ')}
                      >
                        {item.crumbs.map((crumb, i) => (
                          <Fragment key={i}>
                            <span className="text-muted-foreground">{crumb}</span>
                            <span aria-hidden="true" className="text-muted-foreground">
                              {' › '}
                            </span>
                          </Fragment>
                        ))}
                        <span className="font-medium">
                          {matchRuns(item.label, query).map((part, i) =>
                            part.match ? (
                              <span key={i} className="font-semibold">
                                {part.text}
                              </span>
                            ) : (
                              <Fragment key={i}>{part.text}</Fragment>
                            ),
                          )}
                        </span>
                      </span>
                      <span className="text-muted-foreground truncate text-xs">
                        {item.selectable ? (item.ref?.type ?? '') : 'Group'}
                      </span>
                    </span>
                    {item.hasChildren && !searching ? (
                      <button
                        type="button"
                        data-slot="search-drill"
                        aria-label={`Open ${item.label}`}
                        className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          drill(item);
                        }}
                      >
                        <ChevronRight aria-hidden="true" className="size-4" />
                      </button>
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
