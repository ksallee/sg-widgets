<script lang="ts" module>
	export type FieldPickerSize = 'sm' | 'md' | 'lg';

	/**
	 * Controls follow the input ladder of `docs/design-rules.md`. `data-empty` takes the
	 * leading inset down one step, so an empty control is tighter than a filled one. The
	 * height is fixed, so there is no vertical inset to take.
	 */
	const BOX: Record<FieldPickerSize, string> = {
		sm: 'h-8 px-2 data-empty:pl-1.5',
		md: 'h-9 px-3 data-empty:pl-2',
		lg: 'h-10 px-3 data-empty:pl-2'
	};
	const GLYPH: Record<FieldPickerSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
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
		NO_MATCH_LABEL,
		searchFieldOptions,
		stateLine
	} from '@sg-widgets/core';
	import Braces from '@lucide/svelte/icons/braces';
	import Calendar from '@lucide/svelte/icons/calendar';
	import CalendarClock from '@lucide/svelte/icons/calendar-clock';
	import ChevronLeft from '@lucide/svelte/icons/chevron-left';
	import ChevronRight from '@lucide/svelte/icons/chevron-right';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import CircleDollarSign from '@lucide/svelte/icons/circle-dollar-sign';
	import CircleDot from '@lucide/svelte/icons/circle-dot';
	import FileText from '@lucide/svelte/icons/file-text';
	import Fingerprint from '@lucide/svelte/icons/fingerprint';
	import Globe from '@lucide/svelte/icons/globe';
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
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import StateLine from '$lib/registry/components/state-line.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The widget context. The schema is read through it, once per page. */
		context: SgContext;
		/** The type the path starts on. */
		entityType: string;
		/** The dotted path, `field` or `field.Type.field…`. Empty when nothing is chosen. */
		value?: string;
		onValueChange?: (value: string) => void;
		/** Allow descending through entity fields. */
		deepLinks?: boolean;
		/** Show the programmatic name beside the display name. */
		showCode?: boolean;
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
		/** Close the popover on a selection. Off keeps it open for the next pick. */
		closeOnSelect?: boolean;
		placeholder?: string;
		searchPlaceholder?: string;
		/** Shown when the search matches nothing. */
		emptyLabel?: string;
		/** The accessible name of the skeletons a read stands behind. */
		loadingLabel?: string;
		/** Shown in place of what the failed read said. */
		errorLabel?: string;
		clearable?: boolean;
		readonly?: boolean;
		disabled?: boolean;
		invalid?: boolean;
		size?: FieldPickerSize;
		/** Whether the popover is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	};

	let {
		context,
		entityType,
		value = $bindable(''),
		onValueChange,
		deepLinks = false,
		showCode = false,
		maxDepth = 2,
		dataTypes,
		validTypes,
		exclude,
		hidePaths,
		filterableOnly = false,
		extraFields,
		filter,
		closeOnSelect = true,
		placeholder = 'Select a field',
		searchPlaceholder = 'Search fields…',
		emptyLabel = NO_MATCH_LABEL,
		loadingLabel,
		errorLabel,
		clearable = true,
		readonly = false,
		disabled = false,
		invalid = false,
		size = 'md',
		open = $bindable(false),
		onOpenChange,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// The context's own service, so every widget on the page shares one schema read.
	const schema = $derived(context.schema);

	/** The trailing controls ride the first row, so they stay with it when the value wraps. */
