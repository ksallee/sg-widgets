<script lang="ts" module>
	import {
		CONTROL_BUTTON,
		CONTROL_GLYPH,
		CONTROL_HEIGHT,
		CONTROL_PAD,
		type ControlSize
	} from '$lib/registry/components/control-classes.js';
	import { CHIP_CROSS, type ChipSize } from '$lib/registry/components/leaf-classes.js';

	export type FilterBarSize = ControlSize;

	/** A cross inside the pill sits one step under it on the chip ladder. */
	const CROSS: Record<FilterBarSize, ChipSize> = { sm: 'xs', md: 'sm', lg: 'md' };
	/**
	 * The pill's trailing edge: the room above the cross, so its box sits as far from the
	 * right as from the top (`docs/design-rules.md` rule 3).
	 */
	const CROSS_PAD: Record<FilterBarSize, string> = { sm: 'pr-[7px]', md: 'pr-2', lg: 'pr-[9px]' };
	/** The button step beside a pill of each height. */
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import SearchXIcon from '@lucide/svelte/icons/search-x';
	import TriangleAlertIcon from '@lucide/svelte/icons/triangle-alert';
	import XIcon from '@lucide/svelte/icons/x';
	import type {
		FacetValue,
		FieldSchema,
		FilterCondition,
		FilterGroup,
		Operator,
		Scalar,
		SgContext,
		WireGroup
	} from '@sg-widgets/core';
	import {
		conditionArity,
		conditionParts,
		describeCondition,
		emptyFilter,
		facetValues,
		findCondition,
		setFacet,
		toApi3Hash,
		asFilterGroup,
		group,
		matchesTokens,
		withoutPaths
	} from '@sg-widgets/core';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { entityFields } from '$lib/registry/components/entity-fields.svelte.js';
	import FilterDialog from '$lib/registry/components/filter-dialog.svelte';
	import { REMOVE_CONTROL } from '$lib/registry/components/leaf-classes.js';
	import StateLine from '$lib/registry/components/state-line.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		entityType: string;
		/** The widget context. Every read goes through it, so widgets on a page share one cache. */
		context: SgContext;
		/** Field names to offer as pills, in order. */
		facets: string[];
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
		value = $bindable(emptyFilter()),
		hidePaths = [],
		size = 'md',
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
	const activeCount = $derived(facets.filter((name) => Boolean(findCondition(value, name))).length);

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

	function conditionOf(name: string): FilterCondition | null {
		return findCondition(value, name)?.condition ?? null;
	}

	function selectedOf(name: string): Scalar[] {
		const found = conditionOf(name);
		return found && Array.isArray(found.value) ? (found.value as Scalar[]) : [];
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
		const found = conditionOf(name);
		return found && Array.isArray(found.value) ? found.operator : 'in';
	}

	function toggle(name: string, option: FacetValue): void {
		const selected = selectedOf(name);
		const next = selected.some((v) => keyOf(v) === option.key)
			? selected.filter((v) => keyOf(v) !== option.key)
			: [...selected, option.value];
		commit(setFacet(value, name, next, listOperator(name)));
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

{#snippet facetList(name: string)}
	{@const selected = selectedOf(name)}
	<Popover.Content strategy="fixed" class="w-64 p-0" align="start">
		<Command.Root shouldFilter={false}>
			<Command.Input bind:value={facetQuery} placeholder="Search values…" />
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
							<span class="min-w-0 flex-1 truncate">{option.label}</span>
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
					onclick={() => commit(setFacet(value, name, []))}
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
		{@const found = conditionOf(name)}
		{@const parts = found ? conditionParts(found, field) : null}
		{@const selected = selectedOf(name)}
		{#if !found || conditionArity(found, field?.dataType ?? '') === 'many'}
			<!-- One popover and one trigger across both looks, so the first tick does not close the list. -->
			<Popover.Root>
				<div
					data-slot="filter-pill"
					data-field={name}
					data-size={size}
					data-active={found ? 'true' : undefined}
					role={found ? 'group' : undefined}
					aria-label={found ? describeCondition(found, field) : undefined}
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
							<span class="min-w-0 truncate">{field?.displayName ?? name}</span>
						{:else}
							<span data-slot="filter-pill-field" class="shrink-0 font-medium">{parts.field}</span>
							{#if found.operator !== 'in'}
								<span class="text-muted-foreground shrink-0">{parts.operator}</span>
							{/if}
							<span data-slot="filter-pill-values" class="min-w-0 truncate" title={parts.value}>{parts.value}</span>
							{#if selected.length > 1}
								<Badge variant="secondary" class="shrink-0">{selected.length}</Badge>
							{/if}
						{/if}
					</Popover.Trigger>
					{#if found && parts}
						{@render remove(name, parts.field)}
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
				aria-label={describeCondition(found, field)}
				class={cn(
					'border-border bg-background inline-flex max-w-full min-w-0 items-center overflow-hidden rounded-lg border text-sm',
					CONTROL_HEIGHT[size],
					CROSS_PAD[size]
				)}
			>
				<span
					data-slot="filter-pill-values"
					class={cn('inline-flex min-w-0 items-center gap-1.5', CONTROL_HEIGHT[size], CONTROL_PAD[size])}
					title={parts.value}
				>
					<span data-slot="filter-pill-field" class="shrink-0 font-medium">{parts.field}</span>
					<span class="text-muted-foreground shrink-0">{parts.operator}</span>
					{#if parts.value}<span class="min-w-0 truncate">{parts.value}</span>{/if}
				</span>
				{@render remove(name, parts.field)}
			</div>
		{/if}
	{/each}

	{#if activeCount > 0}
		<Button
			variant="ghost"
			size={CONTROL_BUTTON[size]}
			{disabled}
			class="text-muted-foreground hover:text-foreground"
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
