<script lang="ts" module>
	import type {
		EntityRef,
		FieldSpec,
		FilterGroup,
		PickerRow,
		SearchFieldSpec,
		SgContext,
		WireGroup
	} from '@sg-widgets/core';

	export type EntityPickerSize = 'sm' | 'md' | 'lg';

	/** The row a press on the last row of a page carries, rather than an entity key. */
	const LOAD_MORE = '__load-more';

	/** Everything both entity pickers take. They differ only in the shape of the value. */
	export interface EntityPickerBaseProps {
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
		secondary?: (row: PickerRow) => string;
		/** Field shown under the label: a path, or a resolved column. */
		subLabelField?: FieldSpec | null;
		/** The muted line of the caller's own making. Wins over `subLabelField`. */
		subLabel?: (row: PickerRow) => string;
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
		/** Whether the popup is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		onError?: (error: Error) => void;
		class?: string;
	}
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import {
		createEntitySearch,
		entityKey,
		holdsArmed,
		NO_MATCH_LABEL,
		pathOf,
		pickerKeyIntent,
		placeholderName,
		rowThumbnail,
		scrollHighlightedIntoView,
		stateLine,
		withSelectedPinned
	} from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import Row from '$lib/registry/components/picker-row.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';
	import {
		PICKER_ARMED,
		PICKER_BOX,
		PICKER_CHIP,
		PICKER_CONTROL,
		PICKER_GLYPH,
	PICKER_TRAILING,
		PICKER_ICON_BUTTON,
		PICKER_INPUT,
		PICKER_LIST,
		PICKER_POPUP,
		PICKER_ROW
	} from '$lib/registry/components/picker-classes.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> &
		EntityPickerBaseProps & {
		/** The chosen row, two-way. A bare `{type, id}` is resolved on mount. */
		value?: EntityRef | null;
		onValueChange?: (value: EntityRef | null, row: PickerRow | null) => void;
	};

	let {
		entityTypes,
		context,
		value = $bindable(null),
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
		open = $bindable(false),
		onOpenChange,
		onValueChange,
		onError,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// The context's own services, so every widget on the page shares one schema read
	// and one status table.
	const schema = $derived(context.schema);
	const site = $derived(siteUrl ?? context.siteUrl);
	const loadingText = $derived(stateLine('loading', { loadingLabel }));

	// svelte-ignore state_referenced_locally
	const search = createEntitySearch({
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
		onError: (error: Error) => onError?.(error)
	});

	let snap = $state(search.state);
	let controlEl = $state<HTMLElement | null>(null);
	let listEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let query = $state('');
	/** True once a Backspace has highlighted the chip. The next one clears it. */
	let armed = $state(false);
	/** A press on the load-more row is not a selection, and must not close the popup. */
	let paging = false;

	$effect(() => search.subscribe((next) => (snap = next)));
	$effect(() => () => search.dispose());

	$effect(() => {
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
			onError: (error: Error) => onError?.(error)
		});
	});

	// The search runs for an open picker only: the list is what the popup shows, and
	// a closed one has nobody to show it to.
	$effect(() => {
		if (open) search.setQuery(query);
	});

	// A bare reference is resolved by one batched read, latched on the reference
	// itself, so swapping in a different bare one resolves that one too.
	$effect(() => {
		if (value) search.hydrate([value]);
	});

	const selectedRow = $derived.by(() => {
		void snap;
		return value ? (search.known.get(entityKey(value)) ?? null) : null;
	});
	const chipEntity = $derived(
		value
			? {
					type: value.type,
					id: value.id,
					name: selectedRow?.name || value.name || placeholderName(value)
				}
			: null
	);
	const options = $derived(withSelectedPinned(snap.rows, value ? [value] : [], search.known));
	const polymorphic = $derived(entityTypes.length > 1);
	const hasSubLabel = $derived(Boolean(subLabelField || subLabel));
	const interactive = $derived(!disabled && !readonly);
	const showClear = $derived(clearable && Boolean(value) && interactive);
	const selectedKey = $derived(value ? entityKey(value) : '');

	/** The caller's own sub-label. Absent, the row reads `subLabelField` itself. */
	function subLabelOf(row: PickerRow): string | undefined {
		return subLabel ? subLabel(row) : undefined;
	}

	/** The caller's own secondary, and the type on a polymorphic list that names no field. */
	function customSecondary(row: PickerRow): string | undefined {
		if (secondary) return secondary(row);
		return !pathOf(secondaryField) && polymorphic ? row.type : undefined;
	}

	/** A press anywhere in the field opens the list and puts the caret in the input. */
	function openFromControl(event: PointerEvent): void {
		if (!interactive) return;
		const target = event.target as HTMLElement | null;
		// The chip's remove control, the clear control and the chevron own their own press.
		if (target?.closest('button')) return;
		if (target !== inputEl) {
			event.preventDefault();
			inputEl?.focus({ preventScroll: true });
		}
		setOpen(true);
	}

	function setOpen(next: boolean): void {
		// The load-more row is a press on an item, which the primitive reads as a
		// selection and closes on. Paging is not a selection.
		if (!next && paging) {
			paging = false;
			return;
		}
		const wanted = interactive ? next : false;
		if (!wanted) {
			query = '';
			armed = false;
		}
		if (wanted === open) return;
		open = wanted;
		onOpenChange?.(open);
	}

	// Nothing to arm once the value is gone.
	$effect(() => {
		if (armed && !value) armed = false;
	});

	/**
	 * Backspace, Escape and the arrows. The primitive's own handler runs after this
	 * one, so a key this picker owns is prevented rather than shared.
	 */
	function onKey(event: KeyboardEvent): void {
		const intent = pickerKeyIntent(event.key, {
			open,
			query,
			count: value ? 1 : 0,
			armed: armed ? 0 : null,
			editable: interactive
		});
		if (!holdsArmed(event.key)) armed = false;
		switch (intent.kind) {
			case 'dismiss':
				setOpen(false);
				return;
			case 'arm':
				event.preventDefault();
				armed = true;
				return;
			case 'remove':
				event.preventDefault();
				clear();
				return;
			case 'follow':
				void tick().then(() => scrollHighlightedIntoView(listEl));
				return;
			default:
				return;
		}
	}

	// A load-more page appends rows under the highlighted one, and a new query
	// replaces them all; either way the list follows the highlight.
	$effect(() => {
		void snap.rows.length;
		if (!open) return;
		void tick().then(() => scrollHighlightedIntoView(listEl));
	});

	function setSelected(key: string): void {
		if (key === LOAD_MORE) {
			paging = true;
			search.loadMore();
			return;
		}
		const row = options.find((option) => entityKey(option) === key);
		if (!row) return;
		// The primitive writes the item's label into its own copy of the input value;
		// mirroring it here makes the clear on close a change the input sees.
		query = row.name ?? '';
		search.remember([row]);
		value = { type: row.type, id: row.id, name: row.name };
		onValueChange?.(value, row);
	}

	function clear(): void {
		value = null;
		onValueChange?.(null, null);
		inputEl?.focus({ preventScroll: true });
	}
