import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { EntityRef, EntityRow, PagingMode } from '@sg-widgets/core';
import { cellValue, condition, createEntitySource, nextEnabledIndex, stateLine } from '@sg-widgets/core';
import { CircleAlert, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  COLLECTION_ROOT,
  useCollectionBody,
  useCollectionControl,
} from '@/registry/sg/components/collection-control';
import { CollectionFooter } from '@/registry/sg/components/collection-footer';
import { StateLine } from '@/registry/sg/components/state-line';
import { cn } from '@/lib/utils';
import { createDemoContext } from '../_shared/client';

/** A line of this layout is one shot, so the row height is the line height. */
const ROW_HEIGHT = 37;
const PAGE_SIZES = [8, 16, 32];
const SKELETONS = [0, 1, 2, 3, 4];
const PAGING: Array<{ value: PagingMode; label: string }> = [
  { value: 'pages', label: 'Pages' },
  { value: 'more', label: 'Load more' },
  { value: 'scroll', label: 'Scroll' },
];

const toggle =
  'inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-sm ' +
  'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';
const group = 'flex flex-col gap-2';
const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
const head = 'flex min-w-0 items-center gap-2 border-b border-border bg-muted/50 px-3 py-2 text-xs font-medium';
const rowClass =
  'flex min-w-0 items-center gap-2 px-3 py-2 text-sm outline-none transition-colors duration-150 ' +
  'hover:bg-accent/50 focus-visible:ring-ring focus-visible:ring-offset-background focus-visible:ring-2 focus-visible:ring-offset-2';

const codeOf = (row: EntityRow): string => String(cellValue(row, 'code') ?? '');
const statusOf = (row: EntityRow): string => String(cellValue(row, 'sg_status_list') ?? '');

