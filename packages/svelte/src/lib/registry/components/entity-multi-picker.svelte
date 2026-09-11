<script lang="ts" module>
	import type {
		EntityRef,
		FieldSpec,
		FilterGroup,
		PickerRow,
		PickerSummary,
		SearchFieldSpec,
		SgContext,
		WireGroup
	} from '@sg-widgets/core';

	export type EntityMultiPickerSize = 'sm' | 'md' | 'lg';

	/** The row a press on the last row of a page carries, rather than an entity key. */
	const LOAD_MORE = '__load-more';

	/** Everything both entity pickers take. They differ only in the shape of the value. */
	export interface EntityMultiPickerBaseProps {
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
		summariseSelection,
		withSelectedPinned
	} from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import Row from '$lib/registry/components/picker-row.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';
	import {
		CHIP_GAP,
		OVERFLOW_RESERVE,
		PICKER_ARMED,
		PICKER_BOX,
		PICKER_CHIP,
		PICKER_CONTROL,
		PICKER_GLYPH,
	PICKER_TRAILING,
		PICKER_ICON_BUTTON,
		PICKER_LIST,
		PICKER_PILL,
		PICKER_POPUP,
		PICKER_ROW,
		PICKER_SEARCH,
		PICKER_SEARCH_ROW,
		PICKER_TOKEN_INPUT
	} from '$lib/registry/components/picker-classes.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> &
		EntityMultiPickerBaseProps & {
		/** The chosen rows, two-way. Bare `{type, id}` members are resolved on mount. */
		value?: EntityRef[];
		onValueChange?: (value: EntityRef[], rows: PickerRow[]) => void;
	};

	let {
		entityTypes,
		context,
		value = $bindable([]),
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
	/** The chip a Backspace has highlighted. The next one removes it. */
	let armed = $state<number | null>(null);
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

	// Bare references are resolved by one batched read per type, latched on the
	// references themselves, so a later set of bare ones resolves too.
	$effect(() => {
		if (value.length > 0) search.hydrate(value);
	});

	const selectedKeys = $derived(value.map(entityKey));
	const selected = $derived(new Set(selectedKeys));
	const chips = $derived.by(() => {
		void snap;
		return value.map((ref) => {
			const row = search.known.get(entityKey(ref));
			return {
				ref,
				entity: { type: ref.type, id: ref.id, name: row?.name || ref.name || placeholderName(ref) },
				thumbnail: row ? rowThumbnail(row.values, { thumbnail }) : null
			};
		});
	});
	/**
	 * A chip control is a token field, with the caret beside the chips. A summary
	 * control is a trigger, and keeps its search box at the top of the popup instead.
	 */
	const inline = $derived(summary === 'chips');

	/** What the chips look like, so a change to any of it re-measures the row. */
	const rowKey = $derived(
		`${size}|${summary}|${chips.map((chip) => `${chip.entity.name}:${chip.thumbnail ?? ''}`).join(', ')}`
	);
	let chipsEl = $state<HTMLElement | null>(null);
	let available = $state(0);
	let widths = $state<number[]>([]);
	let measured = $state(false);
	/** True once the row knows its own widths and its room, so it may be drawn. */
	const ready = $derived(summary !== 'ellipsis' || (measured && available > 0));

	/** Every chip laid out, so a hidden one still reports the width it would take. */
	function measure(row: HTMLElement): number[] {
		const drawn = [...row.querySelectorAll<HTMLElement>('[data-chip]')];
		const was = drawn.map((chip) => chip.hidden);
		for (const chip of drawn) chip.hidden = false;
		const out = drawn.map((chip) => Math.ceil(chip.getBoundingClientRect().width) + CHIP_GAP);
		drawn.forEach((chip, i) => (chip.hidden = was[i] ?? false));
		return out;
	}

	/** The room the chips have: the control's box, less the padding its affordances take. */
	function roomIn(control: HTMLElement): number {
		const style = getComputedStyle(control);
		return control.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
	}

	$effect(() => {
		const control = controlEl;
		if (!control || summary !== 'ellipsis') return;
		const observer = new ResizeObserver(() => (available = roomIn(control)));
		observer.observe(control);
		available = roomIn(control);
		return () => observer.disconnect();
	});

	$effect(() => {
		void rowKey;
		const row = chipsEl;
		if (!row || summary !== 'ellipsis') return;
		widths = measure(row);
		measured = true;
		let live = true;
		// A chip drawn in the fallback font is not the chip the row ends up with.
		void document.fonts?.ready.then(() => {
			if (live && chipsEl) widths = measure(chipsEl);
		});
		return () => {
			live = false;
		};
	});

	const plan = $derived(
		summariseSelection(chips, (chip) => chip.entity.name, {
			summary,
			max,
			fit:
				summary === 'ellipsis' && measured && available > 0
					? { widths, available, reserve: OVERFLOW_RESERVE }
					: undefined
		})
	);
	// Search results first, selected rows appended, so a selection stays deselectable
	// whatever the query, and even when a search returns nothing at all.
	const options = $derived(withSelectedPinned(snap.rows, value, search.known));
	const polymorphic = $derived(entityTypes.length > 1);
	const hasSubLabel = $derived(Boolean(subLabelField || subLabel));
	const interactive = $derived(!disabled && !readonly);
	const showClear = $derived(clearable && value.length > 0 && interactive);

	/** The caller's own sub-label. Absent, the row reads `subLabelField` itself. */
	function subLabelOf(row: PickerRow): string | undefined {
		return subLabel ? subLabel(row) : undefined;
	}

	/** The caller's own secondary, and the type on a polymorphic list that names no field. */
	function customSecondary(row: PickerRow): string | undefined {
		if (secondary) return secondary(row);
		return !pathOf(secondaryField) && polymorphic ? row.type : undefined;
	}

	function rowFor(key: string): PickerRow | null {
		return options.find((option) => entityKey(option) === key) ?? search.known.get(key) ?? null;
	}

	function emit(next: EntityRef[]): void {
		value = next;
		onValueChange?.(
			next,
			next.map(
				(ref) =>
					search.known.get(entityKey(ref)) ?? {
						type: ref.type,
						id: ref.id,
						name: ref.name || placeholderName(ref),
						values: {}
					}
			)
		);
	}

	/** A press anywhere in the field opens the list, and a token field takes the caret. */
	function openFromControl(event: PointerEvent): void {
		if (!interactive) return;
		const target = event.target as HTMLElement | null;
		// The chip's remove control, the clear control and the chevron own their own press.
		if (target?.closest('button')) return;
		// The press's own default would move focus to the body and off whichever caret
		// takes it: the field's, or the popup's once the effect below focuses it.
		const onCaret = target === inputEl;
		if (!onCaret) event.preventDefault();
		if (inline && !onCaret) inputEl?.focus({ preventScroll: true });
		// A press on the control toggles the list; a press on the caret only ever opens it.
		setOpen(onCaret ? true : !open);
	}

	// A summary trigger has no caret of its own, so the popup's search box takes it.
	$effect(() => {
		if (!open || inline) return;
		inputEl?.focus({ preventScroll: true });
	});

	function setOpen(next: boolean): void {
		// The load-more row is a press on an item, which the primitive reads as a
		// selection. Paging is not a selection, and must not close the popup.
		if (!next && paging) {
			paging = false;
			return;
		}
		const wanted = interactive ? next : false;
		if (!wanted) {
			query = '';
			armed = null;
		}
		if (wanted === open) return;
		open = wanted;
		onOpenChange?.(open);
	}

	// A chip removed from under the highlight takes it with it.
	$effect(() => {
		if (armed !== null && armed >= value.length) armed = null;
	});

	/**
	 * Backspace, Escape and the arrows. The primitive's own handler runs after this
	 * one, so a key this picker owns is prevented rather than shared.
	 */
	function onKey(event: KeyboardEvent): void {
		const intent = pickerKeyIntent(event.key, {
			open,
			query,
			count: value.length,
			armed,
			editable: interactive
		});
		if (!holdsArmed(event.key)) armed = null;
		switch (intent.kind) {
			case 'dismiss':
				setOpen(false);
				return;
			case 'arm':
				event.preventDefault();
				armed = intent.index;
				return;
			case 'remove': {
				event.preventDefault();
				const chip = value[intent.index];
				if (chip) remove(chip);
				return;
			}
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

	function setSelected(keys: string[]): void {
		if (keys.includes(LOAD_MORE)) {
			paging = true;
			search.loadMore();
			return;
		}
		const rows = keys.map(rowFor).filter((row): row is PickerRow => row !== null);
		search.remember(rows);
		emit(rows.map((row) => ({ type: row.type, id: row.id, name: row.name })));
		// The primitive writes the ticked item's label into its own copy of the input
		// value, and the popup stays open, so the clear has to be a change it sees.
		query = rows.at(-1)?.name ?? '';
		void tick().then(() => (query = ''));
	}

	function remove(ref: EntityRef): void {
		emit(value.filter((other) => entityKey(other) !== entityKey(ref)));
	}

	function clear(): void {
		emit([]);
		if (inline) inputEl?.focus({ preventScroll: true });
	}
</script>

<!--
	Several entities, chosen by server-side search.

	The same request model as the single picker: one `contains` condition per word,
	`or`'d across the type's display-name fields, one `POST /entity/<type>/_search`
	per searched type, no filtering in the browser, abandoned responses dropped, and
	the same search without the name condition while nothing is typed. The option list
	is the results followed by any selected row they do not hold, so a selection is
	always there to be unticked, and every row is held under `Type:id`.

	The secondary column is drawn by the field's data type through FieldValue, so a
	status is a badge and a date is formatted.
-->
<div
	bind:this={ref}
	data-slot="entity-picker"
	data-size={size}
	data-multiple="true"
	data-summary={summary}
	class={cn('relative flex w-full min-w-0 items-center', disabled && 'pointer-events-none opacity-50', className)}
	{...rest}
>
	<Combobox.Root
		type="multiple"
		{disabled}
		inputValue={query}
		bind:open={() => open, setOpen}
		bind:value={() => selectedKeys, setSelected}
	>
		<div
			bind:this={controlEl}
			data-slot="entity-picker-control"
		onpointerdown={openFromControl}
		role="group"
			aria-disabled={disabled ? 'true' : undefined}
			data-invalid={invalid && !inline ? 'true' : undefined}
			data-readonly={readonly ? 'true' : undefined}
			data-empty={value.length === 0 ? '' : undefined}
			title={plan.title || placeholder}
			class={cn(PICKER_CONTROL, PICKER_BOX[size], plan.oneLine && 'flex-nowrap', readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
		>
			{#if value.length > 0}
				<span data-slot="entity-picker-value" class="flex min-w-0 items-center gap-1.5">
					{#if summary === 'count'}
						<span data-slot="entity-picker-count" class="truncate">{plan.countLabel}</span>
					{:else}
						<!--
							Whole chips only: the row measures itself and hides the ones that do not
							fit, so nothing is ever cut in half. `+n` follows the last one drawn.
							No stylesheet here gives `[hidden]` a display rule, so the row does.
						-->
						<span
							bind:this={chipsEl}
							data-slot="entity-picker-chips"
							class={cn(
								'flex min-w-0 items-center gap-1.5 [&>[hidden]]:hidden',
								plan.oneLine ? 'flex-nowrap overflow-hidden' : 'flex-wrap',
								ready ? undefined : 'invisible'
							)}
						>
							{#each chips as chip, index (entityKey(chip.ref))}
								<EntityChip
									entity={chip.entity}
									thumbnail={chip.thumbnail}
									size={PICKER_CHIP[size]}
									{context}
									siteUrl={site}
									removable={interactive}
									onRemove={() => remove(chip.ref)}
									data-chip=""
									data-armed={armed === index ? 'true' : undefined}
									hidden={ready && index >= plan.shown.length}
									class={cn('shrink-0', armed === index && PICKER_ARMED)}
								/>
							{/each}
							{#if plan.overflow > 0}
								<button
									type="button"
									data-slot="entity-picker-overflow"
									title={plan.title}
									aria-label={`Show all ${chips.length} selected`}
									onclick={() => setOpen(true)}
									class={PICKER_PILL}>+{plan.overflow}</button
								>
							{/if}
						</span>
					{/if}
				</span>
			{:else if !inline}
				<span data-slot="entity-picker-placeholder" class="text-muted-foreground truncate"
					>{placeholder}</span
				>
			{/if}
			{#if inline}
				<Combobox.Input
					bind:ref={inputEl}
					data-slot="entity-picker-input"
					aria-invalid={invalid ? 'true' : undefined}
					aria-label={placeholder}
					readonly={readonly || undefined}
					placeholder={value.length > 0 ? '' : placeholder}
					oninput={(e) => (query = e.currentTarget.value)}
					onkeydown={onKey}
					class={PICKER_TOKEN_INPUT}
				/>
			{/if}
		</div>

		<!--
			Fixed, and anchored to the whole control rather than to the input: the list
			scrolls its highlighted row into view on mount, and an absolute wrapper still
			at the page origin would drag the page there with it.
		-->
		<Combobox.Portal>
			<Combobox.Content
				data-picker="entity-multi"
				data-slot="entity-picker-content"
				strategy="fixed"
				customAnchor={controlEl}
				align="start"
				sideOffset={4}
				class={PICKER_POPUP}
			>
				{#if !inline}
					<div data-slot="entity-picker-search" class={PICKER_SEARCH_ROW}>
						<Search aria-hidden="true" class="size-4 shrink-0 opacity-50" />
						<Combobox.Input
							bind:ref={inputEl}
							data-slot="entity-picker-input"
							aria-label={searchPlaceholder}
							placeholder={searchPlaceholder}
							oninput={(e) => (query = e.currentTarget.value)}
							onkeydown={onKey}
							class={PICKER_SEARCH}
						/>
					</div>
				{/if}
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
							{@const chosen = selected.has(entityKey(row))}
							<Combobox.Item
								data-slot="entity-picker-option"
								data-entity-type={row.type}
								data-entity-id={row.id}
								data-selected-entity={chosen ? 'true' : undefined}
								value={entityKey(row)}
								label={row.name}
								class={cn(PICKER_ROW, hasSubLabel && 'items-start')}
							>
								<span data-slot="entity-picker-check" class="flex h-5 shrink-0 items-center">
									<Checkbox checked={chosen} tabindex={-1} aria-hidden="true" class="pointer-events-none" />
								</span>
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
