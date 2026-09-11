import type * as React from 'react';
import type { FieldSchema, StatusIcon, StatusRecord } from '@sg-widgets/core';
import {
  foregroundFor,
  parseBgColor,
  rgbToCss,
  spriteStyle,
  statusLabel,
  stockIconSource,
} from '@sg-widgets/core';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

/** How much of the status to show. */
export type StatusBadgeVariant = 'both' | 'icon' | 'text';
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
  const rgb = color ? parseBgColor(status?.bgColor) : null;
  const style = rgb
    ? { backgroundColor: rgbToCss(rgb), color: foregroundFor(rgb) === 'black' ? '#000' : '#fff' }
    : undefined;
  // An `html` icon carries the label itself, so it replaces the text rather than
  // preceding it, and such a status has no image to show in icon-only mode
  // (010_status_icons).
  const icon = status?.icon ?? null;
  const textIcon = icon?.displayType === 'html' ? icon.html || text : null;
  const showGlyph = variant !== 'text' && icon !== null && textIcon === null;
  const showText = variant !== 'icon' || textIcon !== null;
  // A bare icon is the glyph and nothing else, so there is no room for a cross.
  const showRemove = removable && variant !== 'icon';

  const content = (
    <>
      {showGlyph ? <StatusGlyph icon={icon} size={size} siteUrl={siteUrl} /> : null}
      <span className={cn('truncate', !showText && 'sr-only')}>{textIcon ?? text}</span>
    </>
  );

  return (
    <span
      data-slot="status-badge"
      data-status-code={code}
      data-status-known={known ? 'true' : 'false'}
      title={other}
      style={style}
      className={cn(
        'border-border bg-background inline-flex max-w-full min-w-0 items-center rounded-md border px-1.5 align-middle text-xs font-medium',
        showRemove ? 'gap-1' : 'gap-1.5',
        BOX[size],
        variant === 'icon' && 'justify-center',
        rgb && 'border-transparent ring-1 ring-current/10 ring-inset',
        color && !rgb && 'bg-muted text-muted-foreground border-transparent',
        className,
      )}
      {...rest}
    >
      {showRemove ? (
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

/**
 * The picture for an `image` or `image_map` icon (010_status_icons). An `image` icon is
 * a self-contained data URI. An `image_map` icon names a cell of the stock sprite:
 * cells of the shipped statuses are bundled in core and draw with no site access, any
 * other stock icon draws from the site's own copy of the sprite and so needs `siteUrl`,
 * and a key with neither resolves to a neutral dot. The key stays on the element as
 * `data-status-icon`.
 */
function StatusGlyph({ icon, size, siteUrl }: { icon: StatusIcon; size: StatusBadgeSize; siteUrl?: string }) {
  if (icon.displayType === 'image') {
    return (
      <img
        src={icon.dataUrl}
        alt=""
        aria-hidden="true"
        className={cn('shrink-0 [image-rendering:crisp-edges]', GLYPH[size])}
      />
    );
  }
  if (icon.displayType === 'html') return null;
  const stock = stockIconSource(icon.imageMapKey, siteUrl);
  if (stock.kind === 'data') {
    return (
      <img
        src={stock.src}
        alt=""
        aria-hidden="true"
        data-status-icon={icon.imageMapKey}
        style={{ width: `${stock.cell.w}px`, height: `${stock.cell.h}px` }}
        className="shrink-0 [image-rendering:crisp-edges]"
      />
    );
  }
  if (stock.kind === 'sprite') {
    return (
      <span
        aria-hidden="true"
        data-status-icon={icon.imageMapKey}
        style={spriteStyle(stock)}
        className="shrink-0"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      data-status-icon={icon.imageMapKey}
      className="bg-muted-foreground/40 size-2 shrink-0 rounded-full"
    />
  );
}
