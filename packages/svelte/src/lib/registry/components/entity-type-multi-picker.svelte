<script lang="ts" module>
	import type { PickerSummary } from '@sg-widgets/core';

	export type EntityTypeMultiPickerSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityTypeInfo, SgContext } from '@sg-widgets/core';
	import { entityTypeOptions, NO_MATCH_LABEL } from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import PickerControl from '$lib/registry/components/picker-control.svelte';
	import {
		PICKER_ARMED,
		PICKER_ROW,
		PICKER_TEXT_CHIP,
		PICKER_TEXT_CHIP_BOX
	} from '$lib/registry/components/picker-classes.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The widget context. The site's enabled types are read through it, once per page. */
		context: SgContext;
		/** The chosen type codes, in the order they were ticked. */
		value?: string[];
		onValueChange?: (value: string[]) => void;
		/** Codes on offer. Empty or absent means every enabled type. */
		allow?: string[];
		/** Codes withheld, applied after `allow`. */
		deny?: string[];
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
		/** Show the code under the display name where the two differ. */
		showCode?: boolean;
		/** What the control shows for the selection. */
		summary?: PickerSummary;
		/** Chips drawn before the rest becomes `+n`. `0` draws every chip. */
		max?: number;
		size?: EntityTypeMultiPickerSize;
		/** Whether the popup is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	};

	let {
		context,
		value = $bindable([]),
		onValueChange,
		allow,
		deny,
		placeholder = 'Select entity types',
		searchPlaceholder = 'Search types…',
		emptyLabel = NO_MATCH_LABEL,
		loadingLabel,
		errorLabel,
		clearable = true,
		readonly = false,
		disabled = false,
		invalid = false,
		showCode = true,
		summary = 'ellipsis',
		max = 0,
		size = 'md',
		open = $bindable(false),
		onOpenChange,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// The context's own service, so every widget on the page shares one schema read.
	const schema = $derived(context.schema);

	let search = $state('');
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

	const options = $derived(entityTypeOptions(loaded, { allow, deny, query: search }));
	const selected = $derived(value ?? []);
	/**
	 * A chip control is a token field, with the caret beside the chips. A control
	 * summarising its selection is a trigger, and keeps its search box at the top of
	 * the popup instead.
	 */
	const inline = $derived(summary === 'chips');
	const interactive = $derived(!readonly && !disabled);

	function emit(next: string[]): void {
		value = next;
		onValueChange?.(next);
	}

	function remove(code: string): void {
		emit(selected.filter((c) => c !== code));
	}

	function removeAt(index: number): void {
		const code = selected[index];
		if (code !== undefined) remove(code);
	}
</script>

<!--
	Several entity types, as a searchable combobox.

	The list is every type the site has enabled, display name first with the code
	beneath it when the two differ, and a checkbox on every row. `allow` and `deny`
	narrow the derived options rather than the read, so a caller switching sets sees
	the list change without a refetch. The vocabulary is one read, so the query input
	narrows it in the browser. A pick keeps the list open.
-->
<div
	bind:this={ref}
	data-slot="entity-type-picker"
	data-size={size}
	data-multiple="true"
	data-summary={summary}
	class={cn('relative flex w-full min-w-0 items-center', className)}
	{...rest}
>
	<PickerControl
		slot="entity-type-picker"
		picker="entity-type-multi"
		multiple
		keys={selected}
		onSelect={emit}
		labels={selected.map(options.labelOf)}
		chipKeys={selected}
		{summary}
		{max}
		chipRow
		{inline}
		rowCount={options.shown.length}
		{size}
		{disabled}
		{readonly}
		{invalid}
		{clearable}
		{placeholder}
		{searchPlaceholder}
		bind:open
		{onOpenChange}
		bind:query={search}
		onRemoveAt={removeAt}
		onClear={() => emit([])}
		loading={loaded === null}
		error={failure}
		count={options.shown.length}
		empty={options.shown.length === 0}
		{emptyLabel}
		{loadingLabel}
		{errorLabel}
		triggerLabel="Show the entity types"
		overflowLabel={`Show all ${selected.length} types`}
	>
		{#snippet chip(index: number, armed: boolean, hidden: boolean)}
			{@const code = selected[index]!}
			<span
				data-slot="entity-type-picker-chip"
				data-chip=""
				data-armed={armed ? 'true' : undefined}
				{hidden}
				class={cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX[size], armed && PICKER_ARMED)}
			>
				<span class="truncate">{options.labelOf(code)}</span>
				{#if interactive}
					<button
						type="button"
						data-slot="entity-type-picker-remove"
						aria-label={`Remove ${options.labelOf(code)}`}
						onclick={() => remove(code)}
						class="hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm opacity-60 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
					>
						<X aria-hidden="true" class="size-3" />
					</button>
				{/if}
			</span>
		{/snippet}

		{#snippet rows()}
			{#each options.shown as type (type.name)}
				{@const chosen = selected.includes(type.name)}
				<Combobox.Item
					data-slot="entity-type-picker-option"
					data-entity-type={type.name}
					data-selected-type={chosen ? 'true' : undefined}
					value={type.name}
					label={type.displayName}
					class={cn(PICKER_ROW, 'items-start')}
				>
					<span data-slot="entity-type-picker-check" class="flex h-5 shrink-0 items-center">
						<Checkbox checked={chosen} tabindex={-1} aria-hidden="true" class="pointer-events-none" />
					</span>
					<span class="flex min-w-0 flex-1 flex-col">
						<span class="truncate">{type.displayName}</span>
						{#if showCode && type.name !== type.displayName}
							<span data-slot="entity-type-picker-code" class="text-muted-foreground truncate font-mono text-xs"
								>{type.name}</span
							>
						{/if}
					</span>
				</Combobox.Item>
			{/each}
		{/snippet}
	</PickerControl>
</div>
