<script lang="ts" module>
	export type StatusMultiPickerSize = 'sm' | 'md' | 'lg';
	/** What the closed trigger shows for the selection. */
	export type StatusMultiPickerSummary = 'icons' | 'names' | 'both' | 'count';

	/** Controls follow the input ladder of `docs/design-rules.md`. */
	const BOX: Record<StatusMultiPickerSize, string> = {
		sm: 'h-8 px-2',
		md: 'h-9 px-3',
		lg: 'h-10 px-3'
	};
	const GLYPH: Record<StatusMultiPickerSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};
	/** A badge inside a control sits one step down the leaf ladder. */
	const BADGE: Record<StatusMultiPickerSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };
	/** The badge row in the trigger: one line, clipped, never taller than the control. */
	const BADGES = 'flex min-w-0 items-center gap-1 overflow-hidden';

	function countLabel(n: number): string {
		return `${n} ${n === 1 ? 'status' : 'statuses'}`;
	}

	const TRIGGER =
		'border-input bg-background focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex w-full min-w-0 items-center rounded-md border text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2';
</script>

<script lang="ts">
	import type { SgClient, StatusOption, StatusRecord } from '@sg-widgets/core';
	import { createSchemaService, createStatusService } from '@sg-widgets/core';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
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
		/** What the closed trigger shows for the selection. */
		summary?: StatusMultiPickerSummary;
		/** Above this many selected, every mode reads as a count. `icons` collapses at twice this. */
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
		summary = 'both',
		max = 3,
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
	const title = $derived(
		value.length === 0
			? placeholder
			: value.map((code) => rows.find((option) => option.code === code)?.label ?? code).join(', ')
	);

	// Read-only wins over disabled and over the loading window.
	const inert = $derived(!readonly && (disabled || query.loading));
	const showClear = $derived(clearable && value.length > 0 && !readonly && !disabled);
	// Icons take half the width of a badge, so that mode holds twice as many.
	const collapsed = $derived(
		summary === 'count' || value.length > (summary === 'icons' ? max * 2 : max)
	);

	let open = $state(false);
	let inputEl = $state<HTMLInputElement | null>(null);

	function toggle(code: string): void {
		value = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
		onValueChange?.(value);
	}

	function clear(): void {
		value = [];
		onValueChange?.(value);
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

{#snippet selection()}
	<span data-slot="status-multi-picker-value" class="flex min-w-0 flex-1 items-center">
		{#if value.length === 0}
			<span class="text-muted-foreground truncate">{placeholder}</span>
		{:else if collapsed}
			<span class="truncate">{countLabel(value.length)}</span>
		{:else if summary === 'names'}
			<span {title} class="truncate">{title}</span>
		{:else}
			<span data-slot="status-multi-picker-badges" class={BADGES}>
				{#each value as code (code)}
					{@render badge(code, summary === 'icons' ? 'icon' : 'both')}
				{/each}
			</span>
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
	it: the vocabulary is read once and the search box filters it in the browser
	(field_types/status_list).
-->
<div
	data-slot="status-multi-picker"
	data-size={size}
	data-loading={query.loading ? 'true' : undefined}
	class={cn('relative flex w-full min-w-0 items-center', className)}
>
	{#if readonly}
		<div
			data-slot="status-multi-picker-trigger"
			data-readonly="true"
			aria-readonly="true"
			aria-invalid={invalid ? 'true' : undefined}
			{title}
			class={cn(TRIGGER, BOX[size], 'pr-3')}
		>
			{@render selection()}
		</div>
	{:else}
		<Popover.Root bind:open={() => open, (next) => (open = inert ? false : next)}>
			<Popover.Trigger
				data-slot="status-multi-picker-trigger"
				role="combobox"
				aria-expanded={open}
				aria-invalid={invalid ? 'true' : undefined}
				disabled={inert}
				{title}
				class={cn(TRIGGER, BOX[size], showClear ? 'pr-14' : 'pr-8')}
			>
				{@render selection()}
			</Popover.Trigger>

			<!--
				The anchor width is the primitive's own variable, so the list matches the trigger.
				Fixed: the Command list scrolls its highlighted row into view on mount, and an absolute
				wrapper still at the page origin would drag the page there with it.
			-->
			<Popover.Content
				strategy="fixed"
				data-picker="status"
				onOpenAutoFocus={(e) => {
					e.preventDefault();
					inputEl?.focus({ preventScroll: true });
				}}
				align="start"
				class="w-(--bits-floating-anchor-width) min-w-56 gap-0 overflow-hidden p-0"
			>
				<Command.Root label="Statuses">
					<Command.Input bind:ref={inputEl} placeholder={searchPlaceholder} />
					<Command.List>
						{#if query.error !== null}
							<div
								data-slot="status-multi-picker-error"
								class="text-destructive flex items-center justify-center gap-1.5 py-6 text-center text-sm"
							>
								<TriangleAlert aria-hidden="true" class="size-4 shrink-0" />
								<span class="truncate">{query.error}</span>
							</div>
						{:else if query.loading}
							<div data-slot="status-multi-picker-loading" class="flex flex-col gap-2 p-1">
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
							{#each rows as option (option.code)}
								<Command.Item
									value={option.code}
									keywords={[option.label]}
									onSelect={() => toggle(option.code)}
								>
									<Checkbox
										checked={value.includes(option.code)}
										tabindex={-1}
										aria-hidden="true"
										class="pointer-events-none"
									/>
									{@render badge(option.code, 'both')}
								</Command.Item>
							{/each}
						{/if}
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>

		<div class="pointer-events-none absolute right-2 flex items-center gap-1">
			{#if showClear}
				<button
					type="button"
					data-slot="status-multi-picker-clear"
					aria-label="Clear the statuses"
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
