import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type {
  EntityRef,
  FieldSpec,
  FilterGroup,
  PickerRow as PickerRowData,
  PickerSummary,
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
import { Checkbox } from '@/components/ui/checkbox';
import { EntityChip } from '@/registry/sg/components/entity-chip';
import { PICKER_ARMED, PICKER_CHIP, PICKER_ROW } from '@/registry/sg/components/picker-classes';
import { PickerControl } from '@/registry/sg/components/picker-control';
import { PickerRow } from '@/registry/sg/components/picker-row';
import { cn } from '@/lib/utils';

export type EntityMultiPickerSize = 'sm' | 'md' | 'lg';

/** Everything both entity pickers take. They differ only in the shape of the value. */
export interface EntityMultiPickerBaseProps
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
  /** What the control shows for the selection. */
  summary?: PickerSummary;
  /** Chips drawn before the rest becomes `+n`. `0` draws every chip. */
  max?: number;
  size?: EntityMultiPickerSize;
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

export interface EntityMultiPickerProps extends EntityMultiPickerBaseProps {
  /** The chosen rows. Bare `{type, id}` members are resolved on mount. */
  value?: EntityRef[];
  onValueChange?: (value: EntityRef[], rows: PickerRowData[]) => void;
}

/**
 * Several entities, chosen by server-side search.
 *
 * The same request model as the single picker: one `contains` condition per word,
 * `or`'d across the type's display-name fields, one `POST /entity/<type>/_search`
 * per searched type, no filtering in the browser, abandoned responses dropped, and
 * the same search without the name condition while nothing is typed. The option list
 * is the results followed by any selected row they do not hold, so a selection is
 * always there to be unticked, and every row is held under `Type:id`.
 *
 * The secondary column is drawn by the field's data type through FieldValue, so a
 * status is a badge and a date is formatted.
 */
export function EntityMultiPicker({
  entityTypes,
  context,
  value = [],
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
  placeholder = 'Search for entities',
  searchPlaceholder = 'Search…',
  emptyLabel = NO_MATCH_LABEL,
  loadingLabel,
  errorLabel,
  summary = 'ellipsis',
  max = 0,
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
}: EntityMultiPickerProps) {
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

  // Bare references are resolved by one batched read per type, latched on the
  // references themselves, so a later set of bare ones resolves too.
  useEffect(() => {
    if (value.length > 0) search.hydrate(value);
  }, [search, value]);

  const selectedKeys = value.map(entityKey);
  const selected = new Set(selectedKeys);
  const chips = value.map((ref) => {
    const row = search.known.get(entityKey(ref));
    return {
      ref,
      entity: { type: ref.type, id: ref.id, name: row?.name || ref.name || placeholderName(ref) },
      thumbnail: row ? rowThumbnail(row.values, { thumbnail }) : null,
    };
  });
  /**
   * A chip control is a token field, with the caret beside the chips. A summary
   * control is a trigger, and keeps its search box at the top of the popup instead.
   */
  const inline = summary === 'chips';
  /** What the chips look like, so a change to any of it re-measures the row. */
  const rowKey = `${size}|${summary}|${chips.map((chip) => `${chip.entity.name}:${chip.thumbnail ?? ''}`).join(', ')}`;
  // Search results first, selected rows appended, so a selection stays deselectable
  // whatever the query, and even when a search returns nothing at all.
  const options = withSelectedPinned(state.rows, value, search.known);
  const polymorphic = entityTypes.length > 1;
  const hasSubLabel = Boolean(subLabelField || subLabel);
  const interactive = !disabled && !readonly;

  /** The caller's own sub-label. Absent, the row reads `subLabelField` itself. */
  function subLabelOf(row: PickerRowData): string | undefined {
    return subLabel ? subLabel(row) : undefined;
  }

  /** The caller's own secondary, and the type on a polymorphic list that names no field. */
  function customSecondary(row: PickerRowData): string | undefined {
    if (secondary) return secondary(row);
    return !pathOf(secondaryField) && polymorphic ? row.type : undefined;
  }

  function rowFor(key: string): PickerRowData | null {
    return options.find((option) => entityKey(option) === key) ?? search.known.get(key) ?? null;
  }

  function emit(refs: EntityRef[]): void {
    onValueChange?.(
      refs,
      refs.map(
        (ref) =>
          search.known.get(entityKey(ref)) ?? {
            type: ref.type,
            id: ref.id,
            name: ref.name || placeholderName(ref),
            values: {},
          },
      ),
    );
  }

  function choose(keys: string[]): void {
    const rows = keys.map(rowFor).filter((row): row is PickerRowData => row !== null);
    search.remember(rows);
    emit(rows.map((row) => ({ type: row.type, id: row.id, name: row.name })));
  }

  function remove(ref: EntityRef): void {
    emit(value.filter((other) => entityKey(other) !== entityKey(ref)));
  }

  function removeAt(index: number): void {
    const chip = value[index];
    if (chip) remove(chip);
  }

  const byKey = new Map(options.map((row) => [entityKey(row), row]));

  function renderItem(key: string): ReactNode {
    const row = byKey.get(key);
    if (!row) return null;
    const chosen = selected.has(key);
    return (
      <ComboboxPrimitive.Item
        key={key}
        data-slot="entity-picker-option"
        data-entity-type={row.type}
        data-entity-id={row.id}
        data-selected-entity={chosen ? 'true' : undefined}
        value={key}
        className={cn(PICKER_ROW, hasSubLabel && 'items-start')}
      >
        <PickerRow
          indicatorSlot="entity-picker-check"
          indicator={<Checkbox checked={chosen} tabIndex={-1} aria-hidden="true" className="pointer-events-none" />}
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
      data-multiple="true"
      data-summary={summary}
      className={cn(
        'relative flex w-full min-w-0 items-center',
        disabled && 'pointer-events-none opacity-50',
        className,
      )}
      {...rest}
    >
      <PickerControl
        slot="entity-picker"
        picker="entity-multi"
        multiple
        keys={selectedKeys}
        onSelect={choose}
        labels={chips.map((chip) => chip.entity.name)}
        items={options.map(entityKey)}
        renderItem={renderItem}
        renderChip={(index, armed, hidden) => {
          const chip = chips[index];
          if (!chip) return null;
          return (
            <EntityChip
              key={entityKey(chip.ref)}
              entity={chip.entity}
              thumbnail={chip.thumbnail}
              size={PICKER_CHIP[size]}
              context={context}
              siteUrl={site}
              removable={interactive}
              onRemove={() => remove(chip.ref)}
              data-chip=""
              data-armed={armed ? 'true' : undefined}
              hidden={hidden}
              className={cn('shrink-0', armed && PICKER_ARMED)}
            />
          );
        }}
        summary={summary}
        max={max}
        chipRow
        inline={inline}
        rowKey={rowKey}
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
        onRemoveAt={removeAt}
        onClear={() => emit([])}
        loading={state.loading && options.length === 0}
        error={state.error?.message ?? null}
        empty={options.length === 0}
        emptyLabel={emptyLabel}
        loadingLabel={loadingLabel}
        errorLabel={errorLabel}
        hasMore={state.hasMore}
        onLoadMore={() => search.loadMore()}
        overflowLabel={`Show all ${chips.length} selected`}
      />
    </div>
  );
}
