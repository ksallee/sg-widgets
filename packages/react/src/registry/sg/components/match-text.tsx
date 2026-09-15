import type * as React from 'react';
import { matchRuns } from '@sg-widgets/core';
import { cn } from '@/lib/utils';

export interface MatchTextProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The root element. */
  ref?: React.Ref<HTMLSpanElement>;

  /** The label to draw. */
  text: string;
  /** What was searched for. Its whitespace-separated words are the ones marked. */
  query?: string;
}

/**
 * A label with the query's matched runs at the weight `docs/design-rules.md` rule 6
 * gives them.
 *
 * `POST /entity/_text_search` matches a row when every word of the query appears in
 * it, so every word is marked wherever it occurs and overlapping words merge into one
 * run (053_text_search_matching). Emphasis is weight and never colour, so a row that
 * carries its own colour still reads. The runs are text: nothing here sets HTML from
 * a row, and they rebuild the label exactly, so a label with no match draws as itself.
 */
export function MatchText({ text, query = '', className, ref, ...rest }: MatchTextProps) {
  return (
    <span data-slot="match-text" ref={ref} className={cn(className)} {...rest}>
      {matchRuns(text, query).map((run, i) => (
        <span key={i} className={run.match ? 'font-semibold' : undefined}>
          {run.text}
        </span>
      ))}
    </span>
  );
}
