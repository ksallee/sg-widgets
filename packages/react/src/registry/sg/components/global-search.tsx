import type * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { EntityRef, FieldSpec, PickerRow as PickerRowData, SearchHit, SgContext, WireCondition } from '@sg-widgets/core';
import {
  hydrate,
  NO_MATCH_LABEL,
  pathOf,
  placeholderName,
  rowFields,
  scopeToProject,
  stateLine,
} from '@sg-widgets/core';
import { Search, TriangleAlert } from 'lucide-react';
import {
  Command,
  CommandDialog,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { PickerRow } from '@/registry/sg/components/picker-row';
import { StateLine } from '@/registry/sg/components/state-line';

/** Types to search, either bare names or names with a filter each. */
export type GlobalSearchTypes = string[] | Record<string, WireCondition[] | null>;

/** One heading and the rows under it. */
export interface GlobalSearchGroup {
  type: string;
  label: string;
  hits: SearchHit[];
}

/** Types a stock site searches over. A caller with custom entities passes its own. */
export const GLOBAL_SEARCH_TYPES = ['Asset', 'Shot', 'Sequence', 'Task', 'Version', 'HumanUser', 'Project'];

/** Long enough that a typist does not fire a request a letter, short enough to feel live. */
const DEBOUNCE_MS = 250;

/** A stable empty list, so the default never changes what a memo depends on. */
const EMPTY_FIELDS: string[] = [];
/** The endpoint's cap and its default (probe 053). */
const PAGE_SIZE = 25;

/** The modifier the hotkey shows, from the platform the page is on. */
const META =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
    ? '⌘'
    : 'Ctrl';

function typeMap(types: GlobalSearchTypes): Record<string, WireCondition[] | null> {
  return Array.isArray(types) ? Object.fromEntries(types.map((t) => [t, null])) : types;
}

function same(a: EntityRef, b: EntityRef): boolean {
  return a.type === b.type && a.id === b.id;
}

export type GlobalSearchSize = 'sm' | 'md' | 'lg';

/** The trigger follows the input ladder of `docs/design-rules.md`. */
const BOX: Record<GlobalSearchSize, string> = { sm: 'h-8', md: 'h-9', lg: 'h-10' };
const GLYPH: Record<GlobalSearchSize, string> = { sm: 'size-4', md: 'size-4', lg: 'size-5' };
/** A chip inside a row sits one step down the leaf ladder. */
const CHIP: Record<GlobalSearchSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

export interface GlobalSearchProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** The widget context. Every read goes through it, so widgets on a page share one cache. */
  context: SgContext;
  entityTypes?: GlobalSearchTypes;
  /** Scope every searched type that has a `project` field to this project. */
  projectId?: number | null;
  /** Field holding the thumbnail URL. `false` hides the leading slot. */
  thumbnail?: string | false;
  /** Field holding the row label. Defaults to the display-name chain. */
  labelField?: string;
  /** The muted line under the label: a path, or a resolved column. */
  subLabelField?: FieldSpec | null;
  /** The muted line of the caller's own making. Wins over `subLabelField`. */
  subLabel?: (hit: SearchHit) => string;
  /** The right-aligned value: a path, or a resolved column so it renders by type. */
  secondaryField?: FieldSpec | null;
  /** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
  secondary?: (hit: SearchHit) => string;
  /** Show the row's `code` beside the label when the two differ. */
  showCode?: boolean;
  /** Extra fields to request, so a caller's own sub-label or secondary can read them. */
  fields?: string[];
  /** Opens the palette on Cmd/Ctrl+K. Ignored on the inline variant. */
  hotkey?: boolean;
  /** Render as a combobox in the page instead of a dialog behind a trigger. */
  inline?: boolean;
  size?: GlobalSearchSize;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Rows picked before, newest first. Held by the caller: persisting them is the app's job. */
  recents?: EntityRef[];
  /** How many recents to keep when a pick is prepended. */
  recentLimit?: number;
  onRecentsChange?: (recents: EntityRef[]) => void;
  onSelect?: (entity: EntityRef) => void;
  placeholder?: string;
  /** Shown when the query matches nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
  /** Text on the trigger. */
  label?: string;
  className?: string;
  /** Replaces the trigger button. Call `open()` from inside it. */
  trigger?: (props: { open: () => void }) => React.ReactNode;
}

