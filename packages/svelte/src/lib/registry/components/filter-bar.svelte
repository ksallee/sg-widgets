<script lang="ts">
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import type {
		FacetValue,
		FieldSchema,
		FilterCondition,
		FilterGroup,
		Operator,
		OperatorPreset,
		SchemaService,
		Scalar,
		SgClient,
		WireGroup
	} from '@sg-widgets/core';
	import {
		conditionArity,
		conditionParts,
		createSchemaService,
		describeCondition,
		emptyFilter,
		facetPresets,
		facetValues,
		findCondition,
		presetById,
		presetIdOf,
		setFacet,
		setFacetPreset,
		toApi3Hash,
		asFilterGroup,
		group,
		withoutPaths
	} from '@sg-widgets/core';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import { cn } from '$lib/utils.js';
	import FilterDialog from '$lib/registry/components/filter-dialog.svelte';

	type Props = {
		entityType: string;
		client: SgClient;
		schema?: SchemaService;
		/** Field names to offer as pills, in order. */
		facets: string[];
		value: FilterGroup;
		hidePaths?: string[];
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
		client,
		schema,
		facets,
		value = $bindable(emptyFilter()),
		hidePaths = [],
		disabled = false,
		counts,
		baseFilter = null,
		sampleSize = 200,
		onChange,
		class: className
	}: Props = $props();

	const service = $derived(schema ?? createSchemaService(client));
	let fields = $state<Record<string, FieldSchema>>({});

	$effect(() => {
		let live = true;
		void service.fields(entityType).then((loaded) => {
			if (live) fields = loaded;
		});
		return () => {
			live = false;
		};
	});

	// Counts are read against the filter with every facet's own condition stripped, so
	// ticking one value does not empty its neighbours. One read serves every pill.
	const base = $derived(asFilterGroup(baseFilter));
	const scope = $derived(toApi3Hash(base ? group('and', [base, withoutPaths(value, facets)]) : withoutPaths(value, facets)));
	const tally = $derived(loadFacets(scope, fields, facets));
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
		const rows = await client.search(entityType, {
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

	/**
	 * The operator menu one pill offers. A condition the full editor left on an
	 * operator no pill would have chosen still names itself, so the segment reads
	 * what the tree says rather than the nearest entry to it.
	 */
	function menuOf(name: string): OperatorPreset[] {
		const dataType = fields[name]?.dataType ?? '';
		const presets = facetPresets(dataType);
		const found = conditionOf(name);
		if (!found) return presets;
		const current = presetById(dataType, presetIdOf(found, dataType));
		if (!current || presets.some((p) => p.id === current.id)) return presets;
		return [current, ...presets];
	}

	function pickPreset(name: string, id: string): void {
		const dataType = fields[name]?.dataType ?? '';
		const preset = presetById(dataType, id);
		if (preset) commit(setFacetPreset(value, name, preset, dataType));
	}
</script>

{#snippet facetList(name: string)}
	{@const selected = selectedOf(name)}
	<Popover.Content strategy="fixed" class="w-64 p-0" align="start">
		<Command.Root>
			<Command.Input placeholder="Search values…" />
			<Command.List>
				{#await tally}
					<p class="text-muted-foreground py-6 text-center text-sm">Counting…</p>
				{:then found}
					<Command.Empty>No value.</Command.Empty>
					{#each found[name] ?? [] as option (option.key)}
						<Command.Item
							value="{option.label} {option.key}"
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
					<p class="text-destructive py-6 text-center text-sm">{error.message}</p>
				{/await}
			</Command.List>
		</Command.Root>
		{#if selected.length > 0}
			<div class="border-border border-t p-1">
				<Button
					variant="ghost"
					size="sm"
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
	a segmented pill reading field, operator and values, where the operator segment is
	a menu of the operators that field's facet can take and the values segment is the
	checklist. The pill adds its condition to the bound tree, and More filters opens
	the same tree in the full editor, so the two edit one value.

	Counts come from a `_summarize` grouping call when one is wired to `counts`, and
	otherwise from tallying one page of rows, which makes them as complete as the page
	size allowed.
-->
<div class={cn('flex w-full min-w-0 flex-wrap items-center gap-2', className)} data-slot="filter-bar">
	{#each facets as name (name)}
		{@const field = fields[name]}
		{@const found = conditionOf(name)}
		{#if !found}
			<Popover.Root>
				<Popover.Trigger
					disabled={disabled || !field}
					data-slot="filter-pill"
					data-field={name}
					class="border-border text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 max-w-72 min-w-0 items-center gap-1.5 rounded-lg border border-dashed px-2.5 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
				>
					<PlusIcon class="size-4 shrink-0" />
					<span class="min-w-0 truncate">{field?.displayName ?? name}</span>
				</Popover.Trigger>
				{@render facetList(name)}
			</Popover.Root>
		{:else}
			{@const dataType = field?.dataType ?? ''}
			{@const parts = conditionParts(found, field)}
			{@const arity = conditionArity(found, dataType)}
			{@const selected = selectedOf(name)}
			<div
				data-slot="filter-pill"
				data-field={name}
				data-active="true"
				role="group"
				aria-label={describeCondition(found, field)}
				class="border-border bg-background inline-flex h-8 max-w-full min-w-0 items-center overflow-hidden rounded-lg border text-sm"
			>
				<span
					data-slot="filter-pill-field"
					class="min-w-0 shrink truncate px-2.5 font-medium"
					title={parts.field}
				>
					{parts.field}
				</span>
				<Select.Root
					type="single"
					value={presetIdOf(found, dataType)}
					{disabled}
					onValueChange={(id) => pickPreset(name, id)}
				>
					<Select.Trigger
						data-slot="filter-pill-operator"
						class="border-border text-muted-foreground hover:bg-muted h-8 shrink-0 rounded-none border-0 border-l bg-transparent px-2 dark:bg-transparent"
					>
						{parts.operator}
					</Select.Trigger>
					<Select.Content>
						{#each menuOf(name) as preset (preset.id)}
							<Select.Item value={preset.id} label={preset.label} data-preset={preset.id} />
						{/each}
					</Select.Content>
				</Select.Root>
				{#if arity === 'many'}
					<Popover.Root>
						<Popover.Trigger
							{disabled}
							data-slot="filter-pill-values"
							class="border-border hover:bg-muted focus-visible:ring-ring/50 inline-flex h-8 min-w-0 items-center gap-1.5 border-l px-2.5 outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
						>
							<span class="min-w-0 truncate" title={parts.value}>{parts.value}</span>
							{#if selected.length > 1}
								<Badge variant="secondary" class="shrink-0">{selected.length}</Badge>
							{/if}
						</Popover.Trigger>
						{@render facetList(name)}
					</Popover.Root>
				{:else if parts.value}
					<span data-slot="filter-pill-values" class="border-border min-w-0 truncate border-l px-2.5" title={parts.value}>
						{parts.value}
					</span>
				{/if}
				<button
					type="button"
					{disabled}
					data-slot="filter-pill-remove"
					aria-label="Remove {parts.field} filter"
					class="border-border text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center border-l px-1.5 outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
					onclick={() => commit(withoutPaths(value, [name]))}
				>
					<XIcon class="size-4" />
				</button>
			</div>
		{/if}
	{/each}

	{#if activeCount > 0}
		<Button
			variant="ghost"
			size="sm"
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
		{client}
		{schema}
		{hidePaths}
		{disabled}
		label="More filters"
		bind:value
		onChange={(next) => onChange?.(next)}
	/>
</div>
