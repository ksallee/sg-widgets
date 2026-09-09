import { useMemo, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { SgClient, StatusOption, StatusRecord } from '@sg-widgets/core';
import { createSchemaService, createStatusService } from '@sg-widgets/core';
import { ChevronsUpDown, SearchX, TriangleAlert, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { StatusBadge } from '@/registry/sg/components/status-badge';

export type StatusMultiPickerSize = 'sm' | 'md' | 'lg';
/** What the closed trigger shows for the selection. */
export type StatusMultiPickerSummary = 'icons' | 'names' | 'both' | 'count';

/** Controls follow the input ladder of `docs/design-rules.md`. */
const BOX: Record<StatusMultiPickerSize, string> = {
  sm: 'h-8 px-2',
  md: 'h-9 px-3',
  lg: 'h-10 px-3',
};
const GLYPH: Record<StatusMultiPickerSize, string> = {
  sm: 'size-4',
  md: 'size-4',
  lg: 'size-5',
};
/** A badge inside a control sits one step down the leaf ladder. */
const BADGE: Record<StatusMultiPickerSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };
/** The badge row in the trigger: one line, clipped, never taller than the control. */
const BADGES = 'flex min-w-0 items-center gap-1 overflow-hidden';

function countLabel(n: number): string {
  return `${n} ${n === 1 ? 'status' : 'statuses'}`;
}

const TRIGGER =
  'border-input bg-background focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex w-full min-w-0 items-center rounded-md border text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2';

export interface StatusMultiPickerProps {
  /** The site to read from. Wrap it in `createQueryCache` so widgets on a page share one read. */
  client: SgClient;
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
  emptyLabel?: string;
  clearable?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
  invalid?: boolean;
  /** Show the raw code instead of the label. The other one stays in the tooltip. */
  showCode?: boolean;
  /** What the closed trigger shows for the selection. */
  summary?: StatusMultiPickerSummary;
  /** Above this many selected, every mode reads as a count. `icons` collapses at twice this. */
  max?: number;
  /** The site the stock sprite is served from, passed to every badge. */
  siteUrl?: string;
  size?: StatusMultiPickerSize;
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
 * Several statuses, picked from the codes a project offers.
 *
 * The options are `valid_values` minus the project's `hidden_values`, read with
 * `project_id`; over several projects they are the intersection of those sets. REST
 * does not enforce `hidden_values` on write, so the subtraction is the client's job
 * (probe 009). A selected code the option set does not carry keeps a row of its own,
 * labelled with the code, so a selection is never dropped from the display.
 *
 * A status list has no substring operator, so there is no server-side type-ahead over
 * it: the vocabulary is read once and the search box filters it in the browser
 * (field_types/status_list).
 */
export function StatusMultiPicker({
  client,
  entityType,
  projectId,
  projectIds,
  field,
  value = [],
  onValueChange,
  placeholder = 'Select statuses',
  searchPlaceholder = 'Search statuses…',
  emptyLabel = 'No status matches.',
  clearable = true,
  readOnly = false,
  disabled = false,
  invalid = false,
  showCode = false,
  summary = 'both',
  max = 3,
  siteUrl,
  size = 'md',
  className,
}: StatusMultiPickerProps) {
  const projectKey = (projectIds ?? (projectId === undefined ? [] : [projectId])).join(',');
  const store = useMemo(
    () => statusOptionStore(client, entityType, projectKey, field),
    [client, entityType, projectKey, field],
  );
  const query = useSyncExternalStore(store.subscribe, store.snapshot, store.snapshot);
  const [open, setOpen] = useState(false);

  // `display_values` is the only other source of a label, so the options carry it to the badge.
  const badgeField = { displayValues: Object.fromEntries(query.options.map((o) => [o.code, o.label])) };
  // A stored code outside the usable set is legal, so it keeps a row of its own (probe 009).
  const rows = [
    ...query.options,
    ...value.filter((code) => !query.options.some((o) => o.code === code)).map((code) => ({ code, label: code })),
  ];
  const title =
    value.length === 0
      ? placeholder
      : value.map((code) => rows.find((o) => o.code === code)?.label ?? code).join(', ');

  // Read-only wins over disabled and over the loading window.
  const inert = !readOnly && (disabled || query.loading);
  const showClear = clearable && value.length > 0 && !readOnly && !disabled;
  // Icons take half the width of a badge, so that mode holds twice as many.
  const collapsed = summary === 'count' || value.length > (summary === 'icons' ? max * 2 : max);

  const toggle = (code: string) => {
    onValueChange?.(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  };

  const badge = (code: string, variant: 'both' | 'icon') => (
    <StatusBadge
      key={code}
      code={code}
      status={query.statuses.get(code) ?? null}
      field={badgeField}
      variant={variant}
      size={BADGE[size]}
      label={showCode ? 'code' : 'name'}
      siteUrl={siteUrl}
      className="min-w-0"
    />
  );

  let shown: ReactNode;
  if (value.length === 0) shown = <span className="text-muted-foreground truncate">{placeholder}</span>;
  else if (collapsed) shown = <span className="truncate">{countLabel(value.length)}</span>;
  else if (summary === 'names')
    shown = (
      <span title={title} className="truncate">
        {title}
      </span>
    );
  else
    shown = (
      <span data-slot="status-multi-picker-badges" className={BADGES}>
        {value.map((code) => badge(code, summary === 'icons' ? 'icon' : 'both'))}
      </span>
    );

  const selection = (
    <span data-slot="status-multi-picker-value" className="flex min-w-0 flex-1 items-center">
      {shown}
    </span>
  );

  let list: ReactNode;
  if (query.error !== null) {
    list = (
      <div
        data-slot="status-multi-picker-error"
        className="text-destructive flex items-center justify-center gap-1.5 py-6 text-center text-sm"
      >
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
        <span className="truncate">{query.error}</span>
      </div>
    );
  } else if (query.loading) {
    list = (
      <div data-slot="status-multi-picker-loading" className="flex flex-col gap-2 p-1">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-8 w-full" />
        ))}
      </div>
    );
  } else {
    list = (
      <>
        <CommandEmpty>
          <span className="text-muted-foreground inline-flex items-center gap-1.5">
            <SearchX aria-hidden="true" className="size-4 shrink-0" />
            {emptyLabel}
          </span>
        </CommandEmpty>
        {rows.map((option) => (
          <CommandItem
            key={option.code}
            value={option.code}
            keywords={[option.label]}
            onSelect={() => toggle(option.code)}
          >
            <Checkbox
              checked={value.includes(option.code)}
              tabIndex={-1}
              aria-hidden="true"
              className="pointer-events-none"
            />
            {badge(option.code, 'both')}
          </CommandItem>
        ))}
      </>
    );
  }

  return (
    <div
      data-slot="status-multi-picker"
      data-size={size}
      data-loading={query.loading ? 'true' : undefined}
      className={cn('relative flex w-full min-w-0 items-center', className)}
    >
      {readOnly ? (
        <div
          data-slot="status-multi-picker-trigger"
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
          <Popover open={open} onOpenChange={(next) => setOpen(inert ? false : next)}>
            <PopoverTrigger
              data-slot="status-multi-picker-trigger"
              role="combobox"
              aria-expanded={open}
              aria-invalid={invalid ? 'true' : undefined}
              disabled={inert}
              title={title}
              className={cn(TRIGGER, BOX[size], showClear ? 'pr-14' : 'pr-8')}
            >
              {selection}
            </PopoverTrigger>

            {/* The anchor width is the primitive's own variable, so the list matches the trigger. */}
            <PopoverContent
              data-picker="status"
              align="start"
              className="w-(--anchor-width) min-w-56 gap-0 overflow-hidden p-0"
            >
              <Command label="Statuses">
                <CommandInput placeholder={searchPlaceholder} />
                <CommandList>{list}</CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className="pointer-events-none absolute right-2 flex items-center gap-1">
            {showClear ? (
              <button
                type="button"
                data-slot="status-multi-picker-clear"
                aria-label="Clear the statuses"
                onClick={() => onValueChange?.([])}
                className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
              >
                <X aria-hidden="true" className={GLYPH[size]} />
              </button>
            ) : null}
            <ChevronsUpDown aria-hidden="true" className={cn('shrink-0 opacity-50', GLYPH[size])} />
          </div>
        </>
      )}
    </div>
  );
}
