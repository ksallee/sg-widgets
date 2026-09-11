import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type {
  EntityRef,
  FieldSpec,
  FilterGroup,
  PickerRow as PickerRowData,
  SearchFieldSpec,
  SgContext,
  WireGroup,
} from '@sg-widgets/core';
import {
  createEntitySearch,
  entityKey,
  NO_MATCH_LABEL,
  pathOf,
  placeholderName,
  rowThumbnail,
  withSelectedPinned,
} from '@sg-widgets/core';
import { Combobox as ComboboxPrimitive } from '@base-ui/react';
import { Check } from 'lucide-react';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { PICKER_ARMED, PICKER_CHIP, PICKER_ROW } from '@/registry/sg/components/picker-classes';
import { PickerControl } from '@/registry/sg/components/picker-control';
import { PickerRow } from '@/registry/sg/components/picker-row';
import { cn } from '@/lib/utils';

export type EntityPickerSize = 'sm' | 'md' | 'lg';

/** Everything both entity pickers take. They differ only in the shape of the value. */
export interface EntityPickerBaseProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onError'> {
  /** The root element. */
  ref?: React.Ref<HTMLDivElement>;

  /** Types to search. One for a homogeneous picker, several for a polymorphic one. */
  entityTypes: string[];
  /** The widget context. Every read goes through it, so widgets on a page share one cache. */
  context: SgContext;
  /** Field holding the row label. Defaults to the display-name chain. */
  labelField?: string;
  /**
   * Extra fields the query is matched against, on top of the display-name chain. A
   * function is called with the query, so a field is searched only when it suits it.
   */
  searchFields?: SearchFieldSpec[] | ((query: string) => SearchFieldSpec[]);
  /** Field shown right-aligned, drawn by its data type. A path, or a resolved column. */
  secondaryField?: FieldSpec | null;
  /** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
  secondary?: (row: PickerRowData) => string;
  /** Field shown under the label: a path, or a resolved column. */
  subLabelField?: FieldSpec | null;
  /** The muted line of the caller's own making. Wins over `subLabelField`. */
  subLabel?: (row: PickerRowData) => string;
  /** Field holding the thumbnail URL. `false` hides the leading slot. */
  thumbnail?: string | false;
  roundThumbnail?: boolean;
  /** Show the row's `code` beside the label when the two differ. */
  showCode?: boolean;
  /** The site the status sprite is served from, for a secondary that is a status. Defaults to the context's. */
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
  /** Shown when the query matches nothing. */
  emptyLabel?: string;
  /** The accessible name of the skeletons a read stands behind. */
  loadingLabel?: string;
  /** Shown in place of what the failed read said. */
  errorLabel?: string;
  size?: EntityPickerSize;
  disabled?: boolean;
  readonly?: boolean;
  invalid?: boolean;
  clearable?: boolean;
  debounceMs?: number;
  /** Whether the popup is showing. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onError?: (error: Error) => void;
  className?: string;
}

export interface EntityPickerProps extends EntityPickerBaseProps {
  /** The chosen row. A bare `{type, id}` is resolved on mount. */
  value?: EntityRef | null;
  onValueChange?: (value: EntityRef | null, row: PickerRowData | null) => void;
}

/**
 * One entity, chosen by server-side search.
 *
 * A query past `minQueryLength` becomes one `contains` condition per word, `or`'d
 * across the type's display-name fields, and goes to `POST /entity/<type>/_search`
 * once per searched type. Under it the same search runs without the name condition,
 * so an open picker lists the rows worked on most recently. The combobox does no
 * filtering of its own: the server is the only authority on what matches. A response
 * from an abandoned query is dropped rather than shown, reads come from the query
 * cache, and every row is held under `Type:id` because a numeric id alone collides
 * across types.
 *
 * The secondary column is drawn by the field's data type through FieldValue, so a
 * status is a badge and a date is formatted.
 */