export default function CollectionControlDemo() {
  const context = useMemo(() => createDemoContext(), []);
  // The mock's rows are one project's already; a real site's are not.
  const filters = useMemo(
    () => (context.live ? condition('project', 'is', { type: 'Project', id: context.projectId }) : null),
    [context],
  );
  const source = useMemo(
    () =>
      createEntitySource({
        client: context.client,
        entityType: 'Shot',
        fields: ['code', 'sg_status_list'],
        filters,
        mode: 'pages',
        pageSize: 8,
      }),
    [context, filters],
  );
  useEffect(() => {
    void source.count();
  }, [source]);

  const [paging, setPaging] = useState<PagingMode>('pages');
  const [selected, setSelected] = useState<EntityRef[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  const control = useCollectionControl({
    source,
    paging,
    selection: selected,
    onSelectionChange: setSelected,
  });

  const rows = control.rows;
  const snapshot = control.snapshot;
  const view = control.view(rows.length);
  const loadingText = control.loadingText;

  const body = useCollectionBody(control, {
    lines: rows.length,
    measured: rows.length,
    lineHeight: ROW_HEIGHT,
    overscan: 6,
    // One page of shots is short enough to draw whole; the virtualiser idles here.
    virtualizeAfter: 200,
    lineOfRow: (index) => index,
    lastRowOfLine: (line) => line,
    cursorTarget: (index) => listRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`),
  });

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>): void {
    const target = event.target as HTMLElement | null;
    if (!target || target !== target.closest('[data-index]')) return;
    const index = Number(target.dataset['index']);
    if (!Number.isInteger(index)) return;
    const row = rows[index];
    switch (event.key) {
      case 'ArrowDown':
        if (!body.askForPage(index + 1)) {
          body.focusRow(nextEnabledIndex(rows.length, index, 1, control.disabledAt));
        }
        break;
      case 'ArrowUp':
        body.focusRow(nextEnabledIndex(rows.length, index, -1, control.disabledAt));
        break;
      case ' ':
        if (row) control.toggle(row);
        break;
      default:
        return;
    }
    event.preventDefault();
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <section className={group} data-demo-case="paging">
        <h4 className={label}>How the set is walked</h4>
        <div className="flex flex-wrap items-center gap-2">
          {PAGING.map((mode) => (
            <button
              key={mode.value}
              type="button"
              className={toggle}
              aria-pressed={paging === mode.value}
              onClick={() => setPaging(mode.value)}
            >
              {mode.label}
            </button>
          ))}
          <span className="text-muted-foreground text-xs tabular-nums" data-demo="selection">
            {selected.length} selected
          </span>
        </div>
      </section>

      <div data-slot="review-queue" className={COLLECTION_ROOT} data-demo-case="collection">
        <div
          data-slot="review-queue-box"
          className="flex w-full min-w-0 flex-col overflow-hidden rounded-lg border border-border"
        >
          <div data-slot="review-queue-head" className={head}>
            <Checkbox
              aria-label="Select all loaded rows"
              checked={control.allSelected.all}
              indeterminate={control.allSelected.some && !control.allSelected.all}
              onCheckedChange={(value) => control.toggleAll(value === true)}
              className="shrink-0"
            />
            <span className="min-w-0 flex-1 truncate">Shot</span>
            <span className="text-muted-foreground shrink-0">Status</span>
          </div>
          <div
            ref={body.scrollRef}
            data-slot="review-queue-scroll"
            className="flex w-full min-w-0 flex-col overflow-auto"
            style={{ maxHeight: '18rem' }}
          >
            {view === 'error' ? (
              <StateLine
                state="error"
                pad="table"
                icon={CircleAlert}
                label={stateLine('error', {}, snapshot.error?.message)}
              />
            ) : view === 'loading' ? (
              <div aria-busy="true" aria-label={loadingText} className="flex flex-col">
                {SKELETONS.map((line) => (
                  <div key={line} className="flex items-center gap-2 px-3 py-2">
                    <Skeleton className="size-4 shrink-0" />
                    <Skeleton className="h-4 w-40" />
                  </div>
                ))}
              </div>
            ) : view === 'empty' ? (
              <StateLine state="empty" pad="table" icon={Inbox} label="No shots" />
            ) : (
              <>
                <div
                  ref={listRef}
                  data-slot="review-queue-rows"
                  role="listbox"
                  aria-multiselectable={true}
                  aria-label="Shots"
                  tabIndex={-1}
                  className="flex flex-col"
                  onKeyDown={onKeyDown}
                >
                  {rows.map((entry, index) => {
                    const key = control.rowId(entry);
                    const chosen = control.isSelected(entry);
                    return (
                      <div
                        key={key}
                        data-slot="review-queue-row"
                        role="option"
                        aria-selected={chosen}
                        data-row-key={key}
                        data-index={index}
                        tabIndex={index === body.active ? 0 : -1}
                        className={cn(rowClass, chosen && 'bg-accent text-accent-foreground')}
                        onFocus={() => body.setCursor(index)}
                      >
                        <Checkbox
                          aria-label={`Select ${codeOf(entry)}`}
                          checked={chosen}
                          onCheckedChange={() => control.toggle(entry)}
                          className="shrink-0"
                        />
                        <span className="min-w-0 flex-1 truncate" title={codeOf(entry)}>
                          {codeOf(entry)}
                        </span>
                        <span className="text-muted-foreground shrink-0 text-xs">{statusOf(entry)}</span>
                      </div>
                    );
                  })}
                </div>
                {control.bottom === 'error' ? (
                  <StateLine
                    state="error"
                    slotName="review-queue-page-error"
                    pad="none"
                    icon={CircleAlert}
                    label={stateLine('error', {}, snapshot.error?.message)}
                  >
                    <Button variant="outline" size="sm" onClick={() => control.retry()}>
                      Retry
                    </Button>
                  </StateLine>
                ) : control.bottom === 'loading' ? (
                  <div
                    data-slot="review-queue-loading"
                    aria-busy="true"
                    aria-label={loadingText}
                    className="px-3 py-2"
                  >
                    <Skeleton className="h-4 w-40" />
                  </div>
                ) : control.bottom === 'more' ? (
                  <div data-slot="review-queue-load-more" className="flex justify-center p-2">
                    <Button variant="outline" size="sm" onClick={() => void source.loadMore()}>
                      Load more
                    </Button>
                  </div>
                ) : control.bottom === 'sentinel' ? (
                  <div ref={body.setSentinel} data-slot="review-queue-sentinel" aria-hidden="true" className="h-4" />
                ) : null}
              </>
            )}
          </div>
        </div>
        <CollectionFooter
          source={source}
          pager={control.pager}
          pageSizes={PAGE_SIZES}
          loading={snapshot.status === 'loading'}
          slotName="review-queue"
        />
      </div>
    </div>
  );
}
