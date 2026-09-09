<script lang="ts" module>
	export type ColumnPickerSize = 'sm' | 'md' | 'lg';

	/** Leaf chips follow the thumbnail/avatar ladder of `docs/design-rules.md`. */
	const CHIP: Record<ColumnPickerSize, string> = {
		sm: 'h-6 text-xs',
		md: 'h-8 text-sm',
		lg: 'h-10 text-sm'
	};
</script>

<script lang="ts">
	import type { FieldSchema, SchemaService } from '@sg-widgets/core';
	import { friendlyFieldPath } from '@sg-widgets/core';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import X from '@lucide/svelte/icons/x';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';
	import FieldPicker from './field-picker.svelte';

	type Props = {
		/** Reads the schema. Build it once per app with `createSchemaService`. */
		schema: SchemaService;
		/** The type every path starts on. */
		entityType: string;
		/** The chosen dotted paths, in the order they are shown. */
		value?: string[];
		onValueChange?: (value: string[]) => void;
		/** Allow descending through entity fields. */
		deepLinks?: boolean;
		/** How many hops a path may take. */
		maxDepth?: number;
		/** Data types a field must have to be selected. Traversal ignores this. */
		dataTypes?: string | string[];
		/** A field is selectable only if it links one of these. Traversal ignores this. */
		validTypes?: string[];
		/** Full dotted paths to drop, on top of the ones already chosen. */
		exclude?: string[];
		/** Dotted prefixes to drop, along with everything beneath them. */
		hidePaths?: string[];
		/** Drop the data types the API refuses in a filter. */
		filterableOnly?: boolean;
		/** Synthetic entries offered at the root only. */
		extraFields?: { name: string; displayName?: string }[];
		/** Caller's own visibility test over the schema and the candidate's full path. */
		filter?: (field: FieldSchema, path: string) => boolean;
		/** Small inline chips, no ordering controls. */
		compact?: boolean;
		placeholder?: string;
		emptyLabel?: string;
		readonly?: boolean;
		disabled?: boolean;
		invalid?: boolean;
		size?: ColumnPickerSize;
		class?: string;
	};

	let {
		schema,
		entityType,
		value = $bindable([]),
		onValueChange,
		deepLinks = true,
		maxDepth = 2,
		dataTypes,
		validTypes,
		exclude,
		hidePaths,
		filterableOnly = false,
		extraFields,
		filter,
		compact = false,
		placeholder = 'Add a column',
		emptyLabel = 'No columns yet.',
		readonly = false,
		disabled = false,
		invalid = false,
		size = 'md',
		class: className
	}: Props = $props();

	let labels = $state<Record<string, string>>({});
	let dragging = $state<number | null>(null);
	/** The picker's own value, reset after every pick so it always offers the next column. */
	let picked = $state('');

	const reorderable = $derived(!compact && !readonly && !disabled);
	const blocked = $derived([...(exclude ?? []), ...value]);

	// One friendly label per path, resolved through the schema of every type the path
	// travels. Keyed by root type so a change of root never shows a stale label.
	$effect(() => {
		const service = schema;
		const root = entityType;
		const paths = value;
		const synthetic = extraFields ?? [];
		let live = true;
		Promise.all(
			paths.map(async (path): Promise<[string, string]> => {
				const key = `${root}::${path}`;
				const extra = synthetic.find((entry) => entry.name === path);
				if (extra) return [key, extra.displayName ?? extra.name];
				try {
					return [key, friendlyFieldPath(await service.resolvePath(root, path))];
				} catch {
					// A path the schema no longer holds still has to be readable.
					return [key, path];
				}
			})
		).then((pairs) => {
			if (live) labels = Object.fromEntries(pairs);
		});
		return () => {
			live = false;
		};
	});

	function labelOf(path: string): string | undefined {
		return labels[`${entityType}::${path}`];
	}

	function emit(next: string[]): void {
		value = next;
		onValueChange?.(next);
	}

	function add(path: string): void {
		picked = '';
		if (!path || value.includes(path)) return;
		emit([...value, path]);
	}

	function remove(index: number): void {
		emit(value.filter((_, i) => i !== index));
	}

	function move(from: number, to: number): void {
		if (to < 0 || to >= value.length || from === to) return;
		const next = [...value];
		const [moved] = next.splice(from, 1);
		next.splice(to, 0, moved as string);
		emit(next);
	}

	function onDragOver(event: DragEvent, index: number): void {
		if (dragging === null) return;
		event.preventDefault();
		if (dragging === index) return;
		move(dragging, index);
		dragging = index;
	}

	function onChipKeys(event: KeyboardEvent, index: number): void {
		if (!reorderable || !event.altKey) return;
		if (event.key === 'ArrowUp') {
			event.preventDefault();
			move(index, index - 1);
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			move(index, index + 1);
		}
	}
