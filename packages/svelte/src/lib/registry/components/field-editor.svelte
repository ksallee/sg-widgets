<script lang="ts" module>
	import type {
		EditorKind,
		EditorPlacement,
		EntityRef,
		FieldSchema,
		SgContext,
		StatusRecord,
		UrlValue,
		UrlWriteValue
	} from '@sg-widgets/core';
	import { editorNeedsContext } from '@sg-widgets/core';

	export type FieldEditorMode = 'display' | 'edit';
	export type FieldEditorSize = 'sm' | 'md' | 'lg';
	export type FieldEditorPlacement = EditorPlacement;

	/** The display half, which is also the popover's anchor. */
	const DISPLAY =
		'focus-visible:ring-ring focus-visible:ring-offset-background hover:bg-accent hover:text-accent-foreground flex w-full min-w-0 cursor-text items-center rounded-md px-2 py-1.5 transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-offset-2';

	/** The same anchor where the caller draws the value itself, as a table cell does. */
	const ANCHOR = 'flex w-full min-w-0 items-center text-left outline-none';

	/** The popups an editor opens. Each is portalled out of the widget's own tree. */
	/** The control the popover focused on open keeps its ring for the keyboard only. */
	const QUIET_FOCUS =
		'[&_[data-quiet-focus]:focus-visible]:border-input [&_[data-quiet-focus]:focus-visible]:ring-0';
	const POPUP = '[data-slot="popover-content"],[data-slot="select-content"],[data-picker]';

	/**
	 * True while focus is still somewhere the edit session owns. A popover, a select
	 * popup and a picker list are portalled out of the widget, so containment alone is
	 * not enough.
	 */
	function stillEditing(root: HTMLElement | null): boolean {
		const active = document.activeElement;
		if (!root || !(active instanceof HTMLElement)) return false;
		if (root.contains(active)) return true;
		return active.closest(POPUP) !== null;
	}

	/** The facts a teardown path needs, taken when the session opens and never re-read. */
	interface EditSession {
		editable: boolean;
		root: HTMLElement | null;
	}

	/**
	 * Whether the type's editor can be drawn. A picker reads through the context and
	 * needs the schema to say what it offers: a status its entity type, a link its valid
	 * types. Without either the field stays on the display half.
	 */
	function canDraw(
		kind: EditorKind,
		dataType: string,
		context: SgContext | undefined,
		field: FieldSchema | null
	): boolean {
		if (kind === 'none') return false;
		if (!editorNeedsContext(dataType)) return true;
		if (context === undefined) return false;
		return kind === 'status_list' ? Boolean(field?.entityType) : (field?.validTypes?.length ?? 0) > 0;
	}
</script>

