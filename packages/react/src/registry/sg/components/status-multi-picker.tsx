import { useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type {
  FieldSchema,
  PickerRow as PickerRowData,
  PickerSummary,
  SgContext,
  StatusOption,
  StatusRecord,
} from '@sg-widgets/core';
import { clearableForField, matchesTokens, NO_MATCH_LABEL } from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  PICKER_ARMED,
  PICKER_CHIP as BADGE,
  PICKER_ROW,
} from '@/registry/sg/components/picker-classes';
import { PickerControl } from '@/registry/sg/components/picker-control';
import { PickerRow } from '@/registry/sg/components/picker-row';
import { StatusBadge, type StatusBadgeVariant } from '@/registry/sg/components/status-badge';

export type StatusMultiPickerSize = 'sm' | 'md' | 'lg';

export interface StatusMultiPickerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** The widget context. The options and the status table are read through it, once per page. */
  context: SgContext;
  entityType: string;
  /** Offer the codes this project allows. */
  projectId?: number;
  /** Offer the codes every one of these projects allows. */
  projectIds?: number[];
  /** A list or status field other than the type's own. Project's is `sg_status`. */
  field?: string;
  /** The selected codes. */
  value?: string[];
  onValueChange?: (value: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  /** Shown when the search matches nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
  /** Offer a control that clears the selection. A mandatory field is never clearable. */
  clearable?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Draw the code as the row's right-aligned secondary, when it says more than the label. */
  showCode?: boolean;
  /** The muted line under a row's label. */
  subLabel?: (option: StatusOption) => string;
  /** A row's right-aligned value, of the caller's own making. Wins over the code. */
  secondary?: (option: StatusOption) => string;
  /** What the control shows for the selection. */
  summary?: PickerSummary;
  /** What one selected status is drawn as. Orthogonal to how many the control shows. */
  badge?: StatusBadgeVariant;
  /** Badges drawn before the rest becomes `+n`. `0` lets the row fit what it can. */
  max?: number;
  /** The site the stock sprite is served from, passed to every badge. Defaults to the context's. */
  siteUrl?: string;
  size?: StatusMultiPickerSize;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
}

interface Loaded {
  loading: boolean;
  error: string | null;
  options: StatusOption[];
  /** The field the codes come from, which is what clause 8 reads `mandatory` off. */
  field: FieldSchema | null;
  statuses: ReadonlyMap<string, StatusRecord>;
}

const LOADING: Loaded = { loading: true, error: null, options: [], field: null, statuses: new Map() };

/**
 * One load, as a store. The read starts in a memo over the props and goes through the
 * context's cache, so it is never an effect re-firing on a "last seen" key.
 */
function statusOptionStore(
  context: SgContext,
  entityType: string,
  projectKey: string,
  field: string | undefined,
) {
  // The context's own services, so every widget on the page shares one schema read
  // and one status table.
  const schema = context.schema;
  const statuses = context.statuses;
  const ids = projectKey === '' ? [] : projectKey.split(',').map(Number);
  const [first] = ids;
  const options =
    first === undefined
      ? schema.statusOptions(entityType, undefined, field)
      : ids.length === 1
        ? schema.statusOptions(entityType, first, field)
        : schema.statusOptionsForProjects(entityType, ids, field);
  // The field itself, for its `mandatory` flag.
  const named = field === undefined ? schema.statusField(entityType) : schema.field(entityType, field);

  const listeners = new Set<() => void>();
  let snapshot = LOADING;
  const settle = (next: Loaded) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  void Promise.all([options, named, statuses.byCode()]).then(
    ([resolved, found, table]) =>
      settle({
        loading: false,
        error: null,
        options: resolved,
        field: typeof found === 'string' || found === undefined ? null : found,
        statuses: table,
      }),
    (error: unknown) =>
      settle({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        options: [],
        field: null,
        statuses: new Map(),
      }),
  );
  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: (): Loaded => snapshot,
  };
}

/**
 * Several statuses, picked from the codes a project offers.
 *
 * The options are `valid_values` minus the project's `hidden_values`, read with
 * `project_id`; over several projects they are the intersection of those sets. REST
 * does not enforce `hidden_values` on write, so the subtraction is the client's job
 * (probe 009). A selected code the option set does not carry keeps a row of its own,
 * labelled with the code, so a selection is never dropped from the display.
 *
 * A status list has no substring operator, so there is no server-side type-ahead over
 * it: the vocabulary is read once and the query input narrows it in the browser
 * (field_types/status_list).
 *
 * A row is the shared picker row of rule 9, after its checkbox: the status icon as the
 * leading glyph, the display label with the matched runs bold, and the code
 * right-aligned. The badge stays in the control, where a status is a value rather than
 * a row.
 */
