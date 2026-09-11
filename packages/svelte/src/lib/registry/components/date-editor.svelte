<script lang="ts" module>
	import type { DateValue } from '@internationalized/date';
	import type { ControlSize } from '$lib/registry/components/control-classes.js';
	import { fromCalendarDate, toCalendarDate } from '$lib/registry/components/editor-calendar.js';

	export type DateEditorSize = ControlSize;
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
	import { CONTROL_BOX, CONTROL_GLYPH } from '$lib/registry/components/control-classes.js';
	import FieldError from '$lib/registry/components/field-error.svelte';

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
		/** Whether the calendar popover is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
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
		open = $bindable(false),
		onOpenChange,
		errorMessage,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	let draft = $state(value ?? '');
	let parseError = $state<string | null>(null);
	let editing = $state(false);
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

	function setOpen(next: boolean): void {
		const wanted = readonly || disabled ? false : next;
		if (wanted === open) return;
		open = wanted;
		onOpenChange?.(open);
	}

	function pick(picked: DateValue | undefined): void {
		editing = false;
		setOpen(false);
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
			setOpen(false);
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
	<Popover.Root bind:open={() => open, setOpen}>
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
				CONTROL_BOX[size],
				!value && 'text-muted-foreground'
			)}
		>
			<CalendarIcon aria-hidden="true" class={cn(CONTROL_GLYPH[size], 'shrink-0')} />
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
				class={cn('tabular-nums', CONTROL_BOX[size])}
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
	<FieldError {message} {errorMessage} />
</div>
