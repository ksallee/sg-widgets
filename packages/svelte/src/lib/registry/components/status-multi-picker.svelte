<script lang="ts" module>
	import type { PickerSummary } from '@sg-widgets/core';

	export type StatusMultiPickerSize = 'sm' | 'md' | 'lg';
	/**
	 * What the control shows for the selection. `both` is the old spelling of `chips`.
	 * `icons` drops the labels and `names` reads the labels as one line of text.
	 */
	export type StatusMultiPickerSummary = PickerSummary | 'icons' | 'names' | 'both';

	/** Controls follow the input ladder of `docs/design-rules.md`. */
	const PICKER_BOX: Record<StatusMultiPickerSize, string> = {
		sm: 'min-h-8 px-2 py-1',
		md: 'min-h-9 px-3 py-1',
		lg: 'min-h-10 px-3 py-1'
	};
	const PICKER_GLYPH: Record<StatusMultiPickerSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};
	/** A badge inside a control sits one step down the leaf ladder. */
	const BADGE: Record<StatusMultiPickerSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

	/** The bordered field the badges and the query input sit in. */
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
		'bg-popover text-popover-foreground data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95 ring-foreground/10 z-50 w-(--bits-combobox-anchor-width) min-w-56 origin-(--bits-combobox-content-transform-origin) overflow-hidden rounded-lg shadow-md ring-1 outline-hidden duration-100';
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
</script>

