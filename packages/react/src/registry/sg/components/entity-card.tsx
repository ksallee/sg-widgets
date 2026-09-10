import { Fragment, useEffect, useState, type HTMLAttributes, type ReactNode } from 'react';
import type {
  EntityCardColumn,
  EntityCardModel,
  EntityRef,
  EntityRow,
  FieldSpec,
  FieldTextOptions,
  SgClient,
  SgContext,
  StatusRecord,
} from '@sg-widgets/core';
import {
  cellValue,
  contextFromClient,
  describeEntityCard,
  entityDetailUrl,
  fieldText,
  imageState,
  isEmptyValue,
  loadEntityCard,
  pathOf,
  preferencesOf,
  renderKindFor,
  stateLine,
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
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StateLine } from '@/registry/sg/components/state-line';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { Thumbnail, type ThumbnailSize } from '@/registry/sg/components/thumbnail';

export type EntityCardSize = 'sm' | 'md' | 'lg';
/** `card` is the stacked surface; `tile` is the thumbnail-first cell a grid lays out. */
export type EntityCardVariant = 'card' | 'tile';

/** Cards and detail panes take the top of the thumbnail ladder (`docs/design-rules.md`). */
const THUMB: Record<EntityCardSize, ThumbnailSize> = { sm: 'xl', md: 'xl', lg: '2xl' };
const HEADER: Record<EntityCardSize, string> = { sm: 'gap-2', md: 'gap-3', lg: 'gap-3' };
const STACK: Record<EntityCardSize, string> = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4' };
const NAME: Record<EntityCardSize, string> = { sm: 'text-sm', md: 'text-sm', lg: 'text-base' };
const ROWS: Record<EntityCardSize, string> = { sm: 'gap-y-1.5', md: 'gap-y-2', lg: 'gap-y-2' };
const BODY: Record<EntityCardSize, string> = { sm: 'p-2', md: 'p-2', lg: 'p-3' };

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
  /** The cached client, the schema service, the site url and the preferences the card reads through. */
  context?: SgContext;
  /** A client, for an app with no context. One context is built per client and shared. */
  client?: SgClient;
  /** The row to show. Given, nothing is read. */
  row?: EntityRow | null;
  /** The row to read, when no `row` is given. */
  entity?: EntityRef | null;
  /** Dotted field paths for the grid, in order. `card` only. */
  fields?: string[];
  variant?: EntityCardVariant;
  size?: EntityCardSize;
  /** The `image` field the thumbnail comes from. */
  imagePath?: string;
  /** Field shown as the name. Defaults to the type's own display name. `tile` only. */
  labelField?: string | null;
  /** The left of the tile's metadata line: a path, or a resolved column so it renders by type. */
  subLabelField?: FieldSpec | null;
  /** The caller's own sub-label. Wins over `subLabelField`. */
  subLabel?: (row: EntityRow) => string;
  /** The right of the tile's metadata line: a path, or a resolved column so it renders by type. */
  secondaryField?: FieldSpec | null;
  /** The caller's own text on the right of the metadata line. Wins over `secondaryField`. */
  secondary?: (row: EntityRow) => string;
  /** Show the row's `code` beside the name when the two differ. `tile` only. */
  showCode?: boolean;
  /** `Status` rows by code (probe 010). Read through the context when not given. */
  statuses?: Record<string, StatusRecord> | null;
  /** Draws the tile's selection checkbox and gives the tile a focus ring. */
  selectable?: boolean;
  selected?: boolean;
  onSelectedChange?: (selected: boolean) => void;
  /** Controls in the thumbnail's top-right corner, on hover or focus. `tile` only. */
  actions?: ReactNode;
  /** The web app the row lives on. Defaults to the context's. */
  siteUrl?: string;
  /** The site's `hours_per_day` from `GET /preferences`; durations then render in days. Defaults to the context's. */
  hoursPerDay?: number;
  locale?: string;
  /** IANA zone a `date_time` is shown in. Defaults to the context's. */
  timeZone?: string;
  /** Frames a second, for a timecode. Defaults to the context's. */
  frameRate?: number;
  /** What a field with no value shows. */
  emptyLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
}

interface Loaded {
  card: EntityCardModel;
  statuses: Record<string, StatusRecord>;
}

const linkClass =
  'focus-visible:ring-ring focus-visible:ring-offset-background truncate underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2';
