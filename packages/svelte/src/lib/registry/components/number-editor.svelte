<script lang="ts" module>
	import {
		formatDuration,
		formatFloat,
		formatTimecode,
		formatTimecodeFrames,
		parseDurationInput,
		parseFloatInput,
		parseInteger,
		parseTimecodeInput,
		toApiFloat,
		type ParseResult
	} from '@sg-widgets/core';

	export type NumberEditorSize = 'sm' | 'md' | 'lg';

	/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
	const BOX: Record<NumberEditorSize, string> = {
		sm: 'h-8',
		md: 'h-9',
		lg: 'h-10'
	};

	interface Shape {
		hoursPerDay?: number;
		frameRate?: number;
		precision?: number;
		min?: number;
		max?: number;
	}

	/** The stored value as the string the input shows. Each type round-trips through its own parse. */
	function toDraft(value: unknown, dataType: string, shape: Shape): string {
		if (value === null || value === undefined || value === '') return '';
		switch (dataType) {
			case 'float':
			case 'currency':
				return formatFloat(value as string, shape.precision === undefined ? {} : { decimals: shape.precision });
			case 'duration':
				// Hours and minutes, never days: a day rendering rounds and would not survive a
				// round trip through the parse. The working day is a parse unit only.
				return formatDuration(Number(value));
			case 'timecode':
				return shape.frameRate === undefined
					? formatTimecode(Number(value))
					: formatTimecodeFrames(Number(value), shape.frameRate);
			default:
				return String(value);
		}
	}

	function parseFor(raw: string, dataType: string, shape: Shape): ParseResult<number | null> {
		switch (dataType) {
			case 'float':
			case 'currency':
				return parseFloatInput(raw, shape.precision === undefined ? {} : { precision: shape.precision });
			case 'duration':
				return parseDurationInput(raw, shape.hoursPerDay === undefined ? {} : { hoursPerDay: shape.hoursPerDay });
			case 'timecode':
				return parseTimecodeInput(raw, shape.frameRate === undefined ? {} : { frameRate: shape.frameRate });
			default: {
				const bounds: { min?: number; max?: number } = {};
				if (shape.min !== undefined) bounds.min = shape.min;
				if (shape.max !== undefined) bounds.max = shape.max;
				return parseInteger(raw, bounds);
			}
		}
	}

	/**
	 * The wire value. A `float` goes as a decimal string because an Integer is refused
	 * on write and JSON cannot spell `2.0`; every other type is a bare number
	 * (field_types/float, number, percent, duration, timecode).
	 */
	function toWire(parsed: number | null, dataType: string): number | string | null {
		if (parsed === null) return null;
		return dataType === 'float' ? toApiFloat(parsed) : parsed;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema } from '@sg-widgets/core';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The stored value. A float arrives quoted, the rest as bare numbers (field_types/float). */
		value?: number | string | null;
		onValueChange?: (value: number | string | null) => void;
		/** Which numeric type is being edited. Picks the parse, the format and the affix. */
		dataType?: 'number' | 'float' | 'percent' | 'duration' | 'timecode' | 'currency';
		field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
		/** Decimals kept on a float. The store itself keeps six (field_types/float). */
		precision?: number;
		/** The site's `hours_per_day` from `GET /preferences`, for the `d` unit (field_types/duration). */
		hoursPerDay?: number;
		/** Frames per second, for the `HH:MM:SS:FF` form (field_types/timecode). */
		frameRate?: number;
		/** Shown before the value on a currency field. */
		symbol?: string;
		/** Show the stored form under the control, e.g. the minutes behind a duration. */
		hint?: boolean;
		min?: number;
		max?: number;
		size?: NumberEditorSize;
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
		dataType = 'number',
		field = null,
		precision,
		hoursPerDay,
		frameRate,
		symbol = '$',
		hint: showHint = false,
		min,
		max,
		size = 'md',
		disabled = false,
		readonly = false,
		invalid = false,
		error = null,
		onErrorChange,
		placeholder,
		errorMessage,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// A plain function, not a derived: the blur that follows this control being removed
	// would otherwise read a derived belonging to an effect that is already gone.
	function shape(): Shape {
		return { hoursPerDay, frameRate, precision, min, max };
	}

	let draft = $state('');
	let parseError = $state<string | null>(null);
	let editing = $state(false);

	$effect(() => {
		const incoming = toDraft(value, dataType, shape());
		if (!editing) draft = incoming;
	});

	const message = $derived(error ?? parseError);
	const isInvalid = $derived(invalid || message !== null);
	const prefix = $derived(dataType === 'currency' ? symbol : null);
	const suffix = $derived(dataType === 'percent' ? '%' : null);
	// A duration is stored as a whole number of minutes and the field names no unit, so
	// the number that will be written is shown outright (field_types/duration).
	const live = $derived(parseFor(draft, dataType, shape()));
	const hint = $derived(
		dataType === 'duration' && !('error' in live) && live.value !== null
			? `${live.value} ${Math.abs(live.value) === 1 ? 'minute' : 'minutes'}`
			: null
	);

	function commit(): void {
		const result = parseFor(draft, dataType, shape());
		if ('error' in result) {
			parseError = result.error;
			onErrorChange?.(result.error);
			return;
		}
		parseError = null;
		onErrorChange?.(null);
		const wire = toWire(result.value, dataType);
		draft = toDraft(wire, dataType, shape());
		if (wire === value) return;
		value = wire;
		onValueChange?.(wire);
	}

	// Losing focus because the control was removed from the page is not a commit.
	function onblur(event: FocusEvent): void {
		if (!(event.currentTarget as HTMLElement | null)?.isConnected) return;
		editing = false;
		commit();
	}

	function onkeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') commit();
		if (event.key === 'Escape') {
			draft = toDraft(value, dataType, shape());
			parseError = null;
			onErrorChange?.(null);
		}
	}
