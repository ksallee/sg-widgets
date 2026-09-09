<script lang="ts" module>
	export type FieldEditorMode = 'display' | 'edit';
	export type FieldEditorSize = 'sm' | 'md' | 'lg';

	/**
	 * True while focus is still somewhere the edit session owns. A popover and a select
	 * popup are portalled out of the widget, so containment alone is not enough.
	 */
	function stillEditing(root: HTMLElement | null): boolean {
		const active = document.activeElement;
		if (!root || !(active instanceof HTMLElement)) return false;
		if (root.contains(active)) return true;
		return active.closest('[data-slot="popover-content"],[data-slot="select-content"]') !== null;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema, StatusRecord, UrlValue, UrlWriteValue } from '@sg-widgets/core';
	import { editorKindFor } from '@sg-widgets/core';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import CheckboxEditor from '$lib/registry/components/checkbox-editor.svelte';
	import ColorEditor from '$lib/registry/components/color-editor.svelte';
	import DateEditor from '$lib/registry/components/date-editor.svelte';
	import DateTimeEditor from '$lib/registry/components/date-time-editor.svelte';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import ListEditor from '$lib/registry/components/list-editor.svelte';
	import NumberEditor from '$lib/registry/components/number-editor.svelte';
	import TextEditor from '$lib/registry/components/text-editor.svelte';
	import UrlEditor from '$lib/registry/components/url-editor.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'onchange'>, HTMLDivElement> & {
		/** The raw attribute value, exactly as the API returned it. */
		value?: unknown;
		onValueChange?: (value: unknown) => void;
		/** The field's `data_type`. Falls back to the schema's, then to text. */
		dataType?: string;
		field?: FieldSchema | null;
		/** Which half is showing. Bindable, so a caller can drive the toggle. */
		mode?: FieldEditorMode;
		onModeChange?: (mode: FieldEditorMode) => void;
		/** Display mode turns into edit mode on click or Enter. */
		editable?: boolean;
		/** `Status` rows by code, for the display half (probe 010). */
		statuses?: Record<string, StatusRecord> | null;
		/** The site's `hours_per_day` from `GET /preferences` (field_types/duration). */
		hoursPerDay?: number;
		/** Frames per second, for the `HH:MM:SS:FF` form (field_types/timecode). */
		frameRate?: number;
		/** Decimals on a float. */
		precision?: number;
		/** Shown before the value on a currency field. */
		symbol?: string;
		/** The project the schema was read with, for the hidden-value subtraction (probe 009). */
		projectId?: number;
		/** IANA zone a typed wall-clock time is read in. */
		timeZone?: string;
		locale?: string;
		/** A textarea instead of an input, on a text field. */
		multiline?: boolean;
		size?: FieldEditorSize;
		disabled?: boolean;
		readonly?: boolean;
		invalid?: boolean;
		error?: string | null;
		onErrorChange?: (error: string | null) => void;
		placeholder?: string;
		/** What the display half shows for an unset value. */
		emptyLabel?: string;
		errorMessage?: Snippet<[string]>;
	};

	let {
		value = $bindable(null),
		onValueChange,
		dataType,
		field = null,
		mode = $bindable('display'),
		onModeChange,
		editable = false,
		statuses = null,
		hoursPerDay,
		frameRate,
		precision,
		symbol,
		projectId,
		timeZone,
		locale,
		multiline = false,
		size = 'md',
		disabled = false,
		readonly = false,
		invalid = false,
		error = null,
		onErrorChange,
		placeholder,
		emptyLabel = 'empty',
		errorMessage,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const type = $derived(dataType ?? field?.dataType ?? 'text');
	const kind = $derived(editorKindFor(String(type)));
	// Status and entity fields are edited by the picker widgets, not here.
	const canEdit = $derived(kind !== 'none' && !disabled && !readonly);
	const editing = $derived(mode === 'edit' && kind !== 'none');

	let display = $state<HTMLElement | null>(null);
	let original = $state<unknown>(null);
	// The editor below reports its parse error here. An edit session stays open while
	// one stands, because invalid input emits nothing and would otherwise be dropped.
	let liveError = $state<string | null>(null);

	function noteError(next: string | null): void {
		liveError = next;
		onErrorChange?.(next);
	}

	function setMode(next: FieldEditorMode): void {
		if (mode === next) return;
		mode = next;
		onModeChange?.(next);
	}

	function enter(): void {
		if (!canEdit || mode === 'edit') return;
		original = value;
		setMode('edit');
		// The control does not exist until the toggle has rendered.
		requestAnimationFrame(() => {
			ref?.querySelector<HTMLElement>('input, textarea, [data-slot="select-trigger"]')?.focus({ preventScroll: true });
		});
	}

	function leave(): void {
		if (mode === 'display') return;
		liveError = null;
		setMode('display');
		requestAnimationFrame(() => display?.focus({ preventScroll: true }));
	}

	function cancel(): void {
		// Nothing has been emitted yet: an editor emits on Enter or on losing focus.
		value = original;
		leave();
	}

	function onDisplayKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			enter();
		}
	}

	function onEditKeydown(event: KeyboardEvent): void {
		if (!editable) return;
		// The editor commits on the same Enter, and its handler runs first on the way up.
		// The toggle waits a frame so that commit has settled before the control goes.
		if (event.key === 'Enter' && liveError === null && !(multiline && kind === 'text')) {
			requestAnimationFrame(leave);
		}
		if (event.key === 'Escape') cancel();
	}

	function onEditFocusOut(): void {
		if (!editable) return;
		requestAnimationFrame(() => {
			if (liveError === null && !stillEditing(ref)) leave();
		});
	}

	function emit(next: unknown): void {
		value = next;
		onValueChange?.(next);
	}