export function StatusMultiPicker({
  context,
  entityType,
  projectId,
  projectIds,
  field,
  value = [],
  onValueChange,
  placeholder = 'Select statuses',
  searchPlaceholder = 'Search statuses…',
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
  clearable,
  readonly = false,
  disabled = false,
  invalid = false,
  showCode = true,
  subLabel,
  secondary,
  summary = 'ellipsis',
  badge = 'both',
  max = 0,
  siteUrl,
  size = 'md',
  open: openProp,
  onOpenChange,
  className,
  ref,
  ...rest
}: StatusMultiPickerProps) {
  const site = siteUrl ?? context.siteUrl;
  const projectKey = (projectIds ?? (projectId === undefined ? [] : [projectId])).join(',');
  const store = useMemo(
    () => statusOptionStore(context, entityType, projectKey, field),
    // The services are what the store reads through, and they outlive a context copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.schema, context.statuses, entityType, projectKey, field],
  );
  const query = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [search, setSearch] = useState('');

  // `display_values` is the only other source of a label, so the options carry it to the badge.
  const badgeField = { displayValues: Object.fromEntries(query.options.map((o) => [o.code, o.label])) };
  // A stored code outside the usable set is legal, so it keeps a row of its own (probe 009).
  const rows = [
    ...query.options,
    ...value.filter((code) => !query.options.some((o) => o.code === code)).map((code) => ({ code, label: code })),
  ];
  // A status list has no substring operator, so the vocabulary is read once and the
  // search box narrows it here (field_types/status_list).
  const shown = rows.filter((option) => matchesTokens(search, option.label, option.code));
  const byCode = new Map(rows.map((option) => [option.code, option]));

  /**
   * A chip control is a token field, with the caret beside the badges. A summary
   * control is a trigger, and keeps its search box at the top of the popup instead.
   */
  const inline = summary === 'chips';

  // Read-only wins over disabled and over the loading window.
  const inert = !readonly && (disabled || query.loading);
  const interactive = !readonly && !inert;

  /** What the badges look like, so a change to any of it re-measures the row. */
  const rowKey = `${size}|${summary}|${badge}|${interactive}|${value.map((code) => byCode.get(code)?.label ?? code).join(', ')}`;

  function remove(code: string): void {
    onValueChange?.(value.filter((c) => c !== code));
  }

  function removeAt(index: number): void {
    const code = value[index];
    if (code !== undefined) remove(code);
  }

  /** The shared row a status is drawn as. There is no entity behind a code, so it carries no values. */
  const rowOf = (option: StatusOption): PickerRowData => ({
    type: 'Status',
    id: 0,
    name: option.label,
    values: {},
  });

  /** The right-aligned value: the caller's, else the code when it says more than the label. */
  const secondaryOf = (option: StatusOption): string | undefined => {
    if (secondary) return secondary(option) || undefined;
    return showCode && option.code !== option.label ? option.code : undefined;
  };

  function renderItem(code: string): ReactNode {
    const option = byCode.get(code);
    if (!option) return null;
    const chosen = value.includes(code);
    return (
      <ComboboxPrimitive.Item
        key={code}
        data-slot="status-multi-picker-option"
        data-status-code={code}
        data-selected-status={chosen ? 'true' : undefined}
        value={code}
        className={PICKER_ROW}
      >
        <PickerRow
          indicatorSlot="status-multi-picker-check"
          indicator={<Checkbox checked={chosen} tabIndex={-1} aria-hidden="true" className="pointer-events-none" />}
          row={rowOf(option)}
          query={search}
          subLabel={subLabel?.(option)}
          secondary={secondaryOf(option)}
          size={size}
          context={context}
          glyph={
            <StatusBadge
              code={code}
              status={query.statuses.get(code) ?? null}
              field={badgeField}
              variant="glyph"
              size={size}
              siteUrl={site}
            />
          }
        />
      </ComboboxPrimitive.Item>
    );
  }

  return (
    <div
      ref={ref}
      data-slot="status-multi-picker"
      data-size={size}
      data-summary={summary}
      data-badge={badge}
      data-loading={query.loading ? 'true' : undefined}
      className={cn('relative flex w-full min-w-0 items-center', className)}
      {...rest}
    >
      <PickerControl
        slot="status-multi-picker"
        picker="status"
        multiple
        anchored
        keys={value}
        onSelect={(next) => onValueChange?.(next)}
        labels={value.map((code) => byCode.get(code)?.label ?? code)}
        chipsSlot="status-multi-picker-badges"
        items={shown.map((option) => option.code)}
        renderItem={renderItem}
        renderChip={(index, armed, hidden) => {
          const code = value[index];
          if (code === undefined) return null;
          return (
            <span
              key={code}
              data-slot="status-multi-picker-chip"
              data-chip=""
              data-armed={armed ? 'true' : undefined}
              hidden={hidden}
              className={cn('flex min-w-0 shrink-0 items-center', armed && cn(PICKER_ARMED, 'rounded-md'))}
            >
              <StatusBadge
                code={code}
                status={query.statuses.get(code) ?? null}
                field={badgeField}
                variant={badge}
                size={BADGE[size]}
                siteUrl={site}
                removable={interactive}
                onRemove={remove}
                removeLabel={`Remove ${byCode.get(code)?.label ?? code}`}
                className="min-w-0"
              />
            </span>
          );
        }}
        summary={summary}
        // A bare icon is half a badge wide, so a fixed cap fits twice as many.
        max={badge === 'icon' ? max * 2 : max}
        chipRow
        inline={inline}
        rowKey={rowKey}
        size={size}
        disabled={disabled}
        inert={inert}
        readonly={readonly}
        invalid={invalid}
        clearable={clearableForField(clearable, query.field)}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        open={open}
        onOpenChange={setOpen}
        query={search}
        onQueryChange={setSearch}
        onRemoveAt={removeAt}
        onClear={() => onValueChange?.([])}
        loading={query.loading}
        error={query.error}
        empty={shown.length === 0}
        emptyLabel={emptyLabel}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        clearLabel="Clear the statuses"
        triggerLabel="Show the statuses"
        overflowLabel={`Show all ${value.length} statuses`}
      />
    </div>
  );
}
