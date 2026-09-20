/**
 * The class strings the site's own chrome is drawn from: the demo toolbar and the
 * install tabs. Tokens only, and the shadcn button's own heights, so a control on a docs
 * page reads as one of the widgets below it.
 */

export const control =
  'inline-flex h-8 items-center justify-center px-2 text-sm text-muted-foreground select-none ' +
  'transition-[color,background-color,opacity,transform] duration-150 ease-out ' +
  'hover:bg-accent hover:text-accent-foreground ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
  'active:scale-[0.98] ' +
  'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';

/** One button of a segmented group. */
export const segment = `${control} border-l border-border first:border-l-0`;

/** A standalone control: a toggle, a select. */
export const toggle = `${control} rounded-md border border-border bg-background`;

/** The frame a segmented group sits in. */
export const group = 'inline-flex h-8 items-center overflow-hidden rounded-md border border-border bg-background';
