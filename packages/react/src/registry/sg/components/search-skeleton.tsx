import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export interface SearchSkeletonProps {
  /** The accessible name of the block, from `stateLine('loading', …)`. */
  label: string;
  /** How many rows the read stands in for. */
  lines?: number;
  /** The leading slot's shape: a thumbnail, a row glyph. */
  lead?: string;
  /** The `data-slot` the block carries. Omitted where the widget names none. */
  slotName?: string;
}

/**
 * The rows a search widget draws while its read is in flight. Skeletons are shaped
 * like the rows they stand in for, so the block belongs beside them rather than in
 * `state-line`, which draws the empty and the error line.
 */
export function SearchSkeleton({ label, lines = 3, lead = 'h-6 w-10 shrink-0', slotName }: SearchSkeletonProps) {
  return (
    <div data-slot={slotName} className="flex flex-col" aria-busy="true" aria-label={label}>
      {Array.from({ length: lines }, (_, line) => (
        <div key={line} className="flex items-center gap-2 px-2 py-1.5">
          <Skeleton className={cn(lead)} />
          {/* The two bars sit in the line boxes of the label and the sub-label they stand in for. */}
          <div className="flex min-w-0 flex-1 flex-col">
            <span className="flex h-5 items-center">
              <Skeleton className="h-3 w-1/2" />
            </span>
            <span className="flex h-4 items-center">
              <Skeleton className="h-2.5 w-1/4" />
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
