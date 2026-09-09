<script lang="ts" module>
	import { CalendarDate, type DateValue } from '@internationalized/date';

	export type DateEditorSize = 'sm' | 'md' | 'lg';

	/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
	const BOX: Record<DateEditorSize, string> = {
		sm: 'h-8 px-2',
		md: 'h-9 px-3',
		lg: 'h-10 px-3'
	};

	/** The calendar glyph grows one step at `lg`, as the status picker's does. */
	const GLYPH: Record<DateEditorSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};

	const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

	/** `YYYY-MM-DD` as a calendar day, or undefined when the string is not one (field_types/date). */
	function toCalendarDate(value: string | null | undefined): DateValue | undefined {
		const m = DATE_ONLY.exec(String(value ?? '').trim());
		if (!m) return undefined;
		return new CalendarDate(Number(m[1]), Number(m[2]), Number(m[3]));
	}

	function fromCalendarDate(value: DateValue | undefined): string {
		if (!value) return '';
		const pad = (n: number, width = 2) => String(n).padStart(width, '0');
		return `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}`;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema } from '@sg-widgets/core';
	import { toApiDate } from '@sg-widgets/core';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The stored day, exactly `YYYY-MM-DD`, with no time and no zone (field_types/date). */
		value?: string | null;
		onValueChange?: (value: string | null) => void;
		field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
		/** The row form: the button takes the width of its value. */
		inline?: boolean;
		size?: DateEditorSize;
		disabled?: boolean;
		readonly?: boolean;
		invalid?: boolean;
		error?: string | null;
		onErrorChange?: (error: string | null) => void;
		placeholder?: string;
		errorMessage?: Snippet<[string]>;
	};

	let {
		value = $bindable(null),
		onValueChange,
		field = null,
		inline = false,
		size = 'md',
		disabled = false,
		readonly = false,
		invalid = false,
		error = null,
		onErrorChange,
		placeholder = 'YYYY-MM-DD',
		errorMessage,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	let draft = $state(value ?? '');
	let parseError = $state<string | null>(null);
	let editing = $state(false);
	let open = $state(false);
	let dayInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		const incoming = value ?? '';
		if (!editing) draft = incoming;
	});

	const message = $derived(error ?? parseError);
	const isInvalid = $derived(invalid || message !== null);
	const day = $derived(toCalendarDate(value));

	function emit(next: string | null): void {
		parseError = null;
		onErrorChange?.(null);
		draft = next ?? '';
		if (next === value) return;
		value = next;
		onValueChange?.(next);
	}

	/** Commits the typed day. Answers whether it parsed, so Enter knows to close. */
	function commit(): boolean {
		const result = toApiDate(draft);
		if ('error' in result) {
			parseError = result.error;
			onErrorChange?.(result.error);
			return false;
		}
		emit(result.value);
		return true;
	}

	function pick(picked: DateValue | undefined): void {
		editing = false;
		open = false;
		emit(fromCalendarDate(picked) || null);
	}

	// Losing focus because the control was removed from the page is not a commit.
	function onblur(event: FocusEvent): void {
		if (!(event.currentTarget as HTMLElement | null)?.isConnected) return;
		editing = false;
		commit();
	}

	function onkeydown(event: KeyboardEvent): void {
		if (event.key !== 'Enter' && event.key !== 'Escape') return;
		// The popover is portalled out of the widget, but React replays a synthetic event
		// up its own tree, so a key the editor answers is stopped here in both frameworks.
		event.stopPropagation();
		if (event.key === 'Enter') {
			if (!commit()) return;
			editing = false;
			open = false;
			return;
		}
		draft = value ?? '';
		parseError = null;
		onErrorChange?.(null);
		editing = false;
	}
</script>

<!--
	A `date` field.

	The value is exactly `YYYY-MM-DD`: no time, no zone, and the API validates the day
	rather than only parsing it, so `2026-02-30` is refused here too. A timestamp is
	never a date on this type (field_types/date).

	One anatomy everywhere: a button carrying the stored day, over a popover holding the
	typed day and the calendar. `inline` only sizes the button to its value.
-->
<div
	bind:this={ref}
	data-slot="date-editor"
	data-size={size}
	data-inline={inline ? 'true' : undefined}
	class={cn('flex w-full min-w-0 flex-col gap-2', inline && 'w-fit', className)}
	{...rest}
>
	<Popover.Root bind:open={() => open, (next) => (open = readonly || disabled ? false : next)}>
		<Popover.Trigger
			data-slot="date-editor-trigger"
			aria-label={field?.displayName ?? 'Pick a date'}
			aria-invalid={isInvalid}
			aria-disabled={disabled ? 'true' : undefined}
			data-readonly={readonly ? 'true' : undefined}
			{disabled}
			title={value ?? undefined}
			class={cn(
				buttonVariants({ variant: 'outline' }),
				'w-full justify-start gap-1.5 font-normal tabular-nums',
				BOX[size],
				!value && 'text-muted-foreground'
			)}
		>
			<CalendarIcon aria-hidden="true" class={cn(GLYPH[size], 'shrink-0')} />
			<span class="truncate">{value ?? placeholder}</span>
		</Popover.Trigger>
		<Popover.Content
			strategy="fixed"
			align="start"
			class="flex w-auto flex-col gap-3 p-3"
			onOpenAutoFocus={(event) => {
				event.preventDefault();
				dayInput?.focus({ preventScroll: true });
			}}
		>
			<Input
				bind:ref={dayInput}
				bind:value={draft}
				type="text"
				data-slot="date-editor-day"
				{disabled}
				{readonly}
				{placeholder}
				class={cn('tabular-nums', BOX[size])}
				aria-invalid={isInvalid}
				aria-label={field?.displayName ?? 'Date'}
				aria-required={field?.mandatory}
				onfocus={() => (editing = true)}
				{onblur}
				{onkeydown}
			/>
			<Calendar type="single" class="p-0" value={day} onValueChange={pick} />
		</Popover.Content>
	</Popover.Root>
	{#if message}
		{#if errorMessage}
			{@render errorMessage(message)}
		{:else}
			<p data-slot="field-editor-error" class="text-destructive text-xs">{message}</p>
		{/if}
	{/if}
</div>
