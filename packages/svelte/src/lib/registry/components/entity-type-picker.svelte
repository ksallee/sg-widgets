<script lang="ts" module>
	import type { PickerSummary } from '@sg-widgets/core';

	export type EntityTypePickerSize = 'sm' | 'md' | 'lg';

	/** Controls follow the input ladder of `docs/design-rules.md`. */
	const PICKER_BOX: Record<EntityTypePickerSize, string> = {
		sm: 'min-h-8 px-2 py-1',
		md: 'min-h-9 px-3 py-1',
		lg: 'min-h-10 px-3 py-1'
	};
	const PICKER_GLYPH: Record<EntityTypePickerSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};

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
	/** A chosen type in the control. A type is a code, not a row, so it has no thumbnail. */
	const PICKER_TEXT_CHIP =
		'bg-muted text-foreground flex h-6 min-w-0 shrink-0 items-center gap-1 rounded-sm px-1.5 text-xs';
</script>

<script lang="ts">
	import type { EntityTypeInfo, SchemaService } from '@sg-widgets/core';
	import { filterEntityTypes, matchesTokens, summariseSelection } from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';

	type Props = {
		/** Reads the site's enabled types. Build it once per app with `createSchemaService`. */
		schema: SchemaService;
		/** A type code in single mode, an array of them in multi mode. */
		value?: string | string[] | null;
		multiple?: boolean;
		onValueChange?: (value: string | string[] | null) => void;
		/** Codes on offer. Empty or absent means every enabled type. */
		allow?: string[];
		/** Codes withheld, applied after `allow`. */
		deny?: string[];
		placeholder?: string;
		searchPlaceholder?: string;
		emptyLabel?: string;
		clearable?: boolean;
		readonly?: boolean;
		disabled?: boolean;
		invalid?: boolean;
		/** Show the code under the display name where the two differ. */
		showCode?: boolean;
		/** What the control shows for the selection in multi mode. */
		summary?: PickerSummary;
		/** Chips drawn before the rest becomes `+n`. `0` draws every chip. */
		max?: number;
		size?: EntityTypePickerSize;
		class?: string;
	};

	let {
		schema,
		value = $bindable(null),
		multiple = false,
		onValueChange,
		allow,
		deny,
		placeholder = 'Select an entity type',
		searchPlaceholder = 'Search types…',
		emptyLabel = 'No entity type matches.',
		clearable = true,
		readonly = false,
		disabled = false,
		invalid = false,
		showCode = true,
		summary = 'ellipsis',
		max = 0,
		size = 'md',
		class: className
	}: Props = $props();

	let open = $state(false);
	let controlEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let search = $state('');
	let loaded = $state<EntityTypeInfo[] | null>(null);
	let failure = $state<string | null>(null);

	// One read per site, cached by the schema service: `/schema` is 12KB and holds
	// every enabled type (probe 002). Allow and deny are applied to the derived list
	// below, so narrowing them re-filters with no second call.
	$effect(() => {
		const service = schema;
		let live = true;
		service
			.entityTypes()
			.then((types) => {
				if (live) loaded = types;
			})
			.catch((error: unknown) => {
				if (live) failure = error instanceof Error ? error.message : String(error);
			});
		return () => {
			live = false;
		};
	});

	const selected = $derived(multiple ? ((value as string[] | null) ?? []) : value ? [value as string] : []);
	const types = $derived(loaded ? filterEntityTypes(loaded, { allow, deny }) : []);
	const shown = $derived(types.filter((t) => matchesTokens(search, t.displayName, t.name)));
	const byName = $derived(new Map(types.map((t) => [t.name, t])));
	const labelOf = (code: string) => byName.get(code)?.displayName ?? code;
	const plan = $derived(summariseSelection(selected, labelOf, { summary, max }));
	const interactive = $derived(!readonly && !disabled);
	const showClear = $derived(clearable && selected.length > 0 && interactive);
	const singleKey = $derived(multiple ? '' : ((value as string | null) ?? ''));

	function emit(next: string | string[] | null): void {
		value = next;
		onValueChange?.(next);
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
		open = true;
	}

	function setOpen(next: boolean): void {
		open = interactive ? next : false;
		if (!open) search = '';
	}

	function setSingle(code: string): void {
		emit(code === '' ? null : code);
	}

	function setMultiple(codes: string[]): void {
		emit(codes);
	}

	function remove(code: string): void {
		emit(selected.filter((c) => c !== code));
	}

	function clear(): void {
		emit(multiple ? [] : null);
		inputEl?.focus({ preventScroll: true });
	}
</script>

