import type * as React from 'react';
import { Fragment, useEffect, useState } from 'react';
import type {
  FieldSchema,
  FieldSpec,
  PickerRow as PickerRowData,
  SgContext,
  StatusRecord,
} from '@sg-widgets/core';
import {
  highlightRuns,
  isEmptyValue,
  pathOf,
  renderKindFor,
  rowCode,
  rowSecondary,
  rowSubLabel,
  rowThumbnail,
  secondaryType,
} from '@sg-widgets/core';
import { cn } from '@/lib/utils';
import { FieldValue } from '@/registry/sg/components/field-value';
import { PICKER_ROW_INDICATOR } from '@/registry/sg/components/picker-classes';
import { Thumbnail } from '@/registry/sg/components/thumbnail';
import { UserAvatar } from '@/registry/sg/components/user-avatar';

export type PickerRowSize = 'sm' | 'md' | 'lg';

/** The leading slot follows the thumbnail ladder of `docs/design-rules.md`. */
const LEAD: Record<PickerRowSize, string> = { sm: 'size-6', md: 'size-8', lg: 'size-10' };
/** The indicator column is as tall as the leading slot, so a checkbox centres on the picture. */
const LEAD_HEIGHT: Record<PickerRowSize, string> = { sm: 'h-6', md: 'h-8', lg: 'h-10' };
const GLYPH: Record<PickerRowSize, string> = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' };
/** A row's text, on the leaf ladder of `docs/design-rules.md`. */
const TEXT: Record<PickerRowSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

const PEOPLE = ['HumanUser', 'ApiUser', 'ClientUser'];

/** Everything rule 9 of `docs/design-rules.md` gives a row, as one props object. */
export interface PickerRowProps {
  /** The row to draw: the reference, its label and the values a read answered. */
  row: PickerRowData;
  /** The query whose matched runs are bold. */
  query?: string;
  /** Crumbs drawn before the label, muted and separated by `›`. */
  crumbs?: string[];
  /** Field holding the thumbnail URL. `false` hides the leading slot. */
  thumbnail?: string | false;
  roundThumbnail?: boolean;
  /** Show the row's `code` beside the label when the two differ. */
  showCode?: boolean;
  /** The muted line under the label: a path, or a resolved column. */
  subLabelField?: FieldSpec | null;
  /** The muted line of the caller's own making. Wins over `subLabelField`. */
  subLabel?: string;
  /** The right-aligned value: a path, or a resolved column so it renders by type. */
  secondaryField?: FieldSpec | null;
  /** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
  secondary?: string;
  size?: PickerRowSize;
  /** The widget context. The secondary's schema and the status table are read through it. */
  context?: SgContext;
  /** The site the status sprite is served from. Defaults to the context's. */
  siteUrl?: string;
  /** Drawn in the leading slot when the row carries no picture. */
  glyph?: React.ReactNode;
  /** What the indicator column holds: a tick, a checkbox, or nothing while the row is not taken. */
  indicator?: React.ReactNode;
  /** The `data-slot` the indicator column carries. Defaults to `picker-row-indicator`. */
  indicatorSlot?: string;
  /**
   * Where the indicator column sits. A checkbox leads; a single picker's tick trails, where an
   * unticked row leaves no gap before its label.
   */
  indicatorAt?: 'start' | 'end';
}

interface SecondaryPlan {
  field: FieldSchema | null;
  /** `Status` rows by code, read only when the field is a status (probe 010). */
  statuses: Record<string, StatusRecord> | null;
}

/**
 * What the secondary column draws with. A resolved column already carries its field,
 * so only a bare path costs a schema read, and that read is the context's cached one.
 */
