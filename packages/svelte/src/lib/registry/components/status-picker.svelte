<script lang="ts" module>
	export type StatusPickerSize = 'sm' | 'md' | 'lg';

	/**
	 * Controls follow the input ladder of `docs/design-rules.md`. The height carries `!`
	 * because the select trigger sets its own under a `data-size` selector.
	 */
	const BOX: Record<StatusPickerSize, string> = {
		sm: 'h-8! px-2',
		md: 'h-9! px-3',
		lg: 'h-10! px-3'
	};
	const GLYPH: Record<StatusPickerSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};
	/** A badge inside a control sits one step down the leaf ladder. */
	const BADGE: Record<StatusPickerSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

	const TRIGGER =
		'border-input bg-background focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex w-full min-w-0 items-center rounded-md border text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2';
</script>

<script lang="ts">
	import type { SgClient, StatusOption, StatusRecord } from '@sg-widgets/core';
	import { createSchemaService, createStatusService } from '@sg-widgets/core';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import * as Select from '$lib/components/ui/select/index.js';
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
		/** The selected code. */
		value?: string;
		onValueChange?: (value: string | undefined) => void;
		placeholder?: string;
		emptyLabel?: string;
		clearable?: boolean;
		readonly?: boolean;
		disabled?: boolean;
		invalid?: boolean;
		/** Show the raw code instead of the label. The other one stays in the tooltip. */
		showCode?: boolean;
		/** The site the stock sprite is served from, passed to every badge. */
		siteUrl?: string;
		size?: StatusPickerSize;
		class?: string;
	};

	let {
		client,
		entityType,
		projectId = undefined,
		projectIds = undefined,
		field = undefined,
		value = $bindable(undefined),
		onValueChange,
		placeholder = 'Select a status',
		emptyLabel = 'No status on this field.',
		clearable = true,
		readonly = false,
		disabled = false,
		invalid = false,
		showCode = false,
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
	const unknown = $derived(
		value !== undefined && value !== '' && !query.options.some((option) => option.code === value)
	);
	// A stored code outside the usable set is legal, so it still gets a row (probe 009).
	const rows = $derived(
		unknown && value ? [...query.options, { code: value, label: value }] : query.options
	);
	const title = $derived(
		value ? (rows.find((option) => option.code === value)?.label ?? value) : placeholder
	);

	// Read-only wins over disabled and over the loading window.
	const inert = $derived(!readonly && (disabled || query.loading));
	const showClear = $derived(clearable && Boolean(value) && !readonly && !disabled);

	// The first option set is not a change: it is what the widget was mounted to show.
	let seen: string | null = null;
	$effect(() => {
		if (query.loading || query.error !== null) return;
		const codes = query.options.map((option) => option.code).join(',');
		const dropped =
			seen !== null && seen !== codes && Boolean(value) && !query.options.some((o) => o.code === value);
		seen = codes;
		if (dropped) {
			value = undefined;
			onValueChange?.(undefined);
		}
	});

	function pick(code: string): void {
		value = code === '' ? undefined : code;
		onValueChange?.(value);
	}

	function clear(): void {
		value = undefined;
		onValueChange?.(undefined);
	}
</script>

{#snippet badge(code: string)}
	<StatusBadge
		{code}
		status={query.statuses.get(code) ?? null}
		field={badgeField}
		size={BADGE[size]}
		label={showCode ? 'code' : 'name'}
		{siteUrl}
		class="min-w-0"
	/>
{/snippet}

{#snippet selection()}
	<!-- The value keeps clear of the clear control, which floats over the trigger. -->
	<span
		data-slot="status-picker-value"
		class={cn('flex min-w-0 flex-1 items-center', showClear && 'pr-8')}
	>
		{#if value}
			{@render badge(value)}
		{:else}
			<span class="text-muted-foreground truncate">{placeholder}</span>
		{/if}
	</span>
{/snippet}

{#snippet list()}
	{#if query.error !== null}
		<div
			data-slot="status-picker-error"
			class="text-destructive flex items-center justify-center gap-1.5 py-6 text-center text-sm"
		>
			<TriangleAlert aria-hidden="true" class="size-4 shrink-0" />
			<span class="truncate">{query.error}</span>
		</div>
	{:else if query.loading}
		<div data-slot="status-picker-loading" class="flex flex-col gap-2 p-1">
			{#each [0, 1, 2] as row (row)}
				<Skeleton class="h-8 w-full" />
			{/each}
		</div>
	{:else if rows.length === 0}
		<div
			data-slot="status-picker-empty"
			class="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-center text-sm"
		>
			<SearchX aria-hidden="true" class="size-4 shrink-0" />
			<span class="truncate">{emptyLabel}</span>
		</div>
	{:else}
		<Select.Group>
			{#each rows as option (option.code)}
				<Select.Item value={option.code} label={option.label} class="py-1.5 pl-2">
					{@render badge(option.code)}
				</Select.Item>
			{/each}
		</Select.Group>
	{/if}
{/snippet}

<!--
	One status, picked from the codes a project offers.

	The options are `valid_values` minus the project's `hidden_values`, read with
	`project_id`; over several projects they are the intersection of those sets. REST
	does not enforce `hidden_values` on write, so the subtraction is the client's job
	(probe 009). A code the option set does not carry still renders, as itself: a row
	may legally hold one (field_types/status_list). When a later option set drops the
	selected code, the picker clears it and emits once.
-->
<div
	data-slot="status-picker"
	data-size={size}
	data-loading={query.loading ? 'true' : undefined}
	class={cn('relative flex w-full min-w-0 items-center', className)}
>
	{#if readonly}
		<div
			data-slot="status-picker-trigger"
			data-readonly="true"
			aria-readonly="true"
			aria-invalid={invalid ? 'true' : undefined}
			{title}
			class={cn(TRIGGER, BOX[size], 'pr-3')}
		>
			{@render selection()}
		</div>
	{:else}
		<Select.Root
			type="single"
			value={value ?? ''}
			onValueChange={pick}
			disabled={inert}
			items={rows.map((option) => ({ value: option.code, label: option.label }))}
		>
			<Select.Trigger
				aria-invalid={invalid ? 'true' : undefined}
				{title}
				class={cn(TRIGGER, BOX[size])}
			>
				{@render selection()}
			</Select.Trigger>
			<Select.Content align="start" class="p-0">
				{@render list()}
			</Select.Content>
		</Select.Root>

		{#if showClear}
			<button
				type="button"
				data-slot="status-picker-clear"
				aria-label="Clear the status"
				onclick={clear}
				class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background absolute right-8 shrink-0 rounded-sm p-0.5 opacity-70 transition-colors duration-150 outline-none hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
			>
				<X aria-hidden="true" class={GLYPH[size]} />
			</button>
		{/if}
	{/if}
</div>