/**
 * Search across the site, as a command palette.
 *
 * One `_text_search` covers every configured type at once and every word of the query
 * has to match, each as a case-insensitive substring of the row's name or of the name
 * of the row it links to (probe 053). That endpoint has no `fields` parameter, so the
 * thumbnail and the project on each row are a second read of the page just returned.
 * Matching is the server's alone: the command list never filters.
 */
export function GlobalSearch({
  context,
  entityTypes = GLOBAL_SEARCH_TYPES,
  projectId = null,
  thumbnail = 'image',
  labelField,
  subLabelField = null,
  subLabel,
  secondaryField = null,
  secondary,
  showCode = false,
  fields = EMPTY_FIELDS,
  hotkey = false,
  inline = false,
  size = 'md',
  open: openProp,
  onOpenChange,
  recents = [],
  recentLimit = 5,
  onRecentsChange,
  onSelect,
  placeholder = 'Search…',
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
  label = 'Search',
  className,
  trigger,
  ref,
  ...rest
}: GlobalSearchProps) {
  const schema = context.schema;

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = useCallback(
    (next: boolean) => {
      setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [onOpenChange],
  );

  const [query, setQueryState] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

  /** An answer whose id is no longer the current one lost the race and is dropped. */
  const requestId = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    let live = true;
    void schema
      .entityTypes()
      .then((types) => {
        // A heading falls back to the schema name, which is always readable.
        if (live) setDisplayNames(Object.fromEntries(types.map((t) => [t.name, t.displayName])));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [schema]);

  const order = useMemo(() => Object.keys(typeMap(entityTypes)), [entityTypes]);

  const groups = useMemo((): GlobalSearchGroup[] => {
    const byType = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const list = byType.get(hit.ref.type);
      if (list) list.push(hit);
      else byType.set(hit.ref.type, [hit]);
    }
    return order
      .filter((type) => byType.has(type))
      .map((type) => ({ type, label: displayNames[type] ?? type, hits: byType.get(type) as SearchHit[] }));
  }, [hits, order, displayNames]);

  const showRecents = query.trim().length === 0 && recents.length > 0;
  const empty = !loading && failure === null && groups.length === 0 && query.trim().length > 0;

  const run = useCallback(
    async (text: string, nextPage: number): Promise<void> => {
      const id = (requestId.current += 1);
      setLoading(true);
      setFailure(null);
      try {
        let types = typeMap(entityTypes);
        if (projectId !== null && projectId !== undefined) types = await scopeToProject(schema, types, projectId);
        const rows = await context.client.textSearch(text, types, { size: PAGE_SIZE, number: nextPage });
        const found = await hydrate(context.client, rows, {
          fields: rowFields({ thumbnail, labelField, subLabelField, secondaryField, showCode, fields }),
          labelField,
        });
        if (id !== requestId.current) return;
        setHits((current) => (nextPage === 1 ? found : [...current, ...found]));
        setPage(nextPage);
        // The answer carries no `links`, so a full page is the only sign of another one (probe 006).
        setHasMore(rows.length === PAGE_SIZE);
      } catch (error) {
        if (id !== requestId.current) return;
        setFailure(error instanceof Error ? error.message : String(error));
        setHits([]);
        setHasMore(false);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.client, entityTypes, projectId, schema, thumbnail, labelField, subLabelField, secondaryField, showCode, fields],
  );

  const setQuery = useCallback(
    (text: string): void => {
      setQueryState(text);
      clearTimeout(timer.current);
      // Bumping the id here is the cancellation: a request already in flight for the
      // text just replaced can no longer write its answer.
      requestId.current += 1;
      setHits([]);
      setHasMore(false);
      if (text.trim().length === 0) {
        setLoading(false);
        return;
      }
      setLoading(true);
      timer.current = setTimeout(() => void run(text, 1), DEBOUNCE_MS);
    },
    [run],
  );

  const choose = useCallback(
    (entity: EntityRef): void => {
      onRecentsChange?.([entity, ...recents.filter((r) => !same(r, entity))].slice(0, recentLimit));
      onSelect?.(entity);
      if (!inline) setOpen(false);
      setQuery('');
    },
    [inline, onRecentsChange, onSelect, recentLimit, recents, setOpen, setQuery],
  );

  useEffect(() => {
    if (!hotkey || inline) return;
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== 'k' || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen(!open);
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [hotkey, inline, open, setOpen]);

  /** The row a hit draws as: the reference, its label and the values the second read answered. */
  function rowOf(hit: SearchHit): PickerRowData {
    return {
      type: hit.ref.type,
      id: hit.ref.id,
      name: hit.ref.name || placeholderName(hit.ref),
      values: hit.values,
    };
  }

  /**
   * The muted line under the label. With no field and no function of the caller's,
   * it is where the row sits: its project, else the row `_text_search` also matched
   * the words against, else the type.
   */
  function subLabelOf(hit: SearchHit): string | undefined {
    if (subLabel) return subLabel(hit);
    if (pathOf(subLabelField)) return undefined;
    if (hit.project?.name) return hit.project.name;
    if (hit.link) return `${displayNames[hit.link.type] ?? hit.link.type} ${hit.link.name}`;
    return displayNames[hit.ref.type] ?? hit.ref.type;
  }

  function row(hit: SearchHit) {
    return (
      <PickerRow
        row={rowOf(hit)}
        query={query}
        thumbnail={thumbnail}
        showCode={showCode}
        subLabelField={subLabelField}
        subLabel={subLabelOf(hit)}
        secondaryField={secondaryField}
        secondary={secondary ? secondary(hit) : undefined}
        size={size}
        context={context}
      />
    );
  }

  const body = (
    <>
      <CommandInput value={query} placeholder={placeholder} onValueChange={setQuery} />
      <CommandList data-sg-search-list>
        {failure !== null ? (
          <StateLine
            state="error"
            slotName="search-error"
            icon={TriangleAlert}
            label={stateLine('error', { errorLabel }, failure)}
          />
        ) : loading && hits.length === 0 ? (
          <div
            data-slot="search-loading"
            className="flex flex-col gap-2 p-1"
            aria-busy="true"
            aria-label={stateLine('loading', { loadingLabel })}
          >
            {[0, 1, 2].map((line) => (
              <div key={line} className="flex items-center gap-2 px-2 py-1.5">
                <Skeleton className="h-6 w-10 shrink-0" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-2.5 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : empty ? (
          <StateLine state="empty" slotName="search-empty" icon={Search} label={emptyLabel} />
        ) : showRecents ? (
          <CommandGroup heading="Recent">
            {recents.map((entity) => (
              <CommandItem
                key={`${entity.type}:${entity.id}`}
                value={`recent:${entity.type}:${entity.id}`}
                onSelect={() => choose(entity)}
              >
                <EntityChip entity={entity} size={CHIP[size]} context={context} />
                <span className="text-muted-foreground truncate text-xs">
                  {displayNames[entity.type] ?? entity.type}
                </span>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : (
          <>
            {groups.map((group) => (
              <CommandGroup key={group.type} heading={group.label}>
                {group.hits.map((hit) => (
                  <CommandItem
                    key={`${hit.ref.type}:${hit.ref.id}`}
                    value={`${hit.ref.type}:${hit.ref.id}`}
                    data-entity-type={hit.ref.type}
                    data-entity-id={hit.ref.id}
                    onSelect={() => choose(hit.ref)}
                  >
                    {row(hit)}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {hasMore ? (
              <CommandItem
                value="load-more"
                data-slot="search-load-more"
                onSelect={() => void run(query, page + 1)}
              >
                <span className="text-muted-foreground flex-1 text-center text-sm">
                  {loading ? 'Loading…' : 'Load more'}
                </span>
              </CommandItem>
            ) : null}
          </>
        )}
      </CommandList>
    </>
  );

  if (inline) {
    return (
      <div
        ref={ref}
        data-slot="global-search"
        data-variant="inline"
        className={cn('w-full', className)}
        {...rest}
      >
        {/* Server-side matching only, so the list never filters what came back. */}
        <Command shouldFilter={false} className="border-border rounded-md border">
          {body}
        </Command>
      </div>
    );
  }

  return (
    <div
      ref={ref}
      data-slot="global-search"
      data-variant="dialog"
      className={cn('w-full', className)}
      {...rest}
    >
      {trigger ? (
        trigger({ open: () => setOpen(true) })
      ) : (
        <Button
          variant="outline"
          data-slot="global-search-trigger"
          data-size={size}
          className={cn('w-full justify-between', BOX[size])}
          onClick={() => setOpen(true)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Search aria-hidden="true" className={cn('opacity-70', GLYPH[size])} />
            <span className="truncate">{label}</span>
          </span>
          {hotkey ? <Kbd>{META}K</Kbd> : null}
        </Button>
      )}
      <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search across the site by name.">
        <Command shouldFilter={false}>{body}</Command>
      </CommandDialog>
    </div>
  );
}
