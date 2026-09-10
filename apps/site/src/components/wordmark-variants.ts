/**
 * The wordmark variants the QA page at /qa/wordmark/ puts side by side.
 *
 * The list is the page's only source of truth: it drives the cards, the labels, the
 * rationale line and the mark sizes. `Wordmark.astro` holds one snippet per `id`.
 */

/** A mark that can stand on its own, and so is also shown at favicon sizes. */
export type WordmarkMarkId = 'stacked-tiles' | 'tile-grid' | 'bracket-sg' | 'slate-bars';

export interface WordmarkVariant {
  /** Matches the snippet in Wordmark.astro. */
  id: string;
  label: string;
  /** One line saying what the variant is for. */
  rationale: string;
  /** Set when the lockup leads with a mark that can be judged alone. */
  mark?: WordmarkMarkId;
}

export const wordmarkVariants: WordmarkVariant[] = [
  {
    id: 'weight-split',
    label: 'Weight split',
    rationale: 'One face, one colour; a weight step is the smallest change that still parts the two words.',
  },
  {
    id: 'muted-tail',
    label: 'Muted tail',
    rationale: 'Colour carries the hierarchy, so the title shortens to SG at a glance.',
  },
  {
    id: 'primary-tail',
    label: 'Primary tail',
    rationale:
      'Ties the title to the one accent every palette defines, and falls back to the weight split where that accent is the neutral.',
  },
  {
    id: 'tracked-caps',
    label: 'Tracked caps',
    rationale: 'Case and tracking do the parting, so the pair survives whatever face a palette names.',
  },
  {
    id: 'mono-sg',
    label: 'Mono SG',
    rationale: 'Mono reads as a code identifier, which is what SG is in a request.',
  },
  {
    id: 'mono-widgets',
    label: 'Mono Widgets',
    rationale: 'The reverse: the product noun turns technical and SG stays a name.',
  },
  {
    id: 'stacked-tiles',
    label: 'Stacked tiles',
    rationale: 'Two overlapping tiles, a widget on a widget, cornered by the radius token.',
    mark: 'stacked-tiles',
  },
  {
    id: 'tile-grid',
    label: 'Tile grid',
    rationale: 'A catalogue of widgets with one tile picked out in the accent.',
    mark: 'tile-grid',
  },
  {
    id: 'bracket-sg',
    label: 'Bracketed SG',
    rationale: 'An identifier in brackets: nothing is drawn, the mono face carries the mark.',
    mark: 'bracket-sg',
  },
  {
    id: 'slate-bars',
    label: 'Slate bars',
    rationale: 'Two rectangles as a clapper, for the production context. No third-party mark is reproduced.',
    mark: 'slate-bars',
  },
];

/** The marks judged alone, in the order their lockups appear. */
export const wordmarkMarks: { id: WordmarkMarkId; label: string }[] = wordmarkVariants
  .filter((variant): variant is WordmarkVariant & { mark: WordmarkMarkId } => variant.mark !== undefined)
  .map((variant) => ({ id: variant.mark, label: variant.label }));

/** Favicon and sidebar-icon sizes, in px. */
export const markSizes = [16, 24, 32];
