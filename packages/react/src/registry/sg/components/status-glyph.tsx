import type * as React from 'react';
import type { StatusRecord } from '@sg-widgets/core';
import { statusGlyph } from '@sg-widgets/core';
import { cn } from '@/lib/utils';

/**
 * The stock sprite in dark. Its cells were drawn as dark strokes for a light page: they
 * read 2.31:1 against the dark ground at the median and 1.03:1 at the worst, so the mark
 * all but disappears. Inverting the cell and rotating its hue back reads 6.94:1 at the
 * median and leaves the four coloured cells on their own hue, a green tick still green.
 * The two steps compose into one `filter`, in either order. A site's own `image` icon is
 * sent ready for both schemes and the dot is a token, so neither takes this.
 */
const SPRITE_DARK = 'dark:invert dark:hue-rotate-180';

export interface StatusGlyphProps {
  /** The resolved `Status` row. A plain `list` field has none, so it draws no icon. */
  status?: StatusRecord | null;
  /** The site the stock sprite is served from, for icons the package does not bundle. */
  siteUrl?: string;
  /** Draw the dot for a status that names no icon, so every row carries a leading mark. */
  fallback?: boolean;
  /** The glyph sits on the status colour, which is its own ground in both schemes, so the sprite is left as it is. */
  onColor?: boolean;
  /** Sizes the `image` drawing. A sprite cell carries its own size. */
  className?: string;
}

/**
 * One status icon, at whatever size the caller draws it (010_status_icons).
 *
 * An `image` icon is a self-contained data URI. An `image_map` icon names a cell of the
 * stock sprite: cells of the shipped statuses are bundled in core and draw with no site
 * access, any other stock icon draws from the site's own copy of the sprite and so needs
 * `siteUrl`, and a key with neither resolves to a neutral dot. The key stays on the
 * element as `data-status-icon`. An `html` icon is the label itself, so it draws no
 * picture at all; `fallback` gives it the dot instead, which is what a list row wants.
 *
 * A sprite cell is inverted in dark, since the stock sprite was drawn for a light page;
 * `onColor` turns that off for a glyph sitting on the status colour.
 */
export function StatusGlyph({ status = null, siteUrl, fallback = false, onColor = false, className }: StatusGlyphProps) {
  const glyph = statusGlyph(status, siteUrl);
  if (glyph.kind === 'image') {
    return (
      <img
        src={glyph.src}
        alt=""
        aria-hidden="true"
        data-slot="status-glyph"
        className={cn('shrink-0 [image-rendering:crisp-edges]', className)}
      />
    );
  }
  if (glyph.kind === 'cell') {
    return (
      <img
        src={glyph.src}
        alt=""
        aria-hidden="true"
        data-slot="status-glyph"
        data-status-icon={glyph.imageMapKey}
        style={{ width: `${glyph.cell.w}px`, height: `${glyph.cell.h}px` }}
        className={cn('shrink-0 [image-rendering:crisp-edges]', !onColor && SPRITE_DARK)}
      />
    );
  }
  if (glyph.kind === 'sprite') {
    return (
      <span
        aria-hidden="true"
        data-slot="status-glyph"
        data-status-icon={glyph.imageMapKey}
        style={glyph.style as React.CSSProperties}
        className={cn('shrink-0', !onColor && SPRITE_DARK)}
      />
    );
  }
  if (glyph.kind !== 'dot' && !fallback) return null;
  return (
    <span
      aria-hidden="true"
      data-slot="status-glyph"
      data-status-icon={glyph.kind === 'dot' ? glyph.imageMapKey : undefined}
      className="bg-muted-foreground/40 size-2 shrink-0 rounded-full"
    />
  );
}
