import type * as React from 'react';
import type { FieldSchema, StatusRecord } from '@sg-widgets/core';
import { statusGlyph, statusLabel, statusPaint } from '@sg-widgets/core';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { StatusGlyph } from '@/registry/sg/components/status-glyph';

/** How much of the status to show. `glyph` is the bare icon, with no pill around it. */
export type StatusBadgeVariant = 'both' | 'icon' | 'text' | 'glyph';
export type StatusBadgeSize = 'sm' | 'md' | 'lg';
/** Which of the two names the badge puts on show; the other one goes in the tooltip. */
export type StatusBadgeLabel = 'name' | 'code';

/**
 * Leaf atoms follow the thumbnail/avatar ladder of `docs/design-rules.md`
 * (6 / 8 / 10); the input ladder (8 / 9 / 10) is for controls.
 */
const BOX: Record<StatusBadgeSize, string> = {
  sm: 'h-6 text-xs',
  md: 'h-8 text-sm',
  lg: 'h-10 text-sm',
};
const GLYPH: Record<StatusBadgeSize, string> = {
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};

export interface StatusBadgeProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children' | 'color'> {
  /** The stored code, e.g. `ip`. A row may hold a code outside the usable set; that is legal (probe 009). */
  code: string;
  /** The resolved `Status` row, when the app has read `GET /entity/statuses` (probe 010). */
  status?: StatusRecord | null;
  /** The field schema, whose `display_values` is the only other source of a label (field_types/status_list). */
  field?: Pick<FieldSchema, 'displayValues'> | null;
  variant?: StatusBadgeVariant;
  size?: StatusBadgeSize;
  /** Paint the badge in the status colour instead of the neutral surface. */
  color?: boolean;
  label?: StatusBadgeLabel;
  /** The site the stock sprite is served from, for icons the package does not bundle. */
  siteUrl?: string;
  /** Draw a remove control inside the pill. The icon-only variant has no room for it and ignores this. */
  removable?: boolean;
  onRemove?: (code: string) => void;
  /** Accessible label for the remove control. */
  removeLabel?: string;
}

/**
 * One status, as a badge.
 *
 * The label comes from the `Status` row's `name`, else from the field's
 * `display_values`, else it is the raw code: a status_list value is a bare code with
 * no entity behind it, so a dotted read gives nothing (field_types/status_list). An
 * unknown code is therefore never blank - it renders as itself. Whichever of the name
 * and the code is not on show is the tooltip, so a code is always one hover away from
 * its name. The badge is neutral by default; `color` paints it in `bg_color`,
 * comma-separated decimal RGB and never hex (probe 010), the one raw colour the design
 * rules allow.
 *
 * `removable` draws a cross inside the pill, after the label, in the badge's own
 * foreground: under `color` that is the readable black or white the status colour gives,
 * so the cross keeps its contrast on every colour. Its hover is a translucent wash of
 * that foreground rather than the destructive tint the entity chip uses, since the pill
 * already carries a colour of its own.
 *
 * `glyph` is the icon alone, in its own colour, with no pill around it: no border, no
 * background, no inset, sized like a row glyph. It is what a list row's leading slot
 * draws, where a bordered pill would read as a second surface. The label stays as the
 * accessible name and the tooltip, `color` has nothing to paint, and there is no room for
 * a cross. A status with no icon to draw takes the neutral dot, so a row always carries a
 * leading mark.
 */
export function StatusBadge({
  code,
  status = null,
  field = null,
  variant = 'both',
  size = 'md',
  color = false,
  label = 'name',
  siteUrl,
  removable = false,
  onRemove,
  removeLabel,
  className,
  ...rest
}: StatusBadgeProps) {
  if (!code) return null;

  const known = Boolean(status) || field?.displayValues?.[code] !== undefined;
  const name = status?.name || (field ? statusLabel(field, code) : code) || code;
  const text = label === 'code' ? code : name;
  const other = label === 'code' ? name : code;
  const paint = color ? statusPaint(status) : null;
  const style = paint ? { backgroundColor: paint.background, color: paint.foreground } : undefined;
  // An `html` icon carries the label itself, so it replaces the text rather than
  // preceding it, and such a status has no image to show in icon-only mode
  // (010_status_icons).
  const glyph = statusGlyph(status, siteUrl);
  const textIcon = glyph.kind === 'html' ? glyph.html || text : null;
  const showGlyph = variant !== 'text' && glyph.kind !== 'none' && textIcon === null;
  const showText = variant !== 'icon' || textIcon !== null;
  // The bare glyph has no pill, so no colour, no text and no room for a cross.
  const bare = variant === 'glyph';
  // A bare icon is the glyph and nothing else, so there is no room for a cross.
  const showRemove = removable && variant !== 'icon' && !bare;

  const content = (
    <>
      {showGlyph ? <StatusGlyph status={status} siteUrl={siteUrl} className={GLYPH[size]} /> : null}
      <span className={cn('truncate', !showText && 'sr-only')}>{textIcon ?? text}</span>
    </>
  );

  return (
    <span
      data-slot="status-badge"
      data-status-code={code}
      data-status-known={known ? 'true' : 'false'}
      data-variant={variant}
      title={other}
      style={bare ? undefined : style}
      className={cn(
        bare
          ? cn('inline-flex shrink-0 items-center justify-center align-middle', GLYPH[size])
          : cn(
              'border-border bg-background inline-flex max-w-full min-w-0 items-center rounded-md border px-1.5 align-middle text-xs font-medium',
              'gap-1.5',
              BOX[size],
              variant === 'icon' && 'justify-center',
              paint && 'border-transparent ring-1 ring-current/10 ring-inset',
              color && !paint && 'bg-muted text-muted-foreground border-transparent',
            ),
        className,
      )}
      {...rest}
    >
      {bare ? (
        <>
          <StatusGlyph status={status} siteUrl={siteUrl} fallback className={GLYPH[size]} />
          <span className="sr-only">{text}</span>
        </>
      ) : showRemove ? (
        <>
          <span className="flex min-w-0 items-center gap-1.5">{content}</span>
          <button
            type="button"
            data-slot="status-badge-remove"
            aria-label={removeLabel ?? `Remove ${text}`}
            onClick={() => onRemove?.(code)}
            className="hover:bg-current/15 focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
          >
            <X aria-hidden="true" className="size-3" />
          </button>
        </>
      ) : (
        content
      )}
    </span>
  );
}