{#snippet control()}
	<div
		bind:this={controlEl}
		data-slot="entity-type-picker-control"
		onpointerdown={openFromControl}
		role="group"
		aria-disabled={disabled ? 'true' : undefined}
		data-readonly={readonly ? 'true' : undefined}
		title={plan.title || placeholder}
		class={cn(PICKER_CONTROL, PICKER_BOX[size], plan.oneLine && 'flex-nowrap', readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
	>
		{#if selected.length > 0}
			<span data-slot="entity-type-picker-value" class="flex min-w-0 items-center gap-1.5">
				{#if summary === 'count' && multiple}
					<span data-slot="entity-type-picker-count" class="truncate">{plan.countLabel}</span>
				{:else}
					<!-- The chips clip rather than shrink, so `+n` always says how many are hidden. -->
					<span
						data-slot="entity-type-picker-chips"
						class={cn('flex min-w-0 items-center gap-1.5', plan.oneLine ? 'overflow-hidden' : 'flex-wrap')}
					>
					{#each plan.shown as code (code)}
						<span data-slot="entity-type-picker-chip" class={PICKER_TEXT_CHIP}>
							<span class="truncate">{labelOf(code)}</span>
							{#if multiple && interactive}
								<button
									type="button"
									data-slot="entity-type-picker-remove"
									aria-label={`Remove ${labelOf(code)}`}
									onclick={() => remove(code)}
									class="hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm opacity-60 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
								>
									<X aria-hidden="true" class="size-3" />
								</button>
							{/if}
						</span>
					{/each}
					</span>
					{#if plan.overflow > 0}
						<span
							data-slot="entity-type-picker-overflow"
							class="text-muted-foreground shrink-0 text-xs tabular-nums">+{plan.overflow}</span
						>
					{/if}
				{/if}
			</span>
		{/if}
		<Combobox.Input
			bind:ref={inputEl}
			data-slot="entity-type-picker-input"
			aria-invalid={invalid ? 'true' : undefined}
			aria-label={placeholder}
			readonly={readonly || undefined}
			placeholder={selected.length > 0 ? searchPlaceholder : placeholder}
			oninput={(e) => (search = e.currentTarget.value)}
			class={PICKER_INPUT}
		/>
	</div>
{/snippet}

{#snippet list()}
	<!--
		Fixed, and anchored to the whole control rather than to the input: the list
		scrolls its highlighted row into view on mount, and an absolute wrapper still
		at the page origin would drag the page there with it.
	-->
	<Combobox.Portal>
		<Combobox.Content
			data-picker="entity-type"
			data-slot="entity-type-picker-content"
			strategy="fixed"
			customAnchor={controlEl}
			align="start"
			sideOffset={4}
			class={PICKER_POPUP}
		>
			<div data-slot="entity-type-picker-list" class={PICKER_LIST}>
				{#if failure}
					<div data-slot="entity-type-picker-error" class={cn(PICKER_NOTE, 'text-destructive')}>
						<TriangleAlert aria-hidden="true" class="size-4 shrink-0" />
						<span class="truncate">{failure}</span>
					</div>
				{:else if loaded === null}
					<div data-slot="entity-type-picker-loading" class="flex flex-col gap-2">
						{#each [0, 1, 2] as row (row)}
							<Skeleton class="h-8 w-full" />
						{/each}
					</div>
				{:else if shown.length === 0}
					<div data-slot="entity-type-picker-empty" class={cn(PICKER_NOTE, 'text-muted-foreground')}>
						<SearchX aria-hidden="true" class="size-4 shrink-0" />
						<span class="truncate">{emptyLabel}</span>
					</div>
				{:else}
					{#each shown as type (type.name)}
						{@const chosen = selected.includes(type.name)}
						<Combobox.Item
							data-slot="entity-type-picker-option"
							data-entity-type={type.name}
							data-checked={!multiple && chosen ? 'true' : undefined}
							data-selected-type={chosen ? 'true' : undefined}
							value={type.name}
							label={type.displayName}
							class={cn(PICKER_ROW, 'items-start')}
						>
							{#if multiple}
								<span data-slot="entity-type-picker-check" class="flex h-5 shrink-0 items-center">
									<Checkbox checked={chosen} tabindex={-1} aria-hidden="true" class="pointer-events-none" />
								</span>
							{/if}
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="truncate">{type.displayName}</span>
								{#if showCode && type.name !== type.displayName}
									<span data-slot="entity-type-picker-code" class="text-muted-foreground truncate font-mono text-xs"
										>{type.name}</span
									>
								{/if}
							</span>
						</Combobox.Item>
					{/each}
				{/if}
			</div>
		</Combobox.Content>
	</Combobox.Portal>
{/snippet}

{#snippet actions()}
	{#if !readonly}
		<div class="pointer-events-none absolute right-2 flex items-center gap-1">
			{#if showClear}
				<button
					type="button"
					data-slot="entity-type-picker-clear"
					aria-label="Clear the selection"
					onclick={clear}
					class={PICKER_ICON_BUTTON}
				>
					<X aria-hidden="true" class={PICKER_GLYPH[size]} />
				</button>
			{/if}
			<Combobox.Trigger
				data-slot="entity-type-picker-trigger"
				aria-label="Show the entity types"
				{disabled}
				class="pointer-events-auto shrink-0 outline-none"
			>
				<ChevronsUpDown aria-hidden="true" class={cn('shrink-0 opacity-50', PICKER_GLYPH[size])} />
			</Combobox.Trigger>
		</div>
	{/if}
{/snippet}

<!--
	One entity type, or several, as a searchable combobox.

	The list is every type the site has enabled, display name first with the code
	beneath it when the two differ. `allow` and `deny` narrow the derived options
	rather than the read, so a caller switching modes sees the list change without a
	refetch. The vocabulary is one read, so the query input narrows it in the browser.
	Multi mode keeps the popup open and ticks the chosen rows.
-->
<div
	data-slot="entity-type-picker"
	data-size={size}
	data-multiple={multiple ? 'true' : 'false'}
	data-summary={multiple ? summary : undefined}
	class={cn('relative flex w-full min-w-0 items-center', className)}
>
	{#if multiple}
		<Combobox.Root
			type="multiple"
			{disabled}
			inputValue={search}
			bind:open={() => open, setOpen}
			bind:value={() => selected, setMultiple}
		>
			{@render control()}
			{@render list()}
			{@render actions()}
		</Combobox.Root>
	{:else}
		<Combobox.Root
			type="single"
			allowDeselect={false}
			{disabled}
			inputValue={search}
			bind:open={() => open, setOpen}
			bind:value={() => singleKey, setSingle}
		>
			{@render control()}
			{@render list()}
			{@render actions()}
		</Combobox.Root>
	{/if}
</div>
