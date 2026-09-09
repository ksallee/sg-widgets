<script lang="ts" module>
	export type SortPickerSize = 'sm' | 'md' | 'lg';

	/** Controls follow the input ladder of `docs/design-rules.md`. */
	const BOX: Record<SortPickerSize, string> = { sm: 'h-8 px-2', md: 'h-9 px-3', lg: 'h-10 px-3' };
	const GLYPH: Record<SortPickerSize, string> = { sm: 'size-4', md: 'size-4', lg: 'size-5' };
</script>

<script lang="ts">
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import ArrowUpDownIcon from '@lucide/svelte/icons/arrow-up-down';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
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
	import { createSortable } from '$lib/registry/components/sortable.svelte.js';

	type Props = {
		entityType: string;
		client: SgClient;
		schema?: SchemaService;
		value: SortKey[];
		/** Paths to keep out of the field list, each hiding itself and everything under it. */
		hidePaths?: string[];
		size?: SortPickerSize;
		disabled?: boolean;
		/** Both the keys and the `sort` string they serialise to. */
		onChange?: (value: SortKey[], sort: string) => void;
		/** Whether the popover is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	};

	let {
		entityType,
		client,
		schema,
		value = $bindable([]),
		hidePaths = [],
		size = 'md',
		disabled = false,
		onChange,
		open = $bindable(false),
		onOpenChange,
		class: className
	}: Props = $props();

	function setOpen(next: boolean): void {
		const wanted = disabled ? false : next;
		if (wanted === open) return;
		open = wanted;
		onOpenChange?.(open);
	}

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

	const sortable = createSortable({
		ids: () => chosen,
		onOrderChange: (order) =>
			commit(order.map((field) => value.find((k) => k.field === field) as SortKey)),
		label: (field) => nameOf(field),
		disabled: () => disabled
	});

	function onKeyKeys(event: KeyboardEvent, index: number): void {
		// The sortable owns the arrow keys while it carries a row.
		if (disabled || sortable.dragging !== null || !event.altKey) return;
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(index, -1);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(index, 1);
		}
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
	<Popover.Root bind:open={() => open, setOpen}>
		<Popover.Trigger
			{disabled}
			data-slot="sort-trigger"
			data-size={size}
			class={cn(
				'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex min-w-0 items-center gap-1.5 rounded-lg border text-sm font-medium outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
				BOX[size]
			)}
		>
			<ArrowUpDownIcon class={cn('shrink-0', GLYPH[size])} />
			<span class="min-w-0 truncate" title={label}>{label}</span>
			{#if value.length > 1}
				<Badge variant="secondary" class="shrink-0" data-slot="sort-count">{value.length}</Badge>
			{/if}
		</Popover.Trigger>
		<Popover.Content strategy="fixed" class="flex w-96 flex-col gap-3 p-3" align="start">
			<div class="flex min-w-0 flex-col gap-2" data-slot="sort-keys" {@attach sortable.attach}>
				{#each value as key, i (key.field)}
					<div
						class={cn(
							'bg-popover flex min-w-0 items-center gap-2 rounded-md',
							'data-[dragging]:z-10 data-[dragging]:opacity-90 data-[dragging]:shadow-md',
							'data-[drop-target]:bg-accent/40'
						)}
						data-slot="sort-key"
						data-sortable-id={key.field}
						data-field={key.field}
					>
						<Button
							variant="ghost"
							size="icon-sm"
							data-slot="sort-grip"
							data-sortable-handle="true"
							onkeydown={(event) => onKeyKeys(event, i)}
							aria-label={`Reorder ${nameOf(key.field)}`}
							title="Drag to reorder, or press Space and use the arrow keys"
							class="cursor-grab touch-none active:cursor-grabbing"
						>
							<GripVerticalIcon />
						</Button>
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
			<div
				data-slot="sort-live-region"
				role="status"
				aria-live="polite"
				aria-atomic="true"
				class="sr-only"
			>
				{sortable.announcement}
			</div>
			<Separator />
			<FieldPicker
				schema={service}
				{entityType}
				{hidePaths}
				{disabled}
				{size}
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
