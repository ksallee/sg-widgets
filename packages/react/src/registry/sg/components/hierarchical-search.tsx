import type * as React from 'react';
import { useCallback, useEffect, useState } from 'react';
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
  HIERARCHY_LEAF_LIMIT,
  hydrate,
  NO_MATCH_LABEL,
  NO_ROWS_LABEL,
  pathOf,
  pathRefs,
  projectOfPath,
  rowFields,
  scopeToProject,
  searchTypeMap,
} from '@sg-widgets/core';
import { ChevronRight, Folder } from 'lucide-react';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { entityGlyph } from '@/registry/sg/components/entity-glyphs';
import { PickerRow } from '@/registry/sg/components/picker-row';
import type { SearchAnswer, SearchRequest } from '@/registry/sg/components/search-control';
import { SearchControl } from '@/registry/sg/components/search-control';

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

/** One level of the tree, and the levels above it. */
interface Level {
  path: string;
  crumbs: Array<{ label: string; path: string }>;
}

/** Leaf types a drill-down usually ends on. */
export const HIERARCHICAL_SEARCH_TYPES = ['Shot', 'Asset', 'Sequence', 'Task'];

/** A stable empty list, so the default never changes what a callback depends on. */
const EMPTY_FIELDS: string[] = [];

/** A row is addressed by its tree path. */
function nodeKey(row: HierarchicalSearchRow): string {
  return row.nodePath;
}

/** A level is a folder; a row takes its type's own glyph. */
function glyphFor(row: HierarchicalSearchRow) {
  return row.ref ? entityGlyph(row.ref.type) : Folder;
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

  const [query, setQuery] = useState('');
  /** The level being browsed, and the levels above it. */
  const [level, setLevel] = useState<Level>({ path: rootPath, crumbs: [] });

  const searching = query.trim().length > 0;
  const trail = level.crumbs;

  // Only a new root reopens the tree; drilling moves the level itself.
  useEffect(() => {
    setLevel({ path: rootPath, crumbs: [] });
  }, [rootPath]);

  const browseRow = useCallback(
    (node: HierarchyNode, crumbs: string[]): HierarchicalSearchRow => {
      const entity = hierarchyEntity(node.ref);
      const allowed = Object.keys(searchTypeMap(entityTypes));
      return {
        label: node.label,
        crumbs,
        ref: entity ? { ...entity, name: node.label } : null,
        values: {},
        path: pathRefs(node.path),
        nodePath: node.path,
        hasChildren: node.hasChildren,
        selectable: entity !== null && allowed.includes(entity.type),
      };
    },
    [entityTypes],
  );

  /** Open one level of the tree. `children` names the next paths (post_hierarchy_expand). */
  const browse = useCallback(
    async (at: Level): Promise<HierarchicalSearchRow[]> => {
      const node = await context.client.hierarchyExpand(at.path);
      return node.children.map((child) => browseRow(child, [...at.crumbs.map((c) => c.label), node.label]));
    },
    [browseRow, context.client],
  );

  /**
   * Find the leaves, then ask where each one sits. The hierarchy endpoint takes an
   * entity and answers its path, so the words are matched by `_text_search` first
   * (post_hierarchy_search).
   */
  const searchLeaves = useCallback(
    async (text: string): Promise<HierarchicalSearchRow[]> => {
      let types = searchTypeMap(entityTypes);
      const projectId = projectOfPath(rootPath);
      if (projectId !== null) types = await scopeToProject(schema, types, projectId);
      const found = await context.client.textSearch(text, types, { size: HIERARCHY_LEAF_LIMIT, number: 1 });
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
      return paths.flatMap((path, i) => {
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
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.client, entityTypes, rootPath, schema, thumbnail, labelField, subLabelField, secondaryField, showCode, fields],
  );

  const load = useCallback(
    async ({ query: text }: SearchRequest): Promise<SearchAnswer<HierarchicalSearchRow>> => {
      if (text.trim().length === 0) return { items: await browse(level) };
      return { items: await searchLeaves(text) };
    },
    [browse, level, searchLeaves],
  );

  const drill = useCallback(
    (row: HierarchicalSearchRow): void => {
      if (!row.hasChildren || searching) return;
      setLevel((at) => ({ path: row.nodePath, crumbs: [...at.crumbs, { label: row.label, path: at.path }] }));
    },
    [searching],
  );

  const up = useCallback((): void => {
    if (searching) return;
    setLevel((at) => {
      const parent = at.crumbs[at.crumbs.length - 1];
      return parent ? { path: parent.path, crumbs: at.crumbs.slice(0, -1) } : at;
    });
  }, [searching]);

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
  const onKeydown = (event: React.KeyboardEvent<HTMLDivElement>, items: HierarchicalSearchRow[]): void => {
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
    const item = items.find((r) => r.nodePath === nodePath);
    if (!item?.hasChildren) return;
    event.preventDefault();
    drill(item);
  };

  function rows({ items }: { items: HierarchicalSearchRow[] }) {
    return (
      <CommandGroup heading={searching ? 'Results' : trail.map((c) => c.label).join(' › ') || 'Tree'}>
        {!searching && trail.length > 0 ? (
          <CommandItem value="up" data-slot="search-up" onSelect={up}>
            <span className={cn('text-muted-foreground flex shrink-0 items-center justify-center', LEAD[size])}>
              <ChevronRight aria-hidden="true" className={cn('rotate-180', GLYPH[size])} />
            </span>
            <span className={cn('text-muted-foreground min-w-0 flex-1 truncate', TEXT[size])}>Back</span>
          </CommandItem>
        ) : null}
        {items.map((item) => {
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
    );
  }

  return (
    <div ref={ref} data-slot="hierarchical-search" className={cn('w-full', className)} {...rest}>
      <SearchControl<HierarchicalSearchRow>
        load={load}
        query={query}
        onQueryChange={setQuery}
        request={level.path}
        readsEmpty
        commandClass="border-border rounded-lg border"
        onKeyDown={onKeydown}
        placeholder={placeholder}
        emptyLabel={searching ? noMatchLabel : emptyLabel}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        keyOf={nodeKey}
        leadKey={!searching && trail.length > 0 ? 'up' : ''}
        skeletonLead={cn('shrink-0', LEAD[size])}
        rows={rows}
      />
    </div>
  );
}
