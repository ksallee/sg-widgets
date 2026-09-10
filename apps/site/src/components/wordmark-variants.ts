/**
 * Round two of the site title: the marks still in the running, and the two type
 * treatments they are paired with.
 *
 * `markTakes` is the page's source of truth. It drives the mark cards, the favicon row
 * and the rows of the combination grid; `typeTreatments` drives its columns. Each `id`
 * matches a snippet -- marks in `WordmarkMark.astro`, treatments in `Wordmark.astro` --
 * so a take is added here and drawn there, and nowhere else.
 */

/** The two shapes the marks are cut from. */
export type MarkFamily = 'tiles' | 'slate';

export interface MarkTake {
  /** Matches the snippet in WordmarkMark.astro. */
  id: string;
  label: string;
  family: MarkFamily;
  /** One line saying what this take changes. */
  note: string;
}

export interface TypeTreatment {
  /** Matches the snippet in Wordmark.astro. */
  id: string;
  label: string;
  note: string;
}

/**
 * Every tile take drops the inner square the first stacked pair carried: a tile is one
 * flat shape, and the front one is parted from the back by a gap in the ground colour
 * rather than by an outline.
 */
export const markTakes: MarkTake[] = [
  {
    id: 'tiles-tight',
    label: 'Tiles, tight',
    family: 'tiles',
    note: 'The pair as it stood, minus the inner square: front tile in the accent, back tile in the ink at low opacity, overlapping by about half a tile.',
  },
  {
    id: 'tiles-generous',
    label: 'Tiles, generous',
    family: 'tiles',
    note: 'The same two tiles pushed apart until they meet at a corner, so the diagonal is longer and each tile keeps its own square.',
  },
  {
    id: 'tiles-back-accent',
    label: 'Tiles, accent behind',
    family: 'tiles',
    note: 'The accent moves to the back tile and the front tile carries the ink, so the mark leads with the colour of the type beside it.',
  },
  {
    id: 'tiles-mono',
    label: 'Tiles, one ink',
    family: 'tiles',
    note: 'Both tiles in the foreground, parted by opacity alone, so the mark holds where a palette gives the accent no hue.',
  },
  {
    id: 'tiles-popover',
    label: 'Tiles, widget and popover',
    family: 'tiles',
    note: 'The back tile is larger and the front one is smaller and dropped down-right, which is a widget with its popover open.',
  },
  {
    id: 'slate-hinge',
    label: 'Slate, hinge',
    family: 'slate',
    note: 'Two bars at a clapper angle meeting at a hinge dot in the accent; the angle is the whole idea.',
  },
  {
    id: 'slate-rows',
    label: 'Slate, rows',
    family: 'slate',
    note: 'Three bars of decreasing width with the top one in the accent: a slate read as a list of rows.',
  },
  {
    id: 'slate-progress',
    label: 'Slate, progress',
    family: 'slate',
    note: 'A slate body under a top bar split into accent and dimmed ink, so the bar also reads as progress.',
  },
];

/**
 * Both treatments keep the weight split -- SG medium, Widgets regular -- and change only
 * what carries the colour.
 */
export const typeTreatments: TypeTreatment[] = [
  {
    id: 'muted-tail',
    label: 'Muted tail',
    note: 'SG in the foreground, Widgets in the muted foreground. The title shortens to SG at a glance and needs no accent.',
  },
  {
    id: 'primary-head',
    label: 'Primary head',
    note: 'SG in the accent, Widgets in the foreground: the short word takes the colour. In nova the accent sits on the foreground, so this collapses to the weight split there.',
  },
];

/** Favicon, sidebar entry, browser tab. In px. */
export const markSizes = [16, 24, 32];
