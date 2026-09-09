import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { EntityRef, SgClient, TreeFieldPlan, TreeNode, TreeRow } from '@sg-widgets/core';
import {
  createSchemaService,
  createStatusService,
  createTree,
  hierarchyLoader,
  hierarchySearcher,
  isEmptyValue,
  matchRuns,
  resolveTreeFields,
  TREE_STATUS_FIELDS,
} from '@sg-widgets/core';
import { Check, ChevronRight, CircleAlert, Inbox, Loader, Minus, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { FieldValue } from '@/registry/sg/components/field-value';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { Thumbnail } from '@/registry/sg/components/thumbnail';

type DivProps = Omit<React.HTMLAttributes<HTMLDivElement>, 'children' | 'onSelect' | 'onError'>;

export interface EntityTreeProps extends DivProps {
  /** Reads one level per call. Wrap it in a query cache so a reopened node costs nothing. */
  client: SgClient;
  /** Where the tree starts, `/Project/<id>`. */
  rootPath: string;
  /** Opens the tree down to this path on mount, one level per call. */
  seedPath?: string | string[] | null;
  /** Draws a checkbox per node and reports the checked rows. */
  checkable?: boolean;
  selection?: 'none' | 'single' | 'multiple';
  onCheckedChange?: (rows: EntityRef[]) => void;
  onSelect?: (node: TreeNode) => void;
  onError?: (error: Error) => void;
  /** Shows an input that searches the project and opens the tree onto the hits. */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** How many levels a whole-branch expansion opens. */
  expandDepth?: number;
  /** Field holding the thumbnail URL. `false`, the default here, hides the leading slot. */
  thumbnail?: string | false;
  /** Field shown as the row's label. Falls back to the label the tree answers. */
  labelField?: string;
  /** Field shown under the label. */
  subLabelField?: string;
  /** Muted line under the label, of the caller's own making. Wins over `subLabelField`. */
  subLabel?: (node: TreeNode) => string;
  /** Right-aligned field, drawn by its data type through FieldValue. */
  secondaryField?: string;
  /** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
  secondary?: (node: TreeNode) => string;
  /** Show the schema name beside the label on a node that stands for a type. */
  showCode?: boolean;
  /** Extra fields to request, so a caller's own sub-label or secondary can read them. */
  fields?: string[];
  /** The site the status sprite is served from. */
  siteUrl?: string;
  label?: string;
  maxHeight?: string;
  emptyLabel?: string;
  noMatchLabel?: string;
}

const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm';
const EMPTY_PLAN: TreeFieldPlan = { status: {}, secondary: {}, statuses: null };
const DEBOUNCE_MS = 250;

/** `aria-checked` as a tree row spells it: `mixed` for a part-checked branch. */
function checkedAttr(state: TreeRow['checked']): 'true' | 'false' | 'mixed' {
  return state === 'mixed' ? 'mixed' : state === 'checked' ? 'true' : 'false';
}

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
 * Every row's fields come with its level: one read per type over the ids just returned,
 * so a sub-label or a status costs nothing per row.
 *
 * Searching is two calls a query: `_text_search` matches the words and `hierarchy/_search`
 * says where each hit sits, so the tree opens along every answered path, marks the rows the
 * words found and dims the rest (post_entity_text_search, post_hierarchy_search).
 */
export function EntityTree({
  client,
  rootPath,
  seedPath = null,
  checkable = false,
  selection = 'single',
  onCheckedChange,
  onSelect,
  onError,
  searchable = false,
  searchPlaceholder = 'Search',
  expandDepth = 3,
  thumbnail = false,
  labelField,
  subLabelField,
  subLabel,
  secondaryField,
  secondary,
  showCode = false,
  fields,
  siteUrl,
  label = 'Project hierarchy',
  maxHeight = '24rem',
  emptyLabel = 'Nothing under this project',
  noMatchLabel = 'Nothing matches every word',
  className,
  ...rest
}: EntityTreeProps) {
  const schema = useMemo(() => createSchemaService(client), [client]);
  const statusTable = useMemo(() => createStatusService(client), [client]);

  /** What a level is read under: the status names, the thumbnail and whatever the row shows. */
  const requested = [
    ...TREE_STATUS_FIELDS,
    ...(thumbnail === false ? [] : [thumbnail]),
    ...(labelField ? [labelField] : []),
    ...(subLabelField ? [subLabelField] : []),
    ...(secondaryField && secondaryField !== 'id' ? [secondaryField] : []),
    ...(fields ?? []),
  ].join(',');

  const engine = useMemo(
    () =>
      createTree({
        rootPath,
        selection,
        expandDepth,
        loader: hierarchyLoader(client, { fields: requested.split(',') }),
        searcher: hierarchySearcher(client, rootPath, { schema }),
      }),
    [client, rootPath, selection, expandDepth, requested, schema],
  );

  const snap = useSyncExternalStore(engine.subscribe, engine.snapshot, engine.snapshot);
  const [query, setQuery] = useState('');
  const [plan, setPlan] = useState<TreeFieldPlan>(EMPTY_PLAN);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    void (seedPath ? engine.expandToPath(seedPath) : engine.load());
  }, [engine, seedPath]);

  useEffect(() => {
    if (snap.error) onError?.(snap.error);
    // The callback is the caller's; the error is what moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snap.error]);

  /** The checked set as one string, so the callback fires when it moves and not on every keystroke. */
  const checkedKey = snap.checked.join('|');

  useEffect(() => {
    onCheckedChange?.(engine.checkedRefs());
    // The callback is the caller's; the checked set is what moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine, checkedKey]);

  /* what a row draws with -------------------------------------------------- */

  /** The types on show, as one string so the schema read runs when the set changes and not before. */
  const typeKey = [...new Set(snap.rows.map((row) => row.node.entity?.type).filter((t) => t !== undefined))]
    .sort()
    .join(',');

  useEffect(() => {
    let live = true;
    const types = typeKey.split(',').filter(Boolean);
    void resolveTreeFields(schema, statusTable, types, secondaryField).then((found) => {
      if (live) setPlan(found);
    }, onError);
    return () => {
      live = false;
    };
    // The callback is the caller's; the types on show and the secondary field are what move.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schema, statusTable, typeKey, secondaryField]);

  const hasSubLabel = Boolean(subLabelField || subLabel);
  /** An id is a code, and codes are the mono treatment of `docs/design-rules.md`. */
  const secondaryIsId = secondaryField === 'id';

  function labelOf(node: TreeNode): string {
    const explicit = labelField ? node.values[labelField] : undefined;
    return typeof explicit === 'string' && explicit.length > 0 ? explicit : node.label;
  }

  /** The schema name a folder stands for, which is the only code a tree row has. */
  function codeOf(node: TreeNode): string {
    return showCode && node.ref.kind === 'entity_type' && typeof node.ref.value === 'string' ? node.ref.value : '';
  }

  function subLabelOf(node: TreeNode): string {
    if (subLabel) return subLabel(node);
    if (!subLabelField) return '';
    const raw = node.values[subLabelField];
    return raw === null || raw === undefined ? '' : String(raw);
  }

  function thumbOf(node: TreeNode): string | null {
    if (thumbnail === false) return null;
    const raw = node.values[thumbnail];
    return typeof raw === 'string' ? raw : null;
  }

  function statusOf(node: TreeNode): string {
    const field = node.entity ? plan.status[node.entity.type] : null;
    const code = field ? node.values[field.name] : null;
    return typeof code === 'string' ? code : '';
  }

  function secondaryValue(node: TreeNode): unknown {
    if (!secondaryField) return null;
    return secondaryField === 'id' ? (node.entity?.id ?? null) : node.values[secondaryField];
  }

  function secondaryType(node: TreeNode): string {
    const field = node.entity ? plan.secondary[node.entity.type] : null;
    return field?.dataType ?? (secondaryIsId ? 'number' : 'text');
  }

  /* searching --------------------------------------------------------------- */

  const searchText = snap.search.trim();
  const noMatch = searchText.length > 0 && !snap.searching && snap.matches.length === 0;
  const dimming = searchText.length > 0 && snap.matches.length > 0;

  function search(text: string): void {
    setQuery(text);
    clearTimeout(timer.current);
    if (text.trim().length === 0) {
      void engine.search('');
      return;
    }
    timer.current = setTimeout(() => void engine.search(text), DEBOUNCE_MS);
  }

  function onSearchKeyDown(event: React.KeyboardEvent): void {
    if (event.key !== 'Escape' || query.length === 0) return;
    event.preventDefault();
    event.stopPropagation();
    search('');
  }

  /* interaction ------------------------------------------------------------ */

  /** Alt or Cmd/Ctrl on the chevron opens the whole branch rather than one level. */
  function openBranch(event: React.MouseEvent, row: TreeRow): void {
    event.stopPropagation();
    engine.focus(row.node.path);
    if (event.altKey || event.metaKey || event.ctrlKey) void engine.expandAll(row.node.path, expandDepth);
    else void engine.toggle(row.node.path);
  }

  function activate(row: TreeRow): void {
    engine.focus(row.node.path);
    if (row.node.hasChildren) void engine.toggle(row.node.path);
    else {
      engine.select(row.node.path);
      onSelect?.(row.node);
    }
  }

  function onKeyDown(event: React.KeyboardEvent): void {
    const path = snap.cursor;
    if (!engine.keyDown(event)) return;
    event.preventDefault();
    if (event.key !== 'Enter' || path === null) return;
    const node = engine.node(path);
    if (node && !node.hasChildren) onSelect?.(node);
  }

  const cursor = snap.cursor;
  const moveFocus = useCallback(() => {
    // One tab stop: focus follows the cursor while the tree already holds it.
    const root = rootRef.current;
    if (!cursor || !root || !root.contains(document.activeElement)) return;
    root.querySelector<HTMLElement>(`[data-path="${CSS.escape(cursor)}"]`)?.focus({ preventScroll: true });
  }, [cursor]);

  useEffect(moveFocus, [moveFocus, snap.rows]);

  return (
    <div
      ref={rootRef}
      data-slot="entity-tree"
      className={cn('flex w-full min-w-0 flex-col gap-2', className)}
      {...rest}
    >
      {searchable ? (
        <div className="relative flex items-center">
          <Input
            type="search"
            value={query}
            onChange={(event) => search(event.target.value)}
            onKeyDown={onSearchKeyDown}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            aria-busy={snap.searching ? true : undefined}
            data-slot="entity-tree-search"
            className="pe-8"
          />
          {snap.searching ? (
            <Loader
              aria-hidden="true"
              className="text-muted-foreground pointer-events-none absolute end-2 size-4 motion-safe:animate-spin"
            />
          ) : null}
        </div>
      ) : null}

      <div
        data-slot="entity-tree-scroll"
        style={{ maxHeight }}
        className="border-border w-full overflow-auto rounded-md border p-1"
      >
        {snap.status === 'error' ? (
          <p className={cn(stateClass, 'text-destructive')}>
            <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
            {snap.error?.message}
          </p>
        ) : snap.status === 'loading' || snap.status === 'idle' ? (
          <div className="flex flex-col gap-2 p-1">
            {Array.from({ length: 5 }, (_, index) => (
              <Skeleton key={index} className="h-6 w-full" />
            ))}
          </div>
        ) : snap.rows.length === 0 ? (
          <p className={stateClass}>
            <Inbox aria-hidden="true" className="size-4 shrink-0" />
            {emptyLabel}
          </p>
        ) : noMatch ? (
          <p data-slot="entity-tree-no-match" className={stateClass}>
            <Search aria-hidden="true" className="size-4 shrink-0" />
            {noMatchLabel}
          </p>
        ) : (
          <ul
            role="tree"
            aria-label={label}
            aria-multiselectable={selection === 'multiple' ? true : undefined}
            data-slot="entity-tree-list"
            style={{ '--tree-indent': '1rem' } as React.CSSProperties}
            className="flex flex-col"
            onKeyDown={onKeyDown}
          >
            {snap.rows.map((row) => {
              const node = row.node;
              const name = labelOf(node);
              const code = codeOf(node);
              const sub = subLabelOf(node);
              const status = statusOf(node);
              const custom = secondary ? secondary(node) : '';
              const raw = secondaryValue(node);
              return (
                <li
                  key={node.path}
                  role="none"
                  data-slot="entity-tree-item"
                  style={{ paddingInlineStart: `calc(var(--tree-indent) * ${node.level})` }}
                >
                  {/* The keyboard model lives on the `tree` element, which owns the roving focus. */}
                  <div
                    role="treeitem"
                    data-slot="entity-tree-item-label"
                    data-path={node.path}
                    data-level={node.level}
                    data-state={node.hasChildren ? (row.expanded ? 'open' : 'closed') : undefined}
                    data-selected={row.selected ? 'true' : undefined}
                    aria-level={node.level + 1}
                    aria-expanded={node.hasChildren ? row.expanded : undefined}
                    aria-selected={row.selected}
                    aria-checked={checkable ? checkedAttr(row.checked) : undefined}
                    aria-busy={row.loading ? true : undefined}
                    tabIndex={row.focused ? 0 : -1}
                    onClick={() => activate(row)}
                    className={cn(
                      'focus-visible:ring-ring focus-visible:ring-offset-background flex min-w-0 cursor-default gap-1.5 rounded-md px-2 py-1.5 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
                      hasSubLabel ? 'items-start' : 'items-center',
                      dimming && !row.match && 'text-muted-foreground',
                      row.selected ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/50',
                    )}
                  >
                    {node.hasChildren ? (
                      <span
                        aria-hidden="true"
                        data-slot="entity-tree-chevron"
                        onClick={(event) => openBranch(event, row)}
                        className="flex size-4 shrink-0 items-center justify-center"
                      >
                        {row.loading ? (
                          <Loader aria-hidden="true" className="size-4 shrink-0 motion-safe:animate-spin" />
                        ) : (
                          <ChevronRight
                            aria-hidden="true"
                            className={cn(
                              'text-muted-foreground size-4 shrink-0 transition-transform duration-150 ease-out',
                              row.expanded && 'rotate-90',
                            )}
                          />
                        )}
                      </span>
                    ) : (
                      <span aria-hidden="true" className="size-4 shrink-0" />
                    )}

                    {checkable ? (
                      // The row carries `aria-checked`, so the box itself is chrome and never a second tab stop.
                      <span
                        aria-hidden="true"
                        data-slot="entity-tree-checkbox"
                        onClick={(event) => {
                          event.stopPropagation();
                          engine.focus(node.path);
                          engine.toggleChecked(node.path);
                        }}
                        className={cn(
                          'flex size-4 shrink-0 items-center justify-center rounded-[4px] border transition-colors duration-150 [&>svg]:size-3.5',
                          row.checked === 'unchecked'
                            ? 'border-input'
                            : 'border-primary bg-primary text-primary-foreground',
                        )}
                      >
                        {row.checked === 'checked' ? <Check /> : row.checked === 'mixed' ? <Minus /> : null}
                      </span>
                    ) : null}

                    {thumbnail !== false ? (
                      <span className="flex size-6 shrink-0 items-center">
                        {thumbOf(node) ? <Thumbnail src={thumbOf(node)} aspect="square" size="sm" /> : null}
                      </span>
                    ) : null}

                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span data-slot="entity-tree-label" className="truncate" title={name}>
                          {matchRuns(name, snap.search).map((part, index) =>
                            part.match ? (
                              <span key={index} className="font-semibold">
                                {part.text}
                              </span>
                            ) : (
                              <span key={index}>{part.text}</span>
                            ),
                          )}
                        </span>
                        {code ? (
                          <span
                            data-slot="entity-tree-code"
                            className="text-muted-foreground shrink-0 font-mono text-xs"
                          >
                            {code}
                          </span>
                        ) : null}
                      </span>
                      {sub ? (
                        <span
                          data-slot="entity-tree-sub-label"
                          className="text-muted-foreground truncate text-xs"
                          title={sub}
                        >
                          {sub}
                        </span>
                      ) : null}
                    </span>

                    {status ? (
                      // A tree row is dense, so the status is its icon; the name stays in the badge for a reader.
                      <StatusBadge
                        code={status}
                        status={plan.statuses?.[status] ?? null}
                        field={node.entity ? (plan.status[node.entity.type] ?? null) : null}
                        variant="icon"
                        size="sm"
                        siteUrl={siteUrl}
                        className="shrink-0"
                      />
                    ) : null}

                    {custom ? (
                      <span data-slot="entity-tree-secondary" className="text-muted-foreground shrink-0 text-xs">
                        {custom}
                      </span>
                    ) : secondaryField && !isEmptyValue(raw) ? (
                      <span
                        data-slot="entity-tree-secondary"
                        className={cn(
                          'text-muted-foreground flex shrink-0 items-center text-xs',
                          secondaryIsId && 'font-mono tabular-nums',
                        )}
                      >
                        <FieldValue
                          value={raw}
                          dataType={secondaryType(node)}
                          field={node.entity ? (plan.secondary[node.entity.type] ?? null) : null}
                          statuses={plan.statuses}
                          siteUrl={siteUrl}
                          className="w-auto justify-end text-xs"
                        />
                      </span>
                    ) : null}
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