/** Chrome over the thumbnail: absent until it is wanted, then a fade and a small rise. */
const revealClass = 'transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-opacity';
const hiddenClass =
  'opacity-0 group-hover/tile:opacity-100 group-focus-within/tile:opacity-100 motion-safe:-translate-y-0.5 motion-safe:group-hover/tile:translate-y-0 motion-safe:group-focus-within/tile:translate-y-0';

/** An entity value and a multi_entity value are the same shape, one boxed (field_types/multi_entity). */
function refsOf(value: unknown): EntityRef[] {
  return Array.isArray(value) ? (value as EntityRef[]) : [value as EntityRef];
}

/**
 * One row as a card, or as a tile.
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
 *
 * A tile is the same row read picture first: the thumbnail fills the top, the
 * status sits on it as an icon, and the row-anatomy props draw one metadata line
 * under the name. A Version with media carries the play overlay the desktop
 * tk-framework-qtwidgets label uses. Selection and activation belong to whoever
 * lays the tiles out, so the tile takes its selected state and spreads the
 * listbox attributes and handlers a collection puts on it.
 */
export function EntityCard({
  context,
  client,
  row = null,
  entity = null,
  fields = [],
  variant = 'card',
  size = 'md',
  imagePath = 'image',
  labelField = null,
  subLabelField = null,
  subLabel,
  secondaryField = null,
  secondary,
  showCode = false,
  statuses = null,
  selectable = false,
  selected = false,
  onSelectedChange,
  actions,
  siteUrl,
  hoursPerDay,
  locale,
  timeZone,
  frameRate,
  emptyLabel = 'empty',
  errorLabel,
  className,
  ...rest
}: EntityCardProps) {
  // One context per client, so a card handed a bare client shares the page's caches.
  const ctx = context ?? (client ? contextFromClient(client) : undefined);
  // The site's preferences, with anything the caller named winning over them.
  const prefs: FieldTextOptions = {
    ...preferencesOf(ctx),
    ...(hoursPerDay === undefined ? {} : { hoursPerDay }),
    ...(locale === undefined ? {} : { locale }),
    ...(timeZone === undefined ? {} : { timeZone }),
    ...(frameRate === undefined ? {} : { frameRate }),
  };
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState<string | null>(null);
  const subPath = pathOf(subLabelField);
  const secondaryPath = pathOf(secondaryField);
  // A tile draws one metadata line, so the paths it resolves are the row anatomy's,
  // not the caller's field grid.
  const paths =
    variant === 'tile' ? [...new Set([subPath, secondaryPath].filter((p) => p.length > 0))] : fields;
  const wanted = paths.join(',');

  useEffect(() => {
    let current = true;
    setLoaded(null);
    setError(null);
    if (!ctx) {
      setError('An entity card needs a context or a client.');
      return;
    }
    const options = { fields: paths, imagePath };
    const model = row
      ? describeEntityCard(ctx, row, options)
      : entity
        ? loadEntityCard(ctx, entity, options)
        : Promise.reject(new Error('An entity card needs a row or a reference.'));
    Promise.all([model, statuses ? Promise.resolve(null) : ctx.statuses.byCode()])
      .then(([card, table]) => {
        if (current) setLoaded({ card, statuses: statuses ?? Object.fromEntries(table ?? []) });
      })
      .catch((e: unknown) => {
        if (current) setError(e instanceof Error ? e.message : String(e));
      });
    return () => {
      current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx, row, entity?.type, entity?.id, wanted, imagePath, statuses]);

  const site = siteUrl ?? ctx?.siteUrl ?? '';
  const card = loaded?.card ?? null;
  const table = loaded?.statuses ?? {};
  const Glyph = card ? (GLYPHS[card.entity.type as keyof typeof GLYPHS] ?? Tag) : Tag;
  const url = card ? entityDetailUrl(site, card.entity) : null;

  function textOf(column: EntityCardColumn): string {
    return fieldText(column.value, column.dataType, {
      ...prefs,
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
          status={table[String(column.value)] ?? null}
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

  /** The column behind a metadata slot, when it resolved to something worth a line. */
  function slotColumn(model: EntityCardModel, path: string): EntityCardColumn | null {
    if (path.length === 0) return null;
    const column = model.columns.find((c) => c.path === path) ?? null;
    return column && !isEmptyValue(column.value) ? column : null;
  }

  function nameOf(model: EntityCardModel): string {
    if (!labelField) return model.name;
    return String(cellValue(model.row, labelField) ?? '');
  }

  /** The programmatic name, when it says something the label does not. */
  function codeOf(model: EntityCardModel): string {
    if (!showCode) return '';
    const raw = cellValue(model.row, 'code');
    return typeof raw === 'string' && raw.length > 0 && raw !== nameOf(model) ? raw : '';
  }

  function tileBody(model: EntityCardModel): ReactNode {
    const name = nameOf(model);
    const code = codeOf(model);
    const sub = subLabel ? subLabel(model.row) : '';
    const right = secondary ? secondary(model.row) : '';
    const subColumn = slotColumn(model, subPath);
    const secondaryColumn = slotColumn(model, secondaryPath);
    return (
      <>
        <div data-slot="entity-card-media" className="relative w-full">
          <Thumbnail
            src={model.thumbnail}
            size={THUMB[size]}
            alt=""
            playable={model.entity.type === 'Version' && imageState(model.thumbnail) === 'ready'}
            className="h-auto w-full rounded-none border-0"
          />
          <span
            data-slot="entity-card-overlay"
            className="absolute top-2 left-2 flex max-w-[calc(100%-1rem)] items-center gap-1.5"
          >
            {selectable ? (
              <span
                data-slot="entity-card-selection"
                className={cn('flex items-center', revealClass, selected ? 'opacity-100' : hiddenClass)}
              >
                <Checkbox
                  aria-label={`Select ${name}`}
                  checked={selected}
                  onCheckedChange={(value) => onSelectedChange?.(value === true)}
                  className="bg-background/80 border-transparent shadow-sm"
                />
              </span>
            ) : null}
            {model.status ? (
              <StatusBadge
                code={model.status.code}
                status={table[model.status.code] ?? null}
                field={model.status.field}
                variant="icon"
                size="sm"
                siteUrl={site}
                className="bg-background/80 border-transparent shadow-sm"
              />
            ) : null}
          </span>
          {actions ? (
            <span
              data-slot="entity-card-actions"
              className={cn('absolute top-2 right-2 flex items-center gap-1.5', revealClass, hiddenClass)}
            >
              {actions}
            </span>
          ) : null}
        </div>
        <div data-slot="entity-card-body" className={cn('flex min-w-0 flex-col gap-1.5', BODY[size])}>
          <span data-slot="entity-card-name" className="flex min-w-0 items-center gap-1.5">
            <span title={name} className={cn('min-w-0 truncate font-medium', NAME[size])}>
              {name}
            </span>
            {code ? <span className="text-muted-foreground shrink-0 font-mono text-xs">{code}</span> : null}
          </span>
          {sub || subColumn || right || secondaryColumn ? (
            <span
              data-slot="entity-card-meta"
              className="text-muted-foreground flex min-w-0 items-center gap-1.5 text-xs"
            >
              <span data-slot="entity-card-sub" className="flex min-w-0 flex-1 items-center truncate">
                {sub ? (
                  <span title={sub} className="truncate">
                    {sub}
                  </span>
                ) : subColumn ? (
                  cell(subColumn)
                ) : null}
              </span>
              <span data-slot="entity-card-secondary" className="flex shrink-0 items-center justify-end">
                {right ? (
                  <span title={right} className="truncate">
                    {right}
                  </span>
                ) : secondaryColumn ? (
                  cell(secondaryColumn)
                ) : null}
              </span>
            </span>
          ) : null}
        </div>
      </>
    );
  }

  if (variant === 'tile') {
    return (
      <div
        data-slot="entity-card"
        data-variant="tile"
        data-size={size}
        data-state={selected ? 'selected' : undefined}
        className={cn(
          'group/tile border-border bg-card focus-visible:ring-ring focus-visible:ring-offset-background relative flex w-full min-w-0 flex-col overflow-hidden rounded-md border text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
          selected && 'bg-accent text-accent-foreground',
          className,
        )}
        {...rest}
      >
        {error !== null ? (
          <StateLine
            state="error"
            icon={CircleAlert}
            label={stateLine('error', { errorLabel }, error)}
          />
        ) : card === null ? (
          <>
            <Skeleton className="aspect-video w-full rounded-none" />
            <div className={cn('flex min-w-0 flex-col gap-1.5', BODY[size])}>
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </>
        ) : (
          tileBody(card)
        )}
      </div>
    );
  }

  return (
    <div
      data-slot="entity-card"
      data-variant="card"
      data-size={size}
      className={cn('flex w-full min-w-0 flex-col', STACK[size], className)}
      {...rest}
    >
      {error !== null ? (
        <StateLine
          state="error"
          icon={CircleAlert}
          label={stateLine('error', { errorLabel }, error)}
        />
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
                    status={table[card.status.code] ?? null}
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
