<script lang="ts" module>
	export type ValidValuesEditorSize = 'sm' | 'md' | 'lg';

	/** The data types whose schema carries valid values. */
	export type ValidValuesDataType = 'list' | 'status_list';

	/**
	 * A row is its icon buttons and its inset, and the box adds its border, so a box of
	 * one row stands on the control ladder of `docs/design-rules.md`: 28, 32 and 36.
	 */
	const ACTION: Record<ValidValuesEditorSize, 'icon-xs' | 'icon-sm'> = {
		sm: 'icon-xs',
		md: 'icon-xs',
		lg: 'icon-sm'
	};
	const ROW_BOX: Record<ValidValuesEditorSize, string> = {
		sm: 'p-px',
		md: 'p-0.75',
		lg: 'p-0.75'
	};
	/** The line a row's text stands on, as high as the buttons beside it. */
	const LINE: Record<ValidValuesEditorSize, string> = { sm: 'h-6', md: 'h-6', lg: 'h-7' };
	/** The slot the add row's glyph takes, so its text starts where a row's does. */
	const LEAD: Record<ValidValuesEditorSize, string> = { sm: 'size-6', md: 'size-6', lg: 'size-7' };

	const BOX =
		'border-input bg-background has-[input:focus-visible]:ring-ring has-[input:focus-visible]:ring-offset-background data-invalid:border-destructive data-invalid:ring-destructive/20 dark:data-invalid:ring-destructive/40 flex w-full min-w-0 flex-col rounded-lg border text-sm shadow-xs transition-colors duration-150 has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-offset-2 data-invalid:ring-2';
	const ROW =
		'bg-background flex min-w-0 items-center gap-2 rounded-md data-[dragging]:z-10 data-[dragging]:opacity-90 data-[dragging]:shadow-md data-[drop-target]:bg-accent/40';
	const INPUT =
		'placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none disabled:cursor-not-allowed';
</script>

