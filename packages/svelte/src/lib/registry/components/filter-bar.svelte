<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import type {
		FacetValue,
		FieldSchema,
		FilterGroup,
		SchemaService,
		Scalar,
		SgClient,
		WireGroup
	} from '@sg-widgets/core';
	import {
		createSchemaService,
		describeCondition,
		emptyFilter,
		facetValues,
		findCondition,
		setFacet,
		toApi3Hash,
		withoutPaths
	} from '@sg-widgets/core';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
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
	const scope = $derived(toApi3Hash(withoutPaths(value, facets)));
	const tally = $derived(loadFacets(scope, fields, facets));

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

	function selectedOf(name: string): Scalar[] {
		const found = findCondition(value, name);
		return found && Array.isArray(found.condition.value) ? (found.condition.value as Scalar[]) : [];
	}

	function keyOf(v: Scalar): string {
		if (v !== null && typeof v === 'object') return `${v.type}:${v.id}`;
		return String(v);
	}

	function commit(next: FilterGroup): void {
		value = next;
		onChange?.(next);
	}

	function toggle(name: string, option: FacetValue): void {
		const selected = selectedOf(name);
		const next = selected.some((v) => keyOf(v) === option.key)
			? selected.filter((v) => keyOf(v) !== option.key)
			: [...selected, option.value];
		commit(setFacet(value, name, next));
	}

	function summaryOf(name: string): string {
		const field = fields[name];
		const found = findCondition(value, name);
		if (!found || selectedOf(name).length === 0) return field?.displayName ?? name;
		return describeCondition(found.condition, field);
	}
</script>

<!--
	Quick facets over one entity type.

	Each pill lists the field's values with a count and adds an `in` condition to the
	bound tree as they are ticked; the pill then shows what that condition says. More
	filters opens the same tree in the full editor, so the two edit one value.

	Counts come from a `_summarize` grouping call when one is wired to `counts`, and
	otherwise from tallying one page of rows, which makes them as complete as the page
	size allowed.
-->
<div class={cn('flex w-full min-w-0 flex-wrap items-center gap-2', className)} data-slot="filter-bar">
	{#each facets as name (name)}
		{@const field = fields[name]}
		{@const selected = selectedOf(name)}
		<Popover.Root>
			<Popover.Trigger
				disabled={disabled || !field}
				data-slot="filter-pill"
				data-field={name}
				class={cn(
					'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 max-w-72 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
					selected.length > 0 && 'border-transparent bg-accent text-accent-foreground'
				)}
			>
				<span class="min-w-0 truncate" title={summaryOf(name)}>{summaryOf(name)}</span>
				{#if selected.length > 0}
					<Badge variant="secondary" class="shrink-0">{selected.length}</Badge>
				{:else}
					<ChevronDownIcon class="text-muted-foreground size-4 shrink-0" />
				{/if}
			</Popover.Trigger>
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
		</Popover.Root>
	{/each}

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
