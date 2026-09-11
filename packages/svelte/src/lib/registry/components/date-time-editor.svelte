<script lang="ts" module>
	import type { DateValue } from '@internationalized/date';
	import type { ControlSize } from '$lib/registry/components/control-classes.js';
	import { fromCalendarDate, toCalendarDate } from '$lib/registry/components/editor-calendar.js';

	export type DateTimeEditorSize = ControlSize;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema } from '@sg-widgets/core';
	import { fromApiDateTime, timeZoneName, toApiDateTime } from '@sg-widgets/core';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { CONTROL_BOX, CONTROL_GLYPH } from '$lib/registry/components/control-classes.js';
	import FieldError from '$lib/registry/components/field-error.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The stored instant, UTC `YYYY-MM-DDTHH:MM:SSZ` at second resolution (field_types/date_time). */
		value?: string | null;
		onValueChange?: (value: string | null) => void;
		field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
		/** IANA zone the typed wall-clock time is read in. Defaults to the runtime's. */
		timeZone?: string;
		/** Name the zone under the button. */
		hint?: boolean;
		/** The row form: the button takes the width of its value and the zone line goes. */
		inline?: boolean;
		/** Seconds in the time input. The store keeps them; most fields do not need them. */
		showSeconds?: boolean;
		size?: DateTimeEditorSize;
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
		timeZone,
		hint = true,
		inline = false,
		showSeconds = false,
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

	const zoneOptions = $derived(timeZone === undefined ? {} : { timeZone });
	const zone = $derived(timeZoneName(timeZone));

	let dateDraft = $state('');
	let timeDraft = $state('');
	let parseError = $state<string | null>(null);
	let editing = $state(false);
	let dateInput = $state<HTMLInputElement | null>(null);

	$effect(() => {
		const local = fromApiDateTime(value, zoneOptions);
		if (editing) return;
		dateDraft = local?.date ?? '';
		timeDraft = local === null ? '' : showSeconds ? local.timeWithSeconds : local.time;
	});

	const message = $derived(error ?? parseError);
	const isInvalid = $derived(invalid || message !== null);
	const day = $derived(toCalendarDate(dateDraft));
	// The button reads the stored instant, so it answers a commit and never a draft.
	const label = $derived.by(() => {
		const local = fromApiDateTime(value, zoneOptions);
		if (local === null) return null;
		return `${local.date} ${showSeconds ? local.timeWithSeconds : local.time}`;
	});

	/** Commits both drafts. Answers whether they parsed, so Enter knows to close. */
	function commit(): boolean {
		const result = toApiDateTime(dateDraft, timeDraft, zoneOptions);
		if ('error' in result) {
			parseError = result.error;
			onErrorChange?.(result.error);
			return false;
		}
		parseError = null;
		onErrorChange?.(null);
		const local = fromApiDateTime(result.value, zoneOptions);
		dateDraft = local?.date ?? '';
		timeDraft = local === null ? '' : showSeconds ? local.timeWithSeconds : local.time;
		if (result.value === value) return true;
		value = result.value;
		onValueChange?.(result.value);
		return true;
	}

	// A picked day leaves the popover open: the time is the other half of the value.
	function pick(picked: DateValue | undefined): void {
		dateDraft = fromCalendarDate(picked);
		commit();
	}

	function reset(): void {
		const local = fromApiDateTime(value, zoneOptions);
		dateDraft = local?.date ?? '';
		timeDraft = local === null ? '' : showSeconds ? local.timeWithSeconds : local.time;
		parseError = null;
		onErrorChange?.(null);
	}

	// Losing focus because the control was removed from the page is not a commit.
	function onblur(event: FocusEvent): void {
		if (!(event.currentTarget as HTMLElement | null)?.isConnected) return;
		editing = false;
		commit();
	}

	function setOpen(next: boolean): void {
		const wanted = readonly || disabled ? false : next;
		if (wanted === open) return;
		open = wanted;
		onOpenChange?.(open);
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
		reset();
		editing = false;
	}
</script>

<!--
	A `date_time` field.

	The store is UTC `YYYY-MM-DDTHH:MM:SSZ`: a written offset is normalised away and a
	zoneless string is taken as UTC, not as site-local, so the wall-clock time typed
	here is converted before it is emitted and converted back to show
	(field_types/date_time). The zone that conversion uses is named under the button.

	One anatomy everywhere: a button carrying the stored instant, over a popover holding
	the typed day, the calendar and the time. `inline` only sizes the button to its value
	and drops the zone line.
-->
<div
	bind:this={ref}
	data-slot="date-time-editor"
	data-size={size}
	data-inline={inline ? 'true' : undefined}
	class={cn('flex w-full min-w-0 flex-col gap-2', inline && 'w-fit', className)}
	{...rest}
>
	<Popover.Root bind:open={() => open, setOpen}>
		<Popover.Trigger
			data-slot="date-time-editor-trigger"
			aria-label={field?.displayName ?? 'Pick a date and time'}
			aria-invalid={isInvalid}
			aria-disabled={disabled ? 'true' : undefined}
			data-readonly={readonly ? 'true' : undefined}
			{disabled}
			title={value ?? undefined}
			class={cn(
				buttonVariants({ variant: 'outline' }),
				'w-full justify-start gap-1.5 font-normal tabular-nums',
				CONTROL_BOX[size],
				!label && 'text-muted-foreground'
			)}
		>
			<CalendarIcon aria-hidden="true" class={cn(CONTROL_GLYPH[size], 'shrink-0')} />
			<span class="truncate">{label ?? placeholder}</span>
		</Popover.Trigger>
		<Popover.Content
			strategy="fixed"
			align="start"
			class="flex w-auto flex-col gap-3 p-3"
			onOpenAutoFocus={(event) => {
				event.preventDefault();
				dateInput?.focus({ preventScroll: true });
			}}
		>
			<Input
				bind:ref={dateInput}
				bind:value={dateDraft}
				type="text"
				data-slot="date-time-editor-date"
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
			<Input
				bind:value={timeDraft}
				type="time"
				data-slot="date-time-editor-time"
				step={showSeconds ? 1 : undefined}
				{disabled}
				{readonly}
				class={cn('tabular-nums', CONTROL_BOX[size])}
				aria-invalid={isInvalid}
				aria-label="Time"
				onfocus={() => (editing = true)}
				{onblur}
				{onkeydown}
			/>
		</Popover.Content>
	</Popover.Root>
	{#if hint && !inline}
		<p data-slot="date-time-editor-zone" class="text-muted-foreground truncate text-xs">
			Local time in {zone}, stored as UTC.
		</p>
	{/if}
	<FieldError {message} {errorMessage} />
</div>
