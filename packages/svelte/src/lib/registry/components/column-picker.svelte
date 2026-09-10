<script lang="ts" module>
	export type ColumnPickerSize = 'sm' | 'md' | 'lg';
	export type ColumnPickerLayout = 'list' | 'dual';

	/** Rows follow the control ladder of `docs/design-rules.md`. */
	const ROW: Record<ColumnPickerSize, string> = {
		sm: 'min-h-8',
		md: 'min-h-9',
		lg: 'min-h-10'
	};
	const ACTION: Record<ColumnPickerSize, 'icon-xs' | 'icon-sm' | 'icon'> = {
		sm: 'icon-xs',
		md: 'icon-sm',
		lg: 'icon'
	};
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldHop, FieldOption, FieldSchema, SgContext } from '@sg-widgets/core';
	import {
		currentType,
		deriveFieldOptions,
		friendlyFieldPath,
		iconNameFor,
		moveFieldPath,
		searchFieldOptions,
		toggleFieldPath
	} from '@sg-widgets/core';
	import Braces from '@lucide/svelte/icons/braces';
	import Calendar from '@lucide/svelte/icons/calendar';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import CircleDollarSign from '@lucide/svelte/icons/circle-dollar-sign';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import Columns3 from '@lucide/svelte/icons/columns-3';
	import FileText from '@lucide/svelte/icons/file-text';
	import Fingerprint from '@lucide/svelte/icons/fingerprint';
	import Globe from '@lucide/svelte/icons/globe';
	import GripVertical from '@lucide/svelte/icons/grip-vertical';
	import Hash from '@lucide/svelte/icons/hash';
	import Image from '@lucide/svelte/icons/image';
	import KeyRound from '@lucide/svelte/icons/key-round';
	import Link from '@lucide/svelte/icons/link';
	import Link2 from '@lucide/svelte/icons/link-2';
	import List from '@lucide/svelte/icons/list';
	import Palette from '@lucide/svelte/icons/palette';
	import Percent from '@lucide/svelte/icons/percent';
	import RotateCcw from '@lucide/svelte/icons/rotate-ccw';
	import Ruler from '@lucide/svelte/icons/ruler';
	import SearchX from '@lucide/svelte/icons/search-x';
	import Shapes from '@lucide/svelte/icons/shapes';
	import Sigma from '@lucide/svelte/icons/sigma';
	import SquareCheck from '@lucide/svelte/icons/square-check';
	import Tag from '@lucide/svelte/icons/tag';
	import Timer from '@lucide/svelte/icons/timer';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import Type from '@lucide/svelte/icons/type';
	import X from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import FieldPicker from '$lib/registry/components/field-picker.svelte';
	import { createSortable } from '$lib/registry/components/sortable.svelte.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The widget context. The schema is read through it, once per page. */
		context: SgContext;
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
		/** Full dotted paths to drop. */
		exclude?: string[];
		/** Dotted prefixes to drop, along with everything beneath them. */
		hidePaths?: string[];
		/** Drop the data types the API refuses in a filter. */
		filterableOnly?: boolean;
		/** Synthetic entries offered at the root only. */
		extraFields?: { name: string; displayName?: string }[];
		/** Caller's own visibility test over the schema and the candidate's full path. */
		filter?: (field: FieldSchema, path: string) => boolean;
		/** `list` is the field picker over the ordered list; `dual` is the two lists side by side. */
		layout?: ColumnPickerLayout;
		/** Show how many columns are chosen under the list. */
		showCount?: boolean;
		/** Placeholder of the field picker. */
		placeholder?: string;
		searchPlaceholder?: string;
		emptyLabel?: string;
		availableLabel?: string;
		chosenLabel?: string;
		readonly?: boolean;
		disabled?: boolean;
		invalid?: boolean;
		size?: ColumnPickerSize;
		class?: string;
	};

	let {
		context,
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
		layout = 'list',
		showCount = false,
		placeholder = 'Add a column',
		searchPlaceholder = 'Search fields…',
		emptyLabel = 'No columns yet.',
		availableLabel = 'Available',
		chosenLabel = 'Columns',
		readonly = false,
		disabled = false,
		invalid = false,
		size = 'md',
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// The context's own service, so every widget on the page shares one schema read.
	const schema = $derived(context.schema);

	const ICONS: Record<string, typeof Type> = {
		braces: Braces,
		calendar: Calendar,
		'calendar-clock': CalendarClock,
		'circle-dollar-sign': CircleDollarSign,
		'circle-dot': CircleDot,
		'file-text': FileText,
		fingerprint: Fingerprint,
		globe: Globe,
		hash: Hash,
		image: Image,
		'key-round': KeyRound,
		link: Link,
		'link-2': Link2,
		list: List,
		palette: Palette,
		percent: Percent,
		ruler: Ruler,
		shapes: Shapes,
		sigma: Sigma,
		'square-check': SquareCheck,
		tag: Tag,
		timer: Timer,
		type: Type
	};

	/** The field picker's own value, cleared as soon as the path is appended. */
	let adding = $state('');
	let search = $state('');
	let highlighted = $state('');
	let hops = $state<FieldHop[]>([]);
	/** The field whose target type is being chosen, when it declares more than one. */
	let choosing = $state<FieldOption | null>(null);
	let loaded = $state<{ type: string; fields: Record<string, FieldSchema> } | null>(null);
	let labels = $state<Record<string, string>>({});
	let failure = $state<string | null>(null);

	const type = $derived(currentType(entityType, hops));
	const editable = $derived(!readonly && !disabled);

	// `/schema/<Type>/fields` is 48KB and ~330ms (probe 002); the schema service caches
	// it, so a hop back to a type already visited costs nothing.
	$effect(() => {
		const service = schema;
		const wanted = type;
		let live = true;
		service
			.fields(wanted)
			.then((fields) => {
				if (live) loaded = { type: wanted, fields };
			})
			.catch((error: unknown) => {
				if (live) failure = error instanceof Error ? error.message : String(error);
			});
		return () => {
			live = false;
		};
	});

	// One friendly label per chosen path, resolved through the schema of every type the
	// path travels. Keyed by root type so a change of root never shows a stale label.
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

	const fields = $derived(loaded?.type === type ? loaded.fields : null);
	const options = $derived(
		fields
			? deriveFieldOptions(fields, {
					rootType: entityType,
					hops,
					deepLinks,
					maxDepth,
					dataTypes,
					validTypes,
					exclude,
					hidePaths,
					filterableOnly,
					extraFields,
					filter
				})
			: []
	);
	const rows = $derived(choosing ? [] : searchFieldOptions(options, search));
	const targets = $derived(choosing ? choosing.targets.filter((t) => matchesType(t)) : []);
	/** Every row's value, in the order they are drawn: what the arrow keys walk. */
	const values = $derived(choosing ? targets : rows.map((row) => row.path));
	const cursor = $derived(values.includes(highlighted) ? highlighted : (values[0] ?? ''));
	const breadcrumb = $derived(hops.length > 0 || choosing !== null);
	const count = $derived(`${value.length} column${value.length === 1 ? '' : 's'}`);
	/** A chosen path is off the field picker's list, so the same column is never added twice. */
	const offered = $derived([...(exclude ?? []), ...value]);

	function labelOf(path: string): string | undefined {
		return labels[`${entityType}::${path}`];
	}

	function matchesType(target: string): boolean {
		return target.toLowerCase().includes(search.trim().toLowerCase());
	}

	function emit(next: string[]): void {
		value = next;
		onValueChange?.(next);
	}

	function toggle(row: FieldOption): void {
		if (!editable) return;
		emit(toggleFieldPath(value, row.path));
	}

	function remove(index: number): void {
		if (!editable) return;
		emit(value.filter((_, i) => i !== index));
	}

	function append(path: string): void {
		adding = '';
		if (!editable || path === '' || value.includes(path)) return;
		emit([...value, path]);
		// The trigger takes focus back where the popover left it, with the page still.
		requestAnimationFrame(() =>
			ref
				?.querySelector<HTMLElement>('[data-slot="field-picker-trigger"]')
				?.focus({ preventScroll: true })
		);
	}

	function move(from: number, to: number): void {
		if (!editable) return;
		emit(moveFieldPath(value, from, to));
	}

	const sortable = createSortable({
		ids: () => value,
		onOrderChange: (next) => emit(next),
		label: (path) => labelOf(path) ?? path,
		disabled: () => !editable
	});

	/** Every hop clears the search box; nothing is remounted, so focus stays in the input. */
	function descend(field: FieldOption, through: string): void {
		hops = [...hops, { name: field.name, displayName: field.displayName, through }];
		choosing = null;
		search = '';
		highlighted = '';
	}

	function descendInto(row: FieldOption): void {
		if (!row.traversable) return;
		if (row.targets.length === 1) descend(row, row.targets[0] as string);
		else {
			choosing = row;
			search = '';
			highlighted = '';
		}
	}

	function activate(row: FieldOption): void {
		if (row.selectable) toggle(row);
		else descendInto(row);
	}

	function back(): void {
		if (choosing) choosing = null;
		else hops = hops.slice(0, -1);
		search = '';
		highlighted = '';
	}

	function reset(): void {
		hops = [];
		choosing = null;
		search = '';
		highlighted = '';
	}

	function onListKeys(event: KeyboardEvent): void {
		if (event.key === 'ArrowRight') {
			if (choosing) {
				if (cursor) {
					event.preventDefault();
					descend(choosing, cursor);
				}
				return;
			}
			const row = rows.find((r) => r.path === cursor);
			if (row?.traversable) {
				event.preventDefault();
				descendInto(row);
			}
			return;
		}
		if (event.key === 'ArrowLeft' && breadcrumb) {
			event.preventDefault();
			back();
		}
	}

	function onRowKeys(event: KeyboardEvent, index: number): void {
		// The sortable owns the arrow keys while it carries a row.
		if (!editable || sortable.dragging !== null) return;
		if (event.altKey && event.key === 'ArrowUp') {
			event.preventDefault();
			move(index, index - 1);
		} else if (event.altKey && event.key === 'ArrowDown') {
			event.preventDefault();
			move(index, index + 1);
		} else if (event.key === 'Delete' || event.key === 'Backspace') {
			event.preventDefault();
			remove(index);
		}
	}
</script>

<!--
	The columns of a grid, as a field picker over the ordered list it fills.

	Picking a field appends its path and clears the picker; each row carries a grip, the
	friendly path and a remove button, and moves by drag or with Alt and an arrow key.
	`layout="dual"` swaps that for the two lists side by side, the type's fields checked
	on the left and the chosen paths on the right. A value is ShotGrid's dotted path: a
	root field is its own code, and every hop names the field followed and the type it
	landed on. Only a single `entity` field is descended into - a dotted path through a
	`multi_entity` field reads back nothing, 200 with the key absent (probe 016). A link
	declaring several target types asks which one first. `dataTypes` and `validTypes` bind
	what may be chosen, not what may be walked through, so a picker restricted to dates
	still reaches a date behind a link.
-->

{#snippet fieldList()}
	{#if breadcrumb}
		<div
			data-slot="column-picker-breadcrumb"
			class="border-border flex items-center gap-1.5 border-b px-2 py-1.5"
		>
			<button
				type="button"
				data-slot="column-picker-back"
				aria-label="Go back one level"
				title="Back (Left arrow)"
				onclick={back}
				class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
			>
				<ChevronLeft aria-hidden="true" class="size-4" />
			</button>
			<nav
				aria-label="Field path"
				class="text-muted-foreground flex min-w-0 flex-1 items-center gap-1 overflow-hidden text-xs"
			>
				<span class="shrink-0">{entityType}</span>
				{#each hops as hop (hop.name + hop.through)}
					<ChevronRight aria-hidden="true" class="size-3 shrink-0" />
					<span class="truncate">{hop.displayName}</span>
				{/each}
				{#if choosing}
					<ChevronRight aria-hidden="true" class="size-3 shrink-0" />
					<span class="truncate italic">{choosing.displayName}</span>
				{/if}
			</nav>
			<button
				type="button"
				data-slot="column-picker-reset"
				aria-label="Back to the root type"
				title="Reset"
				onclick={reset}
				class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
			>
				<RotateCcw aria-hidden="true" class="size-4" />
			</button>
		</div>
	{/if}

	<Command.Root
		shouldFilter={false}
		loop
		value={cursor}
		onValueChange={(next) => (highlighted = next)}
		onkeydown={onListKeys}
		class="gap-2 bg-transparent p-0"
	>
		<Command.Input
			bind:value={search}
			placeholder={choosing ? 'Which type?' : searchPlaceholder}
		/>
		<Command.List>
			{#if failure}
				<div
					data-slot="column-picker-error"
					class="text-destructive flex items-center justify-center gap-1.5 py-6 text-center text-sm"
				>
					<TriangleAlert aria-hidden="true" class="size-4 shrink-0" />
					<span class="truncate">{failure}</span>
				</div>
			{:else if choosing}
				<Command.Empty>
					<span class="text-muted-foreground inline-flex items-center gap-1.5">
						<SearchX aria-hidden="true" class="size-4 shrink-0" />
						No type matches.
					</span>
				</Command.Empty>
				{#each targets as target (target)}
					<Command.Item
						value={target}
						onSelect={() => choosing && descend(choosing, target)}
						class={cn('gap-2', ROW[size])}
					>
						<Link aria-hidden="true" class="size-4 shrink-0 opacity-70" />
						<span class="min-w-0 flex-1 truncate">{target}</span>
						<span class="text-muted-foreground shrink-0 text-xs">entity type</span>
						<ChevronRight aria-hidden="true" class="size-4 shrink-0 opacity-50" />
					</Command.Item>
				{/each}
			{:else if fields === null}
				<div data-slot="column-picker-loading" class="flex flex-col gap-2 p-1">
					{#each [0, 1, 2] as row (row)}
						<Skeleton class="h-8 w-full" />
					{/each}
				</div>
			{:else}
				<Command.Empty>
					<span class="text-muted-foreground inline-flex items-center gap-1.5">
						<SearchX aria-hidden="true" class="size-4 shrink-0" />
						No field matches.
					</span>
				</Command.Empty>
				{#each rows as row (row.path)}
					{@const Glyph = ICONS[iconNameFor(row.dataType)] ?? FileText}
					<Command.Item
						value={row.path}
						onSelect={() => activate(row)}
						data-slot="column-picker-field"
						data-path={row.path}
						data-chosen={value.includes(row.path) ? 'true' : undefined}
						class={cn('gap-2', ROW[size])}
					>
						<Checkbox
							checked={value.includes(row.path)}
							disabled={!row.selectable}
							tabindex={-1}
							aria-hidden="true"
							class="pointer-events-none"
						/>
						<Glyph aria-hidden="true" class="size-4 shrink-0 opacity-70" />
						<span class="min-w-0 flex-1 truncate" title={row.displayName}>{row.displayName}</span>
						{#if row.name !== row.displayName}
							<span class="text-muted-foreground shrink-0 font-mono text-xs">{row.name}</span>
						{/if}
						{#if row.traversable}
							<button
								type="button"
								tabindex={-1}
								data-slot="column-picker-descend"
								aria-label={`Open ${row.displayName}`}
								title="Open (Right arrow)"
								onmousedown={(event) => event.preventDefault()}
								onclick={(event) => {
									event.stopPropagation();
									descendInto(row);
								}}
								class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
							>
								<ChevronRight aria-hidden="true" class="size-4" />
							</button>
						{/if}
					</Command.Item>
				{/each}
			{/if}
		</Command.List>
	</Command.Root>
{/snippet}

{#snippet chosen()}
	{#if value.length === 0}
		<p
			data-slot="column-picker-empty"
			class="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-center text-sm"
		>
			<Columns3 aria-hidden="true" class="size-4 shrink-0" />
			{emptyLabel}
		</p>
	{:else}
		<ol
			data-slot="column-picker-list"
			class="flex max-h-72 min-w-0 flex-col gap-2 overflow-y-auto"
			{@attach sortable.attach}
		>
			{#each value as path, index (path)}
				<li
					data-slot="column-picker-column"
					data-sortable-id={path}
					data-index={index}
					data-path={path}
					class={cn(
						'bg-background flex min-w-0 items-center gap-2 rounded-md px-2 py-1.5',
						'data-[dragging]:z-10 data-[dragging]:opacity-90 data-[dragging]:shadow-md',
						'data-[drop-target]:bg-accent/40',
						ROW[size]
					)}
				>
					{#if !readonly}
						<Button
							variant="ghost"
							size={ACTION[size]}
							data-slot="column-picker-grip"
							data-sortable-handle="true"
							{disabled}
							onkeydown={(event) => onRowKeys(event, index)}
							aria-label={`Reorder ${labelOf(path) ?? path}`}
							title="Drag to reorder, or press Space and use the arrow keys"
							class="cursor-grab touch-none active:cursor-grabbing"
						>
							<GripVertical aria-hidden="true" />
						</Button>
					{/if}
					{#if labelOf(path) === undefined}
						<Skeleton class="h-4 w-32" />
					{:else}
						<span class="min-w-0 flex-1 truncate text-sm" title={path}>{labelOf(path)}</span>
					{/if}
					{#if !readonly}
						<Button
							variant="ghost"
							size={ACTION[size]}
							data-slot="column-picker-remove"
							{disabled}
							onkeydown={(event) => onRowKeys(event, index)}
							aria-label={`Remove ${labelOf(path) ?? path}`}
							title="Remove (Delete)"
							onclick={() => remove(index)}
						>
							<X aria-hidden="true" />
						</Button>
					{/if}
				</li>
			{/each}
		</ol>
		<div
			data-slot="column-picker-live-region"
			role="status"
			aria-live="polite"
			aria-atomic="true"
			class="sr-only"
		>
			{sortable.announcement}
		</div>
	{/if}
	{#if showCount}
		<p data-slot="column-picker-count" class="text-muted-foreground text-xs">{count}</p>
	{/if}
{/snippet}

{#snippet picker()}
	<FieldPicker
		{context}
		{entityType}
		{deepLinks}
		{maxDepth}
		{dataTypes}
		{validTypes}
		{hidePaths}
		{filterableOnly}
		{extraFields}
		{filter}
		{searchPlaceholder}
		{placeholder}
		{disabled}
		{invalid}
		{size}
		bind:value={adding}
		exclude={offered}
		clearable={false}
		emptyLabel="No field left to add."
		onValueChange={append}
	/>
{/snippet}

<div
	bind:this={ref}
	data-slot="column-picker"
	data-size={size}
	data-layout={layout}
	aria-disabled={disabled ? 'true' : undefined}
	aria-invalid={invalid ? 'true' : undefined}
	data-readonly={readonly ? 'true' : undefined}
	class={cn(
		'@container flex w-full min-w-0 flex-col gap-3',
		disabled && 'pointer-events-none opacity-50',
		className
	)}
	{...rest}
>
	{#if layout === 'dual'}
		<div
			data-slot="column-picker-panes"
			class={cn('grid min-w-0 gap-3', !readonly && '@lg:grid-cols-2')}
		>
			{#if !readonly}
				<section
					data-slot="column-picker-available"
					class={cn(
						'border-border flex min-w-0 flex-col gap-3 rounded-md border p-3',
						invalid && 'border-destructive ring-destructive/20 dark:ring-destructive/40 ring-2'
					)}
				>
					<h3 data-slot="column-picker-heading" class="truncate text-sm font-medium">
						{availableLabel}
					</h3>
					{@render fieldList()}
				</section>
			{/if}

			<section
				data-slot="column-picker-chosen"
				class={cn(
					'border-border flex min-w-0 flex-col gap-3 rounded-md border p-3',
					invalid && 'border-destructive ring-destructive/20 dark:ring-destructive/40 ring-2'
				)}
			>
				<h3 data-slot="column-picker-heading" class="truncate text-sm font-medium">
					{chosenLabel}
				</h3>
				{@render chosen()}
			</section>
		</div>
	{:else}
		{#if !readonly}
			{@render picker()}
		{/if}
		{@render chosen()}
	{/if}
</div>
