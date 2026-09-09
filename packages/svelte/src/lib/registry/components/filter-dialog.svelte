<script lang="ts">
	import type { Snippet } from 'svelte';
	import FilterIcon from '@lucide/svelte/icons/list-filter';
	import PencilIcon from '@lucide/svelte/icons/pencil';
	import Trash2Icon from '@lucide/svelte/icons/trash-2';
	import type { FilterGroup, SchemaService, SgClient } from '@sg-widgets/core';
	import { countActiveConditions, emptyFilter, isEmptyFilter } from '@sg-widgets/core';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import { cn } from '$lib/utils.js';
	import FilterEditor, {
		type FieldChooserArgs,
		type ValueEditorArgs
	} from '$lib/registry/components/filter-editor.svelte';

	type Props = {
		entityType: string;
		client: SgClient;
		schema?: SchemaService;
		value: FilterGroup;
		hidePaths?: string[];
		disabled?: boolean;
		/** Replaces both button labels. Otherwise Add filters, then Edit filters. */
		label?: string;
		title?: string;
		onChange?: (value: FilterGroup) => void;
		/** Whether the dialog is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		fieldChooser?: Snippet<[FieldChooserArgs]>;
		valueEditor?: Snippet<[ValueEditorArgs]>;
		entityEditor?: Snippet<[ValueEditorArgs]>;
		class?: string;
	};

	let {
		entityType,
		client,
		schema,
		value = $bindable(emptyFilter()),
		hidePaths = [],
		disabled = false,
		label,
		title = 'Filters',
		onChange,
		open = $bindable(false),
		onOpenChange,
		fieldChooser,
		valueEditor,
		entityEditor,
		class: className
	}: Props = $props();

	let draft = $state<FilterGroup>(value);

	const active = $derived(countActiveConditions(value));

	function commit(next: FilterGroup): void {
		value = next;
		onChange?.(next);
	}

	function apply(): void {
		// A tree of blank rows is not a filter; it applies as no filter at all.
		commit(isEmptyFilter(draft) ? emptyFilter() : draft);
		setOpen(false);
	}

	function clearAll(): void {
		commit(emptyFilter());
		setOpen(false);
	}

	function setOpen(next: boolean): void {
		if (next === open) return;
		open = next;
		if (next) draft = value;
		onOpenChange?.(next);
	}
</script>

<!--
	The launcher for the filter editor.

	Empty, it is one Add filters button. With filters applied it is an Edit filters
	button carrying the count, plus a control that clears them without opening
	anything. Edits inside the dialog are staged: only Apply emits, Cancel drops
	them, and Clear all emits an empty filter.
-->
<div class={cn('inline-flex items-center gap-2', className)} data-slot="filter-dialog">
	<!-- The draft starts from the applied value every time the dialog opens, so a cancelled edit leaves nothing behind. -->
	<Dialog.Root bind:open={() => open, setOpen}>
		<Dialog.Trigger
			{disabled}
			data-slot="filter-launch"
			class={cn(
				'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50'
			)}
		>
			{#if active > 0}
				<PencilIcon class="size-4" />
				{label ?? 'Edit filters'}
				<Badge variant="secondary" data-slot="filter-count">{active}</Badge>
			{:else}
				<FilterIcon class="size-4" />
				{label ?? 'Add filters'}
			{/if}
		</Dialog.Trigger>
		<!-- A condition row wants room: the dialog takes the viewport up to 64rem. -->
		<Dialog.Content class="w-[min(96vw,64rem)] sm:max-w-none">
			<Dialog.Header>
				<Dialog.Title>{title}</Dialog.Title>
				<Dialog.Description>Rows match on {entityType}. Nothing applies until you press Apply.</Dialog.Description>
			</Dialog.Header>
			<FilterEditor
				{entityType}
				{client}
				{schema}
				{hidePaths}
				bind:value={draft}
				{fieldChooser}
				{valueEditor}
				{entityEditor}
			/>
			<Dialog.Footer class="sm:justify-between">
				<Button variant="ghost" data-slot="filter-clear-all" onclick={clearAll}>Clear all</Button>
				<div class="flex items-center gap-2">
					<Button variant="outline" data-slot="filter-cancel" onclick={() => setOpen(false)}>Cancel</Button>
					<Button data-slot="filter-apply" onclick={apply}>Apply</Button>
				</div>
			</Dialog.Footer>
		</Dialog.Content>
	</Dialog.Root>

	{#if active > 0}
		<Button
			variant="ghost"
			size="icon"
			{disabled}
			aria-label="Clear filters"
			data-slot="filter-clear"
			onclick={() => commit(emptyFilter())}
		>
			<Trash2Icon />
		</Button>
	{/if}
</div>
