import type * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type {
  EntityRef,
  FieldSpec,
  HierarchyNode,
  PickerRow as PickerRowData,
  SgContext,
  WireCondition,
} from '@sg-widgets/core';
import {
  breadcrumb,
  hierarchyEntity,
  hydrate,
  NO_MATCH_LABEL,
  NO_ROWS_LABEL,
  pathOf,
  pathRefs,
  rowFields,
  scopeToProject,
  stateLine,
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
import { PickerRow } from '@/registry/sg/components/picker-row';
import { StateLine } from '@/registry/sg/components/state-line';

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
  /** The fields a search read for the row. Empty on a folder, which is not an entity. */
  values: Record<string, unknown>;
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

/** A stable empty list, so the default never changes what a callback depends on. */
const EMPTY_FIELDS: string[] = [];

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

export type HierarchicalSearchSize = 'sm' | 'md' | 'lg';

/** A row's leading slot and its glyph, on the leaf ladder of `docs/design-rules.md`. */
const LEAD: Record<HierarchicalSearchSize, string> = { sm: 'size-5', md: 'size-6', lg: 'size-8' };
const GLYPH: Record<HierarchicalSearchSize, string> = {
  sm: 'size-3.5',
  md: 'size-4',
  lg: 'size-5',
};
const TEXT: Record<HierarchicalSearchSize, string> = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
};

export interface HierarchicalSearchProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** The widget context. Every read goes through it, so widgets on a page share one cache. */
  context: SgContext;
  /** Where the tree starts, `/Project/<id>` for one project or `/` for the site. */
  rootPath?: string;
  /** Types a search may end on. Browsing reaches every level whatever this says. */
  entityTypes?: HierarchicalSearchTypes;
  /** Field holding the thumbnail URL. `false` leaves every row on its type glyph. */
  thumbnail?: string | false;
  /** Field holding the row label. Defaults to the label the tree answers. */
  labelField?: string;
  /** The muted line under the label: a path, or a resolved column. */
  subLabelField?: FieldSpec | null;
  /** The muted line of the caller's own making. Wins over `subLabelField`. */
  subLabel?: (row: HierarchicalSearchRow) => string;
  /** The right-aligned value: a path, or a resolved column so it renders by type. */
  secondaryField?: FieldSpec | null;
  /** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
  secondary?: (row: HierarchicalSearchRow) => string;
  /** Show the row's `code` beside the label when the two differ. */
  showCode?: boolean;
  /** Extra fields to request, so a caller's own sub-label or secondary can read them. */
  fields?: string[];
  onSelect?: (entity: EntityRef, path: EntityRef[]) => void;
  placeholder?: string;
  /** Shown when a level holds nothing. */
  emptyLabel?: string;
  /** Shown when the query matches nothing. */
  noMatchLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
  size?: HierarchicalSearchSize;
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
  context,
  rootPath = '/',
  entityTypes = HIERARCHICAL_SEARCH_TYPES,
  thumbnail = 'image',
  labelField,
  subLabelField = null,
  subLabel,
  secondaryField = null,
  secondary,
  showCode = false,
  fields = EMPTY_FIELDS,
  onSelect,
  placeholder = 'Search the hierarchy…',
  emptyLabel = NO_ROWS_LABEL,
  noMatchLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
  size = 'md',
  className,
  ref,
  ...rest
}: HierarchicalSearchProps) {
  const schema = context.schema;

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
        values: {},
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
        const node = await context.client.hierarchyExpand(path);
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
    [browseRow, context.client],
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
        const found = await context.client.textSearch(text, types, { size: LEAF_LIMIT, number: 1 });
        const hits = await hydrate(context.client, found, {
          fields: rowFields({ thumbnail, labelField, subLabelField, secondaryField, showCode, fields }),
          labelField,
        });
        const paths = await Promise.all(
          hits.map((hit) =>
            context.client
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
            // The tree's own label names the row, unless the caller named a field.
            const own = (labelField ? hit.ref.name : '') || (crumbs[crumbs.length - 1] as string);
            return [
              {
                label: own,
                crumbs: crumbs.slice(0, -1),
                ref: { ...hit.ref, name: path.label },
                values: hit.values,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.client, entityTypes, rootPath, schema, thumbnail, labelField, subLabelField, secondaryField, showCode, fields],
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

  /** The row a list entry draws as: the reference it stands for and what a search read. */
  function rowOf(item: HierarchicalSearchRow): PickerRowData {
    return {
      type: item.ref?.type ?? '',
      id: item.ref?.id ?? 0,
      name: item.label,
      values: item.values,
    };
  }

  /**
   * The muted line under the label. With no field and no function of the caller's,
   * it says what the row is: its type, or that it is a level rather than a row.
   */
  function subLabelOf(item: HierarchicalSearchRow): string | undefined {
    if (subLabel) return subLabel(item);
    if (pathOf(subLabelField)) return undefined;
    return item.selectable ? (item.ref?.type ?? '') : 'Group';
  }

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
  }, [rootPath, context.client]);

  return (
    <div ref={ref} data-slot="hierarchical-search" className={cn('w-full', className)} {...rest}>
      {/* Server-side matching only, so the list never filters what came back. */}
      <Command shouldFilter={false} className="border-border rounded-md border" onKeyDown={onKeydown}>
        <CommandInput value={query} placeholder={placeholder} onValueChange={setQuery} />
        <CommandList data-sg-search-list>
          {failure !== null ? (
            <StateLine
              state="error"
              slotName="search-error"
              icon={TriangleAlert}
              label={stateLine('error', { errorLabel }, failure)}
            />
          ) : loading && rows.length === 0 ? (
            <div
              data-slot="search-loading"
              className="flex flex-col gap-2 p-1"
              aria-busy="true"
              aria-label={stateLine('loading', { loadingLabel })}
            >
              {[0, 1, 2].map((line) => (
                <div key={line} className="flex items-center gap-2 px-2 py-1.5">
                  <Skeleton className={cn('shrink-0', LEAD[size])} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Skeleton className="h-3 w-1/2" />
                    <Skeleton className="h-2.5 w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : empty ? (
            <StateLine
              state="empty"
              slotName="search-empty"
              icon={Search}
              label={searching ? noMatchLabel : emptyLabel}
            />
          ) : (
            <CommandGroup heading={searching ? 'Results' : trail.map((c) => c.label).join(' › ') || 'Tree'}>
              {!searching && trail.length > 0 ? (
                <CommandItem value="up" data-slot="search-up" onSelect={up}>
                  <span
                    className={cn(
                      'text-muted-foreground flex shrink-0 items-center justify-center',
                      LEAD[size],
                    )}
                  >
                    <ChevronRight aria-hidden="true" className={cn('rotate-180', GLYPH[size])} />
                  </span>
                  <span className={cn('text-muted-foreground min-w-0 flex-1 truncate', TEXT[size])}>
                    Back
                  </span>
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
                    <PickerRow
                      row={rowOf(item)}
                      query={query}
                      crumbs={item.crumbs}
                      thumbnail={thumbnail}
                      showCode={showCode}
                      subLabelField={subLabelField}
                      subLabel={subLabelOf(item)}
                      secondaryField={secondaryField}
                      secondary={secondary ? secondary(item) : undefined}
                      size={size}
                      context={context}
                      glyph={<Glyph aria-hidden="true" className={GLYPH[size]} />}
                    />
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
                        <ChevronRight aria-hidden="true" className={GLYPH[size]} />
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
