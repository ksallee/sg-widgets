import { useState } from 'react';
import type { EntitySource, PageRange } from '@sg-widgets/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';

export interface CollectionFooterProps {
  /** The source the controls drive. */
  source: EntitySource;
  /** The numbers to draw, from core's `describePaging`. */
  pager: PageRange;
  /** The page sizes offered in `pages` mode. */
  pageSizes: number[];
  /** True while the set is being read: the arrows wait for it. */
  loading: boolean;
  /** The widget's own name, which prefixes every `data-slot` here. */
  slotName: string;
}

/**
 * The footer of every collection that pages: the page size, the range and the
 * arrows in `pages`, the loaded count in `more` and `scroll`. The numbers are
 * core's `describePaging`, so the three collections cannot report the set
 * differently.
 */
export function CollectionFooter({ source, pager, pageSizes, loading, slotName }: CollectionFooterProps) {
  /** What the reader has typed, until Enter or a blur takes it. */
  const [pageDraft, setPageDraft] = useState('');

  function goToPage(value: string): void {
    const wanted = Number(value);
    setPageDraft('');
    if (!Number.isFinite(wanted) || wanted < 1) return;
    void source.setPage(pager.pageCount === null ? wanted : Math.min(wanted, pager.pageCount));
  }

  return (
    <div
      data-slot={`${slotName}-footer`}
      className="text-muted-foreground flex w-full min-w-0 flex-wrap items-center justify-between gap-2 text-xs"
    >
      {pager.mode === 'pages' ? (
        <>
          <div data-slot={`${slotName}-page-size`} className="flex items-center gap-2">
            <span>Rows per page</span>
            <Select
              value={String(pager.pageSize)}
              onValueChange={(value) => void source.setPageSize(Number(value))}
            >
              <SelectTrigger aria-label="Rows per page" className="w-auto min-w-16">
                <span data-slot="select-value" className="tabular-nums">
                  {pager.pageSize}
                </span>
              </SelectTrigger>
              <SelectContent>
                {pageSizes.map((option) => (
                  <SelectItem key={option} value={String(option)}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div data-slot={`${slotName}-pager`} className="flex items-center gap-2">
            <span data-slot={`${slotName}-range`} className="tabular-nums">
              {pager.rangeLabel}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Previous page"
              disabled={!pager.hasPrevious || loading}
              onClick={() => void source.setPage(pager.page - 1)}
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Input
              type="number"
              min="1"
              inputMode="numeric"
              aria-label="Page number"
              className="w-14 text-center tabular-nums"
              value={pageDraft === '' ? String(pager.page) : pageDraft}
              onChange={(event) => setPageDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                goToPage(event.currentTarget.value);
              }}
              onBlur={(event) => goToPage(event.currentTarget.value)}
            />
            {pager.pageCount !== null ? <span className="tabular-nums">of {pager.pageCount}</span> : null}
            <Button
              variant="outline"
              size="icon"
              aria-label="Next page"
              disabled={!pager.hasNext || loading}
              onClick={() => void source.setPage(pager.page + 1)}
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </>
      ) : (
        <>
          <span data-slot={`${slotName}-loaded`} className="tabular-nums">
            {pager.loadedLabel}
          </span>
        </>
      )}
    </div>
  );
}
