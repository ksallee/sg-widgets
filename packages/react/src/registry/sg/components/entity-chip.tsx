import type * as React from 'react';
import type { EntityRef } from '@sg-widgets/core';
import {
  Box,
  Clapperboard,
  FileBox,
  Film,
  Folder,
  ListChecks,
  MessageSquare,
  Tag,
  User,
  Video,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type EntityChipSize = 'sm' | 'md' | 'lg';

/** Leaf atoms follow the thumbnail/avatar ladder of `docs/design-rules.md`. */
const BOX_CLASS: Record<EntityChipSize, string> = {
  sm: 'h-6 text-xs',
  md: 'h-8 text-sm',
  lg: 'h-10 text-sm',
};
const GLYPH: Record<EntityChipSize, string> = {
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};

/**
 * A glyph per entity type. A stock site has 114 types plus any number of custom
 * ones, so this covers the types a widget meets constantly and falls back to a tag.
 */
const GLYPHS = {
  Shot: Clapperboard,
  Asset: Box,
  Sequence: Film,
  Version: Video,
  Task: ListChecks,
  HumanUser: User,
  Project: Folder,
  Note: MessageSquare,
  PublishedFile: FileBox,
} as const;

export interface EntityChipProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'onClick'> {
  /** `{type, id, name}` exactly as an entity field returns it under `relationships` (field_types/entity). */
  entity: EntityRef;
  /** A thumbnail URL for the linked row. Presigned and short-lived, so pass a fresh one (field_types/image). */
  thumbnail?: string | null;
  href?: string;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  size?: EntityChipSize;
  removable?: boolean;
  onRemove?: (entity: EntityRef) => void;
  /** Accessible label for the remove control. */
  removeLabel?: string;
}

/**
 * One linked row, as a chip.
 *
 * `name` is the target's `cached_display_name` and is filled on every type measured,
 * so a chip needs no second call (probe 060). When it is missing the chip shows
 * `Type #id`, which is always addressable, in the mono/tabular treatment the design
 * rules give ids.
 */
export function EntityChip({
  entity,
  thumbnail = null,
  href,
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
  const Glyph = GLYPHS[entity.type as keyof typeof GLYPHS] ?? Tag;
  const interactive = Boolean(href || onClick);
  const innerClass = cn(
    'inline-flex min-w-0 items-center gap-1.5 rounded-[inherit] outline-none',
    interactive &&
      'focus-visible:ring-ring focus-visible:ring-offset-background transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]',
  );

  const body = (
    <>
      {thumbnail ? (
        <img
          src={thumbnail}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className={cn('shrink-0 rounded-sm object-cover', GLYPH[size])}
        />
      ) : (
        <Glyph aria-hidden="true" className={cn('shrink-0 opacity-70', GLYPH[size])} />
      )}
      <span className={cn('truncate', !named && 'font-mono tabular-nums')}>{label}</span>
    </>
  );

  return (
    <span
      data-slot="entity-chip"
      data-entity-type={entity.type}
      data-entity-id={entity.id}
      title={label}
      className={cn(
        'bg-secondary text-secondary-foreground inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border px-2 align-middle whitespace-nowrap',
        BOX_CLASS[size],
        interactive && 'hover:bg-accent hover:text-accent-foreground transition-colors duration-150',
        className,
      )}
      {...rest}
    >
      {href ? (
        <a href={href} className={innerClass}>
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
          className="hover:bg-destructive/15 hover:text-destructive focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
        >
          <X aria-hidden="true" className="size-3" />
        </button>
      ) : null}
    </span>
  );
}
