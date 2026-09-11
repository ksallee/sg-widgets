/**
 * The ladder and the chrome every leaf atom in this registry wears.
 *
 * A badge, a chip and an avatar sit on the thumbnail ladder of
 * `docs/design-rules.md` (6 / 8 / 10), not the control ladder, and the cross
 * inside a badge or a chip is one control drawn one way.
 */

/** The leaf ladder: the three sizes a badge, a chip and an avatar take. */
export type LeafSize = 'sm' | 'md' | 'lg';

/** The pill a badge or a chip sits in, with the type step that goes with it. */
export const LEAF_BOX: Record<LeafSize, string> = {
  sm: 'h-6 text-xs',
  md: 'h-8 text-sm',
  lg: 'h-10 text-sm',
};

/** A glyph inside a leaf atom, on the same two steps a control's glyph takes. */
export const LEAF_GLYPH: Record<LeafSize, string> = {
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};

/**
 * The cross inside a badge or a chip. It hovers with a wash of its own
 * foreground rather than the destructive tint, so the two read the same
 * (`docs/design-rules.md` rule 5).
 *
 * A coarse pointer gets a 44px box centred on the cross, drawn as a pseudo-element so
 * the chip keeps its own size and nothing around it moves.
 */
export const REMOVE_CONTROL =
  "hover:bg-current/15 focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98] pointer-coarse:relative pointer-coarse:before:absolute pointer-coarse:before:top-1/2 pointer-coarse:before:left-1/2 pointer-coarse:before:size-11 pointer-coarse:before:-translate-x-1/2 pointer-coarse:before:-translate-y-1/2 pointer-coarse:before:content-['']";
