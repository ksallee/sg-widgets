import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { SgClient, StatusOption, StatusRecord } from '@sg-widgets/core';
import { createSchemaService, createStatusService } from '@sg-widgets/core';
import { SearchX, TriangleAlert, X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/registry/sg/components/status-badge';

export type StatusPickerSize = 'sm' | 'md' | 'lg';

/**
 * Controls follow the input ladder of `docs/design-rules.md`. The height carries `!`
 * because the select trigger sets its own under a `data-size` selector.
 */
const BOX: Record<StatusPickerSize, string> = {
  sm: 'h-8! px-2',
  md: 'h-9! px-3',
  lg: 'h-10! px-3',
};
const GLYPH: Record<StatusPickerSize, string> = {
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};
/** A badge inside a control sits one step down the leaf ladder. */
const BADGE: Record<StatusPickerSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

const TRIGGER =
  'border-input bg-background focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex w-full min-w-0 items-center rounded-md border text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2';

export interface StatusPickerProps {
  /** The site to read from. Wrap it in `createQueryCache` so widgets on a page share one read. */
  client: SgClient;
  entityType: string;
  /** Offer the codes this project allows. */
  projectId?: number;
  /** Offer the codes every one of these projects allows. */
  projectIds?: number[];
  /** A list or status field other than the type's own. Project's is `sg_status`. */
  field?: string;
  /** The selected code. */
  value?: string;
  onValueChange?: (value: string | undefined) => void;
  placeholder?: string;
  emptyLabel?: string;
  clearable?: boolean;
  readonly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Show the raw code instead of the label. The other one stays in the tooltip. */
  showCode?: boolean;
  /** The site the stock sprite is served from, passed to every badge. */
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
  statuses: ReadonlyMap<string, StatusRecord>;
}

const LOADING: Loaded = { loading: true, error: null, options: [], statuses: new Map() };

/**
 * One load, as a store. The read starts in a memo over the props and goes through the
 * cache the client carries, so it is never an effect re-firing on a "last seen" key.
 */
function statusOptionStore(
  client: SgClient,
  entityType: string,
  projectKey: string,
  field: string | undefined,
) {
  const schema = createSchemaService(client);
  const statuses = createStatusService(client);
  const ids = projectKey === '' ? [] : projectKey.split(',').map(Number);
  const [first] = ids;
  const options =
    first === undefined
      ? schema.statusOptions(entityType, undefined, field)
      : ids.length === 1
        ? schema.statusOptions(entityType, first, field)
        : schema.statusOptionsForProjects(entityType, ids, field);

  const listeners = new Set<() => void>();
  let snapshot = LOADING;
  const settle = (next: Loaded) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  void Promise.all([options, statuses.byCode()]).then(
    ([resolved, table]) => settle({ loading: false, error: null, options: resolved, statuses: table }),
    (error: unknown) =>
      settle({
        loading: false,
        error: error instanceof Error ? error.message : String(error),
        options: [],
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
 * The options are `valid_values` minus the project's `hidden_values`, read with
 * `project_id`; over several projects they are the intersection of those sets. REST
 * does not enforce `hidden_values` on write, so the subtraction is the client's job
 * (probe 009). A code the option set does not carry still renders, as itself: a row
 * may legally hold one (field_types/status_list). When a later option set drops the
 * selected code, the picker clears it and emits once.
 */
export function StatusPicker({
  client,
  entityType,
  projectId,
  projectIds,
  field,
  value,
  onValueChange,
  placeholder = 'Select a status',
  emptyLabel = 'No status on this field.',
  clearable = true,
  readonly = false,
  disabled = false,
  invalid = false,
  showCode = false,
  siteUrl,
  size = 'md',
  open: openProp,
  onOpenChange,
  className,
}: StatusPickerProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };

  const projectKey = (projectIds ?? (projectId === undefined ? [] : [projectId])).join(',');
  const store = useMemo(
    () => statusOptionStore(client, entityType, projectKey, field),
    [client, entityType, projectKey, field],
  );
  const query = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);

  // `display_values` is the only other source of a label, so the options carry it to the badge.
  const badgeField = { displayValues: Object.fromEntries(query.options.map((o) => [o.code, o.label])) };
  const unknown = value !== undefined && value !== '' && !query.options.some((o) => o.code === value);
  // A stored code outside the usable set is legal, so it still gets a row (probe 009).
  const rows = unknown && value ? [...query.options, { code: value, label: value }] : query.options;
  const title = value ? (rows.find((o) => o.code === value)?.label ?? value) : placeholder;

  // Read-only wins over disabled and over the loading window.
  const inert = !readonly && (disabled || query.loading);
  const showClear = clearable && Boolean(value) && !readonly && !disabled;

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
    if (dropped) onValueChange?.(undefined);
  }, [query, value, onValueChange]);

  const badge = (code: string) => (
    <StatusBadge
      code={code}
      status={query.statuses.get(code) ?? null}
      field={badgeField}
      size={BADGE[size]}
      label={showCode ? 'code' : 'name'}
      siteUrl={siteUrl}
      className="min-w-0"
    />
  );

  // The value keeps clear of the clear control, which floats over the trigger.
  const selection = (
    <span
      data-slot="status-picker-value"
      className={cn('flex min-w-0 flex-1 items-center', showClear && 'pr-8')}
    >
      {value ? badge(value) : <span className="text-muted-foreground truncate">{placeholder}</span>}
    </span>
  );

  let list: ReactNode;
  if (query.error !== null) {
    list = (
      <div
        data-slot="status-picker-error"
        className="text-destructive flex items-center justify-center gap-1.5 py-6 text-center text-sm"
      >
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{query.error}</span>
      </div>
    );
  } else if (query.loading) {
    list = (
      <div data-slot="status-picker-loading" className="flex flex-col gap-2 p-1">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    );
  } else if (rows.length === 0) {
    list = (
      <div
        data-slot="status-picker-empty"
        className="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-center text-sm"
      >
        <SearchX aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{emptyLabel}</span>
      </div>
    );
  } else {
    list = (
      <SelectGroup>
        {rows.map((option) => (
          <SelectItem key={option.code} value={option.code} className="py-1.5 pl-2">
            {badge(option.code)}
          </SelectItem>
        ))}
      </SelectGroup>
    );
  }

  return (
    <div
      data-slot="status-picker"
      data-size={size}
      data-loading={query.loading ? 'true' : undefined}
      className={cn('relative flex w-full min-w-0 items-center', className)}
    >
      {readonly ? (
        <div
          data-slot="status-picker-trigger"
          data-readonly="true"
          aria-readonly="true"
          aria-invalid={invalid ? 'true' : undefined}
          title={title}
          className={cn(TRIGGER, BOX[size], 'pr-3')}
        >
          {selection}
        </div>
      ) : (
        <>
          <Select
            value={value ?? null}
            onValueChange={(next: string | null) => onValueChange?.(next ?? undefined)}
            disabled={inert}
            open={open}
            onOpenChange={(next: boolean) => setOpen(inert ? false : next)}
          >
            <SelectTrigger
              aria-invalid={invalid ? 'true' : undefined}
              title={title}
              className={cn(TRIGGER, BOX[size])}
            >
              {selection}
            </SelectTrigger>
            <SelectContent align="start" alignItemWithTrigger={false} className="p-0">
              {list}
            </SelectContent>
          </Select>

          {showClear ? (
            <button
              type="button"
              data-slot="status-picker-clear"
              aria-label="Clear the status"
              onClick={() => onValueChange?.(undefined)}
              className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background absolute right-8 shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
            >
              <X aria-hidden="true" className={GLYPH[size]} />
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
