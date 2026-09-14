import type * as React from 'react';
import type { EntityRef, SgClient, SgContext } from '@sg-widgets/core';
import { contextFromClient, entityDetailUrl } from '@sg-widgets/core';
import { X } from 'lucide-react';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { cn } from '@/lib/utils';
import { EntityCard } from '@/registry/sg/components/entity-card';
import { entityGlyph } from '@/registry/sg/components/entity-glyphs';
import { CHIP_BOX, CHIP_CROSS, CHIP_GLYPH, CHIP_PAD, CHIP_SPACING, REMOVE_CONTROL, type ChipSize } from '@/registry/sg/components/leaf-classes';

export type EntityChipSize = ChipSize;
export type EntityChipVariant = 'chip' | 'link' | 'text';

/** A link or a bare label has no box, so only the type scale applies. */
const TEXT: Record<EntityChipSize, string> = {
  xs: 'text-xs',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-sm',
};

export interface EntityChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'onClick'> {
  /** `{type, id, name}` exactly as an entity field returns it under `relationships` (field_types/entity). */
  entity: EntityRef;
  /** A thumbnail URL for the linked row. Presigned and short-lived, so pass a fresh one (field_types/image). */
  thumbnail?: string | null;
  /** `chip` is the boxed default, `link` an inline link, `text` the bare name. */
  variant?: EntityChipVariant;
  /** A url, or a resolver. Left out, the row's own page on the site, opened in a new tab. */
  href?: string | ((entity: EntityRef) => string | null);
  /** The web app the row lives on. Defaults to the context's. */
  siteUrl?: string;
  /** Field paths shown in a hover card. Needs a context to read them through. */
  preview?: string[];
  /** The widget context, for the site url and for the hover card's read. */
  context?: SgContext;
  /** A client, for an app with no context. One context is built per client and shared. */
  client?: SgClient;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  size?: EntityChipSize;
  removable?: boolean;
  onRemove?: (entity: EntityRef) => void;
  /** Accessible label for the remove control. */
  removeLabel?: string;
}

/**
 * One linked row, as a chip, a link or bare text.
 *
 * `name` is the target's `cached_display_name` and is filled on every type measured,
 * so a chip needs no second call (probe 060). When it is missing the chip shows
 * `Type #id`, which is always addressable, in the mono/tabular treatment the design
 * rules give ids. With no `href` the chip addresses the row's own page on the site,
 * which core builds from the context's site url.
 */
export function EntityChip({
  entity,
  thumbnail = null,
  variant = 'chip',
  href,
  siteUrl,
  preview,
  context,
  client,
  onClick,
  size = 'md',
  removable = false,
  onRemove,
  removeLabel,
  className,
  ...rest
}: EntityChipProps) {
  const named = Boolean(entity.name && entity.name.length > 0);
  const label = named ? (entity.name as string) : `${entity.type} #${entity.id}`;
  const Glyph = entityGlyph(entity.type);

  // One context per client, so a chip handed a bare client shares the page's caches.
  const ctx = context ?? (client ? contextFromClient(client) : undefined);
  const site = siteUrl ?? ctx?.siteUrl ?? '';
  // The row's own page is on another origin, so it opens in a new tab; a url the
  // caller resolved belongs to the caller's app and stays in this one.
  const detail = href === undefined ? entityDetailUrl(site, entity) : null;
  const url = variant === 'text' ? null : typeof href === 'function' ? href(entity) : (href ?? detail);
  const interactive = Boolean(url || onClick);
  const showGlyph = variant !== 'text';
  const innerClass = cn(
    'inline-flex min-w-0 items-center rounded-[inherit] outline-none',
    CHIP_SPACING[size].glyph,
    interactive &&
      'focus-visible:ring-ring focus-visible:ring-offset-background transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]',
    variant === 'link' && url && 'underline-offset-2 hover:underline',
  );
  const rootClass = cn(
    'inline-flex max-w-full min-w-0 items-center align-middle whitespace-nowrap',
    CHIP_SPACING[size].cross,
    variant === 'chip'
      ? cn(
          'bg-secondary text-secondary-foreground rounded-md border',
          CHIP_BOX[size],
          CHIP_PAD[size].text,
          showGlyph && CHIP_PAD[size].lead,
          removable && CHIP_PAD[size].trail,
          interactive && 'hover:bg-accent hover:text-accent-foreground transition-colors duration-150',
        )
      : TEXT[size],
    className,
  );

  const body = (
    <>
      {showGlyph ? (
        thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            aria-hidden="true"
            loading="lazy"
            decoding="async"
            className={cn('shrink-0 rounded-sm object-cover', CHIP_GLYPH[size])}
          />
        ) : (
          <Glyph aria-hidden="true" className={cn('shrink-0 opacity-70', CHIP_GLYPH[size])} />
        )
      ) : null}
      <span className={cn('truncate', !named && 'font-mono tabular-nums')}>{label}</span>
    </>
  );

  const chip = (
    <span
      data-slot="entity-chip"
      data-variant={variant}
      data-entity-type={entity.type}
      data-entity-id={entity.id}
      title={label}
      className={rootClass}
      {...rest}
    >
      {url ? (
        <a
          href={url}
          target={href === undefined ? '_blank' : undefined}
          rel={href === undefined ? 'noreferrer' : undefined}
          className={innerClass}
        >
          {body}
        </a>
      ) : onClick ? (
        <button type="button" onClick={onClick} className={innerClass}>
          {body}
        </button>
      ) : (
        <span className={innerClass}>{body}</span>
      )}
      {removable ? (
        <button
          type="button"
          aria-label={removeLabel ?? `Remove ${label}`}
          onClick={() => onRemove?.(entity)}
          className={REMOVE_CONTROL}
        >
          <X aria-hidden="true" className={CHIP_CROSS[size]} />
        </button>
      ) : null}
    </span>
  );

  if (!preview || preview.length === 0 || !ctx) return chip;

  // The content mounts on open, so the card's read happens then and is cached on the context.
  return (
    <HoverCard>
      <HoverCardTrigger
        delay={200}
        closeDelay={100}
        render={<span data-slot="entity-chip-preview" className="inline-flex max-w-full min-w-0 align-middle" />}
      >
        {chip}
      </HoverCardTrigger>
      <HoverCardContent className="w-72 p-3">
        <EntityCard context={ctx} entity={entity} fields={preview} size="sm" siteUrl={site} />
      </HoverCardContent>
    </HoverCard>
  );
}
