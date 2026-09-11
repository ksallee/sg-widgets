import type * as React from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { EntityRef, FieldSpec, PickerRow as PickerRowData, SearchHit, SgContext, WireCondition } from '@sg-widgets/core';
import {
  hasMorePage,
  hydrate,
  NO_MATCH_LABEL,
  pathOf,
  placeholderName,
  prependRecent,
  rowFields,
  scopeToProject,
  SEARCH_PAGE_SIZE,
  searchTypeMap,
} from '@sg-widgets/core';
import { Search } from 'lucide-react';
import { CommandGroup, CommandItem } from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { cn } from '@/lib/utils';
import { CONTROL_GLYPH, CONTROL_HEIGHT, type ControlSize } from '@/registry/sg/components/control-classes';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { PickerRow } from '@/registry/sg/components/picker-row';
import type { SearchAnswer, SearchRequest } from '@/registry/sg/components/search-control';
import { SearchControl } from '@/registry/sg/components/search-control';

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

/** A stable empty list, so the default never changes what a memo depends on. */
const EMPTY_FIELDS: string[] = [];

/** The modifier the hotkey shows, from the platform the page is on. */
const META =
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/i.test(navigator.platform || navigator.userAgent)
    ? '⌘'
    : 'Ctrl';

function keyOf(ref: EntityRef): string {
  return `${ref.type}:${ref.id}`;
}

function hitKey(hit: SearchHit): string {
  return keyOf(hit.ref);
}

export type GlobalSearchSize = ControlSize;

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
  /** Opens the palette on Cmd or Ctrl and K; a string names another key. */
  hotkey?: boolean | string;
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

  const [query, setQuery] = useState('');
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});

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

  const order = useMemo(() => Object.keys(searchTypeMap(entityTypes)), [entityTypes]);
  const showRecents = query.trim().length === 0 && recents.length > 0;

  /** The rows the answer holds, under one heading per type, in the order asked for. */
  function groupsOf(hits: SearchHit[]): GlobalSearchGroup[] {
    const byType = new Map<string, SearchHit[]>();
    for (const hit of hits) {
      const list = byType.get(hit.ref.type);
      if (list) list.push(hit);
      else byType.set(hit.ref.type, [hit]);
    }
    return order
      .filter((type) => byType.has(type))
      .map((type) => ({ type, label: displayNames[type] ?? type, hits: byType.get(type) as SearchHit[] }));
  }

  const load = useCallback(
    async ({ query: text, page }: SearchRequest): Promise<SearchAnswer<SearchHit>> => {
      let types = searchTypeMap(entityTypes);
      if (projectId !== null && projectId !== undefined) types = await scopeToProject(schema, types, projectId);
      const found = await context.client.textSearch(text, types, { size: SEARCH_PAGE_SIZE, number: page });
      const hits = await hydrate(context.client, found, {
        fields: rowFields({ thumbnail, labelField, subLabelField, secondaryField, showCode, fields }),
        labelField,
      });
      return { items: hits, hasMore: hasMorePage(found.length, SEARCH_PAGE_SIZE) };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.client, entityTypes, projectId, schema, thumbnail, labelField, subLabelField, secondaryField, showCode, fields],
  );

  const choose = useCallback(
    (entity: EntityRef): void => {
      onRecentsChange?.(prependRecent(recents, entity, recentLimit, keyOf));
      onSelect?.(entity);
      if (!inline) setOpen(false);
      setQuery('');
    },
    [inline, onRecentsChange, onSelect, recentLimit, recents, setOpen],
  );

  const hotkeyKey = typeof hotkey === 'string' ? hotkey : 'k';
  useEffect(() => {
    if (!hotkey || inline) return;
    const onKeydown = (event: KeyboardEvent): void => {
      if (event.key.toLowerCase() !== hotkeyKey.toLowerCase() || !(event.metaKey || event.ctrlKey)) return;
      event.preventDefault();
      setOpen(!open);
    };
    window.addEventListener('keydown', onKeydown);
    return () => window.removeEventListener('keydown', onKeydown);
  }, [hotkey, hotkeyKey, inline, open, setOpen]);

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

  function rows({ items }: { items: SearchHit[] }) {
    if (showRecents) {
      return (
        <CommandGroup heading="Recent">
          {recents.map((entity) => (
            <CommandItem key={keyOf(entity)} value={`recent:${keyOf(entity)}`} onSelect={() => choose(entity)}>
              <EntityChip entity={entity} size={CHIP[size]} context={context} />
              <span className="text-muted-foreground truncate text-xs">
                {displayNames[entity.type] ?? entity.type}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
      );
    }
    return groupsOf(items).map((group) => (
      <CommandGroup key={group.type} heading={group.label}>
        {group.hits.map((hit) => (
          <CommandItem
            key={hitKey(hit)}
            value={hitKey(hit)}
            data-entity-type={hit.ref.type}
            data-entity-id={hit.ref.id}
            onSelect={() => choose(hit.ref)}
          >
            {row(hit)}
          </CommandItem>
        ))}
      </CommandGroup>
    ));
  }

  const control = (
    <SearchControl<SearchHit>
      load={load}
      query={query}
      onQueryChange={setQuery}
      shell={inline ? 'command' : 'dialog'}
      commandClass="border-border rounded-lg border"
      open={open}
      onOpenChange={setOpen}
      title="Search"
      description="Search across the site by name."
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      loadingLabel={loadingLabel}
      errorLabel={errorLabel}
      paging
      rows={rows}
    />
  );

  if (inline) {
    return (
      <div ref={ref} data-slot="global-search" data-variant="inline" className={cn('w-full', className)} {...rest}>
        {control}
      </div>
    );
  }

  return (
    <div ref={ref} data-slot="global-search" data-variant="dialog" className={cn('w-full', className)} {...rest}>
      {trigger ? (
        trigger({ open: () => setOpen(true) })
      ) : (
        <Button
          variant="outline"
          data-slot="global-search-trigger"
          data-size={size}
          className={cn('w-full justify-between', CONTROL_HEIGHT[size])}
          onClick={() => setOpen(true)}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            <Search aria-hidden="true" className={cn('opacity-70', CONTROL_GLYPH[size])} />
            <span className="truncate">{label}</span>
          </span>
          {hotkey ? <Kbd>{META}{hotkeyKey.toUpperCase()}</Kbd> : null}
        </Button>
      )}
      {control}
    </div>
  );
}
