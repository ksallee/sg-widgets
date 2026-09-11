import type * as React from 'react';
import type { ReactNode } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { RequestGate } from '@sg-widgets/core';
import { errorText, NO_MATCH_LABEL, queryPlan, requestGate, SEARCH_DEBOUNCE_MS, searchView, stateLine } from '@sg-widgets/core';
import { Search, TriangleAlert } from 'lucide-react';
import { Command, CommandDialog, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { SearchSkeleton } from '@/registry/sg/components/search-skeleton';
import { StateLine } from '@/registry/sg/components/state-line';

/** What a read answers: the rows it found and whether a further page may be there. */
export interface SearchAnswer<T> {
  items: T[];
  hasMore?: boolean;
}

/** What a read is asked for: the query as it stands and the page wanted. */
export interface SearchRequest {
  query: string;
  page: number;
}

/** The shell around the list: a command box, a command dialog, or nothing at all. */
export type SearchShell = 'command' | 'dialog' | 'bare';

export interface SearchControlProps<T> {
  /** The read behind the list. */
  load: (request: SearchRequest) => Promise<SearchAnswer<T>>;
  /** What the caret holds. */
  query?: string;
  onQueryChange?: (query: string) => void;
  /** What the read depends on besides the query. A change reads again at once. */
  request?: string;
  /** Nothing is read while this is off. */
  enabled?: boolean;
  /** An empty query reads too, rather than emptying the list. */
  readsEmpty?: boolean;
  /** A further page is asked for on a load-more row under the rows. */
  paging?: boolean;
  /** The pause before a typed query is asked for. */
  debounceMs?: number;
  /** A row's key, which is what the list and the highlight are addressed by. */
  keyOf?: (item: T) => string;
  /** The row the highlight lands on ahead of the first result, if any. */
  leadKey?: string;
  shell?: SearchShell;
  /** Classes on the command box. */
  commandClass?: string;
  /** Keys the wrapper owns, on the command box, with the rows they act on. */
  onKeyDown?: (event: React.KeyboardEvent<HTMLDivElement>, items: T[]) => void;
  /** Whether the dialog is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The dialog's accessible name, and the line under it. */
  title?: string;
  description?: string;
  placeholder?: string;
  /** Shown when the read answered nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
  /** The `data-slot` each block carries. `null` leaves it unnamed. */
  errorSlot?: string | null;
  loadingSlot?: string | null;
  emptySlot?: string | null;
  /** The shape of the skeletons: how many rows, and the leading slot of each. */
  skeletonLines?: number;
  skeletonLead?: string;
  /** The rows the read answered. */
  rows: (state: { items: T[]; query: string; loading: boolean }) => ReactNode;
  /** Drawn in place of the empty line. */
  empty?: ReactNode;
}

/**
 * The query lifecycle and the list every search widget in this registry wears.
 *
 * The debounce, the ticket that drops an answer the next query replaced, the page and
 * its load-more row, the highlight across a page, and the list itself: the error line,
 * the skeletons, the empty line and the rows. A wrapper supplies the read behind it
 * and draws its own rows.
 */
export function SearchControl<T>({
  load,
  query = '',
  onQueryChange,
  request = '',
  enabled = true,
  readsEmpty = false,
  paging = false,
  debounceMs = SEARCH_DEBOUNCE_MS,
  keyOf,
  leadKey = '',
  shell = 'command',
  commandClass,
  onKeyDown,
  open = false,
  onOpenChange,
  title = 'Search',
  description,
  placeholder = 'Search…',
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
  errorSlot = 'search-error',
  loadingSlot = 'search-loading',
  emptySlot = 'search-empty',
  skeletonLines,
  skeletonLead,
  rows,
  empty,
}: SearchControlProps<T>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  /** True from the first frame where a read is already on its way, so nothing flashes empty. */
  const [loading, setLoading] = useState(() => enabled && queryPlan(query, readsEmpty) !== 'clear');
  /** The highlighted row. cmdk owns it between pages; a new page moves it to its first row. */
  const [cursor, setCursor] = useState('');

  const [gate] = useState<RequestGate>(() => requestGate());
  const loadRef = useRef(load);
  loadRef.current = load;
  const keyOfRef = useRef(keyOf);
  keyOfRef.current = keyOf;

  const run = useCallback(
    async (text: string, nextPage: number): Promise<void> => {
      const ticket = gate.next();
      setLoading(true);
      setFailure(null);
      try {
        const answer = await loadRef.current({ query: text, page: nextPage });
        if (!gate.holds(ticket)) return;
        setItems((current) => (nextPage === 1 ? answer.items : [...current, ...answer.items]));
        setPage(nextPage);
        setHasMore(answer.hasMore ?? false);
        const lead = nextPage > 1 ? answer.items[0] : undefined;
        // A page lands under the row that asked for it: the highlight moves to its first
        // row, so the list stays where the reader was instead of returning to the top.
        const key = keyOfRef.current;
        if (lead !== undefined && key) setCursor(key(lead));
      } catch (error) {
        if (!gate.holds(ticket)) return;
        setFailure(errorText(error));
        setItems([]);
        setHasMore(false);
      } finally {
        if (gate.holds(ticket)) setLoading(false);
      }
    },
    [gate],
  );

  // Empty the list and ask again, at once or once the pause has elapsed. Taking the
  // next ticket is the cancellation: a read already in flight for what has just been
  // replaced can no longer write its answer.
  useEffect(() => {
    gate.cancel();
    setItems([]);
    setPage(1);
    setHasMore(false);
    if (!enabled) {
      setLoading(false);
      return;
    }
    const plan = queryPlan(query, readsEmpty);
    if (plan === 'clear') {
      setLoading(false);
      return;
    }
    setLoading(true);
    if (plan === 'now') {
      void run(query, 1);
      return;
    }
    const timer = setTimeout(() => void run(query, 1), debounceMs);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, request, enabled]);

  const firstKey = leadKey || (items[0] !== undefined && keyOf ? keyOf(items[0]) : '');
  useEffect(() => {
    setCursor(firstKey);
  }, [firstKey]);

  const view = searchView({
    error: failure,
    loading,
    count: items.length,
    asked: readsEmpty || query.trim().length > 0,
  });

  const body =
    view === 'error' ? (
      <StateLine
        state="error"
        slotName={errorSlot ?? undefined}
        icon={TriangleAlert}
        label={stateLine('error', { errorLabel }, failure)}
      />
    ) : view === 'loading' ? (
      <SearchSkeleton
        slotName={loadingSlot ?? undefined}
        lines={skeletonLines}
        lead={skeletonLead}
        label={stateLine('loading', { loadingLabel })}
      />
    ) : view === 'empty' ? (
      (empty ?? <StateLine state="empty" slotName={emptySlot ?? undefined} icon={Search} label={emptyLabel} />)
    ) : (
      <>
        {rows({ items, query, loading })}
        {paging && hasMore ? (
          <CommandItem value="load-more" data-slot="search-load-more" onSelect={() => void run(query, page + 1)}>
            <span className="text-muted-foreground flex-1 text-center text-sm">
              {loading ? 'Loading…' : 'Load more'}
            </span>
          </CommandItem>
        ) : null}
      </>
    );

  if (shell === 'bare') return body;

  const inside = (
    <>
      <CommandInput value={query} placeholder={placeholder} onValueChange={onQueryChange} />
      <CommandList data-sg-search-list>{body}</CommandList>
    </>
  );

  if (shell === 'dialog') {
    return (
      <CommandDialog open={open} onOpenChange={onOpenChange} title={title} description={description}>
        {/* Server-side matching only, so the list never filters what came back. */}
        <Command shouldFilter={false} value={cursor} onValueChange={setCursor}>
          {inside}
        </Command>
      </CommandDialog>
    );
  }

  return (
    /* Server-side matching only, so the list never filters what came back. */
    <Command
      shouldFilter={false}
      value={cursor}
      onValueChange={setCursor}
      className={commandClass}
      onKeyDown={onKeyDown ? (event) => onKeyDown(event, items) : undefined}
    >
      {inside}
    </Command>
  );
}