</script>

<!--
	One field, displayed or edited.

	The data type picks the editor, and the pair behind this toggle is the same one a
	caller can use directly: FieldValue on the display half, the type's own editor on
	the other. A field whose type has no editor here -- a status, an entity link, a
	calculated column -- never leaves the display half.
-->
<div
	bind:this={ref}
	data-slot="field-editor"
	data-data-type={type}
	data-mode={editing ? 'edit' : 'display'}
	data-size={size}
	class={cn('flex w-full min-w-0 flex-col gap-2', className)}
	onkeydown={editing ? onEditKeydown : undefined}
	onfocusout={editing ? onEditFocusOut : undefined}
	{...rest}
>
	{#if editing}
		{#if kind === 'text'}
			<TextEditor
				value={value as string | null}
				onValueChange={emit}
				field={field ?? null}
				{multiline}
				{size}
				{disabled}
				{readonly}
				{invalid}
				{error}
				onErrorChange={noteError}
				{placeholder}
				{errorMessage}
			/>
		{:else if kind === 'number'}
			<NumberEditor
				value={value as number | string | null}
				onValueChange={emit}
				dataType={type as 'number'}
				field={field ?? null}
				{precision}
				{hoursPerDay}
				{frameRate}
				symbol={symbol ?? '$'}
				{size}
				{disabled}
				{readonly}
				{invalid}
				{error}
				onErrorChange={noteError}
				{placeholder}
				{errorMessage}
			/>
		{:else if kind === 'checkbox'}
			<CheckboxEditor
				value={value === true}
				onValueChange={emit}
				field={field ?? null}
				{size}
				{disabled}
				{readonly}
				{invalid}
				{error}
				{placeholder}
				{errorMessage}
			/>
		{:else if kind === 'date'}
			<DateEditor
				value={value as string | null}
				onValueChange={emit}
				field={field ?? null}
				{size}
				{disabled}
				{readonly}
				{invalid}
				{error}
				onErrorChange={noteError}
				{errorMessage}
			/>
		{:else if kind === 'date_time'}
			<DateTimeEditor
				value={value as string | null}
				onValueChange={emit}
				field={field ?? null}
				{timeZone}
				{size}
				{disabled}
				{readonly}
				{invalid}
				{error}
				onErrorChange={noteError}
				{errorMessage}
			/>
		{:else if kind === 'list'}
			<ListEditor
				value={value as string | null}
				onValueChange={emit}
				field={field ?? null}
				{projectId}
				{size}
				{disabled}
				{readonly}
				{invalid}
				{error}
				{errorMessage}
			/>
		{:else if kind === 'url'}
			<UrlEditor
				value={value as UrlValue | null}
				onValueChange={(next: UrlWriteValue | null) => emit(next)}
				field={field ?? null}
				{size}
				{disabled}
				{readonly}
				{invalid}
				{error}
				onErrorChange={noteError}
				{errorMessage}
			/>
		{:else}
			<ColorEditor
				value={value as string | null}
				onValueChange={emit}
				field={field ?? null}
				{size}
				{disabled}
				{readonly}
				{invalid}
				{error}
				onErrorChange={noteError}
				{errorMessage}
			/>
		{/if}
	{:else if editable && canEdit}
		<span
			bind:this={display}
			role="button"
			tabindex="0"
			data-slot="field-editor-display"
			aria-label={field?.displayName ? `Edit ${field.displayName}` : 'Edit'}
			class="focus-visible:ring-ring focus-visible:ring-offset-background hover:bg-accent hover:text-accent-foreground flex w-full min-w-0 cursor-text items-center rounded-md px-2 py-1.5 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
			onclick={enter}
			onkeydown={onDisplayKeydown}
		>
			<FieldValue
				{value}
				dataType={String(type)}
				{field}
				{statuses}
				{hoursPerDay}
				{locale}
				{precision}
				{emptyLabel}
			/>
		</span>
	{:else}
		<FieldValue
			{value}
			dataType={String(type)}
			{field}
			{statuses}
			{hoursPerDay}
			{locale}
			{precision}
			{emptyLabel}
		/>
	{/if}
</div>
