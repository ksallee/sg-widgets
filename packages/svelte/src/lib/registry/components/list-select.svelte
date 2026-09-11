<script lang="ts" module>
	export type ListSelectSize = 'sm' | 'md' | 'lg';

	/**
	 * The control ladder of `docs/design-rules.md`: 8 / 9 / 10. The height carries `!`
	 * because the select trigger sets its own under a `data-size` selector.
	 */
	const BOX: Record<ListSelectSize, string> = {
		sm: 'h-8!',
		md: 'h-9!',
		lg: 'h-10!'
	};

	/** The sentinel the clear entry carries; the field itself is cleared with null. */
	const CLEAR = '';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema } from '@sg-widgets/core';
	import { statusLabel, usableStatuses } from '@sg-widgets/core';
	import * as Select from '$lib/components/ui/select/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The stored string, one of the field's valid values, or null (field_types/list). */
		value?: string | null;
		onValueChange?: (value: string | null) => void;
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
		size?: ListSelectSize;
		disabled?: boolean;
		readonly?: boolean;
		invalid?: boolean;
		/** A message from the caller. The list has nothing of its own to fail on. */
		error?: string | null;
		onErrorChange?: (error: string | null) => void;
		placeholder?: string;
		/** The label of the entry that clears the field. */
		clearLabel?: string;
		/** Whether the popup is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		errorMessage?: Snippet<[string]>;
	};

	let {
		value = $bindable(null),
		onValueChange,
		field = null,
		projectId,
		size = 'md',
		disabled = false,
		readonly = false,
		invalid = false,
		error = null,
		onErrorChange,
		placeholder = 'Choose',
		clearLabel = 'Clear',
		open = $bindable(false),
		onOpenChange,
		errorMessage,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const options = $derived(
		projectId === undefined
			? (field?.validValues ?? []).map((code) => ({ code, label: statusLabel(field ?? {}, code) }))
			: usableStatuses(field ?? {})
	);
	const selected = $derived(value ?? CLEAR);
	// A row may hold a value outside the offered set; that is a legal stored value, so
	// it is shown as itself rather than dropped (probe 009).
	const label = $derived(
		value === null || value === undefined
			? placeholder
			: (options.find((o) => o.code === value)?.label ?? value)
	);

	function pick(next: string): void {
		const chosen = next === CLEAR ? null : next;
		if (chosen === value) return;
		value = chosen;
		onErrorChange?.(null);
		onValueChange?.(chosen);
	}

	function setOpen(next: boolean): void {
		const wanted = readonly || disabled ? false : next;
		if (wanted === open) return;
		open = wanted;
		onOpenChange?.(open);
	}
</script>

<!--
	A `list` field.

	Despite the name the value is one bare string, and a write outside `valid_values`
	is a 400 and case-sensitive, so the schema's vocabulary is the whole set a picker
	may offer (field_types/list). With a project id the field's hidden values are
	subtracted, which REST does not do on write.
-->
<div
	bind:this={ref}
	data-slot="list-select"
	data-size={size}
	class={cn('flex w-full min-w-0 flex-col gap-2', className)}
	{...rest}
>
	<Select.Root
		type="single"
		value={selected}
		onValueChange={pick}
		disabled={disabled || readonly}
		bind:open={() => open, setOpen}
	>
		<Select.Trigger
			class={cn('w-full', BOX[size])}
			aria-invalid={invalid}
			aria-label={field?.displayName}
			aria-required={field?.mandatory}
			data-placeholder={value === null || value === undefined ? '' : undefined}
		>
			<span data-slot="select-value" class="truncate">{label}</span>
		</Select.Trigger>
		<Select.Content>
			{#if field?.mandatory !== true}
				<Select.Item value={CLEAR} label={clearLabel} />
			{/if}
			{#each options as option (option.code)}
				<Select.Item value={option.code} label={option.label} />
			{/each}
		</Select.Content>
	</Select.Root>
	{#if error}
		{#if errorMessage}
			{@render errorMessage(error)}
		{:else}
			<p data-slot="field-editor-error" class="text-destructive text-xs">{error}</p>
		{/if}
	{/if}
</div>
