<script lang="ts" module>
	import type { ControlSize } from '$lib/registry/components/control-classes.js';

	export type UrlEditorSize = ControlSize;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema, UrlValue, UrlWriteValue } from '@sg-widgets/core';
	import { parseUrlInput } from '@sg-widgets/core';
	import { Input } from '$lib/components/ui/input/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { CONTROL_BOX } from '$lib/registry/components/control-classes.js';
	import FieldError from '$lib/registry/components/field-error.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The stored object. Only the web-link shape is edited here (field_types/url). */
		value?: UrlValue | null;
		onValueChange?: (value: UrlWriteValue | null) => void;
		field?: Pick<FieldSchema, 'displayName' | 'mandatory'> | null;
		size?: UrlEditorSize;
		disabled?: boolean;
		readonly?: boolean;
		invalid?: boolean;
		error?: string | null;
		onErrorChange?: (error: string | null) => void;
		placeholder?: string;
		/** The placeholder of the second input. */
		namePlaceholder?: string;
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
		placeholder = 'https://example.com/plate.mov',
		namePlaceholder = 'Name',
		errorMessage,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	let urlDraft = $state('');
	let nameDraft = $state('');
	let parseError = $state<string | null>(null);
	let editing = $state(false);

	$effect(() => {
		if (editing) return;
		urlDraft = value?.url ?? '';
		nameDraft = value?.name ?? '';
	});

	const message = $derived(error ?? parseError);
	const isInvalid = $derived(invalid || message !== null);
	// A local value carries paths and no url at all; uploads and local paths are not
	// edited here, so the control says so rather than showing an empty box
	// (field_types/url).
	const localOnly = $derived(value?.link_type === 'local');

	function commit(): void {
		const result = parseUrlInput(urlDraft, nameDraft);
		if ('error' in result) {
			parseError = result.error;
			onErrorChange?.(result.error);
			return;
		}
		parseError = null;
		onErrorChange?.(null);
		urlDraft = result.value?.url ?? '';
		nameDraft = result.value?.name ?? '';
		value = result.value;
		onValueChange?.(result.value);
	}

	function reset(): void {
		urlDraft = value?.url ?? '';
		nameDraft = value?.name ?? '';
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
	A `url` field, as a web link.

	The only accepted write is an object holding `url`: a bare string is a 400, the url
	itself is validated, and a raw space is the one character measured to fail. With no
	name the field reads back the whole url as its name. Uploads mint an Attachment
	through a separate flow and are out of scope here (field_types/url).
-->
<div
	bind:this={ref}
	data-slot="url-editor"
	data-size={size}
	class={cn('flex w-full min-w-0 flex-col gap-2', className)}
	{...rest}
>
	<div class="flex w-full min-w-0 flex-col gap-2">
		<Input
			bind:value={urlDraft}
			type="text"
			data-slot="url-editor-url"
			disabled={disabled || localOnly}
			{readonly}
			{placeholder}
			class={CONTROL_BOX[size]}
			aria-invalid={isInvalid}
			aria-label={field?.displayName}
			aria-required={field?.mandatory}
			onfocus={() => (editing = true)}
			{onblur}
			{onkeydown}
		/>
		<Input
			bind:value={nameDraft}
			type="text"
			data-slot="url-editor-name"
			disabled={disabled || localOnly}
			{readonly}
			placeholder={namePlaceholder}
			class={CONTROL_BOX[size]}
			aria-invalid={isInvalid}
			aria-label="Link name"
			onfocus={() => (editing = true)}
			{onblur}
			{onkeydown}
		/>
	</div>
	{#if localOnly}
		<p data-slot="url-editor-note" class="text-muted-foreground text-xs">
			This value is a local path. Only web links are edited here.
		</p>
	{/if}
	<FieldError {message} {errorMessage} />
</div>
