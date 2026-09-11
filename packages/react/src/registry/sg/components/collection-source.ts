/**
 * The binding between a collection and the source behind it.
 *
 * The table, the grid and the grouped list each hold a source, follow its
 * snapshot, load it when it is idle, keep its mode on the `paging` prop and
 * mirror its sort and its filter out through `onSortChange` and
 * `onFiltersChange`. That is one model, so it lives here and each widget keeps
 * only what it draws.
 */
import { useCallback, useEffect, useRef, useSyncExternalStore } from 'react';
import type { EntitySource, PagingMode, SortSpec, SourceFilters } from '@sg-widgets/core';
import { sameFilters, sameSort, sourceModeFor } from '@sg-widgets/core';

/** The latest value, for an effect that must read it without depending on it. */
export function useLatest<T>(value: T): { current: T } {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

/** The value a source publishes, as the render reads it. */
export type SourceSnapshot = ReturnType<EntitySource['snapshot']>;

export interface CollectionSourceOptions {
  source: EntitySource;
  /** How the set is walked. The source follows it rather than the other way round. */
  paging: PagingMode;
  sort?: SortSpec[];
  onSortChange?: (sort: SortSpec[]) => void;
  filters?: SourceFilters;
  onFiltersChange?: (filters: SourceFilters) => void;
}

export interface CollectionSource {
  /** The last snapshot the source published. */
  snapshot: SourceSnapshot;
  /** Read the page that failed again: the one a pager is on, or the one that was appended. */
  retry: () => void;
}

export function useCollectionSource({
  source,
  paging,
  sort,
  onSortChange,
  filters,
  onFiltersChange,
}: CollectionSourceOptions): CollectionSource {
  const snapshot = useSyncExternalStore(
    useCallback((listener: () => void) => source.subscribe(listener), [source]),
    () => source.snapshot(),
    () => source.snapshot(),
  );

  useEffect(() => {
    if (source.status === 'idle') void source.load();
  }, [source]);
  useEffect(() => {
    // Setting a mode the source already holds is a no-op.
    void source.setMode(sourceModeFor(paging));
  }, [source, paging]);

  /*
   * Each pair is one effect into the source and one out of it, and the out one
   * reads the prop off a ref, so a change travels once and the two never write to
   * each other.
   */
  const sortLatest = useLatest(sort);
  useEffect(() => {
    if (sort === undefined || sameSort(sort, source.sort)) return;
    void source.setSort([...sort]);
  }, [source, sort]);
  useEffect(() => {
    if (sortLatest.current !== undefined && sameSort(snapshot.sort, sortLatest.current)) return;
    onSortChange?.([...snapshot.sort]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.sort]);

  const filtersLatest = useLatest(filters);
  useEffect(() => {
    if (filters === undefined || sameFilters(filters, source.filters)) return;
    void source.setFilters(filters);
  }, [source, filters]);
  useEffect(() => {
    if (filtersLatest.current !== undefined && sameFilters(snapshot.filters, filtersLatest.current)) return;
    onFiltersChange?.(snapshot.filters);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot.filters]);

  return {
    snapshot,
    retry: (): void => {
      if (paging === 'pages') void source.setPage(snapshot.page);
      else void source.loadMore();
    },
  };
}