<script lang="ts">
	import { onMount, onDestroy, type Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { editorKindFor, preferencesOf } from '@sg-widgets/core';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import CheckboxEditor from '$lib/registry/components/checkbox-editor.svelte';
	import ColorEditor from '$lib/registry/components/color-editor.svelte';
	import DateEditor from '$lib/registry/components/date-editor.svelte';
	import DateTimeEditor from '$lib/registry/components/date-time-editor.svelte';
	import EntityMultiPicker from '$lib/registry/components/entity-multi-picker.svelte';
	import EntityPicker from '$lib/registry/components/entity-picker.svelte';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import ListSelect from '$lib/registry/components/list-select.svelte';
	import NumberEditor from '$lib/registry/components/number-editor.svelte';
	import StatusPicker from '$lib/registry/components/status-picker.svelte';
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
		/** Where the editor opens: in place, or in a popover anchored to the display half. */
		editorPlacement?: FieldEditorPlacement;
		/** `Status` rows by code, for the display half (probe 010). */
		statuses?: Record<string, StatusRecord> | null;
		/** The widget context: the site preferences, and what the display half reads. */
		context?: SgContext;
		/** The site's `hours_per_day` from `GET /preferences` (field_types/duration). Defaults to the context's. */
		hoursPerDay?: number;
		/** Frames per second, for the `HH:MM:SS:FF` form (field_types/timecode). Defaults to the context's. */
		frameRate?: number;
		/** Decimals on a float. */
		precision?: number;
		/** Shown before the value on a currency field. */
		symbol?: string;
		/**
		 * The project the schema was read with. It subtracts a list field's hidden values
		 * (probe 009), scopes a status picker to the codes the project allows, and scopes
		 * an entity picker's search.
		 */
		projectId?: number;
		/** IANA zone a typed wall-clock time is read in. Defaults to the context's, then to the runtime's. */
		timeZone?: string;
		/** Defaults to the context's. */
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
		editorPlacement = 'inline',
		statuses = null,
		context,
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

	// The site's preferences, with anything the caller named winning over them.
	const prefs = $derived({
		...preferencesOf(context),
		...(hoursPerDay === undefined ? {} : { hoursPerDay }),
		...(locale === undefined ? {} : { locale }),
		...(timeZone === undefined ? {} : { timeZone }),
		...(frameRate === undefined ? {} : { frameRate })
	});

	const type = $derived(dataType ?? field?.dataType ?? 'text');
	const kind = $derived(editorKindFor(String(type)));
	/** Types a link field may point at. An entity picker has nothing to search without them. */
	const linkTypes = $derived(field?.validTypes ?? []);
	const hasEditor = $derived(canDraw(kind, String(type), context, field));
	const canEdit = $derived(hasEditor && !disabled && !readonly);
	const editing = $derived(mode === 'edit' && hasEditor);
	const popover = $derived(editorPlacement === 'popover');
	/** The field's own name, over the control. */
	const label = $derived(field?.displayName ?? field?.name ?? '');
	/** A multi-entity list needs the room; everything else reads in the narrow one. */
	const width = $derived(kind === 'multi_entity' ? 'w-96' : 'w-72');

	let display = $state<HTMLElement | null>(null);
	let anchor = $state<HTMLButtonElement | null>(null);
	let content = $state<HTMLElement | null>(null);
	let original = $state<unknown>(null);
	// The editor below reports its parse error here. An edit session stays open while
	// one stands, because invalid input emits nothing and would otherwise be dropped.
	let liveError = $state<string | null>(null);

	/**
	 * The open session, and whether this component is still on the page. Both are plain
	 * values: a commit takes the editor away, and everything that runs after it -- a
	 * blur, a queued frame -- would otherwise read a derived belonging to an effect
	 * that is already gone.
	 */
	let session: EditSession | null = null;
	let alive = true;
	onDestroy(() => {
		alive = false;
		session = null;
	});

	// A caller can mount this already in edit mode, as a table cell does, and the
	// teardown paths below read the session rather than the props.
	onMount(() => {
		if (!editing) return;
		original = value;
		session = { editable, root: ref };
	});

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
		session = { editable, root: ref };
		setMode('edit');
		// A popover focuses its own control in onOpenAutoFocus.
		if (popover) return;
		// The control does not exist until the toggle has rendered.
		requestAnimationFrame(() => {
			if (!alive) return;
			ref?.querySelector<HTMLElement>('input, textarea, [data-slot$="-trigger"]')?.focus({ preventScroll: true });
		});
	}

	function close(restore: boolean): void {
		if (mode === 'display') return;
		// Focus comes off the control before the control goes, so its own blur handler
		// commits what it holds while the editor is still on the page. The popover's
		// control is portalled, so it is looked for there too.
		const active = document.activeElement;
		if (active instanceof HTMLElement && (ref?.contains(active) || content?.contains(active))) active.blur();
		// A cancel undoes what that blur emitted, so a caller holding a draft has the
		// value the session opened on.
		if (restore) emit(original);
		session = null;
		liveError = null;
		setMode('display');
		requestAnimationFrame(() => {
			if (alive) (display ?? anchor)?.focus({ preventScroll: true });
		});
	}

	function leave(): void {
		close(false);
	}

	function cancel(): void {
		close(true);
	}

	/** The popover is open exactly while the session is. */
	function setPopoverOpen(next: boolean): void {
		if (next === editing) return;
		if (next) enter();
		else leave();
	}

	function onDisplayKeydown(event: KeyboardEvent): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			enter();
		}
	}

	function onEditKeydown(event: KeyboardEvent): void {
		if (session === null) return;
		// Enter on a control that opens its own popup opens it, and Enter in a picker's
		// search box chooses a row; the session stays until the popup is done with it.
		const target = event.target as HTMLElement | null;
		const inPopupControl = target?.closest('[data-slot$="-trigger"],[role="combobox"]') != null;
		// The editor commits on the same Enter, and its handler runs first on the way up.
		// The toggle waits a frame so that commit has settled before the control goes.
		if (event.key === 'Enter' && !inPopupControl && liveError === null && !(multiline && kind === 'text')) {
			requestAnimationFrame(() => {
				if (alive) leave();
			});
		}
		if (event.key === 'Escape') cancel();
	}

	// A press outside the session commits and closes it. A popover dismisses itself.
	$effect(() => {
		if (!editing || !editable || popover) return;
		const onOutside = (event: PointerEvent): void => {
			const target = event.target as Element | null;
			if (target === null || ref?.contains(target) || target.closest(POPUP) !== null) return;
			leave();
		};
		document.addEventListener('pointerdown', onOutside, true);
		return () => document.removeEventListener('pointerdown', onOutside, true);
	});

	function onEditFocusOut(): void {
		// The snapshot, never the props: the commit this blur follows may already have
		// taken the session away.
		const open = session;
		if (open === null || !open.editable) return;
		requestAnimationFrame(() => {
			if (!alive || session !== open) return;
			if (liveError === null && !stillEditing(open.root)) leave();
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
	the other. A status, an entity link and a multi-entity link open their picker, which
	reads through the context; without a context, or without the schema those pickers
	need, the field stays on the display half, as a calculated column always does.
-->
<div
	bind:this={ref}
	data-slot="field-editor"
	data-data-type={type}
	data-mode={editing ? 'edit' : 'display'}
	data-placement={editorPlacement}
	data-size={size}
	class={cn('flex w-full min-w-0 flex-col gap-2', className)}
	onkeydown={editing ? onEditKeydown : undefined}
	onfocusout={editing ? onEditFocusOut : undefined}
	{...rest}
>
	{#if editing && !popover}
		{@render control()}
	{:else if popover && (editing || (editable && canEdit))}
		<Popover.Root bind:open={() => editing, setPopoverOpen}>
			<Popover.Trigger
				bind:ref={anchor}
				data-slot="field-editor-display"
				aria-label={field?.displayName ? `Edit ${field.displayName}` : 'Edit'}
				class={cn(editable ? DISPLAY : ANCHOR)}
			>
				{@render shown()}
			</Popover.Trigger>
			<!-- Fixed: the cell under the editor scrolls with the table body, and an absolute
			     wrapper would stay where the page was when it opened. -->
			<Popover.Content
				bind:ref={content}
				data-field-editor-popover=""
				strategy="fixed"
				align="start"
				onOpenAutoFocus={(event) => {
					event.preventDefault();
					const control = content?.querySelector<HTMLElement>('input, textarea, [data-slot$="-trigger"]');
					control?.focus({ preventScroll: true });
					// Focus the popover placed itself draws no ring; the first key gives it back.
					if (control) control.dataset.quietFocus = '';
				}}
				onEscapeKeydown={(event) => {
					event.preventDefault();
					cancel();
				}}
				onkeydown={(event) => {
					delete (event.target as HTMLElement | null)?.dataset.quietFocus;
					onEditKeydown(event);
				}}
				class={cn(QUIET_FOCUS, 'gap-3 p-3', width)}
			>
				{#if label}
					<span data-slot="field-editor-label" class="text-muted-foreground text-xs">{label}</span>
				{/if}
				{@render control()}
				<div class="flex items-center justify-end gap-2">
					<Button data-slot="field-editor-cancel" variant="ghost" size="sm" onclick={cancel}>Cancel</Button>
					<Button data-slot="field-editor-save" size="sm" onclick={leave}>Save</Button>
				</div>
			</Popover.Content>
		</Popover.Root>
	{:else if editable && canEdit}
		<span
			bind:this={display}
			role="button"
			tabindex="0"
			data-slot="field-editor-display"
			aria-label={field?.displayName ? `Edit ${field.displayName}` : 'Edit'}
			class={DISPLAY}
			onclick={enter}
			onkeydown={onDisplayKeydown}
		>
			{@render shown()}
		</span>
	{:else}
		{@render shown()}
	{/if}
</div>

{#snippet shown()}
		<FieldValue
			{value}
			dataType={String(type)}
			{field}
			{statuses}
			{context}
			hoursPerDay={prefs.hoursPerDay}
			locale={prefs.locale}
			timeZone={prefs.timeZone}
			frameRate={prefs.frameRate}
			{precision}
			currencySymbol={symbol ?? '$'}
			{emptyLabel}
		/>
{/snippet}

{#snippet control()}
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
				hoursPerDay={prefs.hoursPerDay}
				frameRate={prefs.frameRate}
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
				timeZone={prefs.timeZone}
				{size}
				{disabled}
				{readonly}
				{invalid}
				{error}
				onErrorChange={noteError}
				{errorMessage}
			/>
		{:else if kind === 'list'}
			<ListSelect
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
		{:else if kind === 'color'}
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
		{:else if kind === 'status_list' && context}
			<StatusPicker
				{context}
				entityType={field?.entityType ?? ''}
				field={field?.name}
				{projectId}
				value={typeof value === 'string' ? value : undefined}
				onValueChange={(next: string | undefined) => emit(next ?? null)}
				{size}
				{disabled}
				{readonly}
				{invalid}
			/>
		{:else if kind === 'entity' && context}
			<EntityPicker
				{context}
				entityTypes={linkTypes}
				{projectId}
				value={(value ?? null) as EntityRef | null}
				onValueChange={(next: EntityRef | null) => emit(next)}
				{size}
				{disabled}
				{readonly}
				{invalid}
			/>
		{:else if kind === 'multi_entity' && context}
			<EntityMultiPicker
				{context}
				entityTypes={linkTypes}
				{projectId}
				value={Array.isArray(value) ? (value as EntityRef[]) : []}
				onValueChange={(next: EntityRef[]) => emit([...next])}
				{size}
				{disabled}
				{readonly}
				{invalid}
			/>
		{/if}
{/snippet}
