import { useEffect, useRef, useState, type ReactNode } from 'react';
import type {
  FacetCondition,
  FacetCounts,
  FacetList,
  FacetValue,
  FieldSchema,
  FilterGroup,
  Operator,
  Scalar,
  SgContext,
  StatusRecord,
  WireGroup,
} from '@sg-widgets/core';
import {
  conditionParts,
  conditionValues,
  describeCondition,
  emptyFilter,
  facetLists,
  facetScopes,
  facetShape,
  findFacet,
  renderKindFor,
  setFacet,
  asFilterGroup,
  matchesEveryWord,
  withoutPaths,
} from '@sg-widgets/core';
import { PlusIcon, SearchX, TriangleAlert, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Command, CommandEmpty, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
  CONTROL_BUTTON,
  CONTROL_GLYPH,
  CONTROL_HEIGHT,
  CONTROL_PAD,
  type ControlSize,
} from '@/registry/sg/components/control-classes';
import { useEntityFields } from '@/registry/sg/components/entity-fields';
import { FilterDialog } from '@/registry/sg/components/filter-dialog';
import { CHIP_CROSS, LEAF_GLYPH, REMOVE_CONTROL, type ChipSize } from '@/registry/sg/components/leaf-classes';
import { MatchText } from '@/registry/sg/components/match-text';
import { StateLine } from '@/registry/sg/components/state-line';
import { StatusBadge, type StatusBadgeSize } from '@/registry/sg/components/status-badge';
import { StatusGlyph } from '@/registry/sg/components/status-glyph';

export type FilterBarSize = ControlSize;

/** A cross inside the pill sits one step under it on the chip ladder. */
const CROSS: Record<FilterBarSize, ChipSize> = { sm: 'xs', md: 'sm', lg: 'md' };
/**
 * The pill's trailing edge: the room above the cross, so its box sits as far from the
 * right as from the top (`docs/design-rules.md` rule 3).
 */
const CROSS_PAD: Record<FilterBarSize, string> = { sm: 'pr-[5px]', md: 'pr-1.5', lg: 'pr-[7px]' };
/** A badge sits one step under the pill it is in (`docs/design-rules.md` rule 3). */
const BADGE: Record<FilterBarSize, StatusBadgeSize> = { sm: 'xs', md: 'sm', lg: 'md' };
/**
 * What a pill's value may take before it truncates. A facet with everything ticked would
 * otherwise run the bar past the width it was given (`docs/design-rules.md` rule 2).
 */
const VALUE_WIDTH = 'max-w-64';
/** One row of whole badges: a status value wraps past the cap and the rows below are clipped. */
const VALUE_ROW: Record<FilterBarSize, string> = { sm: 'max-h-5', md: 'max-h-6', lg: 'max-h-8' };
/**
 * A pill is the outline button: a bordered control on the height ladder that presses
 * to open a list, so it wears the button's border, radius and shadow rather than a
 * badge's flat surface.
 */
const PILL =
  'border-border inline-flex max-w-full min-w-0 items-center overflow-hidden rounded-lg border text-sm shadow-xs';

export interface FilterBarProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  entityType: string;
  /** The widget context. Every read goes through it, so widgets on a page share one cache. */
  context: SgContext;
  /** Field names to offer as pills, in order. */
  facets: string[];
  /** A name per facet, for a field whose schema label is not what the page calls it. */
  labels?: Record<string, string>;
  /** Values a pill names before the rest reads as `+n`. `0` names every one. */
  maxValues?: number;
  value: FilterGroup;
  hidePaths?: string[];
  size?: FilterBarSize;
  disabled?: boolean;
  /** Conditions every facet query carries, such as a project scope. Never edited by the bar. */
  baseFilter?: FilterGroup | WireGroup | null;
  /**
   * The groups of a `_summarize` call grouped on one facet's field, which is
   * `facetCounts(context.client, entityType)`. Without it the bar reads one page of
   * rows and tallies them, as it does for a field the site refuses to group.
   */
  counts?: FacetCounts;
  /** Rows read for a tally. */
  sampleSize?: number;
  onValueChange?: (value: FilterGroup) => void;
  className?: string;
}