const TRAILING: Record<FieldPickerSize, string> = {
	sm: 'h-8',
	md: 'h-9',
	lg: 'h-10'
}

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

	function setOpen(next: boolean): void {
		const wanted = readonly || disabled ? false : next;
		if (wanted === open) return;
		open = wanted;
		onOpenChange?.(open);
	}

	let inputEl = $state<HTMLInputElement | null>(null);
	let search = $state('');
	let highlighted = $state('');
	let hops = $state<FieldHop[]>([]);
	/** The field whose target type is being chosen, when it declares more than one. */
	let choosing = $state<FieldOption | null>(null);
	let loaded = $state<{ type: string; fields: Record<string, FieldSchema> } | null>(null);
	let resolved = $state<{ path: string; label: string } | null>(null);
	let failure = $state<string | null>(null);

	const type = $derived(currentType(entityType, hops));

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

	// The closed control shows the friendly path, never the raw one, so the label is
	// resolved through the schema of every type the path travels.
	$effect(() => {
		const service = schema;
		const root = entityType;
		const wanted = value;
		if (!wanted || extraFields?.some((extra) => extra.name === wanted)) return;
		let live = true;
		service
			.resolvePath(root, wanted)
			.then((segments) => {
				if (live) resolved = { path: wanted, label: friendlyFieldPath(segments) };
			})
			// A path the schema no longer holds still has to be readable, so it stays as it is.
			.catch(() => {
				if (live) resolved = { path: wanted, label: wanted };
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
	const computed = $derived(extraFields?.find((extra) => extra.name === value));
	const label = $derived(
		computed
			? (computed.displayName ?? computed.name)
			: resolved?.path === value
				? resolved.label
				: null
	);
	const showClear = $derived(clearable && value !== '' && !readonly && !disabled);
	const breadcrumb = $derived(hops.length > 0 || choosing !== null);

	function matchesType(target: string): boolean {
		return target.toLowerCase().includes(search.trim().toLowerCase());
	}

	function emit(next: string): void {
		value = next;
		onValueChange?.(next);
	}

	/** Every hop clears the search box; nothing is remounted, so focus stays in the input. */
	function descend(field: FieldOption, through: string): void {
		hops = [...hops, { name: field.name, displayName: field.displayName, through }];
		choosing = null;
		search = '';
		highlighted = '';
	}

	function activate(row: FieldOption): void {
		if (row.traversable && !row.selectable) {
			descendInto(row);
			return;
		}
		emit(row.path);
		// The search box clears on every selection as it does on every hop, so a caller
		// adding one field after another never has to reach for the mouse.
		search = '';
		highlighted = '';
		if (closeOnSelect) setOpen(false);
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

	function onKeys(event: KeyboardEvent): void {
		if (event.key === 'ArrowRight') {
			if (choosing) {
				const target = cursor;
				if (target) {
					event.preventDefault();
					descend(choosing, target);
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
</script>

<!--
	One field of one entity type, as a searchable combobox that descends through links.

	The value is ShotGrid's dotted path: a root field is its own code, and every hop
	names the field followed and the type it landed on. Only a single `entity` field
	is descended into - a dotted path through a `multi_entity` field reads back
	nothing, 200 with the key absent (probe 016). A link declaring several target
	types asks which one first. `dataTypes` and `validTypes` bind what may be chosen,
	not what may be walked through, so a picker restricted to dates still reaches a
	date behind a link.
-->
<div
	bind:this={ref}
	data-slot="field-picker"
	data-size={size}
	data-depth={hops.length}
	class={cn('relative flex w-full min-w-0 items-center', className)}
	{...rest}
>
	<Popover.Root bind:open={() => open, setOpen}>
		<Popover.Trigger
			data-slot="field-picker-trigger"
			role="combobox"
			aria-expanded={open}
			aria-invalid={invalid ? 'true' : undefined}
			aria-disabled={disabled ? 'true' : undefined}
			data-readonly={readonly ? 'true' : undefined}
			data-value={value || undefined}
			data-empty={value === '' ? '' : undefined}
			{disabled}
			title={label ?? placeholder}
			class={cn(
				'border-input bg-background hover:bg-muted/30 focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex w-full min-w-0 items-center rounded-lg border text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2',
				BOX[size],
				readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8'
			)}
		>
			{#if value === ''}
				<span class="text-muted-foreground truncate">{placeholder}</span>
			{:else if label === null}
				<Skeleton class="h-4 w-32" />
			{:else}
				<span data-slot="field-picker-label" class="truncate">{label}</span>
			{/if}
		</Popover.Trigger>

		<!-- Fixed: the Command list scrolls its highlighted row into view on mount, and an absolute wrapper
		     still at the page origin would drag the page there with it. -->
		<Popover.Content
			strategy="fixed"
			data-picker="field"
			onOpenAutoFocus={(e) => {
				e.preventDefault();
				inputEl?.focus({ preventScroll: true });
			}}
			align="start"
			onkeydown={onKeys}
			class="w-96 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
		>
			{#if breadcrumb}
				<div
					data-slot="field-picker-breadcrumb"
					class="border-border flex items-center gap-1.5 border-b px-2 py-1.5"
				>
					<button
						type="button"
						data-slot="field-picker-back"
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
						data-slot="field-picker-reset"
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
			>
				<Command.Input
					bind:ref={inputEl}
					bind:value={search}
					placeholder={choosing ? 'Which type?' : searchPlaceholder}
				/>
				<Command.List>
					{#if failure}
						<StateLine
							state="error"
							slotName="field-picker-error"
							icon={TriangleAlert}
							label={stateLine('error', { errorLabel }, failure)}
						/>
					{:else if choosing}
						<Command.Empty>
							<StateLine state="empty" icon={SearchX} label={emptyLabel} pad="none" />
						</Command.Empty>
						{#each targets as target (target)}
							<Command.Item
								value={target}
								onSelect={() => choosing && descend(choosing, target)}
								class="items-start"
							>
								<Link aria-hidden="true" class="mt-0.5 size-4 shrink-0 opacity-70" />
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="truncate">{target}</span>
									<span class="text-muted-foreground truncate text-xs">entity type</span>
								</span>
								<ChevronRight aria-hidden="true" class="size-4 shrink-0 opacity-50" />
							</Command.Item>
						{/each}
					{:else if fields === null}
						<div
							data-slot="field-picker-loading"
							class="flex flex-col gap-2 p-1"
							aria-busy="true"
							aria-label={stateLine('loading', { loadingLabel })}
						>
							{#each [0, 1, 2] as row (row)}
								<Skeleton class="h-10 w-full" />
							{/each}
						</div>
					{:else}
						<Command.Empty>
							<StateLine state="empty" icon={SearchX} label={emptyLabel} pad="none" />
						</Command.Empty>
						{#each rows as row (row.path)}
							{@const Glyph = ICONS[iconNameFor(row.dataType)] ?? FileText}
							<Command.Item
								value={row.path}
								onSelect={() => activate(row)}
								data-checked={row.path === value ? 'true' : undefined}
								data-traversable={row.traversable ? 'true' : undefined}
								class="items-start"
							>
								<Glyph aria-hidden="true" class="mt-0.5 size-4 shrink-0 opacity-70" />
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="flex min-w-0 items-center gap-1.5">
										<span class="truncate">{row.displayName}</span>
										{#if showCode && row.name !== row.displayName}
											<span class="text-muted-foreground shrink-0 font-mono text-xs">{row.name}</span>
										{/if}
									</span>
									<span class="text-muted-foreground truncate text-xs">
										{row.computed ? 'computed' : row.dataType}
									</span>
								</span>
								{#if row.traversable}
									<button
										type="button"
										tabindex={-1}
										data-slot="field-picker-descend"
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
		</Popover.Content>
	</Popover.Root>

	{#if !readonly}
		<div class={cn('pointer-events-none absolute top-0 right-2 flex items-center gap-1', TRAILING[size])}>
			{#if showClear}
				<button
					type="button"
					data-slot="field-picker-clear"
					aria-label="Clear the field"
					onclick={() => emit('')}
					class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
				>
					<X aria-hidden="true" class={GLYPH[size]} />
				</button>
			{/if}
			<ChevronDown aria-hidden="true" class={cn('shrink-0 opacity-50', GLYPH[size])} />
		</div>
	{/if}
</div>
