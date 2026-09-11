<script lang="ts" module>
	import {
		formatDuration,
		formatNumberInput,
		formatTimecode,
		formatTimecodeFrames,
		numberSteps,
		parseDurationInput,
		parseFloatInput,
		parseInteger,
		parseTimecodeInput,
		stepNumber,
		toApiFloat,
		unformatNumberInput,
		type ParseResult
	} from '@sg-widgets/core';

	import type { ControlSize } from '$lib/registry/components/control-classes.js';

	export type NumberEditorSize = ControlSize;

	/** A stepper is the square of the control it steps. */
	const STEPPER: Record<NumberEditorSize, string> = {
		sm: 'size-8',
		md: 'size-9',
		lg: 'size-10'
	};

	/** The hold before a pressed stepper repeats, and the gap between repeats. */
	const HOLD_DELAY = 400;
	const HOLD_TICK = 60;

	/** Pixels of drag one step of the scrub area costs. */
	const SCRUB_PIXELS = 2;

	/** Steps taken at once by Shift and by Page Up or Page Down. */
	const SHIFT_STEPS = 10;
	const PAGE_STEPS = 100;

	interface Shape {
		hoursPerDay?: number;
		frameRate?: number;
		precision?: number;
		min?: number;
		max?: number;
		locale?: string;
	}

	/** The types whose input is a plain number, and so is written in the locale's marks. */
	const LOCALE_TYPES = ['number', 'float', 'percent', 'currency'];

	/**
	 * The comfortable width of each numeric type, in `inline` form: eight characters of
	 * number, eleven of timecode.
	 */
	const INLINE_WIDTH: Record<string, string> = {
		number: 'w-24',
		float: 'w-24',
		percent: 'w-24',
		currency: 'w-24',
		duration: 'w-24',
		timecode: 'w-28'
	};

	/** The stored value as the string the input shows. Each type round-trips through its own parse. */
	function toDraft(value: unknown, dataType: string, shape: Shape): string {
		if (value === null || value === undefined || value === '') return '';
		const n = Number(value);
		switch (dataType) {
			case 'float':
			case 'currency':
				return Number.isFinite(n)
					? formatNumberInput(n, {
							...(shape.locale === undefined ? {} : { locale: shape.locale }),
							...(shape.precision === undefined ? {} : { decimals: shape.precision })
						})
					: String(value);
			case 'duration':
				// Hours and minutes, never days: a day rendering rounds and would not survive a
				// round trip through the parse. The working day is a parse unit only.
				return formatDuration(n);
			case 'timecode':
				return shape.frameRate === undefined ? formatTimecode(n) : formatTimecodeFrames(n, shape.frameRate);
			default:
				return Number.isFinite(n)
					? formatNumberInput(n, shape.locale === undefined ? {} : { locale: shape.locale })
					: String(value);
		}
	}

	/** What the parsers read: the locale's group and decimal marks are undone first. */
	function toDigits(raw: string, dataType: string, shape: Shape): string {
		if (!LOCALE_TYPES.includes(dataType)) return raw;
		return unformatNumberInput(raw, shape.locale);
	}

	function parseFor(raw: string, dataType: string, shape: Shape): ParseResult<number | null> {
		const text = toDigits(raw, dataType, shape);
		switch (dataType) {
			case 'float':
			case 'currency':
				return parseFloatInput(text, shape.precision === undefined ? {} : { precision: shape.precision });
			case 'duration':
				return parseDurationInput(text, shape.hoursPerDay === undefined ? {} : { hoursPerDay: shape.hoursPerDay });
			case 'timecode':
				return parseTimecodeInput(text, shape.frameRate === undefined ? {} : { frameRate: shape.frameRate });
			default: {
				const bounds: { min?: number; max?: number } = {};
				if (shape.min !== undefined) bounds.min = shape.min;
				if (shape.max !== undefined) bounds.max = shape.max;
				return parseInteger(text, bounds);
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

	/** The stored value as the number the steppers and the spinbutton role work on. */
	function toNumber(value: number | string | null | undefined): number | null {
		if (value === null || value === undefined || value === '') return null;
		const n = Number(value);
		return Number.isFinite(n) ? n : null;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema } from '@sg-widgets/core';
	import { Input } from '$lib/components/ui/input/index.js';
	import { buttonVariants } from '$lib/components/ui/button/index.js';
	import Minus from '@lucide/svelte/icons/minus';
	import Plus from '@lucide/svelte/icons/plus';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { CONTROL_BOX, CONTROL_GLYPH } from '$lib/registry/components/control-classes.js';
	import FieldError from '$lib/registry/components/field-error.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The stored value. A float arrives quoted, the rest as bare numbers (field_types/float). */
		value?: number | string | null;
		onValueChange?: (value: number | string | null) => void;
		/** Which numeric type is being edited. Picks the parse, the format, the affix and the step. */
		dataType?: 'number' | 'float' | 'percent' | 'duration' | 'timecode' | 'currency';
		field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
		/** Decimals kept on a float. The store itself keeps six (field_types/float). */
		precision?: number;
		/** The site's `hours_per_day` from `GET /preferences`, for the `d` unit (field_types/duration). */
		hoursPerDay?: number;
		/** Frames per second, for the `HH:MM:SS:FF` form and the one-frame step (field_types/timecode). */
		frameRate?: number;
		/** Shown before the value on a currency field. */
		symbol?: string;
		/** Show the stored form under the control, e.g. the minutes behind a duration. */
		hint?: boolean;
		/** Compact for one row of a form or a filter: a fixed width for the type, no hint. */
		inline?: boolean;
		min?: number;
		max?: number;
		/** What one step moves. Defaults to the step the data type reads in. */
		step?: number;
		/** Name the control and let a drag across that name change the value. */
		scrub?: boolean;
		/** The name over a scrub area. Defaults to the field's display name. */
		label?: string;
		/** Locale the value is written in. Defaults to the runtime's. */
		locale?: string;
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
		inline = false,
		min,
		max,
		step,
		scrub = false,
		label,
		locale,
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

	const inputId = $props.id();

	// A plain function, not a derived: the blur that follows this control being removed
	// would otherwise read a derived belonging to an effect that is already gone.
	function shape(): Shape {
		return { hoursPerDay, frameRate, precision, ...bounds(), locale };
	}

	/** The step and the bounds in force: the caller's where given, the data type's otherwise. */
	function bounds(): { step: number; min?: number; max?: number } {
		const fallback = numberSteps(dataType, frameRate === undefined ? {} : { frameRate });
		const resolved: { step: number; min?: number; max?: number } = { step: step ?? fallback.step };
		const low = min ?? fallback.min;
		const high = max ?? fallback.max;
		if (low !== undefined) resolved.min = low;
		if (high !== undefined) resolved.max = high;
		return resolved;
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
	const limits = $derived(bounds());
	const stored = $derived(toNumber(value));
	const atMin = $derived(stored !== null && limits.min !== undefined && stored <= limits.min);
	const atMax = $derived(stored !== null && limits.max !== undefined && stored >= limits.max);
	const name = $derived(label ?? field?.displayName ?? null);
	// Readonly keeps the value at full contrast and takes the affordances away.
	const steppers = $derived(!readonly);
	// Inline is a row of a table or a filter, where the row's width is spoken for: the
	// steppers move inside the input rather than widen the control.
	const stepperClass = $derived(
		cn(
			buttonVariants({ variant: inline ? 'ghost' : 'outline' }),
			'select-none',
			inline ? 'absolute right-0.5 z-10 h-3.5 w-5 rounded-sm p-0' : STEPPER[size]
		)
	);
	const glyphClass = $derived(inline ? 'size-3' : CONTROL_GLYPH[size]);
	const padRight = $derived(
		suffix && inline && steppers ? 'pr-12' : suffix ? 'pr-7' : inline && steppers ? 'pr-6' : undefined
	);
	// A duration is stored as a whole number of minutes and the field names no unit, so
	// the number that will be written is shown outright (field_types/duration).
	const live = $derived(parseFor(draft, dataType, shape()));
	const hint = $derived(
		dataType === 'duration' && !('error' in live) && live.value !== null
			? `${live.value} ${Math.abs(live.value) === 1 ? 'minute' : 'minutes'}`
			: null
	);

	function apply(parsed: number | null): void {
		parseError = null;
		onErrorChange?.(null);
		const wire = toWire(parsed, dataType);
		draft = toDraft(wire, dataType, shape());
		if (wire === value) return;
		value = wire;
		onValueChange?.(wire);
	}

	function commit(): void {
		const result = parseFor(draft, dataType, shape());
		if ('error' in result) {
			parseError = result.error;
			onErrorChange?.(result.error);
			return;
		}
		apply(result.value);
	}

	/** A step reads what is in the input, so a typed `1h 30m` steps from ninety. */
	function stepBy(direction: 1 | -1, multiplier: number): void {
		if (disabled || readonly) return;
		const result = parseFor(draft, dataType, shape());
		if ('error' in result) return;
		apply(stepNumber(result.value, direction, { ...limits, multiplier }));
	}

	let holdTimer: ReturnType<typeof setTimeout> | null = null;
	let heldByPointer = false;

	/** A pointer that never went down, as a test dispatches, cannot be captured. */
	function capture(event: PointerEvent): void {
		try {
			(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		} catch {
			// The drag still works off the element's own events.
		}
	}

	function startHold(direction: 1 | -1, event: PointerEvent): void {
		if (disabled || readonly || event.button !== 0) return;
		capture(event);
		heldByPointer = true;
		// The release can land anywhere, so the window is what ends the repeat.
		window.addEventListener('pointerup', endHold, { once: true });
		const multiplier = event.shiftKey ? SHIFT_STEPS : 1;
		stepBy(direction, multiplier);
		holdTimer = setTimeout(function repeat() {
			stepBy(direction, multiplier);
			holdTimer = setTimeout(repeat, HOLD_TICK);
		}, HOLD_DELAY);
	}

	function endHold(): void {
		if (holdTimer === null) return;
		clearTimeout(holdTimer);
		holdTimer = null;
	}

	// A pointer press has already stepped by the time the click lands; a click with no
	// press behind it is a programmatic one and steps once.
	function clickStep(direction: 1 | -1, event: MouseEvent): void {
		if (heldByPointer) {
			heldByPointer = false;
			return;
		}
		stepBy(direction, event.shiftKey ? SHIFT_STEPS : 1);
	}

	let scrubbing = $state(false);
	let scrubbed = 0;

	function startScrub(event: PointerEvent): void {
		if (disabled || readonly || event.button !== 0) return;
		capture(event);
		window.addEventListener('pointerup', endScrub, { once: true });
		scrubbing = true;
		scrubbed = 0;
		event.preventDefault();
	}

	function moveScrub(event: PointerEvent): void {
		if (!scrubbing) return;
		scrubbed += event.movementX;
		while (Math.abs(scrubbed) >= SCRUB_PIXELS) {
			const direction = scrubbed > 0 ? 1 : -1;
			stepBy(direction, event.shiftKey ? SHIFT_STEPS : 1);
			scrubbed -= SCRUB_PIXELS * direction;
		}
	}

	function endScrub(): void {
		scrubbing = false;
		scrubbed = 0;
	}

	$effect(() => () => endHold());

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
		if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			event.preventDefault();
			stepBy(event.key === 'ArrowUp' ? 1 : -1, event.shiftKey ? SHIFT_STEPS : 1);
		}
		if (event.key === 'PageUp' || event.key === 'PageDown') {
			event.preventDefault();
			stepBy(event.key === 'PageUp' ? 1 : -1, PAGE_STEPS);
		}
	}
</script>

<!--
	The numeric family, as a number field.

	One control covers six data types because they differ only in what they accept: a
	`number`, a `percent` and a `timecode` take whole numbers, a `float` is rounded to
	six decimals on write, a `duration` is minutes, and a `timecode` is milliseconds.
	Nothing is clamped server-side, so the bounds here are the client's
	(sg-groundtruth `findings/field_types/*`).

	The steppers, the keyboard steps and the scrub area are written here from the same
	state model the React half gets from Base UI's NumberField.

	`inline` is the form a row of a table or a filter takes: the width the type needs, the
	steppers inside the input rather than beside it, and nothing under the control.
-->
<div
	bind:this={ref}
	data-slot="number-editor"
	data-size={size}
	data-data-type={dataType}
	data-inline={inline ? 'true' : undefined}
	class={cn('flex w-full min-w-0 flex-col gap-2', inline && 'w-fit', className)}
	{...rest}
>
	{#if scrub && name}
		<span
			data-slot="number-editor-scrub-area"
			data-scrubbing={scrubbing ? 'true' : undefined}
			role="presentation"
			class="text-muted-foreground w-fit cursor-ew-resize text-xs font-medium select-none"
			onpointerdown={startScrub}
			onpointermove={moveScrub}
			onpointerup={endScrub}
			onpointercancel={endScrub}
		>
			<span data-slot="number-editor-label">{name}</span>
		</span>
	{/if}
	<div
		data-slot="number-editor-group"
		role="group"
		class={cn('flex w-full min-w-0 items-center gap-2', inline && 'relative')}
	>
		{#if steppers}
			<button
				type="button"
				data-slot="number-editor-decrement"
				aria-label="Decrease"
				aria-controls={inputId}
				tabindex={-1}
				disabled={disabled || atMin}
				class={cn(stepperClass, inline && 'bottom-0.5')}
				onpointerdown={(event) => startHold(-1, event)}
				onpointerup={endHold}
				onpointercancel={endHold}
				onclick={(event) => clickStep(-1, event)}
			>
				<Minus class={glyphClass} />
			</button>
		{/if}
		<div data-slot="number-editor-field" class="relative flex w-full min-w-0 items-center">
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
				id={inputId}
				type="text"
				role="spinbutton"
				inputmode={dataType === 'duration' || dataType === 'timecode' ? 'text' : 'decimal'}
				{disabled}
				{readonly}
				{placeholder}
				class={cn(
					'tabular-nums',
					CONTROL_BOX[size],
					prefix && 'pl-7',
					padRight,
					inline && 'shrink-0',
					inline && (INLINE_WIDTH[dataType] ?? 'w-24')
				)}
				aria-invalid={isInvalid}
				aria-label={field?.displayName}
				aria-required={field?.mandatory}
				aria-valuenow={stored ?? undefined}
				aria-valuemin={limits.min}
				aria-valuemax={limits.max}
				aria-valuetext={draft === '' ? undefined : draft}
				onfocus={() => (editing = true)}
				{onblur}
				{onkeydown}
			/>
			{#if suffix}
				<span
					aria-hidden="true"
					data-slot="number-editor-affix"
					class={cn(
						'text-muted-foreground pointer-events-none absolute text-sm select-none',
						inline && steppers ? 'right-7' : 'right-2.5'
					)}
				>
					{suffix}
				</span>
			{/if}
		</div>
		{#if steppers}
			<button
				type="button"
				data-slot="number-editor-increment"
				aria-label="Increase"
				aria-controls={inputId}
				tabindex={-1}
				disabled={disabled || atMax}
				class={cn(stepperClass, inline && 'top-0.5')}
				onpointerdown={(event) => startHold(1, event)}
				onpointerup={endHold}
				onpointercancel={endHold}
				onclick={(event) => clickStep(1, event)}
			>
				<Plus class={glyphClass} />
			</button>
		{/if}
	</div>
	{#if showHint && hint && !inline}
		<p data-slot="number-editor-hint" class="text-muted-foreground text-xs tabular-nums">{hint}</p>
	{/if}
	<FieldError {message} {errorMessage} />
</div>

