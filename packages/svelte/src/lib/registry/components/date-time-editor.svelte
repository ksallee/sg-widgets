<script lang="ts" module>
	import { CalendarDate, type DateValue } from '@internationalized/date';

	export type DateTimeEditorSize = 'sm' | 'md' | 'lg';

	/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
	const BOX: Record<DateTimeEditorSize, string> = {
	sm: 'h-8 px-2',
	md: 'h-9 px-3',
	lg: 'h-10 px-3'
	};

/** The calendar glyph grows one step at `lg`, as the status picker's does. */
const GLYPH: Record<DateTimeEditorSize, string> = {
	sm: 'size-4',
	md: 'size-4',
	lg: 'size-5'
	};

	const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

	function toCalendarDate(value: string): DateValue | undefined {
		const m = DATE_ONLY.exec(value.trim());
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
	import { fromApiDateTime, timeZoneName, toApiDateTime } from '@sg-widgets/core';
	import CalendarIcon from '@lucide/svelte/icons/calendar';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import { Calendar } from '$lib/components/ui/calendar/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

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
	let open = $state(false);
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
	<Popover.Root bind:open={() => open, (next) => (open = readonly || disabled ? false : next)}>
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
				BOX[size],
				!label && 'text-muted-foreground'
			)}
		>
			<CalendarIcon aria-hidden="true" class={cn(GLYPH[size], 'shrink-0')} />
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
				class={cn('tabular-nums', BOX[size])}
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
				class={cn('tabular-nums', BOX[size])}
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
	{#if message}
		{#if errorMessage}
			{@render errorMessage(message)}
		{:else}
			<p data-slot="field-editor-error" class="text-destructive text-xs">{message}</p>
		{/if}
	{/if}
</div>
