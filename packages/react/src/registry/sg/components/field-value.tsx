import type * as React from 'react';
import type { EntityRef, FieldSchema, StatusRecord, UrlLinkInfo } from '@sg-widgets/core';
import {
  COLOR_SENTINEL,
  formatDate,
  formatDateTime,
  formatDuration,
  formatFloat,
  formatPercent,
  formatTimecode,
  isEmptyValue,
  parseBgColor,
  renderKindFor,
  rgbToCss,
  urlLink,
} from '@sg-widgets/core';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { Thumbnail } from '@/registry/sg/components/thumbnail';

export interface FieldValueProps extends Omit<React.HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** The raw attribute (or relationship) value, exactly as the API returned it. */
  value: unknown;
  /** The field's `data_type`. Anything unknown renders as text. */
  dataType: string;
  /** The field schema, for a status label out of `display_values` (probe 009). */
  field?: Pick<FieldSchema, 'displayValues'> | null;
  /** `Status` rows by code, for the status name and icon (probe 010). */
  statuses?: Record<string, StatusRecord> | null;
  /** The site's `hours_per_day` from `GET /preferences`; durations then render in days (field_types/duration). */
  hoursPerDay?: number;
  locale?: string;
  /** Decimals shown on a float, zeros kept. Default shows what the API sent, trailing zeros dropped. */
  precision?: number;
  /** Rewrites the href of a local file link. Default opens `file:`, which browsers refuse from an http page. */
  localHref?: (link: UrlLinkInfo) => string | null;
  /** What to show when the value is empty. Never a dash: a dash reads like a value. */
  emptyLabel?: string;
}

/**
 * Any attribute value, rendered for display.
 *
 * The rendering is chosen by `data_type` through core's `renderKindFor`, and the value
 * shapes are the ones the API actually returns: an entity link is a `{type, id, name}`
 * hash under `relationships`, a status is a bare code, a float comes back quoted, a
 * `url` is an object whose keys depend on `link_type`, and a date carries no zone
 * (sg-groundtruth `findings/field_types/*`).
 */
export function FieldValue({
  value,
  dataType,
  field = null,
  statuses = null,
  hoursPerDay,
  locale,
  precision,
    localHref,
  emptyLabel = 'empty',
  className,
  ...rest
}: FieldValueProps) {
  const kind = renderKindFor(dataType);
  // A checkbox is two-state and never null, so it is the one kind whose "empty"
  // value is a real one (field_types/checkbox).
  const empty = kind !== 'checkbox' && (kind === 'empty' || isEmptyValue(value));
  const dateOptions = locale === undefined ? {} : { locale };
  const rawLink = kind === 'url' ? urlLink(value) : null;
  // A local link opens through `file:`; an app that opens paths its own way rewrites the href.
  const link = rawLink && rawLink.local && localHref ? { ...rawLink, href: localHref(rawLink) } : rawLink;
  const rgb = kind === 'color' ? parseBgColor(String(value)) : null;
  const text =
    kind === 'number'
      ? formatNumber(value, dataType, hoursPerDay, precision)
      : kind === 'date'
        ? formatDate(String(value), dateOptions)
        : kind === 'datetime'
          ? formatDateTime(String(value), dateOptions)
          : String(value);
  /** Single-line renderings carry the full value in a `title`, per the design rules. */
  const titleText =
    empty || kind === 'entity' || kind === 'multi_entity' || kind === 'image' || kind === 'checkbox'
      ? undefined
      : kind === 'url'
        ? (link?.local?.path ?? link?.label ?? undefined)
        : kind === 'date' || kind === 'datetime'
          ? String(value)
          : text;

  return (
    <span
      data-slot="field-value"
      data-data-type={dataType}
      title={titleText}
      className={cn('inline-flex w-full min-w-0 items-center text-sm', className)}
      {...rest}
    >
      {empty ? (
        <span className="text-muted-foreground text-xs italic select-none">{emptyLabel}</span>
      ) : kind === 'entity' ? (
        <EntityChip entity={value as EntityRef} size="sm" />
      ) : kind === 'multi_entity' ? (
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          {(value as EntityRef[]).map((entity) => (
            <EntityChip key={`${entity.type}:${entity.id}`} entity={entity} size="sm" />
          ))}
        </span>
      ) : kind === 'status' ? (
        <StatusBadge code={String(value)} status={statuses?.[String(value)] ?? null} field={field} size="sm" />
      ) : kind === 'image' ? (
        <Thumbnail src={String(value)} size="sm" alt="" />
      ) : kind === 'checkbox' ? (
        <Switch
          size="sm"
          checked={value === true}
          disabled
          aria-readonly="true"
          aria-label={value === true ? 'Yes' : 'No'}
          tabIndex={-1}
          className="data-disabled:cursor-default data-disabled:opacity-100"
        />
      ) : kind === 'url' ? (
        link?.href ? (
          <a
            href={link.href}
            rel="noreferrer"
            className="focus-visible:ring-ring focus-visible:ring-offset-background truncate underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
          >
            {link.label}
          </a>
        ) : (
          <span className="truncate">{link?.label}</span>
        )
      ) : kind === 'date' || kind === 'datetime' ? (
        <time dateTime={String(value)} className="truncate">
          {text}
        </time>
      ) : kind === 'color' ? (
        // `Task.color` holds the token `pipeline_step` rather than a colour (field_types/color).
        String(value) === COLOR_SENTINEL ? (
          <span className="text-muted-foreground truncate">pipeline step</span>
        ) : rgb ? (
          <span className="flex min-w-0 items-center gap-1.5">
            <span
              aria-hidden="true"
              style={{ backgroundColor: rgbToCss(rgb) }}
              className="ring-border size-4 shrink-0 rounded-sm ring-1"
            />
            <span className="text-muted-foreground truncate font-mono text-xs tabular-nums">{text}</span>
          </span>
        ) : (
          <span className="truncate">{text}</span>
        )
      ) : kind === 'number' ? (
        <span className="truncate tabular-nums">{text}</span>
      ) : kind === 'list' ? (
        <span className="truncate">{text}</span>
      ) : (
        // `text` keeps its newlines: a description is free text and often multi-line.
        <span className="min-w-0 break-words whitespace-pre-wrap">{text}</span>
      )}
    </span>
  );
}

/** The numeric family shares one render kind; the exact format comes from the data type. */
function formatNumber(value: unknown, dataType: string, hoursPerDay: number | undefined, precision: number | undefined): string {
  switch (dataType) {
    case 'duration':
      return formatDuration(Number(value), hoursPerDay === undefined ? {} : { hoursPerDay });
    case 'percent':
      return formatPercent(value as number);
    case 'timecode':
      return formatTimecode(Number(value));
    case 'float':
      return formatFloat(value as string, precision === undefined ? {} : { decimals: precision });
    default:
      return String(value);
  }
}
