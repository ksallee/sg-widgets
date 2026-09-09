import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type {
  EntityRef,
  FieldSchema,
  FilterGroup,
  PickerRow,
  SchemaService,
  SearchFieldSpec,
  SgClient,
  StatusRecord,
  StatusService,
  WireGroup,
} from '@sg-widgets/core';
import {
  createEntitySearch,
  createSchemaService,
  createStatusService,
  entityKey,
  highlightRuns,
  isEmptyValue,
  placeholderName,
  renderKindFor,
  withSelectedPinned,
} from '@sg-widgets/core';
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronsUpDown, SearchX, TriangleAlert, X } from 'lucide-react';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { FieldValue } from '@/registry/sg/components/field-value';
import { Thumbnail } from '@/registry/sg/components/thumbnail';
import { UserAvatar } from '@/registry/sg/components/user-avatar';
import { cn } from '@/lib/utils';

export type EntityPickerSize = 'sm' | 'md' | 'lg';

/** Controls follow the input ladder of `docs/design-rules.md`. */
const BOX: Record<EntityPickerSize, string> = {
  sm: 'min-h-8 px-2 py-1',
  md: 'min-h-9 px-3 py-1',
  lg: 'min-h-10 px-3 py-1',
};
const GLYPH: Record<EntityPickerSize, string> = { sm: 'size-4', md: 'size-4', lg: 'size-5' };
/** A chip sits inside the control, so it takes the step below it. */
const CHIP: Record<EntityPickerSize, EntityPickerSize> = { sm: 'sm', md: 'sm', lg: 'md' };

interface SecondaryPlan {
  /** The secondary field's schema, per searched type. */
  fields: Record<string, FieldSchema | undefined>;
  /** `Status` rows by code, read only when the field is a status (probe 010). */
  statuses: Record<string, StatusRecord> | null;
}

const NO_SECONDARY: SecondaryPlan = { fields: {}, statuses: null };

/**
 * What the secondary column draws with: one field read per searched type through the
 * cached schema service, as a store, so the read starts in a memo over the props and
 * never in an effect with a "last seen" key.
 */
function secondaryPlanStore(
  schema: SchemaService,
  statusTable: StatusService,
  types: string[],
  name: string | undefined,
  onError: (error: Error) => void,
) {
  const listeners = new Set<() => void>();
  let snapshot = NO_SECONDARY;
  if (name) {
    void Promise.all(types.map((type) => schema.field(type, name)))
      .then(async (found) => {
        const fields = Object.fromEntries(types.map((type, i) => [type, found[i]]));
        const status = found.some((field) => field && renderKindFor(field.dataType) === 'status');
        snapshot = { fields, statuses: status ? Object.fromEntries(await statusTable.byCode()) : null };
        for (const listener of listeners) listener();
      })
      .catch((error: unknown) => onError(error instanceof Error ? error : new Error(String(error))));
  }
  return {
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: (): SecondaryPlan => snapshot,
  };
}

/** Everything both entity pickers take. They differ only in the shape of the value. */
export interface EntityPickerBaseProps {
  /** Types to search. One for a homogeneous picker, several for a polymorphic one. */
  entityTypes: string[];
  /** A cached client. Every read goes through it. */
  client: SgClient;
  /** Field holding the row label. Defaults to the display-name chain. */
  labelField?: string;
  /**
   * Extra fields the query is matched against, on top of the display-name chain. A
   * function is called with the query, so a field is searched only when it suits it.
   */
  searchFields?: SearchFieldSpec[] | ((query: string) => SearchFieldSpec[]);
  /** Field shown right-aligned, drawn by its data type. Nothing is shown without it. */
  secondaryField?: string;
  /** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
  secondary?: (row: PickerRow) => string;
  /** Field shown under the label. Defaults to the type when several types are searched. */
  subLabelField?: string;
  subLabel?: (row: PickerRow) => string;
  /** Field holding the thumbnail URL. `false` hides the leading slot. */
  thumbnailField?: string | false;
  roundThumbnail?: boolean;
  /** The site the status sprite is served from, for a secondary that is a status. */
  siteUrl?: string;
  /** Extra fields to request, so a caller's own sub-label or secondary can be read. */
  fields?: string[];
  /** Pre-filter merged into every search with `and`. */
  filters?: FilterGroup | WireGroup | null;
  /** Sugar for a project condition. Skipped on a type with no project link. */
  projectId?: number;
  /** Rows to keep out of the results. Pushed into the server filter as `id not_in`. */
  exclude?: EntityRef[];
  minQueryLength?: number;
  pageSize?: number;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyLabel?: string;
  size?: EntityPickerSize;
  disabled?: boolean;
  readOnly?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  debounceMs?: number;
  onError?: (error: Error) => void;
  className?: string;
}

