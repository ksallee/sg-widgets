<script lang="ts" module>
	import type {
		EntityRef,
		FilterGroup,
		PickerRow,
		SearchFieldSpec,
		SgClient,
		WireGroup
	} from '@sg-widgets/core';

	export type EntityPickerSize = 'sm' | 'md' | 'lg';

	/** Controls follow the input ladder of `docs/design-rules.md`. */
	const PICKER_BOX: Record<EntityPickerSize, string> = {
		sm: 'min-h-8 px-2 py-1',
		md: 'min-h-9 px-3 py-1',
		lg: 'min-h-10 px-3 py-1'
	};
	const PICKER_GLYPH: Record<EntityPickerSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};
	/** A chip sits inside the control, so it takes the step below it. */
	const PICKER_CHIP: Record<EntityPickerSize, EntityPickerSize> = { sm: 'sm', md: 'sm', lg: 'md' };

	/** The bordered field the chips and the query input sit in. */
	const PICKER_CONTROL =
		'border-input bg-background has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-background has-aria-invalid:border-destructive has-aria-invalid:ring-destructive/20 dark:has-aria-invalid:ring-destructive/40 relative flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-md border text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 has-aria-invalid:ring-2';
	/** The combobox input: no box of its own, it borrows the control's. */
	const PICKER_INPUT =
		'placeholder:text-muted-foreground relative min-w-8 flex-1 bg-transparent outline-none disabled:cursor-not-allowed';
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

	/** The row a press on the last row of a page carries, rather than an entity key. */
	const LOAD_MORE = '__load-more';

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
		thumbnail?: string | false;
		roundThumbnail?: boolean;
		/** Show the row's `code` beside the label when the two differ. */
		showCode?: boolean;
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
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema, StatusRecord } from '@sg-widgets/core';
	import {
		createEntitySearch,
		createSchemaService,
		createStatusService,
		entityKey,
		highlightRuns,
		isEmptyValue,
		placeholderName,
		renderKindFor,
		withSelectedPinned
	} from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';
	import UserAvatar from '$lib/registry/components/user-avatar.svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> &
		EntityPickerBaseProps & {
		/** The chosen row, two-way. A bare `{type, id}` is resolved on mount. */
		value?: EntityRef | null;
		onValueChange?: (value: EntityRef | null, row: PickerRow | null) => void;
	};

	let {
		entityTypes,
		client,
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
		emptyLabel = 'No entity matches.',
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

	// One schema service for the widget, built from the prop so a client swapped in
	// reloads. The controller shares it, so a type's fields are read once.
	const schema = $derived(createSchemaService(client));
	const statusTable = $derived(createStatusService(client));

	// svelte-ignore state_referenced_locally
	const search = createEntitySearch({
		client,
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
	let inputEl = $state<HTMLInputElement | null>(null);
	let query = $state('');
	/** A press on the load-more row is not a selection, and must not close the popup. */
	let paging = false;

	$effect(() => search.subscribe((next) => (snap = next)));
	$effect(() => () => search.dispose());

	$effect(() => {
		search.update({
			client,
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
		if (!wanted) query = '';
		if (wanted === open) return;
		open = wanted;
		onOpenChange?.(open);
	}

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
			title={chipEntity?.name ?? placeholder}
			class={cn(PICKER_CONTROL, PICKER_BOX[size], readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
		>
			{#if chipEntity}
				<span data-slot="entity-picker-value" class="flex min-w-0 items-center gap-1.5">
					<EntityChip
						entity={chipEntity}
						thumbnail={selectedRow ? thumbOf(selectedRow) : null}
						size={PICKER_CHIP[size]}
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
				<div data-slot="entity-picker-list" class={PICKER_LIST}>
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
							{@const chosen = selectedKey === entityKey(row)}
							{@const sub = subLabelOf(row)}
							{@const code = codeOf(row)}
							{@const custom = secondary ? secondary(row) : !secondaryField && polymorphic ? row.type : ''}
							{@const raw = secondaryValue(row)}
							<Combobox.Item
								data-slot="entity-picker-option"
								data-entity-type={row.type}
								data-entity-id={row.id}
								data-checked={chosen ? 'true' : undefined}
								value={entityKey(row)}
								label={row.name}
								class={cn(PICKER_ROW, hasSubLabel && 'items-start')}
							>
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
											{siteUrl}
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
					class="pointer-events-auto shrink-0 outline-none"
				>
					<ChevronsUpDown aria-hidden="true" class={cn('shrink-0 opacity-50', PICKER_GLYPH[size])} />
				</Combobox.Trigger>
			</div>
		{/if}
	</Combobox.Root>
</div>
