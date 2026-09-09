import type * as React from 'react';
import { useState } from 'react';
import { initialsOf } from '@sg-widgets/core';
import { Bot } from 'lucide-react';
import { cn } from '@/lib/utils';

export type UserAvatarSize = 'sm' | 'md' | 'lg';

/** Avatars follow the same ladder as thumbnails (`docs/design-rules.md`). */
const BOX: Record<UserAvatarSize, string> = {
  sm: 'size-6 text-xs',
  md: 'size-8 text-sm',
  lg: 'size-10 text-sm',
};
const BADGE: Record<UserAvatarSize, string> = {
  sm: 'size-3',
  md: 'size-3.5',
  lg: 'size-4',
};
const BADGE_GLYPH: Record<UserAvatarSize, string> = {
  sm: 'size-2',
  md: 'size-2.5',
  lg: 'size-3',
};

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
}

/**
 * A person, as a round avatar.
 *
 * The initials fall out of the name in core (`initialsOf`) so React and Svelte cannot
 * drift. An avatar never renders blank: an image that fails to load falls back to the
 * initials, and with no name at all it is still a muted circle.
 */
export function UserAvatar({
  name,
  image = null,
  size = 'md',
  inactive = false,
  apiUser = false,
  className,
  ...rest
}: UserAvatarProps) {
  // Held as the failing URL, not a flag, so a new `image` retries without an effect.
  const [failed, setFailed] = useState<string | null>(null);
  const src = image !== null && image === failed ? null : image;
  const initials = initialsOf(name);

  return (
    <span
      data-slot="user-avatar"
      data-inactive={inactive ? 'true' : undefined}
      title={apiUser ? `${name} (API user)` : name}
      className={cn('relative inline-flex shrink-0 align-middle', BOX[size], className)}
      {...rest}
    >
      <span
        className={cn(
          'bg-muted text-muted-foreground ring-border flex size-full items-center justify-center overflow-hidden rounded-full font-medium ring-1 select-none',
          inactive && 'opacity-50 grayscale',
        )}
      >
        {src ? (
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
      {apiUser ? (
        <span
          role="img"
          aria-label="API user"
          className={cn(
            'border-background bg-secondary text-secondary-foreground absolute right-0 bottom-0 flex translate-x-1/4 translate-y-1/4 items-center justify-center rounded-full border',
            BADGE[size],
          )}
        >
          <Bot aria-hidden="true" className={BADGE_GLYPH[size]} />
        </span>
      ) : null}
    </span>
  );
}