<script lang="ts">
	import type { SgClient, StatusOption, StatusRecord } from '@sg-widgets/core';
	import { createSchemaService, createStatusService, matchesTokens, summariseSelection } from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import Search from '@lucide/svelte/icons/search';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';

	type Props = {
		/** The site to read from. Wrap it in `createQueryCache` so widgets on a page share one read. */
		client: SgClient;
		entityType: string;
		/** Offer the codes this project allows. */
		projectId?: number;
		/** Offer the codes every one of these projects allows. */
		projectIds?: number[];
		/** A list or status field other than the type's own. Project's is `sg_status`. */
		field?: string;
		/** The selected codes. */
		value?: string[];
		onValueChange?: (value: string[]) => void;
		placeholder?: string;
		searchPlaceholder?: string;
		emptyLabel?: string;
		clearable?: boolean;
		readonly?: boolean;
		disabled?: boolean;
		invalid?: boolean;
		/** Show the raw code instead of the label. The other one stays in the tooltip. */
		showCode?: boolean;
		/** What the control shows for the selection. */
		summary?: StatusMultiPickerSummary;
		/** Badges drawn before the rest becomes `+n`. `0` lets the row fit what it can. */
		max?: number;
		/** The site the stock sprite is served from, passed to every badge. */
		siteUrl?: string;
		size?: StatusMultiPickerSize;
		class?: string;
	};

	let {
		client,
		entityType,
		projectId = undefined,
		projectIds = undefined,
		field = undefined,
		value = $bindable([]),
		onValueChange,
		placeholder = 'Select statuses',
		searchPlaceholder = 'Search statuses…',
		emptyLabel = 'No status matches.',
		clearable = true,
		readonly = false,
		disabled = false,
		invalid = false,
		showCode = false,
		summary = 'ellipsis',
		max = 0,
		siteUrl = undefined,
		size = 'md',
		class: className
	}: Props = $props();

	// Built from the prop rather than at init, so a client swapped in reloads.
	const schema = $derived(createSchemaService(client));
	const statusTable = $derived(createStatusService(client));

	interface Loaded {
		loading: boolean;
		error: string | null;
		options: StatusOption[];
		statuses: ReadonlyMap<string, StatusRecord>;
	}

	function optionsFor(type: string, ids: number[], name: string | undefined): Promise<StatusOption[]> {
		const [first] = ids;
		if (first === undefined) return schema.statusOptions(type, undefined, name);
		return ids.length === 1
			? schema.statusOptions(type, first, name)
			: schema.statusOptionsForProjects(type, ids, name);
	}

	/**
	 * One load, as reactive state. The read hangs off the props through a derived and
	 * goes through the cache the client carries, so it is never an effect re-firing on
	 * a "last seen" key.
	 */
	function load(type: string, ids: number[], name: string | undefined): Loaded {
		const state = $state<Loaded>({ loading: true, error: null, options: [], statuses: new Map() });
		Promise.all([optionsFor(type, ids, name), statusTable.byCode()]).then(
			([options, statuses]) => {
				state.options = options;
				state.statuses = statuses;
				state.loading = false;
			},
			(error: unknown) => {
				state.error = error instanceof Error ? error.message : String(error);
				state.loading = false;
			}
		);
		return state;
	}

	const projectKey = $derived((projectIds ?? (projectId === undefined ? [] : [projectId])).join(','));
	const query = $derived(
		load(entityType, projectKey === '' ? [] : projectKey.split(',').map(Number), field)
	);

	let open = $state(false);
	let controlEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let search = $state('');

	// `display_values` is the only other source of a label, so the options carry it to the badge.
	const badgeField = $derived({
		displayValues: Object.fromEntries(query.options.map((option) => [option.code, option.label]))
	});
	// A stored code outside the usable set is legal, so it keeps a row of its own (probe 009).
	const rows = $derived([
		...query.options,
		...value
			.filter((code) => !query.options.some((option) => option.code === code))
			.map((code) => ({ code, label: code }))
	]);
	// A status list has no substring operator, so the vocabulary is read once and the
	// search box narrows it here (field_types/status_list).
	const shown = $derived(rows.filter((option) => matchesTokens(search, option.label, option.code)));
	const byCode = $derived(new Map(rows.map((option) => [option.code, option])));

	/** `both` is the old spelling of `chips`, and `icons` fits twice as many. */
	const mode = $derived<PickerSummary>(
		summary === 'both' || summary === 'icons' || summary === 'names' ? 'chips' : summary
	);
	/**
	 * A badge control is a token field, with the caret beside the badges. A summary
	 * control is a trigger, and keeps its search box at the top of the popup instead.
	 */
	const inline = $derived(summary !== 'ellipsis' && summary !== 'count' && summary !== 'names');

	/** What the badges look like, so a change to any of it re-measures the row. */
	const rowKey = $derived(
		`${size}|${summary}|${showCode}|${value.map((code) => byCode.get(code)?.label ?? code).join(', ')}`
	);
	let badgesEl = $state<HTMLElement | null>(null);
	let available = $state(0);
	let widths = $state<number[]>([]);
	let measured = $state(false);
	/** True once the row knows its own widths and its room, so it may be drawn. */
	const ready = $derived(mode !== 'ellipsis' || (measured && available > 0));

	/** Every badge laid out, so a hidden one still reports the width it would take. */
	function measure(row: HTMLElement): number[] {
		const badges = [...row.querySelectorAll<HTMLElement>('[data-chip]')];
		const was = badges.map((badge) => badge.hidden);
		for (const badge of badges) badge.hidden = false;
		const out = badges.map((badge) => Math.ceil(badge.getBoundingClientRect().width) + CHIP_GAP);
		badges.forEach((badge, i) => (badge.hidden = was[i] ?? false));
		return out;
	}

	/** The room the badges have: the control's box, less the padding its affordances take. */
	function roomIn(control: HTMLElement): number {
		const style = getComputedStyle(control);
		return control.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
	}

	$effect(() => {
		const control = controlEl;
		if (!control || mode !== 'ellipsis') return;
		const observer = new ResizeObserver(() => (available = roomIn(control)));
		observer.observe(control);
		available = roomIn(control);
		return () => observer.disconnect();
	});

	$effect(() => {
		void rowKey;
		const row = badgesEl;
		if (!row || mode !== 'ellipsis') return;
		widths = measure(row);
		measured = true;
		let live = true;
		// A badge drawn in the fallback font is not the badge the row ends up with.
		void document.fonts?.ready.then(() => {
			if (live && badgesEl) widths = measure(badgesEl);
		});
		return () => {
			live = false;
		};
	});

	const plan = $derived(
		summariseSelection(value, (code) => byCode.get(code)?.label ?? code, {
			summary: mode,
			max: summary === 'icons' ? max * 2 : max,
			fit:
				mode === 'ellipsis' && measured && available > 0
					? { widths, available, reserve: OVERFLOW_RESERVE }
					: undefined
		})
	);

	// Read-only wins over disabled and over the loading window.
	const inert = $derived(!readonly && (disabled || query.loading));
	const interactive = $derived(!readonly && !inert);
	const showClear = $derived(clearable && value.length > 0 && !readonly && !disabled);

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
		open = true;
	}

	// A summary trigger has no caret of its own, so the popup's search box takes it.
	$effect(() => {
		if (!open || inline) return;
		const el = inputEl;
		if (!el) return;
		el.focus({ preventScroll: true });
	});

	function setOpen(next: boolean): void {
		open = interactive ? next : false;
		if (!open) search = '';
	}

	function setSelected(next: string[]): void {
		value = next;
		onValueChange?.(value);
	}

	function remove(code: string): void {
		setSelected(value.filter((c) => c !== code));
	}

	function clear(): void {
		setSelected([]);
		if (inline) inputEl?.focus({ preventScroll: true });
	}