export interface EntityPickerProps extends EntityPickerBaseProps {
  /** The chosen row. A bare `{type, id}` is resolved on mount. */
  value?: EntityRef | null;
  onValueChange?: (value: EntityRef | null, row: PickerRow | null) => void;
}

/**
 * One entity, chosen by server-side search.
 *
 * A query past `minQueryLength` becomes one `contains` condition per word, `or`'d
 * across the type's display-name fields, and goes to `POST /entity/<type>/_search`
 * once per searched type. Under it the same search runs without the name condition,
 * so an open picker lists the rows worked on most recently. Client-side filtering is
 * off: the server is the only authority on what matches. A response from an abandoned
 * query is dropped rather than shown, reads come from the query cache, and every row
 * is held under `Type:id` because a numeric id alone collides across types.
 *
 * The secondary column is drawn by the field's data type through FieldValue, so a
 * status is a badge and a date is formatted.
 */
export function EntityPicker({
  entityTypes,
  client,
  value = null,
  onValueChange,
  labelField,
  searchFields,
  secondaryField,
  secondary,
  subLabelField,
  subLabel,
  thumbnailField = 'image',
  roundThumbnail = false,
  siteUrl,
  fields,
  filters = null,
  projectId,
  exclude,
  minQueryLength = 0,
  pageSize = 20,
  placeholder = 'Search for an entity',
  searchPlaceholder = 'Search…',
  emptyLabel = 'No entity matches.',
  size = 'md',
  disabled = false,
  readOnly = false,
  invalid = false,
  clearable = true,
  debounceMs = 250,
  onError,
  className,
}: EntityPickerProps) {
  const errorRef = useRef(onError);
  errorRef.current = onError;

  // One schema service for the widget. The controller shares it, so a type's fields
  // are read once however many times they are asked for.
  const schema = useMemo(() => createSchemaService(client), [client]);
  const statusTable = useMemo(() => createStatusService(client), [client]);
  const secondaryStore = useMemo(
    () =>
      secondaryPlanStore(schema, statusTable, entityTypes, secondaryField, (error) =>
        errorRef.current?.(error),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema, statusTable, entityTypes.join(','), secondaryField],
  );

  const [search] = useState(() =>
    createEntitySearch({
      client,
      schema,
      entityTypes,
      labelField,
      searchFields,
      secondaryField,
      subLabelField,
      thumbnailField,
      fields,
      filters,
      projectId,
      exclude,
      minQueryLength,
      pageSize,
      debounceMs,
      onError: (error: Error) => errorRef.current?.(error),
    }),
  );
  const state = useSyncExternalStore(search.subscribe, () => search.state, () => search.state);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  // The serialised request, so a caller passing fresh array literals every render
  // does not restart the search.
  const shape = JSON.stringify([
    entityTypes,
    labelField,
    searchFields,
    secondaryField,
    subLabelField,
    thumbnailField,
    fields,
    filters,
    projectId,
    exclude,
    minQueryLength,
    pageSize,
    debounceMs,
  ]);

  useEffect(() => {
    search.update({
      client,
      schema,
      entityTypes,
      labelField,
      searchFields,
      secondaryField,
      subLabelField,
      thumbnailField,
      fields,
      filters,
      projectId,
      exclude,
      minQueryLength,
      pageSize,
      debounceMs,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, client, schema, shape]);

  useEffect(() => () => search.dispose(), [search]);

  // The search runs for an open picker only: the list is what the popover shows, and
  // a closed one has nobody to show it to.
  useEffect(() => {
    if (open) search.setQuery(query);
  }, [search, open, query]);

  // A bare reference is resolved by one batched read, latched on the reference
  // itself, so swapping in a different bare one resolves that one too.
  useEffect(() => {
    if (value) search.hydrate([value]);
  }, [search, value]);

  const selectedRow = value ? (search.known.get(entityKey(value)) ?? null) : null;
  const chipEntity = value
    ? { type: value.type, id: value.id, name: selectedRow?.name || value.name || placeholderName(value) }
    : null;
  const options = withSelectedPinned(state.rows, value ? [value] : [], search.known);
  const polymorphic = entityTypes.length > 1;
  const hasSubLabel = Boolean(subLabelField || subLabel);
  const interactive = !disabled && !readOnly;
  const showClear = clearable && Boolean(value) && interactive;
  /** An id is a code, and codes are the mono treatment of `docs/design-rules.md`. */
  const secondaryIsId = secondaryField === 'id';
  const secondaryPlan = useSyncExternalStore(
    secondaryStore.subscribe,
    secondaryStore.snapshot,
    secondaryStore.snapshot,
  );

  function thumbOf(row: PickerRow): string | null {
    if (thumbnailField === false) return null;
    const raw = row.values[thumbnailField ?? 'image'];
    return typeof raw === 'string' ? raw : null;
  }

  function subLabelOf(row: PickerRow): string {
    if (subLabel) return subLabel(row);
    if (subLabelField) {
      const raw = row.values[subLabelField];
      return raw === null || raw === undefined ? '' : String(raw);
    }
    return '';
  }

  /** The id is on the row itself, not among the attributes a read returns. */
  function secondaryValue(row: PickerRow): unknown {
    if (!secondaryField) return null;
    return secondaryField === 'id' ? row.id : row.values[secondaryField];
  }

  function secondaryType(row: PickerRow): string {
    return secondaryPlan.fields[row.type]?.dataType ?? (secondaryIsId ? 'number' : 'text');
  }

  function isPerson(row: PickerRow): boolean {
    return row.type === 'HumanUser' || row.type === 'ApiUser';
  }

  function choose(row: PickerRow): void {
    search.remember([row]);
    onValueChange?.({ type: row.type, id: row.id, name: row.name }, row);
    setOpen(false);
  }

  return (
    <div
      data-slot="entity-picker"
      data-size={size}
      data-multiple="false"
      className={cn(
        'relative flex w-full min-w-0 items-center',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
    >
      <Popover open={open} onOpenChange={(next) => setOpen(interactive ? next : false)}>
        <div
          data-slot="entity-picker-control"
          aria-invalid={invalid ? 'true' : undefined}
          aria-disabled={disabled ? 'true' : undefined}
          data-readonly={readOnly ? 'true' : undefined}
          className={cn(
            'border-input bg-background has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 relative flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-md border text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 aria-invalid:ring-2',
            BOX[size],
            readOnly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8',
          )}
        >
          {/*
            The trigger covers the control rather than sitting inside it, so the popup
            anchors to the whole field and a chip's remove control is a sibling button
            rather than a button inside a button.
          */}
          <PopoverTrigger
            data-slot="entity-picker-trigger"
            role="combobox"
            aria-expanded={open}
            aria-label={chipEntity?.name ?? placeholder}
            disabled={!interactive}
            title={chipEntity?.name ?? placeholder}
            className="absolute inset-0 rounded-md outline-none"
          />
          {chipEntity ? (
            <span
              data-slot="entity-picker-value"
              className="pointer-events-none relative flex min-w-0 flex-wrap items-center gap-1.5 [&_button]:pointer-events-auto"
            >
              <EntityChip
                entity={chipEntity}
                thumbnail={selectedRow ? thumbOf(selectedRow) : null}
                size={CHIP[size]}
              />
            </span>
          ) : (
            <span className="text-muted-foreground pointer-events-none relative min-w-0 truncate">{placeholder}</span>
          )}
        </div>

        <PopoverContent
          data-picker="entity"
          align="start"
          className="w-96 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
        >
          <Command shouldFilter={false} loop>
            <CommandInput autoFocus value={query} onValueChange={setQuery} placeholder={searchPlaceholder} />
            <CommandList>
              {state.error ? (
                <div
                  data-slot="entity-picker-error"
                  className="text-destructive flex items-center justify-center gap-1.5 py-6 text-center text-sm"
                >
                  <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
                  <span className="truncate">{state.error.message}</span>
                </div>
              ) : state.loading && options.length === 0 ? (
                <div data-slot="entity-picker-loading" className="flex flex-col gap-2 p-1">
                  {[0, 1, 2].map((row) => (
                    <Skeleton key={row} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <>
                  <CommandEmpty>
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <SearchX aria-hidden="true" className="size-4 shrink-0" />
                      {emptyLabel}
                    </span>
                  </CommandEmpty>
                  {options.map((row) => {
                    const chosen = Boolean(value && entityKey(value) === entityKey(row));
                    const sub = subLabelOf(row);
                    const custom = secondary ? secondary(row) : !secondaryField && polymorphic ? row.type : '';
                    const raw = secondaryValue(row);
                    return (
                      <CommandItem
                        key={entityKey(row)}
                        data-slot="entity-picker-option"
                        data-entity-type={row.type}
                        data-entity-id={row.id}
                        data-checked={chosen ? 'true' : undefined}
                        value={entityKey(row)}
                        onSelect={() => choose(row)}
                        className={hasSubLabel ? 'items-start' : undefined}
                      >
                        {thumbnailField === false ? null : (
                          <span data-slot="entity-picker-leading" className="flex shrink-0 items-center">
                            {isPerson(row) ? (
                              <UserAvatar
                                name={row.name}
                                image={thumbOf(row)}
                                size={size}
                                apiUser={row.type === 'ApiUser'}
                                inactive={row.values['sg_status_list'] === 'dis'}
                              />
                            ) : (
                              <Thumbnail
                                src={thumbOf(row)}
                                aspect="square"
                                size={size}
                                className={roundThumbnail ? 'rounded-full' : undefined}
                              />
                            )}
                          </span>
                        )}
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span data-slot="entity-picker-label" className="truncate" title={row.name}>
                            {highlightRuns(row.name, state.query).map((run, i) => (
                              <span key={i} className={run.match ? 'font-semibold' : undefined}>
                                {run.text}
                              </span>
                            ))}
                          </span>
                          {sub ? (
                            // Highlighted too, so a row matched on its login or its email shows why.
                            <span
                              data-slot="entity-picker-sub-label"
                              className="text-muted-foreground truncate text-xs"
                            >
                              {highlightRuns(sub, state.query).map((run, i) => (
                                <span key={i} className={run.match ? 'font-semibold' : undefined}>
                                  {run.text}
                                </span>
                              ))}
                            </span>
                          ) : null}
                        </span>
                        {custom ? (
                          <span
                            data-slot="entity-picker-secondary"
                            className="text-muted-foreground shrink-0 text-xs"
                          >
                            {custom}
                          </span>
                        ) : secondaryField && !isEmptyValue(raw) ? (
                          <span
                            data-slot="entity-picker-secondary"
                            className={cn(
                              'text-muted-foreground flex shrink-0 items-center text-xs',
                              secondaryIsId && 'font-mono tabular-nums',
                            )}
                          >
                            <FieldValue
                              value={raw}
                              dataType={secondaryType(row)}
                              field={secondaryPlan.fields[row.type] ?? null}
                              statuses={secondaryPlan.statuses}
                              siteUrl={siteUrl}
                              className="w-auto justify-end text-xs"
                            />
                          </span>
                        ) : null}
                      </CommandItem>
                    );
                  })}
                  {state.hasMore ? (
                    <CommandItem
                      data-slot="entity-picker-more"
                      value="__load-more"
                      onSelect={() => search.loadMore()}
                      className="text-muted-foreground justify-center text-xs"
                    >
                      {state.loading ? 'Loading…' : 'Load more'}
                    </CommandItem>
                  ) : null}
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {readOnly ? null : (
        <div className="pointer-events-none absolute right-2 flex items-center gap-1">
          {showClear ? (
            <button
              type="button"
              data-slot="entity-picker-clear"
              aria-label="Clear the selection"
              onClick={() => onValueChange?.(null, null)}
              className="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
            >
              <X aria-hidden="true" className={GLYPH[size]} />
            </button>
          ) : null}
          <ChevronsUpDown aria-hidden="true" className={cn('shrink-0 opacity-50', GLYPH[size])} />
        </div>
      )}
    </div>
  );
}
