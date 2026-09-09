<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import ChevronUpIcon from '@lucide/svelte/icons/chevron-up';
	import XIcon from '@lucide/svelte/icons/x';
	import type { FieldSchema, SchemaService, SgClient, SortKey } from '@sg-widgets/core';
	import { createSchemaService, sortableFields, toSortString } from '@sg-widgets/core';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { cn } from '$lib/utils.js';

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

	const chosen = $derived(new Set(value.map((k) => k.field)));
	const options = $derived(sortableFields(fields, { hidePaths }).filter((f) => !chosen.has(f.name)));
	const label = $derived(
		value.length === 0 ? 'Sort' : value.map((k) => nameOf(k.field)).join(', ')
	);

	function nameOf(field: string): string {
		const parts = field.split('.');
		return fields[parts[parts.length - 1] as string]?.displayName ?? field;
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
			<Command.Root>
				<Command.Input placeholder="Add a field…" />
				<Command.List>
					<Command.Empty>No field.</Command.Empty>
					{#each options as f (f.name)}
						<Command.Item
							value="{f.displayName} {f.name}"
							data-field={f.name}
							onSelect={() => commit([...value, { field: f.name, direction: 'asc' }])}
						>
							<span class="min-w-0 flex-1 truncate">{f.displayName}</span>
							<span class="text-muted-foreground font-mono text-xs">{f.name}</span>
						</Command.Item>
					{/each}
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
</div>