export function EntityPicker({
  entityTypes,
  context,
  value = null,
  onValueChange,
  labelField,
  searchFields,
  secondaryField,
  secondary,
  subLabelField,
  subLabel,
  thumbnail = 'image',
  roundThumbnail = false,
  showCode = false,
  siteUrl,
  fields,
  filters = null,
  projectId,
  exclude,
  minQueryLength = 0,
  pageSize = 20,
  placeholder = 'Search for an entity',
  searchPlaceholder = 'Search…',
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
  size = 'md',
  disabled = false,
  readonly = false,
  invalid = false,
  clearable = true,
  debounceMs = 250,
  open: openProp,
  onOpenChange,
  onError,
  className,
  ref,
  ...rest
}: EntityPickerProps) {
  const errorRef = useRef(onError);
  errorRef.current = onError;

  // The context's own services, so every widget on the page shares one schema read
  // and one status table.
  const schema = context.schema;
  const site = siteUrl ?? context.siteUrl;

  const [search] = useState(() =>
    createEntitySearch({
      client: context.client,
      schema,
      entityTypes,
      labelField,
      searchFields,
      secondaryField,
      subLabelField,
      thumbnail,
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

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const setOpen = (next: boolean): void => {
    setUncontrolledOpen(next);
    onOpenChange?.(next);
  };
  const [query, setQuery] = useState('');

  // The serialised request, so a caller passing fresh array literals every render
  // does not restart the search.
  const shape = JSON.stringify([
    entityTypes,
    labelField,
    searchFields,
    secondaryField,
    subLabelField,
    thumbnail,
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
      client: context.client,
      schema,
      entityTypes,
      labelField,
      searchFields,
      secondaryField,
      subLabelField,
      thumbnail,
      fields,
      filters,
      projectId,
      exclude,
      minQueryLength,
      pageSize,
      debounceMs,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, context.client, schema, shape]);

  useEffect(() => () => search.dispose(), [search]);

  // The search runs for an open picker only: the list is what the popup shows, and
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
  const selectedKey = value ? entityKey(value) : '';

  /** The caller's own sub-label. Absent, the row reads `subLabelField` itself. */
  function subLabelOf(row: PickerRowData): string | undefined {
    return subLabel ? subLabel(row) : undefined;
  }

  /** The caller's own secondary, and the type on a polymorphic list that names no field. */
  function customSecondary(row: PickerRowData): string | undefined {
    if (secondary) return secondary(row);
    return !pathOf(secondaryField) && polymorphic ? row.type : undefined;
  }

  function clear(): void {
    onValueChange?.(null, null);
  }

  function choose(keys: string[]): void {
    const row = options.find((option) => entityKey(option) === keys[0]);
    if (!row) return;
    search.remember([row]);
    onValueChange?.({ type: row.type, id: row.id, name: row.name }, row);
  }

  const byKey = new Map(options.map((row) => [entityKey(row), row]));

  function renderItem(key: string): ReactNode {
    const row = byKey.get(key);
    if (!row) return null;
    const chosen = selectedKey === key;
    return (
      <ComboboxPrimitive.Item
        key={key}
        data-slot="entity-picker-option"
        data-entity-type={row.type}
        data-entity-id={row.id}
        data-checked={chosen ? 'true' : undefined}
        value={key}
        className={cn(PICKER_ROW, hasSubLabel && 'items-start')}
      >
        <PickerRow
          indicator={chosen ? <Check aria-hidden="true" className="size-4" /> : null}
          row={row}
          query={state.query}
          thumbnail={thumbnail}
          roundThumbnail={roundThumbnail}
          showCode={showCode}
          subLabelField={subLabelField}
          subLabel={subLabelOf(row)}
          secondaryField={secondaryField}
          secondary={customSecondary(row)}
          size={size}
          context={context}
          siteUrl={site}
        />
      </ComboboxPrimitive.Item>
    );
  }

  return (
    <div
      ref={ref}
      data-slot="entity-picker"
      data-size={size}
      data-multiple="false"
      className={cn(
        'relative flex w-full min-w-0 items-center',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      {...rest}
    >
      <PickerControl
        slot="entity-picker"
        picker="entity"
        keys={value ? [selectedKey] : []}
        onSelect={choose}
        labels={chipEntity ? [chipEntity.name] : []}
        items={options.map(entityKey)}
        renderItem={renderItem}
        renderChip={(_index, armed) => (
          <EntityChip
            entity={chipEntity!}
            thumbnail={selectedRow ? rowThumbnail(selectedRow.values, { thumbnail }) : null}
            size={PICKER_CHIP[size]}
            context={context}
            siteUrl={site}
            data-armed={armed ? 'true' : undefined}
            className={armed ? PICKER_ARMED : undefined}
          />
        )}
        summary="chips"
        tokenInput={false}
        inputPlaceholder={chipEntity ? searchPlaceholder : placeholder}
        size={size}
        disabled={disabled}
        readonly={readonly}
        invalid={invalid}
        clearable={clearable}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        open={open}
        onOpenChange={setOpen}
        query={query}
        onQueryChange={setQuery}
        onRemoveAt={clear}
        onClear={clear}
        loading={state.loading && options.length === 0}
        error={state.error?.message ?? null}
        empty={options.length === 0}
        emptyLabel={emptyLabel}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        hasMore={state.hasMore}
        onLoadMore={() => search.loadMore()}
        // The chip shows the selection; the input never carries the item's key as text.
        itemToStringLabel={() => ''}
      />
    </div>
  );
}
