<script lang="ts" module>
	import type { PickerSummary } from '@sg-widgets/core';

	export type EntityTypePickerSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityTypeInfo, SgContext } from '@sg-widgets/core';
	import {
		filterEntityTypes,
		holdsArmed,
		matchesTokens,
		NO_MATCH_LABEL,
		pickerKeyIntent,
		scrollHighlightedIntoView,
		stateLine,
		summariseSelection
	} from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import Search from '@lucide/svelte/icons/search';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import StateLine from '$lib/registry/components/state-line.svelte';
	import {
		CHIP_GAP,
		OVERFLOW_RESERVE,
		PICKER_ARMED,
		PICKER_BOX,
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
		PICKER_TEXT_CHIP,
		PICKER_TOKEN_INPUT
	} from '$lib/registry/components/picker-classes.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The widget context. The site's enabled types are read through it, once per page. */
		context: SgContext;
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
		/** Shown when the search matches nothing. */
		emptyLabel?: string;
		/** The accessible name of the skeletons a read stands behind. */
		loadingLabel?: string;
		/** Shown in place of what the failed read said. */
		errorLabel?: string;
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
		/** Whether the popup is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	};

	let {
		context,
		value = $bindable(null),
		multiple = false,
		onValueChange,
		allow,
		deny,
		placeholder = 'Select an entity type',
		searchPlaceholder = 'Search types…',
		emptyLabel = NO_MATCH_LABEL,
		loadingLabel,
		errorLabel,
		clearable = true,
		readonly = false,
		disabled = false,
		invalid = false,
		showCode = true,
		summary = 'ellipsis',
		max = 0,
		size = 'md',
		open = $bindable(false),
		onOpenChange,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// The context's own service, so every widget on the page shares one schema read.
	const schema = $derived(context.schema);

	let controlEl = $state<HTMLElement | null>(null);
	let listEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let search = $state('');
	/** The chip a Backspace has highlighted. The next one removes it. */
	let armed = $state<number | null>(null);
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
	/**
	 * A chip control is a token field, with the caret beside the chips. A multi
	 * control summarising its selection is a trigger, and keeps its search box at the
	 * top of the popup instead. A single picker is always a token field.
	 */
	const inline = $derived(!multiple || summary === 'chips');
	/** Only a multi control measures a row; a single one draws one chip and stops. */
	const fitted = $derived(multiple && summary === 'ellipsis');

	/** What the chips look like, so a change to any of it re-measures the row. */
	const rowKey = $derived(`${size}|${summary}|${selected.map(labelOf).join(', ')}`);
	let chipsEl = $state<HTMLElement | null>(null);
	let available = $state(0);
	let widths = $state<number[]>([]);
	let measured = $state(false);
	/** True once the row knows its own widths and its room, so it may be drawn. */
	const ready = $derived(!fitted || (measured && available > 0));

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
		if (!control || !fitted) return;
		const observer = new ResizeObserver(() => (available = roomIn(control)));
		observer.observe(control);
		available = roomIn(control);
		return () => observer.disconnect();
	});

	$effect(() => {
		void rowKey;
		const row = chipsEl;
		if (!row || !fitted) return;
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
		summariseSelection(selected, labelOf, {
			summary,
			max,
			fit: fitted && measured && available > 0 ? { widths, available, reserve: OVERFLOW_RESERVE } : undefined
		})
	);
	const interactive = $derived(!readonly && !disabled);
	const showClear = $derived(clearable && selected.length > 0 && interactive);
	const singleKey = $derived(multiple ? '' : ((value as string | null) ?? ''));

	function emit(next: string | string[] | null): void {
		value = next;
		onValueChange?.(next);
	}

	/** A press anywhere in the field opens the list, and a token field takes the caret. */
	function openFromControl(event: PointerEvent): void {
		if (!interactive) return;
		const target = event.target as HTMLElement | null;
		// The chip's remove control, the clear control and the chevron own their own press.
		if (target?.closest('button')) return;
		// The press's own default would move focus to the body and off whichever caret
		// takes it: the field's, or the popup's once the effect below focuses it.
		if (target !== inputEl) event.preventDefault();
		if (inline && target !== inputEl) inputEl?.focus({ preventScroll: true });
		setOpen(true);
	}

	// A summary trigger has no caret of its own, so the popup's search box takes it.
	$effect(() => {
		if (!open || inline) return;
		inputEl?.focus({ preventScroll: true });
	});

	function setOpen(next: boolean): void {
		const wanted = interactive ? next : false;
		if (!wanted) {
			search = '';
			armed = null;
		}
		if (wanted === open) return;
		open = wanted;
		onOpenChange?.(open);
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
		if (inline) inputEl?.focus({ preventScroll: true });
	}

	// A chip removed from under the highlight takes it with it.
	$effect(() => {
		if (armed !== null && armed >= selected.length) armed = null;
	});

	/**
	 * Backspace, Escape and the arrows. The primitive's own handler runs after this
	 * one, so a key this picker owns is prevented rather than shared.
	 */
	function onKey(event: KeyboardEvent): void {
		const intent = pickerKeyIntent(event.key, {
			open,
			query: search,
			count: selected.length,
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
				const code = selected[intent.index];
				if (code !== undefined) remove(code);
				return;
			}
			case 'follow':
				void tick().then(() => scrollHighlightedIntoView(listEl));
				return;
			default:
				return;
		}
	}

	// The search box narrows the list here, so the rows change under the highlight;
	// the list follows it.
	$effect(() => {
		void shown.length;
		if (!open) return;
		void tick().then(() => scrollHighlightedIntoView(listEl));
	});
</script>

{#snippet control()}
	<div
		bind:this={controlEl}
		data-slot="entity-type-picker-control"
		onpointerdown={openFromControl}
		role="group"
		aria-disabled={disabled ? 'true' : undefined}
		data-invalid={invalid && !inline ? 'true' : undefined}
		data-readonly={readonly ? 'true' : undefined}
		data-empty={selected.length === 0 ? '' : undefined}
		title={plan.title || placeholder}
		class={cn(PICKER_CONTROL, PICKER_BOX[size], plan.oneLine && 'flex-nowrap', readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
	>
		{#if selected.length > 0}
			<span data-slot="entity-type-picker-value" class="flex min-w-0 items-center gap-1.5">
				{#if summary === 'count' && multiple}
					<span data-slot="entity-type-picker-count" class="truncate">{plan.countLabel}</span>
				{:else}
					<!--
						Whole chips only: the row measures itself and hides the ones that do not
						fit, so nothing is ever cut in half. `+n` follows the last one drawn.
							No stylesheet here gives `[hidden]` a display rule, so the row does.
					-->
					<span
						bind:this={chipsEl}
						data-slot="entity-type-picker-chips"
						class={cn(
							'flex min-w-0 items-center gap-1.5 [&>[hidden]]:hidden',
							plan.oneLine ? 'flex-nowrap overflow-hidden' : 'flex-wrap',
							ready ? undefined : 'invisible'
						)}
					>
					{#each selected as code, index (code)}
						<span
							data-slot="entity-type-picker-chip"
							data-chip=""
							data-armed={armed === index ? 'true' : undefined}
							hidden={ready && index >= plan.shown.length}
							class={cn(PICKER_TEXT_CHIP, armed === index && PICKER_ARMED)}
						>
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
					{#if plan.overflow > 0}
						<button
							type="button"
							data-slot="entity-type-picker-overflow"
							title={plan.title}
							aria-label={`Show all ${selected.length} types`}
							onclick={() => setOpen(true)}
							class={PICKER_PILL}>+{plan.overflow}</button
						>
					{/if}
					</span>
				{/if}
			</span>
		{:else if !inline}
			<span data-slot="entity-type-picker-placeholder" class="text-muted-foreground truncate"
				>{placeholder}</span
			>
		{/if}
		{#if inline}
			<Combobox.Input
				bind:ref={inputEl}
				data-slot="entity-type-picker-input"
				aria-invalid={invalid ? 'true' : undefined}
				aria-label={placeholder}
				readonly={readonly || undefined}
				placeholder={selected.length > 0 ? '' : placeholder}
				oninput={(e) => (search = e.currentTarget.value)}
				class={PICKER_TOKEN_INPUT}
			/>
		{/if}
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
			{#if !inline}
				<div data-slot="entity-type-picker-search" class={PICKER_SEARCH_ROW}>
					<Search aria-hidden="true" class="size-4 shrink-0 opacity-50" />
					<Combobox.Input
						bind:ref={inputEl}
						data-slot="entity-type-picker-input"
						aria-label={searchPlaceholder}
						placeholder={searchPlaceholder}
						oninput={(e) => (search = e.currentTarget.value)}
						onkeydown={onKey}
						class={PICKER_SEARCH}
					/>
				</div>
			{/if}
			<div bind:this={listEl} data-slot="entity-type-picker-list" class={PICKER_LIST}>
				{#if failure}
					<StateLine
						state="error"
						slotName="entity-type-picker-error"
						icon={TriangleAlert}
						label={stateLine('error', { errorLabel }, failure)}
					/>
				{:else if loaded === null}
					<div
						data-slot="entity-type-picker-loading"
						class="flex flex-col gap-2"
						aria-busy="true"
						aria-label={stateLine('loading', { loadingLabel })}
					>
						{#each [0, 1, 2] as row (row)}
							<Skeleton class="h-8 w-full" />
						{/each}
					</div>
				{:else if shown.length === 0}
					<StateLine
						state="empty"
						slotName="entity-type-picker-empty"
						icon={SearchX}
						label={emptyLabel}
					/>
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
		<div class={cn('pointer-events-none absolute top-0 right-2 flex items-center gap-1', PICKER_TRAILING[size])}>
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
				class={PICKER_ICON_BUTTON}
			>
				<ChevronDown aria-hidden="true" class={PICKER_GLYPH[size]} />
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
	bind:this={ref}
	data-slot="entity-type-picker"
	data-size={size}
	data-multiple={multiple ? 'true' : 'false'}
	data-summary={multiple ? summary : undefined}
	class={cn('relative flex w-full min-w-0 items-center', className)}
	{...rest}
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
