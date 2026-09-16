<script lang="ts" module>
	import {
		CONTROL_BUTTON,
		CONTROL_GLYPH,
		CONTROL_HEIGHT,
		CONTROL_PAD,
		type ControlSize
	} from '$lib/registry/components/control-classes.js';
	import { CHIP_CROSS, type ChipSize } from '$lib/registry/components/leaf-classes.js';
	import type { StatusBadgeSize } from '$lib/registry/components/status-badge.svelte';

	export type FilterBarSize = ControlSize;

	/** A cross inside the pill sits one step under it on the chip ladder. */
	const CROSS: Record<FilterBarSize, ChipSize> = { sm: 'xs', md: 'sm', lg: 'md' };
	/**
	 * The pill's trailing edge: the room above the cross, so its box sits as far from the
	 * right as from the top (`docs/design-rules.md` rule 3).
	 */
	const CROSS_PAD: Record<FilterBarSize, string> = { sm: 'pr-[5px]', md: 'pr-1.5', lg: 'pr-[7px]' };
	/** A badge sits one step under the pill it is in (`docs/design-rules.md` rule 3). */
	const BADGE: Record<FilterBarSize, StatusBadgeSize> = { sm: 'xs', md: 'sm', lg: 'md' };
	/**
	 * What a pill's value may take before it truncates. A facet with everything ticked
	 * would otherwise run the bar past the width it was given (`docs/design-rules.md` rule 2).
	 */
	const VALUE_WIDTH = 'max-w-64';
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import XIcon from '@lucide/svelte/icons/x';
	import type {
		FacetCondition,
		FacetValue,
		FieldSchema,
		FilterGroup,
		Operator,
		Scalar,
		SgContext,
		WireGroup
	} from '@sg-widgets/core';
	import {
		conditionParts,
		conditionValues,
		describeCondition,
		emptyFilter,
		facetShape,
		facetValues,
		findFacet,
		renderKindFor,
		setFacet,
		toApi3Hash,
		asFilterGroup,
		group,
		matchesTokens,
		withoutPaths
	} from '@sg-widgets/core';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { entityFields } from '$lib/registry/components/entity-fields.svelte.js';
	import FilterDialog from '$lib/registry/components/filter-dialog.svelte';
	import { LEAF_GLYPH, REMOVE_CONTROL } from '$lib/registry/components/leaf-classes.js';
	import MatchText from '$lib/registry/components/match-text.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import StatusGlyph from '$lib/registry/components/status-glyph.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		entityType: string;
		/** The widget context. Every read goes through it, so widgets on a page share one cache. */
		context: SgContext;
		/** Field names to offer as pills, in order. */
		facets: string[];
		/** A name per facet, for a field whose schema label is not what the page calls it. */
		labels?: Record<string, string>;
		/** Values a pill names before the rest reads as `+n`. `0` names every one. */
		maxValues?: number;
		value: FilterGroup;
		hidePaths?: string[];
		size?: FilterBarSize;
		disabled?: boolean;
		/**
		 * Counts per value for one facet. Wire it to a `_summarize` grouping call.
		 * Without it the bar reads one page of rows and tallies them.
		 */
		/** Conditions every facet query carries, such as a project scope. Never edited by the bar. */
		baseFilter?: FilterGroup | WireGroup | null;
		counts?: (field: string, filters: WireGroup | null) => Promise<Record<string, number>>;
		/** Rows read for the tally when `counts` is not given. */
		sampleSize?: number;
		onChange?: (value: FilterGroup) => void;
		class?: string;
	};

	let {
		entityType,
		context,
		facets,
		labels = {},
		value = $bindable(emptyFilter()),
		hidePaths = [],
		size = 'md',
		maxValues = 2,
		disabled = false,
		counts,
		baseFilter = null,
		sampleSize = 200,
		onChange,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const schemaFields = entityFields(
		() => context,
		() => entityType
	);
	const fields = $derived(schemaFields.current);

	// Counts are read against the filter with every facet's own condition stripped, so
	// ticking one value does not empty its neighbours. One read serves every pill.
	const base = $derived(asFilterGroup(baseFilter));
	const scope = $derived(toApi3Hash(base ? group('and', [base, withoutPaths(value, facets)]) : withoutPaths(value, facets)));
	const tally = $derived(loadFacets(scope, fields, facets));
	/** What the open facet's search box holds. */
	let facetQuery = $state('');
	/** The facet whose checklist is open, if any. */
	let openFacet = $state<string | null>(null);
	let searchEl = $state<HTMLInputElement | null>(null);
	const activeCount = $derived(facets.filter((name) => Boolean(facetOf(name))).length);

	async function loadFacets(
		filters: WireGroup | null,
		schemaFields: Record<string, FieldSchema>,
		names: string[]
	): Promise<Record<string, FacetValue[]>> {
		const present = names.map((name) => schemaFields[name]).filter((f): f is FieldSchema => Boolean(f));
		if (present.length === 0) return {};
		if (counts) {
			const out: Record<string, FacetValue[]> = {};
			for (const field of present) {
				const found = await counts(field.name, filters);
				out[field.name] = facetValues([], field).map((v) => ({ ...v, count: found[v.key] ?? 0 }));
			}
			return out;
		}
		const rows = await context.client.search(entityType, {
			filters,
			fields: present.map((f) => f.name),
			page: { size: sampleSize }
		});
		const out: Record<string, FacetValue[]> = {};
		for (const field of present) out[field.name] = facetValues(rows.data, field);
		return out;
	}

	/** The `Status` rows, for a facet over a status field (probe 010). */
	// A facet without the table still reads: a badge falls back to its own code.
	const statuses = $derived(context.statuses.byCode());

	/** The name a pill and its popover carry: the caller's, else the schema's, else the path. */
	function labelOf(name: string): string {
		return labels[name] ?? fields[name]?.displayName ?? name;
	}

	/** True where the facet's values are status codes, which draw as badges rather than text. */
	function isStatus(name: string): boolean {
		return renderKindFor(fields[name]?.dataType ?? '') === 'status';
	}

	/**
	 * The node this facet contributes. A field the API evaluates no `in` on holds an
	 * `or` of one-value conditions, which reads back as one checklist.
	 */
	function facetOf(name: string): FacetCondition | null {
		return findFacet(value, name, fields[name]) ?? null;
	}

	function selectedOf(name: string): Scalar[] {
		return facetOf(name)?.values ?? [];
	}

	function keyOf(v: Scalar): string {
		if (v !== null && typeof v === 'object') return `${v.type}:${v.id}`;
		return String(v);
	}

	function commit(next: FilterGroup): void {
		value = next;
		onChange?.(next);
	}

	/** The list operator the checklist writes: the one the pill already holds, else `in`. */
	function listOperator(name: string): Operator {
		const found = facetOf(name);
		return found?.checklist ? found.operator : facetShape(fields[name]).any;
	}

	function toggle(name: string, option: FacetValue): void {
		const selected = selectedOf(name);
		const next = selected.some((v) => keyOf(v) === option.key)
			? selected.filter((v) => keyOf(v) !== option.key)
			: [...selected, option.value];
		commit(setFacet(value, name, next, listOperator(name), fields[name]));
	}
</script>

{#snippet remove(name: string, label: string)}
	<button
		type="button"
		{disabled}
		data-slot="filter-pill-remove"
		aria-label="Remove {label} filter"
		class={cn(REMOVE_CONTROL, 'disabled:pointer-events-none disabled:opacity-50')}
		onclick={() => commit(withoutPaths(value, [name]))}
	>
		<XIcon aria-hidden="true" class={CHIP_CROSS[CROSS[size]]} />
	</button>
{/snippet}

<!-- One value in a pill, where a status is a value: a status is a badge, and every other value is text. -->
{#snippet valueBadge(name: string, key: string)}
	{#await statuses then table}
		<StatusBadge
			code={key}
			status={table.get(key) ?? null}
			field={fields[name] ?? null}
			size={BADGE[size]}
			siteUrl={context.siteUrl}
		/>
	{:catch}
		<StatusBadge code={key} field={fields[name] ?? null} size={BADGE[size]} siteUrl={context.siteUrl} />
	{/await}
{/snippet}

<!--
	One checklist row: the status glyph as a leading mark before the label, the way a
	picker row whose label is a name reads, with the matched runs of the box bold.
-->
{#snippet rowValue(name: string, key: string, label: string)}
	{#if isStatus(name)}
		{#await statuses then table}
			<StatusGlyph
				status={table.get(key) ?? null}
				siteUrl={context.siteUrl}
				fallback
				class={LEAF_GLYPH[size]}
			/>
		{:catch}
			<StatusGlyph siteUrl={context.siteUrl} fallback class={LEAF_GLYPH[size]} />
		{/await}
	{/if}
	<MatchText text={label} query={facetQuery} class="truncate" />
{/snippet}

<!--
	A pill's value: the values it has room to name, then `+n`. It is capped and truncated
	with the whole list in its `title`, so a facet with everything ticked never stretches
	the bar.
-->
{#snippet pillValues(name: string, shown: ReturnType<typeof conditionValues>)}
	{#if shown.shown.length > 0}
		<span
			data-slot="filter-pill-values"
			class={cn('flex min-w-0 items-center gap-1.5 truncate', VALUE_WIDTH)}
			title={shown.title}
		>
			{#if isStatus(name) && shown.values.length > 0}
				{#each shown.values as scalar (keyOf(scalar as Scalar))}
					<span class="flex min-w-0 items-center truncate">
						{@render valueBadge(name, keyOf(scalar as Scalar))}
					</span>
				{/each}
			{:else}
				<span class="min-w-0 truncate">{shown.text}</span>
			{/if}
			{#if shown.overflow > 0}
				<span data-slot="filter-pill-overflow" class="text-muted-foreground shrink-0 tabular-nums">
					+{shown.overflow}
				</span>
			{/if}
		</span>
	{/if}
{/snippet}

{#snippet facetList(name: string)}
	{@const selected = selectedOf(name)}
	<Popover.Content
		strategy="fixed"
		class="w-64 p-0"
		align="start"
		onOpenAutoFocus={(event) => {
			event.preventDefault();
			searchEl?.focus({ preventScroll: true });
		}}
	>
		<Command.Root shouldFilter={false}>
			<Command.Input bind:ref={searchEl} bind:value={facetQuery} placeholder="Search values…" />
			<Command.List>
				{#await tally}
					<p class="text-muted-foreground py-6 text-center text-sm">Counting…</p>
				{:then found}
					<Command.Empty>
						<StateLine state="empty" icon={SearchXIcon} label="No value." pad="none" />
					</Command.Empty>
					<!-- The box matches what it was given rather than what a read answered, so the rows drawn are the rows the list holds. -->
					{#each (found[name] ?? []).filter((option) => matchesTokens(facetQuery, option.label, option.key)) as option (option.key)}
						<Command.Item
							value={option.key}
							data-option={option.key}
							onSelect={() => toggle(name, option)}
						>
							<Checkbox
								checked={selected.some((v) => keyOf(v) === option.key)}
								tabindex={-1}
								aria-hidden="true"
							/>
							<span class="flex min-w-0 flex-1 items-center gap-1.5 truncate" title={option.label}>
								{@render rowValue(name, option.key, option.label)}
							</span>
							<span class="text-muted-foreground text-xs tabular-nums" data-slot="facet-count">
								{option.count}
							</span>
						</Command.Item>
					{/each}
				{:catch error}
					<StateLine
						state="error"
						slotName="filter-bar-error"
						icon={TriangleAlertIcon}
						label={error.message}
					/>
				{/await}
			</Command.List>
		</Command.Root>
		{#if selected.length > 0}
			<div class="border-border border-t p-1">
				<Button
					variant="ghost"
					size={CONTROL_BUTTON[size]}
					class="w-full"
					data-slot="filter-pill-clear"
					onclick={() => commit(setFacet(value, name, [], 'in', fields[name]))}
				>
					Clear
				</Button>
			</div>
		{/if}
	</Popover.Content>
{/snippet}

<!--
	Quick facets over one entity type.

	An untouched facet is a quiet pill naming its field; ticking a value turns it into
	a pill reading the field and the values ticked, and opening it again reopens the
	checklist. The pill adds its condition to the bound tree, and More filters opens
	the same tree in the full editor, so the two edit one value: a condition the editor
	wrote on an operator the checklist cannot hold reads as text in its pill.

	Counts come from a `_summarize` grouping call when one is wired to `counts`, and
	otherwise from tallying one page of rows, which makes them as complete as the page
	size allowed.
-->
<div
	bind:this={ref}
	data-slot="filter-bar"
	class={cn('flex w-full min-w-0 flex-wrap items-center gap-2', className)}
	{...rest}
>
	{#each facets as name (name)}
		{@const field = fields[name]}
		{@const found = facetOf(name)}
		{@const parts = found ? conditionParts(found.summary, field) : null}
		{@const shown = found ? conditionValues(found.summary, field, maxValues) : null}
		{#if !found || found.checklist}
			<!-- One popover and one trigger across both looks, so the first tick does not close the list. -->
			<Popover.Root
				bind:open={() => openFacet === name, (next) => (openFacet = next ? name : null)}
			>
				<div
					data-slot="filter-pill"
					data-field={name}
					data-size={size}
					data-active={found ? 'true' : undefined}
					role={found ? 'group' : undefined}
					aria-label={found ? describeCondition(found.summary, field) : undefined}
					class={cn(
						'border-border inline-flex max-w-full min-w-0 items-center overflow-hidden rounded-lg border text-sm',
						CONTROL_HEIGHT[size],
						found && parts && CROSS_PAD[size],
						found ? 'bg-background' : 'text-muted-foreground max-w-72 border-dashed'
					)}
				>
					<Popover.Trigger
						disabled={disabled || !field}
						data-slot="filter-pill-trigger"
						class={cn(
							'hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex min-w-0 items-center gap-1.5 outline-none focus-visible:ring-3 focus-visible:ring-inset disabled:pointer-events-none disabled:opacity-50',
							CONTROL_HEIGHT[size],
							CONTROL_PAD[size]
						)}
					>
						{#if !found || !parts}
							<PlusIcon class={cn('shrink-0', CONTROL_GLYPH[size])} />
							<span class="min-w-0 truncate">{labelOf(name)}</span>
						{:else}
							<span data-slot="filter-pill-field" class="shrink-0 font-medium">{labelOf(name)}</span>
							{#if found.summary.operator !== 'in'}
								<span class="text-muted-foreground shrink-0">{parts.operator}</span>
							{/if}
							{#if shown}{@render pillValues(name, shown)}{/if}
						{/if}
					</Popover.Trigger>
					{#if found && parts}
						{@render remove(name, labelOf(name))}
					{/if}
				</div>
				{@render facetList(name)}
			</Popover.Root>
		{:else if parts}
			<!-- A condition the editor wrote on an operator no checklist can hold reads as text. -->
			<div
				data-slot="filter-pill"
				data-field={name}
				data-size={size}
				data-active="true"
				role="group"
				aria-label={describeCondition(found.summary, field)}
				class={cn(
					'border-border bg-background inline-flex max-w-full min-w-0 items-center overflow-hidden rounded-lg border text-sm',
					CONTROL_HEIGHT[size],
					CROSS_PAD[size]
				)}
			>
				<span
					class={cn('inline-flex min-w-0 items-center gap-1.5', CONTROL_HEIGHT[size], CONTROL_PAD[size])}
				>
					<span data-slot="filter-pill-field" class="shrink-0 font-medium">{labelOf(name)}</span>
					<span class="text-muted-foreground shrink-0">{parts.operator}</span>
					{#if shown}{@render pillValues(name, shown)}{/if}
				</span>
				{@render remove(name, labelOf(name))}
			</div>
		{/if}
	{/each}

	{#if activeCount > 0}
		<Button
			variant="ghost"
			size={CONTROL_BUTTON[size]}
			{disabled}
			class="text-muted-foreground"
			data-slot="filter-clear-all"
			onclick={() => commit(withoutPaths(value, facets))}
		>
			Clear all
		</Button>
	{/if}

	<FilterDialog
		{entityType}
		{context}
		{hidePaths}
		{disabled}
		{size}
		label="More filters"
		bind:value
		onChange={(next) => onChange?.(next)}
	/>
</div>
