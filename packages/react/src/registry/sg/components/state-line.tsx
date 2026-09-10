import type * as React from 'react';
import type { WidgetState } from '@sg-widgets/core';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Where the line sits: `docs/design-rules.md` rule 5 gives each its own inset. */
export type StateLinePad = 'popover' | 'table' | 'none';

const LINE = 'flex items-center justify-center gap-1.5 text-center text-sm';
const TONE: Record<Exclude<WidgetState, 'loading'>, string> = {
  empty: 'text-muted-foreground',
  error: 'text-destructive',
};
const PAD: Record<StateLinePad, string> = { popover: 'py-6', table: 'py-10', none: '' };

export interface StateLineProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Which state this is. An error is destructive, an empty state muted. */
  state: Exclude<WidgetState, 'loading'>;
  /** The line to show. */
  label: string;
  /** The glyph in front of it. */
  icon?: LucideIcon | null;
  /** `popover` for a list, `table` for a body, `none` under loaded rows. */
  pad?: StateLinePad;
  /** The `data-slot` the widget names this block. */
  slotName?: string;
  /** Anything after the line: a retry control. */
  children?: React.ReactNode;
}

/**
 * The empty and error line of `docs/design-rules.md` rule 5, drawn once for every
 * widget in this registry. Loading is skeletons shaped like the rows they stand in
 * for, so it stays with the widget that knows that shape.
 */
export function StateLine({
  state,
  label,
  icon: Icon = null,
  pad = 'popover',
  slotName,
  className,
  children,
  ...rest
}: StateLineProps) {
  return (
    <div
      data-slot={slotName}
      data-state={state}
      className={cn(LINE, TONE[state], PAD[pad], className)}
      {...rest}
    >
      {Icon ? <Icon aria-hidden="true" className="size-4 shrink-0" /> : null}
      <span className="min-w-0 truncate" title={label}>
        {label}
      </span>
      {children}
    </div>
  );
}
