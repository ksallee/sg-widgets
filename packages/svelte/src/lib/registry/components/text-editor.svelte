<script lang="ts" module>
	export type TextEditorSize = 'sm' | 'md' | 'lg';

	/** The control ladder of `docs/design-rules.md`: 8 / 9 / 10. */
	const BOX: Record<TextEditorSize, string> = {
		sm: 'h-8 px-2',
		md: 'h-9 px-3',
		lg: 'h-10 px-3'
	};
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema } from '@sg-widgets/core';
	import { parseTextInput } from '@sg-widgets/core';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Textarea } from '$lib/components/ui/textarea/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'oninput'>, HTMLDivElement> & {
		/** The stored string, or null. There is no empty string in the store (field_types/text). */
		value?: string | null;
		onValueChange?: (value: string | null) => void;
		/** The field schema, for the label and the placeholder. */
		field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
		/** A textarea instead of a single-line input. Newlines survive a one-line field either way. */
		multiline?: boolean;
		rows?: number;
		size?: TextEditorSize;
		disabled?: boolean;
		readonly?: boolean;
		/** Forced invalid state. A failed parse sets it on its own. */
		invalid?: boolean;
		/** A message from the caller, shown in place of the parse error. */
		error?: string | null;
		onErrorChange?: (error: string | null) => void;
		placeholder?: string;
		/** Renders the message. Default is a small destructive line under the control. */
		errorMessage?: Snippet<[string]>;
	};

	let {
		value = $bindable(null),
		onValueChange,
		field = null,
		multiline = false,
		rows = 3,
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

	let draft = $state(value ?? '');
	let parseError = $state<string | null>(null);
	// The input is uncontrolled while it has focus, so typing is never fought by an
	// incoming value; an outside change lands as soon as the field is left.
	let editing = $state(false);

	$effect(() => {
		const incoming = value ?? '';
		if (!editing) draft = incoming;
	});

	const message = $derived(error ?? parseError);
	const isInvalid = $derived(invalid || message !== null);

	function commit(): void {
		const result = parseTextInput(draft);
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

	function onkeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' && !multiline) commit();
		if (event.key === 'Escape') {
			draft = value ?? '';
			parseError = null;
			onErrorChange?.(null);
		}
	}
</script>

<!--
	A `text` field.

	Both ends of the value are stripped on write and an empty string is stored as null,
	so clearing the input and clearing the field are the same act; there is no "set but
	blank" state to round-trip (field_types/text).
-->
<div
	bind:this={ref}
	data-slot="text-editor"
	data-size={size}
	class={cn('flex w-full min-w-0 flex-col gap-2', className)}
	{...rest}
>
	{#if multiline}
		<Textarea
			bind:value={draft}
			{rows}
			{disabled}
			{readonly}
			{placeholder}
			aria-invalid={isInvalid}
			aria-label={field?.displayName}
			aria-required={field?.mandatory}
			onfocus={() => (editing = true)}
			{onblur}
			{onkeydown}
		/>
	{:else}
		<Input
			bind:value={draft}
			type="text"
			{disabled}
			{readonly}
			{placeholder}
			class={BOX[size]}
			aria-invalid={isInvalid}
			aria-label={field?.displayName}
			aria-required={field?.mandatory}
			onfocus={() => (editing = true)}
			{onblur}
			{onkeydown}
		/>
	{/if}
	{#if message}
		{#if errorMessage}
			{@render errorMessage(message)}
		{:else}
			<p data-slot="field-editor-error" class="text-destructive text-xs">{message}</p>
		{/if}
	{/if}
</div>
