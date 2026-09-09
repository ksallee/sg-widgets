import { Fragment, useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import type {
  EntityCardColumn,
  EntityCardModel,
  EntityRef,
  EntityRow,
  SgContext,
  StatusRecord,
} from '@sg-widgets/core';
import {
  describeEntityCard,
  entityDetailUrl,
  fieldText,
  isEmptyValue,
  loadEntityCard,
  renderKindFor,
  urlLink,
} from '@sg-widgets/core';
import {
  Box,
  CircleAlert,
  Clapperboard,
  FileBox,
  Film,
  Folder,
  ListChecks,
  MessageSquare,
  Tag,
  User,
  Video,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { Thumbnail, type ThumbnailSize } from '@/registry/sg/components/thumbnail';

export type EntityCardSize = 'sm' | 'md' | 'lg';

/** Cards and detail panes take the top of the thumbnail ladder (`docs/design-rules.md`). */
const THUMB: Record<EntityCardSize, ThumbnailSize> = { sm: 'xl', md: 'xl', lg: '2xl' };
const HEADER: Record<EntityCardSize, string> = { sm: 'gap-2', md: 'gap-3', lg: 'gap-3' };
const STACK: Record<EntityCardSize, string> = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4' };
const NAME: Record<EntityCardSize, string> = { sm: 'text-sm', md: 'text-sm', lg: 'text-base' };
const ROWS: Record<EntityCardSize, string> = { sm: 'gap-y-1.5', md: 'gap-y-2', lg: 'gap-y-2' };

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

export interface EntityCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The cached client, the schema service and the site url the card reads through. */
  context: SgContext;
  /** The row to show. Given, nothing is read. */
  row?: EntityRow | null;
  /** The row to read, when no `row` is given. */
  entity?: EntityRef | null;
  /** Dotted field paths for the grid, in order. */
  fields?: string[];
  size?: EntityCardSize;
  /** The `image` field the thumbnail comes from. */
  imagePath?: string;
  /** The web app the row lives on. Defaults to the context's. */
  siteUrl?: string;
  /** The site's `hours_per_day` from `GET /preferences`; durations then render in days. */
  hoursPerDay?: number;
  locale?: string;
  /** What a field with no value shows. */
  emptyLabel?: string;
}

interface Loaded {
  card: EntityCardModel;
  statuses: Record<string, StatusRecord>;
}

const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm';
const linkClass =
  'focus-visible:ring-ring focus-visible:ring-offset-background truncate underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2';

/** An entity value and a multi_entity value are the same shape, one boxed (field_types/multi_entity). */
function refsOf(value: unknown): EntityRef[] {
  return Array.isArray(value) ? (value as EntityRef[]) : [value as EntityRef];
}

/**
 * One row as a card: thumbnail, name, type, status and a grid of field values.
 *
 * Given a reference the card reads the row itself: one search asking for the
 * type's identity chain, its thumbnail, its status field and the caller's paths
 * at once, through the context's cache, so a second card on the same row costs
 * nothing. Every path is labelled through the schema, and a hop names the type it
 * travels through only when the field could have gone somewhere else, which is
 * the same ambiguity the projection resolves (probe 059).
 *
 * Values are drawn here rather than through FieldValue: FieldValue draws a linked
 * row as a chip, and a chip's own hover card is this card, so the two would
 * depend on each other and neither registry CLI can install a cycle. A card is a
 * compact surface, so a linked row is a link and the rest is one line of text
 * through core's `fieldText`.
 */
export function EntityCard({
  context,
  row = null,
  entity = null,
  fields = [],
  size = 'md',
  imagePath = 'image',
  siteUrl,
  hoursPerDay,
  locale,
  emptyLabel = 'empty',
  className,
  ...rest
}: EntityCardProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const paths = fields.join(',');

  useEffect(() => {
    let current = true;
    setLoaded(null);
    setError(null);
    const options = { fields, imagePath };
    const model = row
      ? describeEntityCard(context, row, options)
      : entity
        ? loadEntityCard(context, entity, options)
        : Promise.reject(new Error('An entity card needs a row or a reference.'));
    Promise.all([model, context.statuses.byCode()])
      .then(([card, statuses]) => {
        if (current) setLoaded({ card, statuses: Object.fromEntries(statuses) });
      })
      .catch((e: unknown) => {
        if (current) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, row, entity?.type, entity?.id, paths, imagePath]);

  const site = siteUrl ?? context.siteUrl;
  const card = loaded?.card ?? null;
  const statuses = loaded?.statuses ?? {};
  const Glyph = card ? (GLYPHS[card.entity.type as keyof typeof GLYPHS] ?? Tag) : Tag;
  const url = card ? entityDetailUrl(site, card.entity) : null;

  function textOf(column: EntityCardColumn): string {
    return fieldText(column.value, column.dataType, {
      ...(hoursPerDay === undefined ? {} : { hoursPerDay }),
      ...(locale === undefined ? {} : { locale }),
      ...(column.field?.displayValues === undefined ? {} : { displayValues: column.field.displayValues }),
    });
  }

  function cell(column: EntityCardColumn): ReactNode {
    const kind = renderKindFor(column.dataType);
    if (kind === 'empty' || isEmptyValue(column.value)) {
      return <span className="text-muted-foreground text-xs italic select-none">{emptyLabel}</span>;
    }
    if (kind === 'status') {
      return (
        <StatusBadge
          code={String(column.value)}
          status={statuses[String(column.value)] ?? null}
          field={column.field}
          size="sm"
          siteUrl={site}
        />
      );
    }
    if (kind === 'image') return <Thumbnail src={String(column.value)} size="sm" alt="" />;
    if (kind === 'entity' || kind === 'multi_entity') {
      return (
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          {refsOf(column.value).map((target) => {
            const href = entityDetailUrl(site, target);
            const name = fieldText(target, 'entity');
            return href ? (
              <a
                key={`${target.type}:${target.id}`}
                href={href}
                target="_blank"
                rel="noreferrer"
                title={name}
                className={linkClass}
              >
                {name}
              </a>
            ) : (
              <span key={`${target.type}:${target.id}`} title={name} className="truncate">
                {name}
              </span>
            );
          })}
        </span>
      );
    }
    if (kind === 'url') {
      const link = urlLink(column.value);
      return link?.href ? (
        <a href={link.href} rel="noreferrer" title={link.label} className={linkClass}>
          {link.label}
        </a>
      ) : (
        <span title={link?.label} className="truncate">
          {link?.label}
        </span>
      );
    }
    if (kind === 'text') {
      // `text` keeps its newlines: a description is free text and often multi-line.
      return <span className="min-w-0 break-words whitespace-pre-wrap">{textOf(column)}</span>;
    }
    const text = textOf(column);
    return (
      <span title={text} className={cn('truncate', kind === 'number' && 'tabular-nums')}>
        {text}
      </span>
    );
  }

  return (
    <div
      data-slot="entity-card"
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col', STACK[size], className)}
      {...rest}
    >
      {error !== null ? (
        <p className={cn(stateClass, 'text-destructive')}>
          <CircleAlert aria-hidden="true" className="size-4 shrink-0" />
          {error}
        </p>
      ) : card === null ? (
        <>
          <div className={cn('flex min-w-0 items-start', HEADER[size])}>
            <Skeleton className={cn('aspect-video shrink-0', size === 'lg' ? 'h-24' : 'h-16')} />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
          <div className={cn('grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3', ROWS[size])}>
            {fields.map((path) => (
              <Fragment key={path}>
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-full" />
              </Fragment>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className={cn('flex min-w-0 items-start', HEADER[size])}>
            <Thumbnail src={card.thumbnail} size={THUMB[size]} alt="" />
            <div className="flex min-w-0 flex-1 flex-col gap-1.5">
              {url ? (
                <a
                  href={url}
                  target="_blank"
                  rel="noreferrer"
                  title={card.name}
                  className={cn(linkClass, 'font-medium', NAME[size])}
                >
                  {card.name}
                </a>
              ) : (
                <span title={card.name} className={cn('truncate font-medium', NAME[size])}>
                  {card.name}
                </span>
              )}
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <span className="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs">
                  <Glyph aria-hidden="true" className="size-4 shrink-0 opacity-70" />
                  <span className="truncate">{card.typeLabel}</span>
                </span>
                {card.status ? (
                  <StatusBadge
                    code={card.status.code}
                    status={statuses[card.status.code] ?? null}
                    field={card.status.field}
                    size="sm"
                    siteUrl={site}
                  />
                ) : null}
              </div>
            </div>
          </div>
          {card.columns.length > 0 ? (
            <dl className={cn('grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3', ROWS[size])}>
              {card.columns.map((column) => (
                <Fragment key={column.path}>
                  <dt className="text-muted-foreground truncate text-xs" title={column.label}>
                    {column.label}
                  </dt>
                  <dd data-data-type={column.dataType} className="flex min-w-0 items-center text-sm">
                    {cell(column)}
                  </dd>
                </Fragment>
              ))}
            </dl>
          ) : null}
        </>
      )}
    </div>
  );
}
