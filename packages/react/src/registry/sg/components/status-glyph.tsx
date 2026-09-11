import type * as React from 'react';
import type { StatusRecord } from '@sg-widgets/core';
import { statusGlyph } from '@sg-widgets/core';
import { cn } from '@/lib/utils';

export interface StatusGlyphProps {
  /** The resolved `Status` row. A plain `list` field has none, so it draws no icon. */
  status?: StatusRecord | null;
  /** The site the stock sprite is served from, for icons the package does not bundle. */
  siteUrl?: string;
  /** Draw the dot for a status that names no icon, so every row carries a leading mark. */
  fallback?: boolean;
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
 */
export function StatusGlyph({ status = null, siteUrl, fallback = false, className }: StatusGlyphProps) {
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
        className="shrink-0 [image-rendering:crisp-edges]"
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
        className="shrink-0"
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
