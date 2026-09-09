<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import XIcon from '@lucide/svelte/icons/x';
	import type { SchemaService, SgClient, SortKey } from '@sg-widgets/core';
	import { createSchemaService, friendlyFieldPath, isSortable, toSortString } from '@sg-widgets/core';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { cn } from '$lib/utils.js';
	import FieldPicker from '$lib/registry/components/field-picker.svelte';

	type Props = {
		entityType: string;
		client: SgClient;
		schema?: SchemaService;
		value: SortKey[];
		/** Paths to keep out of the field list, each hiding itself and everything under it. */
		hidePaths?: string[];
		disabled?: boolean;
		/** Both the keys and the `sort` string they serialise to. */
		onChange?: (value: SortKey[], sort: string) => void;
		class?: string;
	};

	let {
		entityType,
		client,
		schema,
		value = $bindable([]),
		hidePaths = [],
		disabled = false,
		onChange,
		class: className
	}: Props = $props();

	const service = $derived(schema ?? createSchemaService(client));

	/** The friendly label of every path in the list, resolved once and kept. */
	let labels = $state<Record<string, string>>({});
	const resolving = new Map<string, Promise<string>>();
	/** The picker's own value, cleared as soon as a key is added. */
	let adding = $state('');

	function resolveLabel(path: string): void {
		const at = `${entityType}|${path}`;
		if (resolving.has(at)) return;
		const job = service.resolvePath(entityType, path).then(friendlyFieldPath, () => path);
		resolving.set(at, job);
		void job.then((label) => {
			labels = { ...labels, [at]: label };
		});
	}

	$effect(() => {
		for (const key of value) resolveLabel(key.field);
	});

	const chosen = $derived(value.map((k) => k.field));
	const label = $derived(
		value.length === 0 ? 'Sort' : value.map((k) => nameOf(k.field)).join(', ')
	);

	function nameOf(field: string): string {
		return labels[`${entityType}|${field}`] ?? field;
	}

	function add(path: string): void {
		if (!path) return;
		commit([...value, { field: path, direction: 'asc' }]);
		adding = '';
	}

	function commit(next: SortKey[]): void {
		value = next;
		onChange?.(next, toSortString(next));
	}

	function move(index: number, delta: number): void {
		const to = index + delta;
		if (to < 0 || to >= value.length) return;
		const next = [...value];
		const [key] = next.splice(index, 1);
		next.splice(to, 0, key as SortKey);
		commit(next);
	}
</script>

<!--
	The `sort` a query carries, as an ordered list.

	Each key is a field and a direction; the list serialises to the comma-joined
	string `_search` takes, a leading `-` marking a descending key
	(026_result_order). Order is meaningful: the first key wins, and id ascending
	breaks every remaining tie whether or not it is in the list.

	A key may be a dotted path: `entity.Shot.code` sorts, and so does
	`project.Project.name` under `-` (026_result_order), so the field picker descends
	through links. An unsortable or unknown field is a silent 200 no-op with the rows
	in default order, so only types that sort are offered.
-->
<div class={cn('inline-flex min-w-0 items-center', className)} data-slot="sort-picker">
	<Popover.Root>
		<Popover.Trigger
			{disabled}
			data-slot="sort-trigger"
			class="border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 min-w-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
		>
			<ArrowUpDownIcon class="size-4 shrink-0" />
			<span class="min-w-0 truncate" title={label}>{label}</span>
			{#if value.length > 1}
				<Badge variant="secondary" class="shrink-0" data-slot="sort-count">{value.length}</Badge>
			{/if}
		</Popover.Trigger>
		<Popover.Content class="flex w-96 flex-col gap-3 p-3" align="start">
			<div class="flex min-w-0 flex-col gap-2" data-slot="sort-keys">
				{#each value as key, i (key.field)}
					<div class="flex min-w-0 items-center gap-2" data-slot="sort-key" data-field={key.field}>
						<span class="min-w-0 flex-1 truncate text-sm" title={key.field}>{nameOf(key.field)}</span>
						<ToggleGroup.Root
							type="single"
							size="sm"
							variant="outline"
							value={key.direction}
							data-slot="sort-direction"
							onValueChange={(next) =>
								next &&
								commit(
									value.map((k, j) => (j === i ? { ...k, direction: next as SortKey['direction'] } : k))
								)}
						>
							<ToggleGroup.Item value="asc" aria-label="Ascending">
								<ArrowUpIcon />
							</ToggleGroup.Item>
							<ToggleGroup.Item value="desc" aria-label="Descending">
								<ArrowDownIcon />
							</ToggleGroup.Item>
						</ToggleGroup.Root>
						<Button
							variant="ghost"
							size="icon-sm"
							disabled={i === 0}
							aria-label="Move up"
							data-slot="sort-up"
							onclick={() => move(i, -1)}
						>
							<ChevronUpIcon />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							disabled={i === value.length - 1}
							aria-label="Move down"
							data-slot="sort-down"
							onclick={() => move(i, 1)}
						>
							<ChevronDownIcon />
						</Button>
						<Button
							variant="ghost"
							size="icon-sm"
							aria-label="Remove"
							data-slot="sort-remove"
							onclick={() => commit(value.filter((_, j) => j !== i))}
						>
							<XIcon />
						</Button>
					</div>
				{/each}
				{#if value.length === 0}
					<p class="text-muted-foreground py-6 text-center text-sm">
						No sort. Rows come back id ascending.
					</p>
				{/if}
			</div>
			<Separator />
			<FieldPicker
				schema={service}
				{entityType}
				{hidePaths}
				{disabled}
				bind:value={adding}
				deepLinks
				clearable={false}
				exclude={chosen}
				filter={(field) => isSortable(field.dataType)}
				placeholder="Add a field"
				searchPlaceholder="Add a field…"
				emptyLabel="No field left to sort on."
				onValueChange={add}
			/>
		</Popover.Content>
	</Popover.Root>
</div>