</script>

<!--
	The numeric family.

	One control covers six data types because they differ only in what they accept: a
	`number`, a `percent` and a `timecode` take whole numbers, a `float` is rounded to
	six decimals on write, a `duration` is minutes, and a `timecode` is milliseconds.
	Nothing is clamped server-side, so the bounds here are the client's
	(sg-groundtruth `findings/field_types/*`).
-->
<div
	bind:this={ref}
	data-slot="number-editor"
	data-size={size}
	data-data-type={dataType}
	class={cn('flex w-full min-w-0 flex-col gap-2', className)}
	{...rest}
>
	<div class="relative flex w-full min-w-0 items-center">
		{#if prefix}
			<span
				aria-hidden="true"
				data-slot="number-editor-affix"
				class="text-muted-foreground pointer-events-none absolute left-2.5 text-sm select-none"
			>
				{prefix}
			</span>
		{/if}
		<Input
			bind:value={draft}
			type="text"
			inputmode={dataType === 'duration' || dataType === 'timecode' ? 'text' : 'decimal'}
			{disabled}
			{readonly}
			{placeholder}
			class={cn('tabular-nums', BOX[size], prefix && 'pl-7', suffix && 'pr-7')}
			aria-invalid={isInvalid}
			aria-label={field?.displayName}
			aria-required={field?.mandatory}
			onfocus={() => (editing = true)}
			{onblur}
			{onkeydown}
		/>
		{#if suffix}
			<span
				aria-hidden="true"
				data-slot="number-editor-affix"
				class="text-muted-foreground pointer-events-none absolute right-2.5 text-sm select-none"
			>
				{suffix}
			</span>
		{/if}
	</div>
	{#if showHint && hint}
		<p data-slot="number-editor-hint" class="text-muted-foreground text-xs tabular-nums">{hint}</p>
	{/if}
	{#if message}
		{#if errorMessage}
			{@render errorMessage(message)}
		{:else}
			<p data-slot="field-editor-error" class="text-destructive text-xs">{message}</p>
		{/if}
	{/if}
</div>