</script>

<!--
	One entity, chosen by server-side search.

	A query past `minQueryLength` becomes one `contains` condition per word, `or`'d
	across the type's display-name fields, and goes to `POST /entity/<type>/_search`
	once per searched type. Under it the same search runs without the name condition,
	so an open picker lists the rows worked on most recently. The combobox does no
	filtering of its own: the server is the only authority on what matches. A response
	from an abandoned query is dropped rather than shown, reads come from the query
	cache, and every row is held under `Type:id` because a numeric id alone collides
	across types.

	The secondary column is drawn by the field's data type through FieldValue, so a
	status is a badge and a date is formatted.
-->
<div
	bind:this={ref}
	data-slot="entity-picker"
	data-size={size}
	data-multiple="false"
	class={cn('relative flex w-full min-w-0 items-center', disabled && 'pointer-events-none opacity-50', className)}
	{...rest}
>
	<Combobox.Root
		type="single"
		allowDeselect={false}
		{disabled}
		inputValue={query}
		bind:open={() => open, setOpen}
		bind:value={() => selectedKey, setSelected}
	>
		<div
			bind:this={controlEl}
			data-slot="entity-picker-control"
		onpointerdown={openFromControl}
		role="group"
			aria-disabled={disabled ? 'true' : undefined}
			data-readonly={readonly ? 'true' : undefined}
			data-empty={chipEntity ? undefined : ''}
			title={chipEntity?.name ?? placeholder}
			class={cn(PICKER_CONTROL, PICKER_BOX[size], readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
		>
			{#if chipEntity}
				<span data-slot="entity-picker-value" class="flex min-w-0 items-center gap-1.5">
					<EntityChip
						entity={chipEntity}
						thumbnail={selectedRow ? rowThumbnail(selectedRow.values, { thumbnail }) : null}
						size={PICKER_CHIP[size]}
						{context}
						siteUrl={site}
						data-armed={armed ? 'true' : undefined}
						class={armed ? PICKER_ARMED : undefined}
					/>
				</span>
			{/if}
			<Combobox.Input
				bind:ref={inputEl}
				data-slot="entity-picker-input"
				aria-invalid={invalid ? 'true' : undefined}
				aria-label={placeholder}
				readonly={readonly || undefined}
				placeholder={chipEntity ? searchPlaceholder : placeholder}
				oninput={(e) => (query = e.currentTarget.value)}
				onkeydown={onKey}
				class={PICKER_INPUT}
			/>
		</div>

		<!--
			Fixed, and anchored to the whole control rather than to the input: the list
			scrolls its highlighted row into view on mount, and an absolute wrapper still
			at the page origin would drag the page there with it.
		-->
		<Combobox.Portal>
			<Combobox.Content
				data-picker="entity"
				data-slot="entity-picker-content"
				strategy="fixed"
				customAnchor={controlEl}
				align="start"
				sideOffset={4}
				class={PICKER_POPUP}
			>
				<div bind:this={listEl} data-slot="entity-picker-list" class={PICKER_LIST}>
					{#if snap.error}
						<StateLine
							state="error"
							slotName="entity-picker-error"
							icon={TriangleAlert}
							label={stateLine('error', { errorLabel }, snap.error.message)}
						/>
					{:else if snap.loading && options.length === 0}
						<div
							data-slot="entity-picker-loading"
							class="flex flex-col gap-2"
							aria-busy="true"
							aria-label={loadingText}
						>
							{#each [0, 1, 2] as row (row)}
								<Skeleton class="h-8 w-full" />
							{/each}
						</div>
					{:else if options.length === 0}
						<StateLine state="empty" slotName="entity-picker-empty" icon={SearchX} label={emptyLabel} />
					{:else}
						{#each options as row (entityKey(row))}
							{@const chosen = selectedKey === entityKey(row)}
							<Combobox.Item
								data-slot="entity-picker-option"
								data-entity-type={row.type}
								data-entity-id={row.id}
								data-checked={chosen ? 'true' : undefined}
								value={entityKey(row)}
								label={row.name}
								class={cn(PICKER_ROW, hasSubLabel && 'items-start')}
							>
								<Row
									{row}
									query={snap.query}
									{thumbnail}
									{roundThumbnail}
									{showCode}
									{subLabelField}
									subLabel={subLabelOf(row)}
									{secondaryField}
									secondary={customSecondary(row)}
									{size}
									{context}
									siteUrl={site}
								/>
							</Combobox.Item>
						{/each}
						{#if snap.hasMore}
							<Combobox.Item
								data-slot="entity-picker-more"
								value={LOAD_MORE}
								label={snap.loading ? loadingText : 'Load more'}
								class={cn(PICKER_ROW, 'text-muted-foreground justify-center text-xs')}
							>
								{snap.loading ? loadingText : 'Load more'}
							</Combobox.Item>
						{/if}
					{/if}
				</div>
			</Combobox.Content>
		</Combobox.Portal>

		{#if !readonly}
			<div class={cn('pointer-events-none absolute top-0 right-2 flex items-center gap-1', PICKER_TRAILING[size])}>
				{#if showClear}
					<button
						type="button"
						data-slot="entity-picker-clear"
						aria-label="Clear the selection"
						onclick={clear}
						class={PICKER_ICON_BUTTON}
					>
						<X aria-hidden="true" class={PICKER_GLYPH[size]} />
					</button>
				{/if}
				<Combobox.Trigger
					data-slot="entity-picker-trigger"
					aria-label="Show the options"
					{disabled}
					class={PICKER_ICON_BUTTON}
				>
					<ChevronDown aria-hidden="true" class={PICKER_GLYPH[size]} />
				</Combobox.Trigger>
			</div>
		{/if}
	</Combobox.Root>
</div>
