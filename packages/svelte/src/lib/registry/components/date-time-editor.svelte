<script lang="ts" module>
	import { CalendarDate, type DateValue } from '@internationalized/date';

	export type DateTimeEditorSize = 'sm' | 'md' | 'lg';

	/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
	const BOX: Record<DateTimeEditorSize, string> = {
		sm: 'h-8',
		md: 'h-9',
		lg: 'h-10'
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
		/** Name the zone under the control. */
		hint?: boolean;
		/** Compact for one row of a form or a filter: date and time only, on one line. */
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

	$effect(() => {
		const local = fromApiDateTime(value, zoneOptions);
		if (editing) return;
		dateDraft = local?.date ?? '';
		timeDraft = local === null ? '' : showSeconds ? local.timeWithSeconds : local.time;
	});

	const message = $derived(error ?? parseError);
	const isInvalid = $derived(invalid || message !== null);
	const day = $derived(toCalendarDate(dateDraft));

	function commit(): void {
		const result = toApiDateTime(dateDraft, timeDraft, zoneOptions);
		if ('error' in result) {
			parseError = result.error;
			onErrorChange?.(result.error);
			return;
		}
		parseError = null;
		onErrorChange?.(null);
		const local = fromApiDateTime(result.value, zoneOptions);
		dateDraft = local?.date ?? '';
		timeDraft = local === null ? '' : showSeconds ? local.timeWithSeconds : local.time;
		if (result.value === value) return;
		value = result.value;
		onValueChange?.(result.value);
	}

	function pick(picked: DateValue | undefined): void {
		open = false;
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
		if (event.key === 'Enter') commit();
		if (event.key === 'Escape') reset();
	}
</script>

<!--
	A `date_time` field.

	The store is UTC `YYYY-MM-DDTHH:MM:SSZ`: a written offset is normalised away and a
	zoneless string is taken as UTC, not as site-local, so the wall-clock time typed
	here is converted before it is emitted and converted back to show
	(field_types/date_time). The zone that conversion uses is named under the control.

	`inline` is the form a row of a table or a filter takes: the date and the time sit on
	one line at a fixed width, and the calendar and the zone line are dropped.
-->
<div
	bind:this={ref}
	data-slot="date-time-editor"
	data-size={size}
	data-inline={inline ? 'true' : undefined}
	class={cn('flex w-full min-w-0 flex-col gap-2', inline && 'w-fit', className)}
	{...rest}
>
	<div class={cn('flex w-full min-w-0 items-center gap-2', !inline && 'flex-wrap')}>
		<Input
			bind:value={dateDraft}
			type="text"
			data-slot="date-time-editor-date"
			{disabled}
			{readonly}
			{placeholder}
			class={cn('tabular-nums', BOX[size], inline && 'w-28 shrink-0')}
			aria-invalid={isInvalid}
			aria-label={field?.displayName}
			aria-required={field?.mandatory}
			onfocus={() => (editing = true)}
			{onblur}
			{onkeydown}
		/>
		{#if !inline}
			<Popover.Root bind:open>
				<Popover.Trigger
					disabled={disabled || readonly}
					aria-label="Pick a date"
					class={cn(buttonVariants({ variant: 'outline', size: 'icon' }), 'shrink-0', BOX[size])}
				>
					<CalendarIcon aria-hidden="true" class="size-4" />
				</Popover.Trigger>
				<Popover.Content strategy="fixed" class="w-auto p-0" align="start">
					<Calendar type="single" value={day} onValueChange={pick} />
				</Popover.Content>
			</Popover.Root>
		{/if}
		<Input
			bind:value={timeDraft}
			type="time"
			data-slot="date-time-editor-time"
			step={showSeconds ? 1 : undefined}
			{disabled}
			{readonly}
			class={cn('w-auto shrink-0 tabular-nums', BOX[size], inline && 'w-24')}
			aria-invalid={isInvalid}
			aria-label="Time"
			onfocus={() => (editing = true)}
			{onblur}
			{onkeydown}
		/>
	</div>
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
