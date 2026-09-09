import type * as React from 'react';
import { useState } from 'react';
import { initialsOf, nameColorIndex } from '@sg-widgets/core';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

export type UserAvatarSize = 'sm' | 'md' | 'lg';

/** Avatars follow the same ladder as thumbnails (`docs/design-rules.md`). */
const BOX: Record<UserAvatarSize, string> = {
  sm: 'size-6 text-xs',
  md: 'size-8 text-sm',
  lg: 'size-10 text-sm',
};
const GLYPH: Record<UserAvatarSize, string> = {
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};

/** Initials tints, from the theme's chart palette so every theme brings its own. */
const TINT = [
  'bg-chart-1/15 text-chart-1',
  'bg-chart-2/15 text-chart-2',
  'bg-chart-3/15 text-chart-3',
  'bg-chart-4/15 text-chart-4',
  'bg-chart-5/15 text-chart-5',
];

export interface UserAvatarProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The person's display name, i.e. `cached_display_name` on a HumanUser (probe 060). */
  name: string;
  /** The user's `image` field, or null. Presigned and short-lived (field_types/image). */
  image?: string | null;
  size?: UserAvatarSize;
  /** For a HumanUser whose `sg_status_list` is `dis`: dim without hiding. */
  inactive?: boolean;
  /** Marks an ApiUser or a script account rather than a person. */
  apiUser?: boolean;
  /** `auto` tints the initials from the name, the same tint every time. */
  color?: 'auto' | 'none';
}

/**
 * A person, as a round avatar.
 *
 * The initials fall out of the name in core (`initialsOf`) so React and Svelte cannot
 * drift. An avatar never renders blank: an image that fails to load falls back to the
 * initials, and with no name at all it is still a muted circle. An API user is a script
 * account rather than a person, so the circle holds a bot glyph instead of a picture or
 * initials and the tooltip says so.
 */
export function UserAvatar({
  name,
  image = null,
  size = 'md',
  inactive = false,
  apiUser = false,
  color = 'none',
  className,
  ...rest
}: UserAvatarProps) {
  // Held as the failing URL, not a flag, so a new `image` retries without an effect.
  const [failed, setFailed] = useState<string | null>(null);
  const src = apiUser || (image !== null && image === failed) ? null : image;
  const initials = initialsOf(name);
  const tinted = color === 'auto' && !apiUser && !src && initials.length > 0;

  return (
    <span
      data-slot="user-avatar"
      data-inactive={inactive ? 'true' : undefined}
      data-api-user={apiUser ? 'true' : undefined}
      title={apiUser ? `${name} (API user)` : name}
      className={cn('relative inline-flex shrink-0 align-middle', BOX[size], className)}
      {...rest}
    >
      <span
        className={cn(
          'bg-muted text-muted-foreground ring-border flex size-full items-center justify-center overflow-hidden rounded-full font-medium ring-1 select-none',
          apiUser && 'bg-secondary text-secondary-foreground',
          tinted && TINT[nameColorIndex(name, TINT.length)],
          inactive && 'opacity-50 grayscale',
        )}
      >
        {apiUser ? (
          <>
            <Bot aria-hidden="true" className={GLYPH[size]} />
            <span className="sr-only">{name}</span>
          </>
        ) : src ? (
          <img
            src={src}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(src)}
            className="size-full object-cover"
          />
        ) : (
          <>
            <span aria-hidden="true">{initials}</span>
            <span className="sr-only">{name}</span>
          </>
        )}
      </span>
    </span>
  );
}
