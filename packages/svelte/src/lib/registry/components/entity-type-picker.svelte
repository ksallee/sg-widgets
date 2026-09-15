<script lang="ts" module>
	export type EntityTypePickerSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityTypeInfo, SgContext } from '@sg-widgets/core';
	import { entityTypeOptions, NO_MATCH_LABEL } from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
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
		/** The chosen type code. */
		value?: string | null;
		onValueChange?: (value: string | null) => void;
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
		size?: EntityTypePickerSize;
		/** Whether the popup is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	};

	let {
		context,
		value = $bindable(null),
		onValueChange,
		allow,
		deny,
		placeholder = 'Select an entity type',
		searchPlaceholder = 'Search types…',
		emptyLabel = NO_MATCH_LABEL,
		loadingLabel,
		errorLabel,
		clearable = true,
		readonly = false,
		disabled = false,
		invalid = false,
		showCode = true,
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
	const selected = $derived(value ? [value] : []);

	function emit(next: string | null): void {
		value = next;
		onValueChange?.(next);
	}
</script>

<!--
	One entity type, as a searchable combobox.

	The list is every type the site has enabled, display name first with the code
	beneath it when the two differ. `allow` and `deny` narrow the derived options
	rather than the read, so a caller switching sets sees the list change without a
	refetch. The vocabulary is one read, so the query input narrows it in the browser.
	A pick closes the list.
-->
<div
	bind:this={ref}
	data-slot="entity-type-picker"
	data-size={size}
	data-multiple="false"
	class={cn('relative flex w-full min-w-0 items-center', className)}
	{...rest}
>
	<PickerControl
		slot="entity-type-picker"
		picker="entity-type"
		keys={selected}
		onSelect={(keys) => emit(keys[0] ?? null)}
		labels={selected.map(options.labelOf)}
		chipKeys={selected}
		summary="ellipsis"
		chipRow
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
		onRemoveAt={() => emit(null)}
		onClear={() => emit(null)}
		loading={loaded === null}
		error={failure}
		count={options.shown.length}
		empty={options.shown.length === 0}
		{emptyLabel}
		{loadingLabel}
		{errorLabel}
		triggerLabel="Show the entity types"
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
			</span>
		{/snippet}

		{#snippet rows()}
			{#each options.shown as type (type.name)}
				<Combobox.Item
					data-slot="entity-type-picker-option"
					data-entity-type={type.name}
					data-checked={value === type.name ? 'true' : undefined}
					data-selected-type={value === type.name ? 'true' : undefined}
					value={type.name}
					label={type.displayName}
					class={cn(PICKER_ROW, 'items-start')}
				>
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