function useSecondaryPlan(
  type: string,
  spec: FieldSpec | null | undefined,
  context: SgContext | undefined,
): SecondaryPlan {
  const resolved = spec && typeof spec !== 'string' ? spec : null;
  const [plan, setPlan] = useState<SecondaryPlan>({ field: resolved?.field ?? null, statuses: null });
  const path = pathOf(spec);
  const declared = resolved?.dataType;
  useEffect(() => {
    if (!context || path.length === 0 || path === 'id') return;
    let live = true;
    void Promise.resolve(resolved ? (resolved.field ?? undefined) : context.schema.field(type, path))
      .then(async (found) => {
        if (!live) return;
        const dataType = declared ?? found?.dataType;
        const statuses =
          dataType && renderKindFor(dataType) === 'status'
            ? Object.fromEntries(await context.statuses.byCode())
            : null;
        if (live) setPlan({ field: found ?? null, statuses });
      })
      .catch(() => {
        // A secondary the schema cannot answer renders as text, which is always readable.
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, type, path, declared]);
  return plan;
}

/**
 * One entity row, the anatomy of rule 9 in `docs/design-rules.md`: a picture, the
 * label with the matched runs bold, a muted sub-label and a right-aligned secondary
 * rendered by its data type. Every picker, search and tree row is this one row, so a
 * caller learns the six props once.
 *
 * The component draws the row's contents, not its box: the caller owns the list item,
 * its selection state and anything it puts in front, such as a checkbox.
 */
export function PickerRow({
  row,
  query = '',
  crumbs = [],
  thumbnail = 'image',
  roundThumbnail = false,
  showCode = false,
  subLabelField = null,
  subLabel,
  secondaryField = null,
  secondary,
  size = 'md',
  context,
  siteUrl,
  glyph,
  indicator,
  indicatorSlot,
  indicatorAt = 'start',
}: PickerRowProps) {
  const anatomy = { thumbnail, subLabelField, secondaryField, showCode };
  const site = siteUrl ?? context?.siteUrl;
  const picture = rowThumbnail(row.values, anatomy);
  const sub = subLabel ?? rowSubLabel(row.values, anatomy);
  const code = rowCode(row.values, row.name, showCode);
  const raw = rowSecondary(row, anatomy);
  const secondaryPath = pathOf(secondaryField);
  /** An id is a code, and codes are the mono treatment of `docs/design-rules.md`. */
  const secondaryIsId = secondaryPath === 'id';
  const person = PEOPLE.includes(row.type);
  const title = [...crumbs, row.name].join(' › ');
  const plan = useSecondaryPlan(row.type, secondaryField, context);
  const dataType = secondaryType(anatomy, plan.field?.dataType);
  // Fixed whether or not the row is ticked, so the labels, or the secondaries before a trailing
  // tick, sit at one x down the list.
  const indicatorCell =
    indicator !== undefined ? (
      <span
        data-slot={indicatorSlot ?? 'picker-row-indicator'}
        className={cn(PICKER_ROW_INDICATOR, thumbnail !== false && LEAD_HEIGHT[size])}
      >
        {indicator}
      </span>
    ) : null;

  return (
    <>
      {indicatorAt === 'start' ? indicatorCell : null}

      {thumbnail !== false ? (
        <span
          data-slot="picker-row-leading"
          className={cn('flex shrink-0 items-center justify-center', LEAD[size])}
        >
          {person ? (
            <UserAvatar
              name={row.name}
              image={picture}
              size={size}
              color="auto"
              apiUser={row.type === 'ApiUser'}
              inactive={row.values['sg_status_list'] === 'dis'}
            />
          ) : picture === null && glyph ? (
            <span className={cn('text-muted-foreground flex items-center justify-center', GLYPH[size])}>
              {glyph}
            </span>
          ) : (
            <Thumbnail
              src={picture}
              aspect="square"
              size={size}
              className={roundThumbnail ? 'rounded-full' : undefined}
            />
          )}
        </span>
      ) : null}

      <span data-slot="picker-row-text" className={cn('flex min-w-0 flex-1 flex-col', TEXT[size])}>
        <span data-slot="picker-row-label" className="flex min-w-0 items-center gap-1.5" title={title}>
          <span className="truncate">
            {crumbs.map((crumb, i) => (
              <Fragment key={`crumb-${i}`}>
                <span className="text-muted-foreground">{crumb}</span>
                <span aria-hidden="true" className="text-muted-foreground">
                  {' › '}
                </span>
              </Fragment>
            ))}
            <span
              data-slot="picker-row-name"
              className={crumbs.length > 0 ? 'font-medium' : undefined}
            >
              {highlightRuns(row.name, query).map((run, i) => (
                <span key={i} className={run.match ? 'font-semibold' : undefined}>
                  {run.text}
                </span>
              ))}
            </span>
          </span>
          {code ? (
            <span data-slot="picker-row-code" className="text-muted-foreground shrink-0 font-mono text-xs">
              {code}
            </span>
          ) : null}
        </span>
        {sub ? (
          // Highlighted too, so a row matched on its login or its email shows why.
          <span
            data-slot="picker-row-sub-label"
            className="text-muted-foreground truncate text-xs"
            title={sub}
          >
            {highlightRuns(sub, query).map((run, i) => (
              <span key={i} className={run.match ? 'font-semibold' : undefined}>
                {run.text}
              </span>
            ))}
          </span>
        ) : null}
      </span>

      {secondary ? (
        <span data-slot="picker-row-secondary" className="text-muted-foreground shrink-0 text-xs">
          {secondary}
        </span>
      ) : secondaryPath && !isEmptyValue(raw) ? (
        <span
          data-slot="picker-row-secondary"
          className={cn(
            'text-muted-foreground flex shrink-0 items-center text-xs',
            secondaryIsId && 'font-mono tabular-nums',
          )}
        >
          <FieldValue
            value={raw}
            dataType={dataType}
            field={plan.field}
            statuses={plan.statuses}
            context={context}
            siteUrl={site}
            className="w-auto justify-end text-xs"
          />
        </span>
      ) : null}

      {indicatorAt === 'end' ? indicatorCell : null}
    </>
  );
}
