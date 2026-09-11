<script lang="ts" module>
	export type ListMultiSelectSize = 'sm' | 'md' | 'lg';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema } from '@sg-widgets/core';
	import { matchesTokens, statusLabel, usableStatuses } from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import X from '@lucide/svelte/icons/x';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import PickerControl from '$lib/registry/components/picker-control.svelte';
	import {
		PICKER_ARMED,
		PICKER_ROW,
		PICKER_TEXT_CHIP,
		PICKER_TEXT_CHIP_BOX
	} from '$lib/registry/components/picker-classes.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The chosen values, each one of the field's valid values (field_types/list). */
		value?: string[];
		onValueChange?: (value: string[]) => void;
		/** The field schema. Its valid values are the whole vocabulary a write may use. */
		field?: Pick<
			FieldSchema,
			'displayName' | 'mandatory' | 'validValues' | 'displayValues' | 'hiddenValues'
		> | null;
		/**
		 * The project the schema was read with. Given, the field's hidden values are
		 * subtracted; REST does not enforce them on write, so the subtraction is the
		 * client's (probe 009).
		 */
		projectId?: number;
		size?: ListMultiSelectSize;
		disabled?: boolean;
		readonly?: boolean;
		invalid?: boolean;
		/** A message from the caller. The list has nothing of its own to fail on. */
		error?: string | null;
		onErrorChange?: (error: string | null) => void;
		placeholder?: string;
		searchPlaceholder?: string;
		emptyLabel?: string;
		/** Whether the popup is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		errorMessage?: Snippet<[string]>;
	};

	let {
		value = $bindable([]),
		onValueChange,
		field = null,
		projectId,
		size = 'md',
		disabled = false,
		readonly = false,
		invalid = false,
		error = null,
		onErrorChange,
		placeholder = 'Select values',
		searchPlaceholder = 'Search values…',
		emptyLabel = 'No value.',
		open = $bindable(false),
		onOpenChange,
		errorMessage,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	let search = $state('');

	const options = $derived(
		projectId === undefined
			? (field?.validValues ?? []).map((code) => ({ code, label: statusLabel(field ?? {}, code) }))
			: usableStatuses(field ?? {})
	);
	// The vocabulary is one read, so the search box narrows it here.
	const shown = $derived(options.filter((option) => matchesTokens(search, option.label, option.code)));
	const interactive = $derived(!readonly && !disabled);

	// A row may hold a value outside the offered set; that is a legal stored value, so
	// it is shown as itself rather than dropped (probe 009).
	function labelOf(code: string): string {
		return options.find((option) => option.code === code)?.label ?? code;
	}

	function emit(next: string[]): void {
		value = next;
		onErrorChange?.(null);
		onValueChange?.(next);
	}

	function remove(code: string): void {
		emit(value.filter((c) => c !== code));
	}

	function removeAt(index: number): void {
		const code = value[index];
		if (code !== undefined) remove(code);
	}
</script>

<!--
	Several values of a `list` field.

	The vocabulary is the field's `valid_values`, byte for byte: a value outside it is
	a 400 and the comparison is case-sensitive (field_types/list). With a project id
	the field's hidden values are subtracted, which REST does not do on write.
-->
<div
	bind:this={ref}
	data-slot="list-multi-select"
	data-size={size}
	class={cn('flex w-full min-w-0 flex-col gap-2', className)}
	{...rest}
>
	<div class="relative flex w-full min-w-0 items-center">
		<PickerControl
			slot="list-multi-select"
			picker="list"
			multiple
			anchored
			keys={value}
			onSelect={emit}
			labels={value.map(labelOf)}
			chipKeys={value}
			chipRow
			inline={false}
			clearable={false}
			rowCount={shown.length}
			{size}
			{disabled}
			{readonly}
			{invalid}
			{placeholder}
			{searchPlaceholder}
			bind:open
			{onOpenChange}
			bind:query={search}
			onRemoveAt={removeAt}
			empty={shown.length === 0}
			{emptyLabel}
			triggerLabel="Show the values"
			overflowLabel={`Show all ${value.length} values`}
			controlProps={{ 'aria-label': field?.displayName, 'aria-required': field?.mandatory }}
		>
			{#snippet chip(index: number, armed: boolean, hidden: boolean)}
				{@const code = value[index]!}
				<span
					data-slot="list-multi-select-chip"
					data-chip=""
					data-armed={armed ? 'true' : undefined}
					{hidden}
					class={cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX[size], armed && PICKER_ARMED)}
				>
					<span class="truncate">{labelOf(code)}</span>
					{#if interactive}
						<button
							type="button"
							data-slot="list-multi-select-remove"
							aria-label={`Remove ${labelOf(code)}`}
							onclick={() => remove(code)}
							class="hover:text-foreground focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm opacity-60 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
						>
							<X aria-hidden="true" class="size-3" />
						</button>
					{/if}
				</span>
			{/snippet}

			{#snippet rows()}
				{#each shown as option (option.code)}
					{@const chosen = value.includes(option.code)}
					<Combobox.Item
						data-slot="list-multi-select-option"
						data-option={option.code}
						data-checked={chosen ? 'true' : undefined}
						value={option.code}
						label={option.label}
						class={PICKER_ROW}
					>
						<span data-slot="list-multi-select-check" class="flex h-5 shrink-0 items-center">
							<Checkbox checked={chosen} tabindex={-1} aria-hidden="true" class="pointer-events-none" />
						</span>
						<span class="min-w-0 flex-1 truncate">{option.label}</span>
					</Combobox.Item>
				{/each}
			{/snippet}
		</PickerControl>
	</div>
	{#if error}
		{#if errorMessage}
			{@render errorMessage(error)}
		{:else}
			<p data-slot="field-editor-error" class="text-destructive text-xs">{error}</p>
		{/if}
	{/if}
</div>
