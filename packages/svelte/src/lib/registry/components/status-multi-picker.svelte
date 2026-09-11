<script lang="ts" module>
	import type { PickerSummary } from '@sg-widgets/core';

	export type StatusMultiPickerSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { PickerRow, SgContext, StatusOption, StatusRecord } from '@sg-widgets/core';
	import {
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
	import Row from '$lib/registry/components/picker-row.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';
	import {
		CHIP_GAP,
		OVERFLOW_RESERVE,
		PICKER_ANCHORED_POPUP,
		PICKER_ARMED,
		PICKER_BOX,
		PICKER_CHIP as BADGE,
		PICKER_CONTROL,
		PICKER_GLYPH,
	PICKER_TRAILING,
		PICKER_ICON_BUTTON,
		PICKER_LIST,
		PICKER_PILL,
		PICKER_ROW,
		PICKER_SEARCH,
		PICKER_SEARCH_ROW,
		PICKER_TOKEN_INPUT
	} from '$lib/registry/components/picker-classes.js';
	import StatusBadge, { type StatusBadgeVariant } from '$lib/registry/components/status-badge.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The widget context. The options and the status table are read through it, once per page. */
		context: SgContext;
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
		/** Draw the code as the row's right-aligned secondary, when it says more than the label. */
		showCode?: boolean;
		/** The muted line under a row's label. */
		subLabel?: (option: StatusOption) => string;
		/** A row's right-aligned value, of the caller's own making. Wins over the code. */
		secondary?: (option: StatusOption) => string;
		/** What the control shows for the selection. */
		summary?: PickerSummary;
		/** What one selected status is drawn as. Orthogonal to how many the control shows. */
		badge?: StatusBadgeVariant;
		/** Badges drawn before the rest becomes `+n`. `0` lets the row fit what it can. */
		max?: number;
		/** The site the stock sprite is served from, passed to every badge. Defaults to the context's. */
		siteUrl?: string;
		size?: StatusMultiPickerSize;
		/** Whether the popup is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	};

	let {
		context,
		entityType,
		projectId = undefined,
		projectIds = undefined,
		field = undefined,
		value = $bindable([]),
		onValueChange,
		placeholder = 'Select statuses',
		searchPlaceholder = 'Search statuses…',
		emptyLabel = NO_MATCH_LABEL,
		loadingLabel,
		errorLabel,
		clearable = true,
		readonly = false,
		disabled = false,
		invalid = false,
		showCode = true,
		subLabel,
		secondary,
		summary = 'ellipsis',
		badge = 'both',
		max = 0,
		siteUrl = undefined,
		size = 'md',
		open = $bindable(false),
		onOpenChange,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// The context's own services, so every widget on the page shares one schema read
	// and one status table.
	const schema = $derived(context.schema);
	const statusTable = $derived(context.statuses);
	const site = $derived(siteUrl ?? context.siteUrl);

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
	 * goes through the context's cache, so it is never an effect re-firing on
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

	let controlEl = $state<HTMLElement | null>(null);
	let listEl = $state<HTMLElement | null>(null);
	let inputEl = $state<HTMLInputElement | null>(null);
	let search = $state('');
	/** The chip a Backspace has highlighted. The next one removes it. */
	let armed = $state<number | null>(null);

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

	/**
	 * A chip control is a token field, with the caret beside the badges. A summary
	 * control is a trigger, and keeps its search box at the top of the popup instead.
	 */
	const inline = $derived(summary === 'chips');

	// Read-only wins over disabled and over the loading window.
	const inert = $derived(!readonly && (disabled || query.loading));
	const interactive = $derived(!readonly && !inert);
	const showClear = $derived(clearable && value.length > 0 && !readonly && !disabled);

	/** What the badges look like, so a change to any of it re-measures the row. */
	const rowKey = $derived(
		`${size}|${summary}|${badge}|${interactive}|${value.map((code) => byCode.get(code)?.label ?? code).join(', ')}`
	);
	let badgesEl = $state<HTMLElement | null>(null);
	let available = $state(0);
	let widths = $state<number[]>([]);
	let measured = $state(false);
	/** True once the row knows its own widths and its room, so it may be drawn. */
	const ready = $derived(summary !== 'ellipsis' || (measured && available > 0));

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
		if (!control || summary !== 'ellipsis') return;
		const observer = new ResizeObserver(() => (available = roomIn(control)));
		observer.observe(control);
		available = roomIn(control);
		return () => observer.disconnect();
	});

	$effect(() => {
		void rowKey;
		const row = badgesEl;
		if (!row || summary !== 'ellipsis') return;
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
			summary,
			// A bare icon is half a badge wide, so a fixed cap fits twice as many.
			max: badge === 'icon' ? max * 2 : max,
			fit:
				summary === 'ellipsis' && measured && available > 0
					? { widths, available, reserve: OVERFLOW_RESERVE }
					: undefined
		})
	);

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
		const el = inputEl;
		if (!el) return;
		el.focus({ preventScroll: true });
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

	function setSelected(next: string[]): void {
		value = next;
		onValueChange?.(value);
	}

	function remove(code: string): void {
		setSelected(value.filter((c) => c !== code));
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
			query: search,
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
				const code = value[intent.index];
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

	function clear(): void {
		setSelected([]);
		if (inline) inputEl?.focus({ preventScroll: true });
	}

	/** The shared row a status is drawn as. There is no entity behind a code, so it carries no values. */
	function rowOf(option: StatusOption): PickerRow {
		return { type: 'Status', id: 0, name: option.label, values: {} };
	}

	/** The right-aligned value: the caller's, else the code when it says more than the label. */
	function secondaryOf(option: StatusOption): string | undefined {
		if (secondary) return secondary(option) || undefined;
		return showCode && option.code !== option.label ? option.code : undefined;
	}
</script>

{#snippet statusBadge(code: string, variant: StatusBadgeVariant, removable: boolean)}
	<StatusBadge
		{code}
		status={query.statuses.get(code) ?? null}
		field={badgeField}
		{variant}
		size={BADGE[size]}
		siteUrl={site}
		{removable}
		onRemove={remove}
		removeLabel={`Remove ${byCode.get(code)?.label ?? code}`}
		class="min-w-0"
	/>
{/snippet}

{#snippet chip(code: string, index: number)}
	<span
		data-slot="status-multi-picker-chip"
		data-chip=""
		data-armed={armed === index ? 'true' : undefined}
		hidden={ready && index >= plan.shown.length}
		class={cn('flex min-w-0 shrink-0 items-center', armed === index && cn(PICKER_ARMED, 'rounded-sm'))}
	>
		{@render statusBadge(code, badge, interactive)}
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

	A row is the shared picker row of rule 9, after its checkbox: the status icon as the
	leading glyph, the display label with the matched runs bold, and the code
	right-aligned. The badge stays in the control, where a status is a value rather than
	a row.
-->
<div
	bind:this={ref}
	data-slot="status-multi-picker"
	data-size={size}
	data-summary={summary}
	data-badge={badge}
	data-loading={query.loading ? 'true' : undefined}
	class={cn('relative flex w-full min-w-0 items-center', className)}
	{...rest}
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
			data-empty={value.length === 0 ? '' : undefined}
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
				data-picker="status"
				data-slot="status-multi-picker-content"
				strategy="fixed"
				customAnchor={controlEl}
				align="start"
				sideOffset={4}
				class={PICKER_ANCHORED_POPUP}
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
							onkeydown={onKey}
							class={PICKER_SEARCH}
						/>
					</div>
				{/if}
				<div bind:this={listEl} data-slot="status-multi-picker-list" class={PICKER_LIST}>
					{#if query.error !== null}
						<StateLine
							state="error"
							slotName="status-multi-picker-error"
							icon={TriangleAlert}
							label={stateLine('error', { errorLabel }, query.error)}
						/>
					{:else if query.loading}
						<div
							data-slot="status-multi-picker-loading"
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
							slotName="status-multi-picker-empty"
							icon={SearchX}
							label={emptyLabel}
						/>
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
								<Row
									row={rowOf(option)}
									query={search}
									subLabel={subLabel?.(option)}
									secondary={secondaryOf(option)}
									{size}
									{context}
								>
									{#snippet glyph()}
										<StatusBadge
											code={option.code}
											status={query.statuses.get(option.code) ?? null}
											field={badgeField}
											variant="glyph"
											{size}
											siteUrl={site}
										/>
									{/snippet}
								</Row>
							</Combobox.Item>
						{/each}
					{/if}
				</div>
			</Combobox.Content>
		</Combobox.Portal>

		{#if !readonly}
			<div class={cn('pointer-events-none absolute top-0 right-2 flex items-center gap-1', PICKER_TRAILING[size])}>
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
					class={PICKER_ICON_BUTTON}
				>
					<ChevronDown aria-hidden="true" class={PICKER_GLYPH[size]} />
				</Combobox.Trigger>
			</div>
		{/if}
	</Combobox.Root>
</div>
