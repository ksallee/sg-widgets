import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { FieldSchema, SgContext, StatusOption, StatusRecord } from '@sg-widgets/core';
import { NO_ROWS_LABEL } from '@sg-widgets/core';
import { LEAF_GLYPH } from '@/registry/sg/components/leaf-classes';
import { ListPicker } from '@/registry/sg/components/list-picker';
import { PICKER_CHIP as BADGE } from '@/registry/sg/components/picker-classes';
import { StatusBadge } from '@/registry/sg/components/status-badge';
import { StatusGlyph } from '@/registry/sg/components/status-glyph';

export type StatusPickerSize = 'sm' | 'md' | 'lg';

export interface StatusPickerProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'slot'> {
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
  /** The selected code, or `null` when nothing is chosen. */
  value?: string | null;
  onValueChange?: (value: string | null) => void;
  placeholder?: string;
  /** Shown when the field offers nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
  /** Offer a control that clears the value. A mandatory field is never clearable. */
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
  /** The site the stock sprite is served from, passed to every badge. Defaults to the context's. */
  siteUrl?: string;
  size?: StatusPickerSize;
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

  // The field itself, for its display name and its `mandatory` flag.
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
 * One status, picked from the codes a project offers.
 *
 * The clear follows clause 8 of the picker contract: the field's own schema decides,
 * and a site that flags its status field mandatory gets no cross.
 *
 * The list picker with a status row and a badge for its value. The options are
 * `valid_values` minus the project's `hidden_values`, read with `project_id`; over
 * several projects they are the intersection of those sets. REST does not enforce
 * `hidden_values` on write, so the subtraction is the client's job (probe 009). A code
 * the option set does not carry still renders, as itself: a row may legally hold one
 * (field_types/status_list). When a later option set drops the selected code, the
 * picker clears it and emits once.
 *
 * A row is the shared picker row of rule 9: the status glyph as the leading mark, the
 * display label as the row's text, and the code right-aligned. The badge stays in the
 * control, where a status is a value rather than an option.
 */
export function StatusPicker({
  context,
  entityType,
  projectId,
  projectIds,
  field,
  value,
  onValueChange,
  placeholder = 'Select a status',
  emptyLabel = NO_ROWS_LABEL,
  loadingLabel,
  errorLabel,
  clearable,
  readonly = false,
  disabled = false,
  invalid = false,
  showCode = true,
  subLabel,
  secondary,
  siteUrl,
  size = 'md',
  open: openProp,
  onOpenChange,
  className,
  ref,
  ...rest
}: StatusPickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const site = siteUrl ?? context.siteUrl;
  const projectKey = (projectIds ?? (projectId === undefined ? [] : [projectId])).join(',');
  const store = useMemo(
    () => statusOptionStore(context, entityType, projectKey, field),
    // The services are what the store reads through, and they outlive a context copy.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [context.schema, context.statuses, entityType, projectKey, field],
  );
  const query = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);

  // `display_values` is the only other source of a label, so the options carry it to the badge.
  const badgeField = { displayValues: Object.fromEntries(query.options.map((o) => [o.code, o.label])) };

  // The first option set is not a change: it is what the widget was mounted to show.
  const seen = useRef<string | null>(null);
  useEffect(() => {
    if (query.loading || query.error !== null) return;
    const codes = query.options.map((o) => o.code).join(',');
    const dropped =
      seen.current !== null &&
      seen.current !== codes &&
      Boolean(value) &&
      !query.options.some((o) => o.code === value);
    seen.current = codes;
    if (dropped) onValueChange?.(null);
  }, [query, value, onValueChange]);

  return (
    <ListPicker
      ref={ref}
      slot="status-picker"
      picker="status"
      options={query.options}
      value={value ?? null}
      onValueChange={(next) => onValueChange?.(next)}
      placeholder={placeholder}
      emptyLabel={emptyLabel}
      loadingLabel={loadingLabel}
      errorLabel={errorLabel}
      loading={query.loading}
      loadError={query.error}
      field={query.field}
      clearable={clearable}
      clearLabel="Clear the status"
      triggerLabel="Show the statuses"
      readonly={readonly}
      disabled={disabled}
      invalid={invalid}
      showCode={showCode}
      subLabel={subLabel}
      secondary={secondary}
      size={size}
      open={open}
      onOpenChange={setOpen}
      className={className}
      valueChip={(code) => (
        <StatusBadge
          key={code}
          code={code}
          status={query.statuses.get(code) ?? null}
          field={badgeField}
          size={BADGE[size]}
          siteUrl={site}
          className="min-w-0"
        />
      )}
      mark={(option) => (
        <StatusGlyph status={query.statuses.get(option.code) ?? null} siteUrl={site} fallback className={LEAF_GLYPH[size]} />
      )}
      {...rest}
    />
  );
}
