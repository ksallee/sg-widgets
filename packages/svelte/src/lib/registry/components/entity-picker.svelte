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
	const BOX: Record<EntityPickerSize, string> = {
		sm: 'min-h-8 px-2 py-1',
		md: 'min-h-9 px-3 py-1',
		lg: 'min-h-10 px-3 py-1'
	};
	const GLYPH: Record<EntityPickerSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};
	/** A chip sits inside the control, so it takes the step below it. */
	const CHIP: Record<EntityPickerSize, EntityPickerSize> = { sm: 'sm', md: 'sm', lg: 'md' };

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
		readonly?: boolean;
		invalid?: boolean;
		clearable?: boolean;
		debounceMs?: number;
		onerror?: (error: Error) => void;
		class?: string;
	}
</script>

<script lang="ts">
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
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';
	import UserAvatar from '$lib/registry/components/user-avatar.svelte';
	import { cn } from '$lib/utils.js';

	type Props = EntityPickerBaseProps & {
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
		readonly = false,
		invalid = false,
		clearable = true,
		debounceMs = 250,
		onValueChange,
		onerror,
		class: className
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
		thumbnailField,
		fields,
		filters,
		projectId,
		exclude,
		minQueryLength,
		pageSize,
		debounceMs,
		onError: (error: Error) => onerror?.(error)
	});

	let snap = $state(search.state);
	let open = $state(false);
	let query = $state('');

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
			thumbnailField,
			fields,
			filters,
			projectId,
			exclude,
			minQueryLength,
			pageSize,
			debounceMs,
			onError: (error: Error) => onerror?.(error)
		});
	});

	// The search runs for an open picker only: the list is what the popover shows, and
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
		}, onerror);
		return plan;
	}

	const secondaryPlan = $derived(loadSecondary(entityTypes, secondaryField));

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
		value = { type: row.type, id: row.id, name: row.name };
		onValueChange?.(value, row);
		open = false;
	}

	function clear(): void {
		value = null;
		onValueChange?.(null, null);
	}
</script>

<!--
	One entity, chosen by server-side search.

	A query past `minQueryLength` becomes one `contains` condition per word, `or`'d
	across the type's display-name fields, and goes to `POST /entity/<type>/_search`
	once per searched type. Under it the same search runs without the name condition,
	so an open picker lists the rows worked on most recently. Client-side filtering is
	off: the server is the only authority on what matches. A response from an abandoned
	query is dropped rather than shown, reads come from the query cache, and every row
	is held under `Type:id` because a numeric id alone collides across types.

	The secondary column is drawn by the field's data type through FieldValue, so a
	status is a badge and a date is formatted.
-->
<div
	data-slot="entity-picker"
	data-size={size}
	data-multiple="false"
	class={cn('relative flex w-full min-w-0 items-center', disabled && 'pointer-events-none opacity-50', className)}
>
	<Popover.Root {open} onOpenChange={(next) => (open = interactive ? next : false)}>
		<div
			data-slot="entity-picker-control"
			aria-invalid={invalid ? 'true' : undefined}
			aria-disabled={disabled ? 'true' : undefined}
			data-readonly={readonly ? 'true' : undefined}
			class={cn(
				'border-input bg-background has-[:focus-visible]:ring-ring has-[:focus-visible]:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 relative flex w-full min-w-0 flex-wrap items-center gap-1.5 rounded-md border text-sm transition-colors duration-150 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-offset-2 aria-invalid:ring-2',
				BOX[size],
				readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8'
			)}
		>
			<!--
				The trigger covers the control rather than sitting inside it, so the popup
				anchors to the whole field and a chip's remove control is a sibling button
				rather than a button inside a button.
			-->
			<Popover.Trigger
				data-slot="entity-picker-trigger"
				role="combobox"
				aria-expanded={open}
				aria-label={chipEntity?.name ?? placeholder}
				disabled={!interactive}
				title={chipEntity?.name ?? placeholder}
				class="absolute inset-0 rounded-md outline-none"
			></Popover.Trigger>
			{#if chipEntity}
				<span
					data-slot="entity-picker-value"
					class="pointer-events-none relative flex min-w-0 flex-wrap items-center gap-1.5 [&_button]:pointer-events-auto"
				>
					<EntityChip
						entity={chipEntity}
						thumbnail={selectedRow ? thumbOf(selectedRow) : null}
						size={CHIP[size]}
					/>
				</span>
			{:else}
				<span class="text-muted-foreground pointer-events-none relative min-w-0 truncate">{placeholder}</span>
			{/if}
		</div>

		<Popover.Content
			data-picker="entity"
			align="start"
			class="w-96 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
		>
			<Command.Root shouldFilter={false} loop>
				<!-- svelte-ignore a11y_autofocus -->
				<Command.Input autofocus bind:value={query} placeholder={searchPlaceholder} />
				<Command.List>
					{#if snap.error}
						<div
							data-slot="entity-picker-error"
							class="text-destructive flex items-center justify-center gap-1.5 py-6 text-center text-sm"
						>
							<TriangleAlert aria-hidden="true" class="size-4 shrink-0" />
							<span class="truncate">{snap.error.message}</span>
						</div>
					{:else if snap.loading && options.length === 0}
						<div data-slot="entity-picker-loading" class="flex flex-col gap-2 p-1">
							{#each [0, 1, 2] as row (row)}
								<Skeleton class="h-8 w-full" />
							{/each}
						</div>
					{:else}
						<Command.Empty>
							<span class="text-muted-foreground inline-flex items-center gap-1.5">
								<SearchX aria-hidden="true" class="size-4 shrink-0" />
								{emptyLabel}
							</span>
						</Command.Empty>
						{#each options as row (entityKey(row))}
							{@const chosen = Boolean(value && entityKey(value) === entityKey(row))}
							{@const sub = subLabelOf(row)}
							{@const custom = secondary ? secondary(row) : !secondaryField && polymorphic ? row.type : ''}
							{@const raw = secondaryValue(row)}
							<Command.Item
								data-slot="entity-picker-option"
								data-entity-type={row.type}
								data-entity-id={row.id}
								data-checked={chosen ? 'true' : undefined}
								value={entityKey(row)}
								onSelect={() => choose(row)}
								class={hasSubLabel ? 'items-start' : undefined}
							>
								{#if thumbnailField !== false}
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
									<span data-slot="entity-picker-label" class="truncate" title={row.name}>
										{#each highlightRuns(row.name, snap.query) as run, i (i)}<span
												class={run.match ? 'font-semibold' : undefined}>{run.text}</span
											>{/each}
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
									<span
										data-slot="entity-picker-secondary"
										class="text-muted-foreground shrink-0 text-xs">{custom}</span
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
							</Command.Item>
						{/each}
						{#if snap.hasMore}
							<Command.Item
								data-slot="entity-picker-more"
								value="__load-more"
								onSelect={() => search.loadMore()}
								class="text-muted-foreground justify-center text-xs"
							>
								{snap.loading ? 'Loading…' : 'Load more'}
							</Command.Item>
						{/if}
					{/if}
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>

	{#if !readonly}
		<div class="pointer-events-none absolute right-2 flex items-center gap-1">
			{#if showClear}
				<button
					type="button"
					data-slot="entity-picker-clear"
					aria-label="Clear the selection"
					onclick={clear}
					class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
				>
					<X aria-hidden="true" class={GLYPH[size]} />
				</button>
			{/if}
			<ChevronsUpDown aria-hidden="true" class={cn('shrink-0 opacity-50', GLYPH[size])} />
		</div>
	{/if}
</div>