/**
 * Quick facets over one entity type.
 *
 * An untouched facet is a quiet pill naming its field; ticking a value turns it into
 * a pill reading the field and the values ticked, and opening it again reopens the
 * checklist. The pill adds its condition to the bound tree, and More filters opens
 * the same tree in the full editor, so the two edit one value: a condition the editor
 * wrote on an operator the checklist cannot hold reads as text in its pill.
 *
 * Each facet is counted against the whole filter less its own condition. With `counts`
 * a facet's values are the site's own groups, an entity facet among them; a field the
 * site refuses to group, and every field without `counts`, is tallied from one page of
 * rows, and its list says so.
 */
export function FilterBar({
  entityType,
  context,
  facets,
  labels = {},
  value = emptyFilter(),
  hidePaths = [],
  size = 'md',
  maxValues = 2,
  disabled = false,
  counts,
  baseFilter = null,
  sampleSize = 200,
  onValueChange,
  className,
  ref,
  ...rest
}: FilterBarProps) {
  const fields = useEntityFields(context, entityType);
  const [tally, setTally] = useState<Record<string, FacetList>>({});
  /** The `Status` rows, for a facet over a status field (probe 010). */
  const [statuses, setStatuses] = useState<Record<string, StatusRecord>>({});
  /** What the open facet's search box holds. */
  const [facetQuery, setFacetQuery] = useState('');
  const [counting, setCounting] = useState(true);
  /** What a failed tally said, shown in place of the values. */
  const [failure, setFailure] = useState<string | null>(null);

  // A facet is counted against the whole filter less its own condition, so it keeps
  // every value it could switch to while the other pills show what remains.
  const base = asFilterGroup(baseFilter);
  const scopes = JSON.stringify(facetScopes(value, base, facets));
  // The reader is read at call time, so a host's inline function never re-counts on its own.
  const countsRef = useRef(counts);
  countsRef.current = counts;
  /** Fields the site refused to group, so it is asked once per field. */
  const refused = useRef(new Set<string>());

  useEffect(() => {
    const present = facets.map((name) => fields[name]).filter((f): f is FieldSchema => Boolean(f));
    if (present.length === 0) return;
    let live = true;
    setCounting(true);
    setFailure(null);
    const filters = JSON.parse(scopes) as Record<string, WireGroup | null>;
    const load = (): Promise<Record<string, FacetList>> =>
      facetLists(present, filters, {
        counts: countsRef.current,
        refused: refused.current,
        sample: async (sampleFields, sampleFilters) =>
          (
            await context.client.search(entityType, {
              filters: sampleFilters,
              fields: [...sampleFields],
              page: { size: sampleSize },
            })
          ).data,
      });
    void load()
      .then((found) => {
        if (live) setTally(found);
      })
      .catch((error: unknown) => {
        if (live) setFailure(error instanceof Error ? error.message : String(error));
      })
      .finally(() => {
        if (live) setCounting(false);
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context.client, entityType, fields, facets.join(','), scopes, sampleSize]);

  useEffect(() => {
    let live = true;
    void context.statuses
      .byCode()
      .then((table) => {
        if (live) setStatuses(Object.fromEntries(table));
      })
      .catch(() => {
        // A facet without the table still reads: a badge falls back to its own code.
      });
    return () => {
      live = false;
    };
  }, [context.statuses]);

  /** The name a pill and its popover carry: the caller's, else the schema's, else the path. */
  const labelOf = (name: string): string => labels[name] ?? fields[name]?.displayName ?? name;
  /** True where the facet's values are status codes, which draw as badges rather than text. */
  const isStatus = (name: string): boolean => renderKindFor(fields[name]?.dataType ?? '') === 'status';

  /** One value in a pill, where a status is a value: a status is a badge, and every other value is text. */
  const valueBadge = (name: string, key: string): ReactNode => (
    <StatusBadge
      code={key}
      status={statuses[key] ?? null}
      field={fields[name] ?? null}
      size={BADGE[size]}
      siteUrl={context.siteUrl}
    />
  );

  /**
   * One checklist row: the status glyph as a leading mark before the label, the way a
   * picker row whose label is a name reads, with the matched runs of the box bold.
   */
  const rowValue = (name: string, key: string, label: string): ReactNode => (
    <>
      {isStatus(name) ? (
        <StatusGlyph status={statuses[key] ?? null} siteUrl={context.siteUrl} fallback className={LEAF_GLYPH[size]} />
      ) : null}
      <MatchText text={label} query={facetQuery} className="truncate" />
    </>
  );

  /**
   * A pill's value: the values it has room to name, then `+n`. It is capped and
   * truncated with the whole list in its `title`, so a facet with everything ticked
   * never stretches the bar.
   */
  const pillValues = (name: string, shown: ReturnType<typeof conditionValues> | null): ReactNode => {
    if (!shown || shown.shown.length === 0) return null;
    return (
      <span
        data-slot="filter-pill-values"
        className={cn(
          'flex min-w-0 items-center gap-1.5',
          VALUE_WIDTH,
          isStatus(name) && shown.values.length > 0 ? `flex-wrap content-start overflow-hidden ${VALUE_ROW[size]}` : 'truncate',
        )}
        title={shown.title}
      >
        {isStatus(name) && shown.values.length > 0 ? (
          shown.values.map((scalar) => (
            <span key={keyOf(scalar)} className="flex shrink-0 items-center">
              {valueBadge(name, keyOf(scalar))}
            </span>
          ))
        ) : (
          <span className="min-w-0 truncate">{shown.text}</span>
        )}
        {shown.overflow > 0 ? (
          <span data-slot="filter-pill-overflow" className="text-muted-foreground shrink-0 tabular-nums">
            +{shown.overflow}
          </span>
        ) : null}
      </span>
    );
  };

  /**
   * The node this facet contributes. A field the API evaluates no `in` on holds an
   * `or` of one-value conditions, which reads back as one checklist.
   */
  const facetOf = (name: string): FacetCondition | null => findFacet(value, name, fields[name]) ?? null;

  const selectedOf = (name: string): Scalar[] => facetOf(name)?.values ?? [];

  const keyOf = (v: Scalar): string => (v !== null && typeof v === 'object' ? `${v.type}:${v.id}` : String(v));

  /** The list operator the checklist writes: the one the pill already holds, else `in`. */
  const listOperator = (name: string): Operator => {
    const found = facetOf(name);
    return found?.checklist ? found.operator : facetShape(fields[name]).any;
  };

  function toggle(name: string, option: FacetValue) {
    const selected = selectedOf(name);
    const next = selected.some((v) => keyOf(v) === option.key)
      ? selected.filter((v) => keyOf(v) !== option.key)
      : [...selected, option.value];
    onValueChange?.(setFacet(value, name, next, listOperator(name), fields[name]));
  }

  const facetList = (name: string): ReactNode => {
    const selected = selectedOf(name);
    // The box matches what it was given rather than what a read answered, so the rows
    // drawn are the rows the list holds.
    const shown = (tally[name]?.values ?? []).filter((option) => matchesEveryWord(`${option.label} ${option.key}`, facetQuery));
    const sampled = tally[name]?.sampled;
    return (
      <PopoverContent className="w-64 p-0" align="start">
        <Command
          shouldFilter={false}
          items={shown.map((option) => option.key)}
          query={facetQuery}
          onQueryChange={setFacetQuery}
        >
          <CommandInput placeholder="Search values…" />
          <CommandList>
            {counting ? (
              <p className="text-muted-foreground py-6 text-center text-sm">Counting…</p>
            ) : failure ? (
              <StateLine state="error" slotName="filter-bar-error" icon={TriangleAlert} label={failure} />
            ) : (
              <>
                <CommandEmpty>
                  <StateLine state="empty" icon={SearchX} label="No value." pad="none" />
                </CommandEmpty>
                {shown.map((option) => (
                  <CommandItem
                    key={option.key}
                    value={option.key}
                    data-option={option.key}
                    onSelect={() => toggle(name, option)}
                  >
                    <Checkbox
                      checked={selected.some((v) => keyOf(v) === option.key)}
                      tabIndex={-1}
                      aria-hidden="true"
                    />
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate" title={option.label}>
                      {rowValue(name, option.key, option.label)}
                    </span>
                    <span className="text-muted-foreground text-xs tabular-nums" data-slot="facet-count">
                      {option.count}
                    </span>
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
        {/* A tally is as complete as the page it read, and the list says so. */}
        {!counting && !failure && sampled !== undefined ? (
          <p
            data-slot="facet-sample"
            className="text-muted-foreground border-border border-t px-2 py-1.5 text-xs tabular-nums"
          >
            Counts from a sample of {sampled} rows
          </p>
        ) : null}
        {selected.length > 0 ? (
          <div className="border-border border-t p-1">
            <Button
              variant="ghost"
              size={CONTROL_BUTTON[size]}
              className="w-full"
              data-slot="filter-pill-clear"
              onClick={() => onValueChange?.(setFacet(value, name, [], 'in', fields[name]))}
            >
              Clear
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    );
  };

  const activeCount = facets.filter((name) => Boolean(facetOf(name))).length;

  return (
    <div
      ref={ref}
      data-slot="filter-bar"
      className={cn('flex w-full min-w-0 flex-wrap items-center gap-2', className)}
      {...rest}
    >
      {facets.map((name) => {
        const field = fields[name];
        const found = facetOf(name);
        const parts = found ? conditionParts(found.summary, field) : null;
        const shown = found ? conditionValues(found.summary, field, maxValues) : null;
        const remove = (label: string) => (
          <button
            type="button"
            disabled={disabled}
            data-slot="filter-pill-remove"
            aria-label={`Remove ${label} filter`}
            className={cn(REMOVE_CONTROL, 'disabled:pointer-events-none disabled:opacity-50')}
            onClick={() => onValueChange?.(withoutPaths(value, [name]))}
          >
            <XIcon aria-hidden="true" className={CHIP_CROSS[CROSS[size]]} />
          </button>
        );
        if (!found || !parts || found.checklist) {
          // One popover and one trigger across both looks, so the first tick does not close the list.
          return (
            <Popover key={name}>
              <div
                data-slot="filter-pill"
                data-field={name}
                data-size={size}
                data-active={found ? 'true' : undefined}
                role={found ? 'group' : undefined}
                aria-label={found ? describeCondition(found.summary, field) : undefined}
                className={cn(
                  PILL,
                  CONTROL_HEIGHT[size],
                  found && parts && CROSS_PAD[size],
                  found ? 'bg-background' : 'text-muted-foreground max-w-72 border-dashed',
                )}
              >
                <PopoverTrigger
                  disabled={disabled || !field}
                  data-slot="filter-pill-trigger"
                  className={cn(
                    'hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex min-w-0 items-center gap-1.5 outline-none focus-visible:ring-3 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50',
                    CONTROL_HEIGHT[size],
                    CONTROL_PAD[size],
                  )}
                >
                  {!found || !parts ? (
                    <>
                      <PlusIcon className={cn('shrink-0', CONTROL_GLYPH[size])} />
                      <span className="min-w-0 truncate">{labelOf(name)}</span>
                    </>
                  ) : (
                    <>
                      <span data-slot="filter-pill-field" className="shrink-0 font-medium">
                        {labelOf(name)}
                      </span>
                      {found.summary.operator !== 'in' ? (
                        <span className="text-muted-foreground shrink-0">{parts.operator}</span>
                      ) : null}
                      {pillValues(name, shown)}
                    </>
                  )}
                </PopoverTrigger>
                {found && parts ? remove(labelOf(name)) : null}
              </div>
              {facetList(name)}
            </Popover>
          );
        }
        // A condition the editor wrote on an operator no checklist can hold reads as text.
        return (
          <div
            key={name}
            data-slot="filter-pill"
            data-field={name}
            data-size={size}
            data-active="true"
            role="group"
            aria-label={describeCondition(found.summary, field)}
            className={cn(PILL, 'bg-background', CONTROL_HEIGHT[size], CROSS_PAD[size])}
          >
            <span
              className={cn('inline-flex min-w-0 items-center gap-1.5', CONTROL_HEIGHT[size], CONTROL_PAD[size])}
            >
              <span data-slot="filter-pill-field" className="shrink-0 font-medium">
                {labelOf(name)}
              </span>
              <span className="text-muted-foreground shrink-0">{parts.operator}</span>
              {pillValues(name, shown)}
            </span>
            {remove(labelOf(name))}
          </div>
        );
      })}

      {activeCount > 0 ? (
        <Button
          variant="ghost"
          size={CONTROL_BUTTON[size]}
          disabled={disabled}
          className="text-muted-foreground"
          data-slot="filter-clear-all"
          onClick={() => onValueChange?.(withoutPaths(value, facets))}
        >
          Clear all
        </Button>
      ) : null}

      <FilterDialog
        entityType={entityType}
        context={context}
        hidePaths={hidePaths}
        disabled={disabled}
        size={size}
        label="More filters"
        value={value}
        onValueChange={(next) => onValueChange?.(next)}
      />
    </div>
  );
}
