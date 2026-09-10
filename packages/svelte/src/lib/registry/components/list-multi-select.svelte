<script lang="ts" module>
	export type ListMultiSelectSize = 'sm' | 'md' | 'lg';

	/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
	const BOX: Record<ListMultiSelectSize, string> = {
		sm: 'h-8',
		md: 'h-9',
		lg: 'h-10'
	};

	/** The trigger, matching the select trigger of each registry. */
	const TRIGGER =
		'border-input bg-background hover:bg-muted focus-visible:ring-ring focus-visible:ring-offset-background aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 flex w-full min-w-0 items-center justify-between gap-1.5 rounded-md border px-3 text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 aria-invalid:ring-2';
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema } from '@sg-widgets/core';
	import { statusLabel, usableStatuses } from '@sg-widgets/core';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import SearchX from '@lucide/svelte/icons/search-x';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
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

	let inputEl = $state<HTMLInputElement | null>(null);

	const options = $derived(
		projectId === undefined
			? (field?.validValues ?? []).map((code) => ({ code, label: statusLabel(field ?? {}, code) }))
			: usableStatuses(field ?? {})
	);

	// A row may hold a value outside the offered set; that is a legal stored value, so
	// it is shown as itself rather than dropped (probe 009).
	function labelOf(code: string): string {
		return options.find((option) => option.code === code)?.label ?? code;
	}

	const label = $derived(value.length === 0 ? placeholder : value.map(labelOf).join(', '));

	function toggle(code: string): void {
		const next = value.includes(code) ? value.filter((c) => c !== code) : [...value, code];
		value = next;
		onErrorChange?.(null);
		onValueChange?.(next);
	}

	function setOpen(next: boolean): void {
		const wanted = readonly || disabled ? false : next;
		if (wanted === open) return;
		open = wanted;
		onOpenChange?.(open);
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
	<Popover.Root bind:open={() => open, setOpen}>
		<Popover.Trigger
			data-slot="list-multi-select-trigger"
			role="combobox"
			aria-expanded={open}
			aria-invalid={invalid ? 'true' : undefined}
			aria-label={field?.displayName}
			aria-required={field?.mandatory}
			data-empty={value.length === 0 ? '' : undefined}
			disabled={disabled || readonly}
			title={label}
			class={cn(TRIGGER, BOX[size])}
		>
			<span class={cn('min-w-0 truncate', value.length === 0 && 'text-muted-foreground')}>{label}</span>
			{#if value.length > 0}
				<Badge variant="secondary" class="shrink-0">{value.length}</Badge>
			{:else}
				<ChevronDownIcon aria-hidden="true" class="text-muted-foreground size-4 shrink-0" />
			{/if}
		</Popover.Trigger>

		<!-- Fixed: the Command list scrolls its highlighted row into view on mount, and an absolute
		     wrapper still at the page origin would drag the page there with it. -->
		<Popover.Content
			strategy="fixed"
			align="start"
			onOpenAutoFocus={(e) => {
				e.preventDefault();
				inputEl?.focus({ preventScroll: true });
			}}
			class="w-64 gap-0 overflow-hidden p-0"
		>
			<Command.Root>
				<Command.Input bind:ref={inputEl} placeholder={searchPlaceholder} />
				<Command.List>
					<Command.Empty>
						<span class="text-muted-foreground inline-flex items-center gap-1.5">
							<SearchX aria-hidden="true" class="size-4 shrink-0" />
							{emptyLabel}
						</span>
					</Command.Empty>
					{#each options as option (option.code)}
						<Command.Item
							value="{option.label} {option.code}"
							data-option={option.code}
							data-checked={value.includes(option.code) ? 'true' : undefined}
							onSelect={() => toggle(option.code)}
						>
							<Checkbox checked={value.includes(option.code)} tabindex={-1} aria-hidden="true" />
							<span class="min-w-0 flex-1 truncate">{option.label}</span>
						</Command.Item>
					{/each}
				</Command.List>
			</Command.Root>
		</Popover.Content>
	</Popover.Root>
	{#if error}
		{#if errorMessage}
			{@render errorMessage(error)}
		{:else}
			<p data-slot="field-editor-error" class="text-destructive text-xs">{error}</p>
		{/if}
	{/if}
</div>
