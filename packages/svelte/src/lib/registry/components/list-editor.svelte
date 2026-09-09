<script lang="ts" module>
	export type ListEditorSize = 'sm' | 'md' | 'lg';

	/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
	const BOX: Record<ListEditorSize, string> = {
		sm: 'h-8',
		md: 'h-9',
		lg: 'h-10'
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
		size?: ListEditorSize;
		disabled?: boolean;
		readonly?: boolean;
		invalid?: boolean;
		error?: string | null;
		placeholder?: string;
		/** The label of the entry that clears the field. */
		clearLabel?: string;
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
		placeholder = 'Choose',
		clearLabel = 'Clear',
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
		onValueChange?.(chosen);
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
	data-slot="list-editor"
	data-size={size}
	class={cn('flex w-full min-w-0 flex-col gap-2', className)}
	{...rest}
>
	<Select.Root type="single" value={selected} onValueChange={pick} disabled={disabled || readonly}>
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
