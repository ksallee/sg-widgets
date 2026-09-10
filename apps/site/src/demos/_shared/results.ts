/**
 * The result set a filter demo shows under its editor.
 *
 * Every filter demo answers the same question -- what does this tree match -- so the
 * columns, the debounce and the project scoping live here rather than in each demo.
 */
import type { FilterNode } from '@sg-widgets/core';
import { condition, group } from '@sg-widgets/core';
import type { DemoContext } from './client';

/** Keystrokes settle before the result set is read again. */
export const RESULT_DEBOUNCE_MS = 250;

/** Rows per page in a result set. */
export const RESULT_PAGE_SIZE = 25;

/** The columns a Version result set is shown with. */
export const VERSION_COLUMNS = [
  { path: 'code', width: 220 },
  { path: 'entity', width: 140 },
  { path: 'sg_status_list', width: 130 },
  { path: 'user', width: 150 },
  { path: 'created_at', width: 170 },
  { path: 'description', width: 260 },
];

/** The tree as the source reads it, scoped to the project the toolbar picked. */
export function scopeToProject(context: DemoContext, tree: FilterNode): FilterNode {
  // The mock's rows are one project's already; a real site's are not.
  if (!context.live) return tree;
  return group('and', [condition('project', 'is', { type: 'Project', id: context.projectId }), tree]);
}

/** What a count line reads while the total is on its way, or when there is none. */
export type ResultCount =
  | { kind: 'counting' }
  | { kind: 'ready'; total: number }
  | { kind: 'none' }
  | { kind: 'error'; message: string };

/** `3 Versions match`. */
export function matchLabel(count: ResultCount, noun: string): string {
  switch (count.kind) {
    case 'counting':
      return 'Counting…';
    case 'none':
      return 'The site answered no count.';
    case 'error':
      return count.message;
    default:
      return `${count.total} ${noun}${count.total === 1 ? '' : 's'} match${count.total === 1 ? 'es' : ''}`;
  }
}

/** The count of the filter the source now holds, as a state a view can render. */
export async function readCount(count: () => Promise<number | null>): Promise<ResultCount> {
  try {
    const total = await count();
    return total === null ? { kind: 'none' } : { kind: 'ready', total };
  } catch (error) {
    // A path the site cannot summarize fails the call; the demo says so in place.
    return { kind: 'error', message: error instanceof Error ? error.message : String(error) };
  }
}