</script>

{#snippet badge(code: string, variant: 'both' | 'icon')}
	<StatusBadge
		{code}
		status={query.statuses.get(code) ?? null}
		field={badgeField}
		{variant}
		size={BADGE[size]}
		label={showCode ? 'code' : 'name'}
		{siteUrl}
		class="min-w-0"
	/>
{/snippet}

{#snippet chip(code: string, index: number)}
	<span
		data-slot="status-multi-picker-chip"
		data-chip=""
		hidden={ready && index >= plan.shown.length}
		class="flex min-w-0 shrink-0 items-center gap-1"
	>
		{@render badge(code, summary === 'icons' ? 'icon' : 'both')}
		{#if interactive && summary !== 'icons'}
			<button
				type="button"
				data-slot="status-multi-picker-remove"
				aria-label={`Remove ${byCode.get(code)?.label ?? code}`}
				onclick={() => remove(code)}
				class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm opacity-60 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
			>
				<X aria-hidden="true" class="size-3" />
			</button>
		{/if}
	</span>
{/snippet}

<!--
	Several statuses, picked from the codes a project offers.

	The options are `valid_values` minus the project's `hidden_values`, read with
	`project_id`; over several projects they are the intersection of those sets. REST
	does not enforce `hidden_values` on write, so the subtraction is the client's job
	(probe 009). A selected code the option set does not carry keeps a row of its own,
	labelled with the code, so a selection is never dropped from the display.

	A status list has no substring operator, so there is no server-side type-ahead over
	it: the vocabulary is read once and the query input narrows it in the browser
	(field_types/status_list).
-->
<div
	data-slot="status-multi-picker"
	data-size={size}
	data-summary={summary}
	data-loading={query.loading ? 'true' : undefined}
	class={cn('relative flex w-full min-w-0 items-center', className)}
>
	<Combobox.Root
		type="multiple"
		disabled={inert}
		inputValue={search}
		bind:open={() => open, setOpen}
		bind:value={() => value, setSelected}
	>
		<div
			bind:this={controlEl}
			data-slot="status-multi-picker-control"
		onpointerdown={openFromControl}
		role="group"
			aria-disabled={inert ? 'true' : undefined}
			data-invalid={invalid && !inline ? 'true' : undefined}
			data-readonly={readonly ? 'true' : undefined}
			title={plan.title || placeholder}
			class={cn(PICKER_CONTROL, PICKER_BOX[size], plan.oneLine && 'flex-nowrap', readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8')}
		>
			{#if value.length > 0}
				<span
					data-slot="status-multi-picker-value"
					class="flex min-w-0 items-center gap-1.5"
				>
					{#if summary === 'count'}
						<span data-slot="status-multi-picker-count" class="truncate">{plan.countLabel}</span>
					{:else if summary === 'names'}
						<span data-slot="status-multi-picker-names" class="truncate">{plan.title}</span>
					{:else}
						<!--
							Whole badges only: the row measures itself and hides the ones that do not
							fit, so nothing is ever cut in half. `+n` follows the last one drawn.
							No stylesheet here gives `[hidden]` a display rule, so the row does.
						-->
						<span
							bind:this={badgesEl}
							data-slot="status-multi-picker-badges"
							class={cn(
								'flex min-w-0 items-center gap-1.5 [&>[hidden]]:hidden',
								plan.oneLine ? 'flex-nowrap overflow-hidden' : 'flex-wrap',
								ready ? undefined : 'invisible'
							)}
						>
							{#each value as code, index (code)}
								{@render chip(code, index)}
							{/each}
							{#if plan.overflow > 0}
								<button
									type="button"
									data-slot="status-multi-picker-overflow"
									title={plan.title}
									aria-label={`Show all ${value.length} statuses`}
									onclick={() => setOpen(true)}
									class={PICKER_PILL}>+{plan.overflow}</button
								>
							{/if}
						</span>
					{/if}
				</span>
			{:else if !inline}
				<span data-slot="status-multi-picker-placeholder" class="text-muted-foreground truncate"
					>{placeholder}</span
				>
			{/if}
			{#if inline}
				<Combobox.Input
					bind:ref={inputEl}
					data-slot="status-multi-picker-input"
					aria-invalid={invalid ? 'true' : undefined}
					aria-label={placeholder}
					readonly={readonly || undefined}
					placeholder={value.length > 0 ? '' : placeholder}
					oninput={(e) => (search = e.currentTarget.value)}
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
				data-picker="status"
				data-slot="status-multi-picker-content"
				strategy="fixed"
				customAnchor={controlEl}
				align="start"
				sideOffset={4}
				class={PICKER_POPUP}
			>
				{#if !inline}
					<div data-slot="status-multi-picker-search" class={PICKER_SEARCH_ROW}>
						<Search aria-hidden="true" class="size-4 shrink-0 opacity-50" />
						<Combobox.Input
							bind:ref={inputEl}
							data-slot="status-multi-picker-input"
							aria-label={searchPlaceholder}
							placeholder={searchPlaceholder}
							oninput={(e) => (search = e.currentTarget.value)}
							class={PICKER_SEARCH}
						/>
					</div>
				{/if}
				<div data-slot="status-multi-picker-list" class={PICKER_LIST}>
					{#if query.error !== null}
						<div data-slot="status-multi-picker-error" class={cn(PICKER_NOTE, 'text-destructive')}>
							<TriangleAlert aria-hidden="true" class="size-4 shrink-0" />
							<span class="truncate">{query.error}</span>
						</div>
					{:else if query.loading}
						<div data-slot="status-multi-picker-loading" class="flex flex-col gap-2">
							{#each [0, 1, 2] as row (row)}
								<Skeleton class="h-8 w-full" />
							{/each}
						</div>
					{:else if shown.length === 0}
						<div data-slot="status-multi-picker-empty" class={cn(PICKER_NOTE, 'text-muted-foreground')}>
							<SearchX aria-hidden="true" class="size-4 shrink-0" />
							<span class="truncate">{emptyLabel}</span>
						</div>
					{:else}
						{#each shown as option (option.code)}
							{@const chosen = value.includes(option.code)}
							<Combobox.Item
								data-slot="status-multi-picker-option"
								data-status-code={option.code}
								data-selected-status={chosen ? 'true' : undefined}
								value={option.code}
								label={option.label}
								class={PICKER_ROW}
							>
								<span data-slot="status-multi-picker-check" class="flex h-5 shrink-0 items-center">
									<Checkbox checked={chosen} tabindex={-1} aria-hidden="true" class="pointer-events-none" />
								</span>
								{@render badge(option.code, 'both')}
							</Combobox.Item>
						{/each}
					{/if}
				</div>
			</Combobox.Content>
		</Combobox.Portal>

		{#if !readonly}
			<div class="pointer-events-none absolute right-2 flex items-center gap-1">
				{#if showClear}
					<button
						type="button"
						data-slot="status-multi-picker-clear"
						aria-label="Clear the statuses"
						onclick={clear}
						class={PICKER_ICON_BUTTON}
					>
						<X aria-hidden="true" class={PICKER_GLYPH[size]} />
					</button>
				{/if}
				<Combobox.Trigger
					data-slot="status-multi-picker-trigger"
					aria-label="Show the statuses"
					disabled={inert}
					class="focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
				>
					<ChevronsUpDown aria-hidden="true" class={cn('shrink-0 opacity-50', PICKER_GLYPH[size])} />
				</Combobox.Trigger>
			</div>
		{/if}
	</Combobox.Root>
</div>