<script lang="ts">
	import { tick } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import type { ListRow, SgContext } from 'sg-widgets-core';
	import {
		addListValues,
		moveListValue,
		replaceListValue,
		splitListValues,
		syncListRows
	} from 'sg-widgets-core';
	import GripVerticalIcon from '@lucide/svelte/icons/grip-vertical';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import { Button } from '$lib/components/ui/button/index.js';
	import { createSortable } from '$lib/registry/components/sortable.svelte.js';
	import StatusMultiPicker from '$lib/registry/components/status-multi-picker.svelte';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The field's data type: an ordered list of strings, or status codes. */
		dataType?: ValidValuesDataType;
		/** The valid values: strings in drop-down order, or status codes. */
		value?: string[];
		onValueChange?: (value: string[]) => void;
		/** The widget context. A status list picks from the site's statuses through it; without one its codes are typed. */
		context?: SgContext;
		/** Drop a value the list already holds. Off: a repeated value is kept. */
		unique?: boolean;
		/** Shown in the add row, or in an empty status picker. */
		placeholder?: string;
		/** Shown in a read-only editor that holds no value. */
		emptyLabel?: string;
		size?: ValidValuesEditorSize;
		disabled?: boolean;
		readonly?: boolean;
		invalid?: boolean;
		class?: string;
	};

	let {
		dataType = 'list',
		value = $bindable([]),
		onValueChange,
		context = undefined,
		unique = false,
		placeholder = undefined,
		emptyLabel = 'No values',
		size = 'md',
		disabled = false,
		readonly = false,
		invalid = false,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	/** Status codes are picked where there is a site to read them from, and typed otherwise. */
	const picked = $derived(dataType === 'status_list' && context !== undefined);
	const editable = $derived(!disabled && !readonly);

	// The rows keep their keys from one value to the next, so an edit and a move keep
	// the row's element, and with it the focus.
	let held: ListRow[] = [];
	const rows = $derived.by(() => (held = syncListRows(held, value)));

	/** What is typed in a row and not yet committed, by row key. */
	let drafts = $state<Record<string, string>>({});
	let adding = $state('');
	let boxEl = $state<HTMLDivElement | null>(null);

	function commit(next: string[]): void {
		if (next.length === value.length && next.every((item, index) => item === value[index])) return;
		value = next;
		onValueChange?.(next);
	}

	function textOf(row: ListRow): string {
		return drafts[row.key] ?? row.value;
	}

	function dropDraft(key: string): string | undefined {
		const draft = drafts[key];
		if (draft !== undefined) delete drafts[key];
		return draft;
	}

	/** The row's draft becomes its value: trimmed, removed when blank, one row per line. */
	function commitRow(key: string): void {
		const index = rows.findIndex((row) => row.key === key);
		const draft = dropDraft(key);
		if (index < 0 || draft === undefined) return;
		commit(replaceListValue(value, index, draft, { unique }));
	}

	function add(text: string): void {
		adding = '';
		if (text.trim() !== '') commit(addListValues(value, text, { unique }));
	}

	/** The caret in the row at `index`, or in the add row past the last one. */
	async function focusAt(index: number): Promise<void> {
		await tick();
		const inputs = boxEl?.querySelectorAll<HTMLInputElement>('input') ?? [];
		inputs[Math.max(0, Math.min(index, inputs.length - 1))]?.focus({ preventScroll: true });
	}

	function removeAt(index: number): void {
		const row = rows[index];
		if (row) dropDraft(row.key);
		commit(value.filter((_, at) => at !== index));
	}

	function move(index: number, delta: number): void {
		const to = index + delta;
		if (to < 0 || to >= value.length) return;
		commit(moveListValue(value, index, to));
		void focusAt(to);
	}

	/** A paste of several lines, merged into the text at the caret. One line is the input's own. */
	function pasted(event: ClipboardEvent): string | null {
		const text = event.clipboardData?.getData('text') ?? '';
		if (!/[\r\n]/.test(text)) return null;
		event.preventDefault();
		const input = event.currentTarget as HTMLInputElement;
		const from = input.selectionStart ?? input.value.length;
		const to = input.selectionEnd ?? input.value.length;
		return input.value.slice(0, from) + text + input.value.slice(to);
	}

	/** Alt and an arrow move the row holding focus, from its grip or from its text. */
	function onMoveKeys(event: KeyboardEvent, index: number): boolean {
		// The sortable owns the arrow keys while it carries a row.
		if (sortable.dragging !== null || !event.altKey) return false;
		if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return false;
		event.preventDefault();
		move(index, event.key === 'ArrowUp' ? -1 : 1);
		return true;
	}

	function onRowKeys(event: KeyboardEvent, row: ListRow, index: number): void {
		if (onMoveKeys(event, index)) return;
		if (event.key === 'Enter') {
			event.preventDefault();
			const lines = splitListValues(textOf(row)).length;
			commitRow(row.key);
			void focusAt(index + lines);
		} else if (event.key === 'Escape' && drafts[row.key] !== undefined) {
			event.stopPropagation();
			dropDraft(row.key);
			// The stored text goes back at once, whether or not the draft was ever drawn.
			(event.currentTarget as HTMLInputElement).value = row.value;
		} else if (event.key === 'Backspace' && textOf(row) === '') {
			event.preventDefault();
			removeAt(index);
			void focusAt(index - 1);
		}
	}

	function onRowPaste(event: ClipboardEvent, row: ListRow, index: number): void {
		const text = pasted(event);
		if (text === null) return;
		dropDraft(row.key);
		commit(replaceListValue(value, index, text, { unique }));
		void focusAt(index + splitListValues(text).length);
	}

	function onAddKeys(event: KeyboardEvent): void {
		if (event.key === 'Enter') {
			event.preventDefault();
			add(adding);
		} else if (event.key === 'Backspace' && adding === '' && value.length > 0) {
			event.preventDefault();
			void focusAt(value.length - 1);
		}
	}

	function onAddPaste(event: ClipboardEvent): void {
		const text = pasted(event);
		if (text !== null) add(text);
	}

	const sortable = createSortable({
		ids: () => rows.map((row) => row.key),
		onOrderChange: (order) =>
			commit(order.map((key) => rows.find((row) => row.key === key)?.value ?? '')),
		label: (key) => rows.find((row) => row.key === key)?.value ?? key,
		disabled: () => !editable
	});
</script>

<!--
	The valid values of a `list` or a `status_list` field.

	A list's values are bare strings, and their order is the order of the drop-down. A
	write is compared to them byte for byte, case and a trailing space included, so a
	value is trimmed where it is defined and a blank one is dropped (field_types/list).
	Each value is a row that is typed in, dragged and removed, and a text of several
	lines pasted anywhere becomes one row per line.

	A status list's values are status codes. With a context they are picked from the
	site's Status table, each drawn as the site draws it, and their order carries no
	meaning. Without one there is no table to read, and the codes are typed as a list's are.
-->
<div
	bind:this={ref}
	data-slot="valid-values-editor"
	data-type={dataType}
	data-size={size}
	class={cn('flex w-full min-w-0 flex-col', className)}
	{...rest}
>
	{#if picked && context}
		<StatusMultiPicker
			{context}
			{value}
			onValueChange={commit}
			summary="chips"
			placeholder={placeholder ?? 'Select statuses'}
			{size}
			{disabled}
			{readonly}
			{invalid}
		/>
	{:else}
		<div
			bind:this={boxEl}
			data-slot="valid-values-editor-box"
			data-invalid={invalid ? 'true' : undefined}
			data-empty={value.length === 0 ? 'true' : undefined}
			aria-disabled={disabled || undefined}
			class={cn(BOX, disabled && 'pointer-events-none opacity-50')}
		>
			<div
				data-slot="valid-values-editor-rows"
				role="list"
				class="flex min-w-0 flex-col"
				{@attach sortable.attach}
			>
				{#each rows as row, index (row.key)}
					<div
						data-slot="valid-values-editor-row"
						data-sortable-id={row.key}
						data-value={row.value}
						role="listitem"
						class={cn(ROW, ROW_BOX[size])}
					>
						{#if editable}
							<Button
								variant="ghost"
								size={ACTION[size]}
								data-slot="valid-values-editor-grip"
								data-sortable-handle="true"
								onkeydown={(event) => onMoveKeys(event, index)}
								aria-label={`Reorder ${row.value}`}
								title="Drag to reorder, or press Space and use the arrow keys"
								class="cursor-grab touch-none active:cursor-grabbing"
							>
								<GripVerticalIcon />
							</Button>
							<input
								data-slot="valid-values-editor-input"
								type="text"
								value={textOf(row)}
								aria-label={`Value ${index + 1}`}
								aria-invalid={invalid || undefined}
								autocomplete="off"
								spellcheck="false"
								class={cn(INPUT, LINE[size])}
								oninput={(event) => (drafts[row.key] = event.currentTarget.value)}
								onblur={() => commitRow(row.key)}
								onkeydown={(event) => onRowKeys(event, row, index)}
								onpaste={(event) => onRowPaste(event, row, index)}
							/>
							<Button
								variant="ghost"
								size={ACTION[size]}
								data-slot="valid-values-editor-remove"
								aria-label={`Remove ${row.value}`}
								onclick={() => {
									removeAt(index);
									void focusAt(index);
								}}
							>
								<XIcon />
							</Button>
						{:else}
							<span class={cn('flex min-w-0 items-center px-2', LINE[size])}>
								<span class="truncate" title={row.value}>{row.value}</span>
							</span>
						{/if}
					</div>
				{/each}
			</div>
			{#if editable}
				<div data-slot="valid-values-editor-add" class={cn('flex min-w-0 items-center gap-2', ROW_BOX[size])}>
					<span class={cn('text-muted-foreground flex shrink-0 items-center justify-center', LEAD[size])}>
						<PlusIcon aria-hidden="true" class="size-4" />
					</span>
					<input
						data-slot="valid-values-editor-add-input"
						type="text"
						bind:value={adding}
						placeholder={placeholder ?? 'Add a value'}
						aria-label="Add a value"
						aria-invalid={invalid || undefined}
						autocomplete="off"
						spellcheck="false"
						class={cn(INPUT, LINE[size])}
						onblur={() => add(adding)}
						onkeydown={onAddKeys}
						onpaste={onAddPaste}
					/>
				</div>
			{:else if value.length === 0}
				<div data-slot="valid-values-editor-empty" class={cn('flex min-w-0 items-center', ROW_BOX[size])}>
					<span class={cn('text-muted-foreground flex min-w-0 items-center px-2', LINE[size])}>
						<span class="truncate">{emptyLabel}</span>
					</span>
				</div>
			{/if}
		</div>
		<div
			data-slot="valid-values-editor-live-region"
			role="status"
			aria-live="polite"
			aria-atomic="true"
			class="sr-only"
		>
			{sortable.announcement}
		</div>
	{/if}
</div>
