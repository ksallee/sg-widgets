<script lang="ts" module>
	import type { ControlSize } from '$lib/registry/components/control-classes.js';

	export type ColorEditorSize = ControlSize;

	/** The swatch is the square of the control beside it. */
	const SWATCH: Record<ColorEditorSize, string> = {
		sm: 'size-8',
		md: 'size-9',
		lg: 'size-10'
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema } from '@sg-widgets/core';
	import { COLOR_SENTINEL, colorToHex, parseBgColor, parseColorInput, rgbToCss } from '@sg-widgets/core';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { CONTROL_BOX } from '$lib/registry/components/control-classes.js';
	import FieldError from '$lib/registry/components/field-error.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'color'>, HTMLDivElement> & {
		/** The stored string: decimal `r,g,b`, or the pipeline-step token (field_types/color). */
		value?: string | null;
		onValueChange?: (value: string | null) => void;
		field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
		size?: ColorEditorSize;
		disabled?: boolean;
		readonly?: boolean;
		invalid?: boolean;
		error?: string | null;
		onErrorChange?: (error: string | null) => void;
		placeholder?: string;
		/** Explain the pipeline-step token under the control. */
		hint?: boolean;
		errorMessage?: Snippet<[string]>;
	};

	let {
		value = $bindable(null),
		onValueChange,
		field = null,
		size = 'md',
		disabled = false,
		readonly = false,
		invalid = false,
		error = null,
		onErrorChange,
		placeholder = '255,128,0',
		hint = true,
		errorMessage,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	let draft = $state(value ?? '');
	let parseError = $state<string | null>(null);
	let editing = $state(false);

	$effect(() => {
		const incoming = value ?? '';
		if (!editing) draft = incoming;
	});

	const message = $derived(error ?? parseError);
	const isInvalid = $derived(invalid || message !== null);
	// The swatch follows the draft, so a typed hex shows its colour before it is committed.
	const preview = $derived(parseColorInput(draft));
	const rgb = $derived('error' in preview || preview.value === null ? null : parseBgColor(preview.value));
	const sentinel = $derived(!('error' in preview) && preview.value === COLOR_SENTINEL);

	function commit(): void {
		const result = parseColorInput(draft);
		if ('error' in result) {
			parseError = result.error;
			onErrorChange?.(result.error);
			return;
		}
		parseError = null;
		onErrorChange?.(null);
		draft = result.value ?? '';
		if (result.value === value) return;
		value = result.value;
		onValueChange?.(result.value);
	}

	// Losing focus because the control was removed from the page is not a commit.
	function onblur(event: FocusEvent): void {
		if (!(event.currentTarget as HTMLElement | null)?.isConnected) return;
		editing = false;
		commit();
	}

	// The native picker answers in hex; the store wants the decimal triple.
	function pick(event: Event): void {
		const hex = (event.currentTarget as HTMLInputElement).value;
		const result = parseColorInput(hex);
		if ('error' in result) return;
		draft = result.value ?? '';
		commit();
	}

	function onkeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter') commit();
		if (event.key === 'Escape') {
			draft = value ?? '';
			parseError = null;
			onErrorChange?.(null);
		}
	}
</script>

<!--
	A `color` field.

	The stored form is decimal `r,g,b` with no spaces and no `#`; hex is rejected on
	write and inside a filter, so a hex code typed here is converted before it is
	emitted. `Task.color` also takes the token `pipeline_step`, which is the only way
	to un-set it: a written null is a 400 (field_types/color).
-->
<div
	bind:this={ref}
	data-slot="color-editor"
	data-size={size}
	class={cn('flex w-full min-w-0 flex-col gap-2', className)}
	{...rest}
>
	<div class="flex w-full min-w-0 items-center gap-2">
		<label
			data-slot="color-editor-swatch"
			title={disabled || readonly ? undefined : 'Pick a colour'}
			style={rgb ? `background-color:${rgbToCss(rgb)}` : undefined}
			class={cn(
				'ring-border focus-within:ring-ring focus-within:ring-offset-background relative shrink-0 overflow-hidden rounded-md ring-1 transition-shadow duration-150 focus-within:ring-2 focus-within:ring-offset-2',
				SWATCH[size],
				rgb ? undefined : 'bg-muted',
				disabled || readonly ? 'cursor-default' : 'cursor-pointer'
			)}
		>
			<input
				type="color"
				value={colorToHex(rgb ? `${rgb.r},${rgb.g},${rgb.b}` : null) ?? '#808080'}
				disabled={disabled || readonly}
				aria-label={field?.displayName ? `${field.displayName} colour` : 'Colour'}
				class="absolute inset-0 size-full cursor-[inherit] opacity-0"
				oninput={pick}
			/>
		</label>
		<Input
			bind:value={draft}
			type="text"
			{disabled}
			{readonly}
			{placeholder}
			class={cn('font-mono tabular-nums', CONTROL_BOX[size])}
			aria-invalid={isInvalid}
			aria-label={field?.displayName}
			aria-required={field?.mandatory}
			onfocus={() => (editing = true)}
			{onblur}
			{onkeydown}
		/>
	</div>
	{#if hint && sentinel}
		<p data-slot="color-editor-note" class="text-muted-foreground text-xs">
			Takes the colour of the linked pipeline step.
		</p>
	{/if}
	<FieldError {message} {errorMessage} />
</div>
