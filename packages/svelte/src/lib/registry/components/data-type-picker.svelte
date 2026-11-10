<script lang="ts" module>
	export type DataTypePickerSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { StatusOption } from 'sg-widgets-core';
	import { dataTypeLabel, dataTypeOptions, NO_ROWS_LABEL } from 'sg-widgets-core';
	import { fieldGlyph } from '$lib/registry/components/field-glyphs.js';
	import {
		CHIP_BOX,
		CHIP_GLYPH,
		CHIP_PAD,
		CHIP_SPACING,
		LEAF_GLYPH
	} from '$lib/registry/components/leaf-classes.js';
	import ListPicker from '$lib/registry/components/list-picker.svelte';
	import { PICKER_CHIP, PICKER_TEXT_CHIP } from '$lib/registry/components/picker-classes.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'slot'>, HTMLDivElement> & {
		/** The data types on offer, in the order they are listed. The caller decides the set. */
		types?: readonly string[];
		/** The chosen data type, by its API name, or `null` when nothing is chosen. */
		value?: string | null;
		onValueChange?: (value: string | null) => void;
		/** Labels of the caller's own, by API name. They win over the built-in ones. */
		labels?: Readonly<Record<string, string>>;
		placeholder?: string;
		/** Shown when no type is on offer. */
		emptyLabel?: string;
		/** Offer a search box, which narrows the set in the browser. */
		searchable?: boolean;
		searchPlaceholder?: string;
		/** Offer a control that clears the value. */
		clearable?: boolean;
		readonly?: boolean;
		disabled?: boolean;
		invalid?: boolean;
		/** Draw the API name as the row's right-aligned secondary, when it says more than the label. */
		showCode?: boolean;
		/** The muted line under a row's label. */
		subLabel?: (option: StatusOption) => string;
		/** A row's right-aligned value, of the caller's own making. Wins over the API name. */
		secondary?: (option: StatusOption) => string;
		size?: DataTypePickerSize;
		/** Whether the popup is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	};

	let {
		types = [],
		value = $bindable(null),
		onValueChange,
		labels = undefined,
		placeholder = 'Select a data type',
		emptyLabel = NO_ROWS_LABEL,
		searchable = false,
		searchPlaceholder = 'Search data types…',
		clearable = false,
		readonly = false,
		disabled = false,
		invalid = false,
		showCode = true,
		subLabel,
		secondary,
		size = 'md',
		open = $bindable(false),
		onOpenChange,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// A held type outside the set keeps a row of its own, labelled like the rest.
	const options = $derived(dataTypeOptions(types, { value, labels }));
	const chip = $derived(PICKER_CHIP[size]);

	function pick(next: string | null): void {
		value = next;
		onValueChange?.(next);
	}
</script>

<!--
	One field data type, picked from the set the caller offers.

	The list picker with the data type's glyph as a row's leading mark and a chip for
	its value. The widget names no set of its own: which types a site lets a client
	create is the caller's to say (019_create_fields).

	The value is the API name. A type outside the set still draws, under its label, and
	a type this build has never heard of draws under the name it was given with the
	document glyph, so a read-only control shows whatever a site's schema answered.
-->
<ListPicker
	bind:ref
	slot="data-type-picker"
	picker="data-type"
	{options}
	value={value || null}
	onValueChange={pick}
	{placeholder}
	{emptyLabel}
	{searchable}
	{searchPlaceholder}
	{clearable}
	clearLabel="Clear the data type"
	triggerLabel="Show the data types"
	{readonly}
	{disabled}
	{invalid}
	{showCode}
	{subLabel}
	{secondary}
	{size}
	bind:open
	{onOpenChange}
	class={className}
	{...rest}
>
	{#snippet valueChip(code: string)}
		{@const Glyph = fieldGlyph(code)}
		<span
			data-slot="data-type-picker-chip"
			data-type={code}
			title={dataTypeLabel(code, labels)}
			class={cn(
				PICKER_TEXT_CHIP,
				CHIP_BOX[chip],
				CHIP_PAD[chip].text,
				CHIP_PAD[chip].lead,
				CHIP_SPACING[chip].glyph
			)}
		>
			<Glyph aria-hidden="true" class={cn('shrink-0 opacity-70', CHIP_GLYPH[chip])} />
			<span class="truncate">{dataTypeLabel(code, labels)}</span>
		</span>
	{/snippet}

	{#snippet mark(option: StatusOption)}
		{@const Glyph = fieldGlyph(option.code)}
		<Glyph aria-hidden="true" class={LEAF_GLYPH[size]} />
	{/snippet}
</ListPicker>
