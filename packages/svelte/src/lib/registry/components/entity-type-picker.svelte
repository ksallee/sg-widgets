<script lang="ts" module>
	export type EntityTypePickerSize = 'sm' | 'md' | 'lg';

	/** Controls follow the input ladder of `docs/design-rules.md`. */
	const BOX: Record<EntityTypePickerSize, string> = {
		sm: 'h-8 px-2',
		md: 'h-9 px-3',
		lg: 'h-10 px-3'
	};
	const GLYPH: Record<EntityTypePickerSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};
</script>

<script lang="ts">
	import type { EntityTypeInfo, SchemaService } from '@sg-widgets/core';
	import { filterEntityTypes, matchesTokens } from '@sg-widgets/core';
	import ChevronsUpDown from '@lucide/svelte/icons/chevrons-up-down';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import X from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';

	type Props = {
		/** Reads the site's enabled types. Build it once per app with `createSchemaService`. */
		schema: SchemaService;
		/** A type code in single mode, an array of them in multi mode. */
		value?: string | string[] | null;
		multiple?: boolean;
		onValueChange?: (value: string | string[] | null) => void;
		/** Codes on offer. Empty or absent means every enabled type. */
		allow?: string[];
		/** Codes withheld, applied after `allow`. */
		deny?: string[];
		placeholder?: string;
		searchPlaceholder?: string;
		emptyLabel?: string;
		clearable?: boolean;
		readonly?: boolean;
		disabled?: boolean;
		invalid?: boolean;
		size?: EntityTypePickerSize;
		class?: string;
	};

	let {
		schema,
		value = $bindable(null),
		multiple = false,
		onValueChange,
		allow,
		deny,
		placeholder = 'Select an entity type',
		searchPlaceholder = 'Search types…',
		emptyLabel = 'No entity type matches.',
		clearable = true,
		readonly = false,
		disabled = false,
		invalid = false,
		size = 'md',
		class: className
	}: Props = $props();

	let open = $state(false);
	let search = $state('');
	let highlighted = $state('');
	let loaded = $state<EntityTypeInfo[] | null>(null);
	let failure = $state<string | null>(null);

	// One read per site, cached by the schema service: `/schema` is 12KB and holds
	// every enabled type (probe 002). Allow and deny are applied to the derived list
	// below, so narrowing them re-filters with no second call.
	$effect(() => {
		const service = schema;
		let live = true;
		service
			.entityTypes()
			.then((types) => {
				if (live) loaded = types;
			})
			.catch((error: unknown) => {
				if (live) failure = error instanceof Error ? error.message : String(error);
			});
		return () => {
			live = false;
		};
	});

	const selected = $derived(multiple ? ((value as string[] | null) ?? []) : value ? [value as string] : []);
	const types = $derived(loaded ? filterEntityTypes(loaded, { allow, deny }) : []);
	const shown = $derived(types.filter((t) => matchesTokens(search, t.displayName, t.name)));
	const cursor = $derived(
		shown.some((t) => t.name === highlighted) ? highlighted : (shown[0]?.name ?? '')
	);
	const byName = $derived(new Map(types.map((t) => [t.name, t])));
	const label = $derived(
		selected.map((code) => byName.get(code)?.displayName ?? code).join(', ')
	);
	const showClear = $derived(clearable && selected.length > 0 && !readonly && !disabled);

	function emit(next: string | string[] | null): void {
		value = next;
		onValueChange?.(next);
	}

	function choose(code: string): void {
		if (!multiple) {
			emit(code);
			open = false;
			return;
		}
		const current = selected;
		emit(current.includes(code) ? current.filter((c) => c !== code) : [...current, code]);
	}

	function clear(): void {
		emit(multiple ? [] : null);
	}
</script>

<!--
	One entity type, or several, as a searchable combobox.

	The list is every type the site has enabled, display name first with the code
	beneath it when the two differ. `allow` and `deny` narrow the derived options
	rather than the read, so a caller switching modes sees the list change without a
	refetch. Multi mode keeps the popover open and marks the chosen rows.
-->
<div
	data-slot="entity-type-picker"
	data-size={size}
	data-multiple={multiple ? 'true' : 'false'}
	class={cn('relative flex w-full min-w-0 items-center', className)}
>
	<Popover.Root {open} onOpenChange={(next) => (open = readonly || disabled ? false : next)}>
		<Popover.Trigger
			data-slot="entity-type-picker-trigger"
			role="combobox"
			aria-expanded={open}
			aria-invalid={invalid ? 'true' : undefined}
			aria-disabled={disabled ? 'true' : undefined}
			data-readonly={readonly ? 'true' : undefined}
			{disabled}
			title={label || placeholder}
			class={cn(
				'border-input bg-background focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex w-full min-w-0 items-center rounded-md border text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2',
				BOX[size],
				readonly ? 'pr-3' : showClear ? 'pr-14' : 'pr-8'
			)}
		>
			<span class={cn('truncate', selected.length === 0 && 'text-muted-foreground')}>
				{label || placeholder}
			</span>
		</Popover.Trigger>

		<Popover.Content
			data-picker="entity-type"
			align="start"
			class="w-96 max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0"
		>
			<Command.Root
				shouldFilter={false}
				loop
				value={cursor}
				onValueChange={(next) => (highlighted = next)}
			>
				<!-- svelte-ignore a11y_autofocus -->
				<Command.Input autofocus bind:value={search} placeholder={searchPlaceholder} />
				<Command.List>
					{#if failure}
						<div data-slot="entity-type-picker-error" class="text-destructive flex items-center justify-center gap-1.5 py-6 text-center text-sm">
							<TriangleAlert aria-hidden="true" class="size-4 shrink-0" />
							<span class="truncate">{failure}</span>
						</div>
					{:else if loaded === null}
						<div data-slot="entity-type-picker-loading" class="flex flex-col gap-2 p-1">
							{#each [0, 1, 2] as row (row)}
								<Skeleton class="h-8 w-full" />
							{/each}
						</div>
					{:else}
						<Command.Empty>
							<span class="text-muted-foreground inline-flex items-center gap-1.5">
								<SearchX aria-hidden="true" class="size-4 shrink-0" />
								{emptyLabel}
							</span>
						</Command.Empty>
						{#each shown as type (type.name)}
							<Command.Item
								value={type.name}
								onSelect={() => choose(type.name)}
								data-checked={!multiple && selected.includes(type.name) ? 'true' : undefined}
								class="items-start"
							>
								{#if multiple}
									<Checkbox
										checked={selected.includes(type.name)}
										tabindex={-1}
										aria-hidden="true"
										class="pointer-events-none mt-0.5"
									/>
								{/if}
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="truncate">{type.displayName}</span>
									{#if type.name !== type.displayName}
										<span class="text-muted-foreground truncate font-mono text-xs">{type.name}</span>
									{/if}
								</span>
							</Command.Item>
						{/each}
					{/if}
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>

	{#if !readonly}
		<div class="pointer-events-none absolute right-2 flex items-center gap-1">
			{#if showClear}
				<button
					type="button"
					data-slot="entity-type-picker-clear"
					aria-label="Clear the selection"
					onclick={clear}
					class="hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
				>
					<X aria-hidden="true" class={GLYPH[size]} />
				</button>
			{/if}
			<ChevronsUpDown aria-hidden="true" class={cn('shrink-0 opacity-50', GLYPH[size])} />
		</div>
	{/if}
</div>
