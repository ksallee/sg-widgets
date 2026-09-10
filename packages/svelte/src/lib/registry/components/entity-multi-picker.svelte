<script lang="ts" module>
	import type {
		EntityRef,
		FilterGroup,
		PickerRow,
		PickerSummary,
		SearchFieldSpec,
		SgContext,
		WireGroup
	} from '@sg-widgets/core';

	export type EntityMultiPickerSize = 'sm' | 'md' | 'lg';

	/**
	 * Controls follow the input ladder of `docs/design-rules.md`. `data-empty` takes the
	 * leading and the vertical inset down one step, so an empty control is tighter than a
	 * filled one; `min-h` holds the ladder and the trailing inset stays reserve for the
	 * clear and open controls.
	 */
	const PICKER_BOX: Record<EntityMultiPickerSize, string> = {
		sm: 'min-h-8 px-2 py-1 data-empty:pl-1.5 data-empty:py-0.5',
		md: 'min-h-9 px-3 py-1 data-empty:pl-2 data-empty:py-0.5',
		lg: 'min-h-10 px-3 py-1 data-empty:pl-2 data-empty:py-0.5'
	};
	const PICKER_GLYPH: Record<EntityMultiPickerSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};
	/** A chip sits inside the control, so it takes the step below it. */
	const PICKER_CHIP: Record<EntityMultiPickerSize, EntityMultiPickerSize> = { sm: 'sm', md: 'sm', lg: 'md' };

	/** The bordered field the chips and the query input sit in. */
	const PICKER_CONTROL =
		'border-input bg-background has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-background has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 data-invalid:border-destructive data-invalid:ring-destructive/20 dark:data-invalid:ring-destructive/40 relative flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-md border text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 has-aria-invalid:ring-2 data-invalid:ring-2';
	/** The caret inside a token field: no box of its own, it borrows the control's. */
	const PICKER_INPUT =
		'placeholder:text-muted-foreground relative min-w-[2ch] flex-1 bg-transparent outline-none disabled:cursor-not-allowed';
	/** The search box a summary trigger keeps in its popup instead. */
	const PICKER_SEARCH_ROW = 'border-border flex items-center gap-1.5 border-b px-3';
	const PICKER_SEARCH =
		'placeholder:text-muted-foreground h-9 w-full min-w-0 bg-transparent text-sm outline-none disabled:cursor-not-allowed';
	/** The `+n` pill. A press on it opens the list, where the hidden ones are. */
	const PICKER_PILL =
		'text-muted-foreground hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm text-xs tabular-nums outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2';
	/** Room the `+n` pill needs beside the chips, so it is never the thing that overflows. */
	const OVERFLOW_RESERVE = 40;
	/** The chip row's `gap-1.5`, carried by every measured width. */
	const CHIP_GAP = 6;
	/** The popup surface, matching the popover item of each registry. */
	const PICKER_POPUP =
		'bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 ring-foreground/10 z-50 w-96 max-w-[calc(100vw-2rem)] origin-(--bits-combobox-content-transform-origin) overflow-hidden rounded-lg shadow-md ring-1 outline-hidden duration-100';
	/** The scrolling list inside the popup. */
	const PICKER_LIST = 'no-scrollbar max-h-72 scroll-py-1 overflow-x-hidden overflow-y-auto p-1 outline-none';
	/** One row. Highlight and selection share one colour, per `docs/design-rules.md`. */
	const PICKER_ROW =
		'data-highlighted:bg-accent data-highlighted:text-accent-foreground relative flex cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-hidden select-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0';
	/** The centred line every empty, loading and error state uses. */
	const PICKER_NOTE = 'flex items-center justify-center gap-1.5 py-6 text-center text-sm';
	/** The clear control, shared by every picker in this registry. */
	const PICKER_ICON_BUTTON =
		'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]';

	/** The chip a Backspace has armed. The keyboard cursor wears the focus ring. */
	const PICKER_ARMED = 'ring-ring ring-offset-background ring-2 ring-offset-1';

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
		/** Field shown right-aligned, drawn by its data type. Nothing is shown without it. */
		secondaryField?: string;
		/** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
		secondary?: (row: PickerRow) => string;
		/** Field shown under the label. Defaults to the type when several types are searched. */
		subLabelField?: string;
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
		emptyLabel?: string;
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
	import type { FieldSchema, StatusRecord } from '@sg-widgets/core';
	import {
		createEntitySearch,
		entityKey,
		highlightRuns,
		holdsArmed,
		isEmptyValue,
		pickerKeyIntent,
		placeholderName,
		renderKindFor,
		scrollHighlightedIntoView,
		summariseSelection,
		withSelectedPinned
	} from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import Search from '@lucide/svelte/icons/search';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';
	import UserAvatar from '$lib/registry/components/user-avatar.svelte';
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
		emptyLabel = 'No entity matches.',
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
	const statusTable = $derived(context.statuses);
	const site = $derived(siteUrl ?? context.siteUrl);

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
				thumbnail: row ? thumbOf(row) : null
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
	/** An id is a code, and codes are the mono treatment of `docs/design-rules.md`. */
	const secondaryIsId = $derived(secondaryField === 'id');

	interface SecondaryPlan {
		/** The secondary field's schema, per searched type. */
		fields: Record<string, FieldSchema | undefined>;
		/** `Status` rows by code, read only when the field is a status (probe 010). */
		statuses: Record<string, StatusRecord> | null;
	}

	/**
	 * What the secondary column draws with: one field read per searched type through
	 * the cached schema service. The read hangs off the props through a derived and
	 * never off an effect with a "last seen" key.
	 */
	function loadSecondary(types: string[], name: string | undefined): SecondaryPlan {
		const plan = $state<SecondaryPlan>({ fields: {}, statuses: null });
		if (!name) return plan;
		void Promise.all(types.map((type) => schema.field(type, name))).then(async (found) => {
			plan.fields = Object.fromEntries(types.map((type, i) => [type, found[i]]));
			if (found.some((field) => field && renderKindFor(field.dataType) === 'status')) {
				plan.statuses = Object.fromEntries(await statusTable.byCode());
			}
		}, onError);
		return plan;
	}

	const secondaryPlan = $derived(loadSecondary(entityTypes, secondaryField));

	function thumbOf(row: PickerRow): string | null {
		if (thumbnail === false) return null;
		const raw = row.values[thumbnail ?? 'image'];
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

	/** The programmatic name, when it says something the label does not. */
	function codeOf(row: PickerRow): string {
		if (!showCode) return '';
		const raw = row.values['code'];
		return typeof raw === 'string' && raw.length > 0 && raw !== row.name ? raw : '';
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
		if (inline && target !== inputEl) {
			event.preventDefault();
			inputEl?.focus({ preventScroll: true });
		}
		setOpen(true);
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
					class={PICKER_INPUT}
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
						<div data-slot="entity-picker-error" class={cn(PICKER_NOTE, 'text-destructive')}>
							<TriangleAlert aria-hidden="true" class="size-4 shrink-0" />
							<span class="truncate">{snap.error.message}</span>
						</div>
					{:else if snap.loading && options.length === 0}
						<div data-slot="entity-picker-loading" class="flex flex-col gap-2">
							{#each [0, 1, 2] as row (row)}
								<Skeleton class="h-8 w-full" />
							{/each}
						</div>
					{:else if options.length === 0}
						<div data-slot="entity-picker-empty" class={cn(PICKER_NOTE, 'text-muted-foreground')}>
							<SearchX aria-hidden="true" class="size-4 shrink-0" />
							<span class="truncate">{emptyLabel}</span>
						</div>
					{:else}
						{#each options as row (entityKey(row))}
							{@const chosen = selected.has(entityKey(row))}
							{@const sub = subLabelOf(row)}
							{@const code = codeOf(row)}
							{@const custom = secondary ? secondary(row) : !secondaryField && polymorphic ? row.type : ''}
							{@const raw = secondaryValue(row)}
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
								{#if thumbnail !== false}
									<span data-slot="entity-picker-leading" class="flex shrink-0 items-center">
										{#if isPerson(row)}
											<UserAvatar
												name={row.name}
												image={thumbOf(row)}
												{size}
												apiUser={row.type === 'ApiUser'}
												inactive={row.values['sg_status_list'] === 'dis'}
											/>
										{:else}
											<Thumbnail
												src={thumbOf(row)}
												aspect="square"
												{size}
												class={roundThumbnail ? 'rounded-full' : undefined}
											/>
										{/if}
									</span>
								{/if}
								<span class="flex min-w-0 flex-1 flex-col">
									<span data-slot="entity-picker-label" class="flex min-w-0 items-center gap-1.5" title={row.name}>
										<span class="truncate"
											>{#each highlightRuns(row.name, snap.query) as run, i (i)}<span
													class={run.match ? 'font-semibold' : undefined}>{run.text}</span
												>{/each}</span
										>
										{#if code}
											<span
												data-slot="entity-picker-code"
												class="text-muted-foreground shrink-0 font-mono text-xs">{code}</span
											>
										{/if}
									</span>
									{#if sub}
										<!-- Highlighted too, so a row matched on its login or its email shows why. -->
										<span data-slot="entity-picker-sub-label" class="text-muted-foreground truncate text-xs"
											>{#each highlightRuns(sub, snap.query) as run, i (i)}<span
													class={run.match ? 'font-semibold' : undefined}>{run.text}</span
												>{/each}</span
										>
									{/if}
								</span>
								{#if custom}
									<span data-slot="entity-picker-secondary" class="text-muted-foreground shrink-0 text-xs"
										>{custom}</span
									>
								{:else if secondaryField && !isEmptyValue(raw)}
									<span
										data-slot="entity-picker-secondary"
										class={cn(
											'text-muted-foreground flex shrink-0 items-center text-xs',
											secondaryIsId && 'font-mono tabular-nums'
										)}
									>
										<FieldValue
											value={raw}
											dataType={secondaryType(row)}
											field={secondaryPlan.fields[row.type] ?? null}
											statuses={secondaryPlan.statuses}
											{context}
											siteUrl={site}
											class="w-auto justify-end text-xs"
										/>
									</span>
								{/if}
							</Combobox.Item>
						{/each}
						{#if snap.hasMore}
							<Combobox.Item
								data-slot="entity-picker-more"
								value={LOAD_MORE}
								label={snap.loading ? 'Loading…' : 'Load more'}
								class={cn(PICKER_ROW, 'text-muted-foreground justify-center text-xs')}
							>
								{snap.loading ? 'Loading…' : 'Load more'}
							</Combobox.Item>
						{/if}
					{/if}
				</div>
			</Combobox.Content>
		</Combobox.Portal>

		{#if !readonly}
			<div class="pointer-events-none absolute right-2 flex items-center gap-1">
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
					class="focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
				>
					<ChevronsUpDown aria-hidden="true" class={cn('shrink-0 opacity-50', PICKER_GLYPH[size])} />
				</Combobox.Trigger>
			</div>
		{/if}
	</Combobox.Root>
</div>