</script>

<!--
	An ordered list of field paths, built with the field picker.

	Every pick appends and clears the picker's search without closing it, and the
	paths already chosen are fed back as exclusions, so a column cannot be added
	twice. Order is the column order: drag a chip, or move the focused one with
	Alt and an arrow key.
-->
<div
	data-slot="column-picker"
	data-size={size}
	data-compact={compact ? 'true' : 'false'}
	class={cn('flex w-full min-w-0 flex-col gap-3', className)}
>
	{#if !readonly}
		<FieldPicker
			{schema}
			{entityType}
			bind:value={picked}
			onValueChange={add}
			closeOnSelect={false}
			{deepLinks}
			{maxDepth}
			{dataTypes}
			{validTypes}
			exclude={blocked}
			{hidePaths}
			{filterableOnly}
			{extraFields}
			{filter}
			{placeholder}
			clearable={false}
			{disabled}
			{invalid}
			{size}
		/>
	{/if}

	{#if value.length === 0}
		<p data-slot="column-picker-empty" class="text-muted-foreground text-sm">{emptyLabel}</p>
	{:else}
		<ol
			data-slot="column-picker-list"
			class={cn('flex min-w-0 gap-2', compact ? 'flex-wrap' : 'flex-col')}
		>
			{#each value as path, index (path)}
				<li
					data-slot="column-picker-chip"
					data-index={index}
					data-dragging={dragging === index ? 'true' : undefined}
					ondragover={(event) => onDragOver(event, index)}
					ondrop={() => (dragging = null)}
					class={cn(
						'min-w-0 rounded-md transition-[opacity,transform] duration-200',
						dragging === index && 'opacity-50'
					)}
				>
					<Badge
						variant="secondary"
						class={cn(
							'w-full max-w-full min-w-0 justify-start gap-1.5 rounded-md px-2 font-normal',
							CHIP[size]
						)}
					>
						{#if reorderable}
							<button
								type="button"
								data-slot="column-picker-grip"
								draggable="true"
								aria-label={`Reorder ${labelOf(path) ?? path}, column ${index + 1} of ${value.length}`}
								title="Drag, or Alt with an arrow key, to reorder"
								ondragstart={() => (dragging = index)}
								ondragend={() => (dragging = null)}
								onkeydown={(event) => onChipKeys(event, index)}
								class="focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 cursor-grab rounded-sm opacity-50 outline-none transition-opacity duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2"
							>
								<GripVertical aria-hidden="true" class="size-3.5" />
							</button>
						{/if}
						{#if labelOf(path) === undefined}
							<Skeleton class="h-4 w-24" />
						{:else}
							<span class="truncate" title={path}>{labelOf(path)}</span>
						{/if}
						{#if !readonly && !disabled}
							<button
								type="button"
								data-slot="column-picker-remove"
								aria-label={`Remove ${labelOf(path) ?? path}`}
								onclick={() => remove(index)}
								class="hover:bg-destructive/15 hover:text-destructive focus-visible:ring-ring focus-visible:ring-offset-background ml-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
							>
								<X aria-hidden="true" class="size-3.5" />
							</button>
						{/if}
					</Badge>
				</li>
			{/each}
		</ol>
		<p data-slot="column-picker-count" class="text-muted-foreground text-xs">
			{value.length}
			{value.length === 1 ? 'column' : 'columns'}{reorderable
				? ' · drag a chip, or Alt with an arrow key, to reorder'
				: ''}
		</p>
	{/if}
</div>
