<script lang="ts">
	import { matchesTokens } from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import PickerControl from '$lib/registry/components/picker-control.svelte';
	import {
		PICKER_ARMED,
		PICKER_ROW,
		PICKER_TEXT_CHIP,
		PICKER_TEXT_CHIP_BOX
	} from '$lib/registry/components/picker-classes.js';
	import { cn } from '$lib/utils.js';

	/** The rows both controls offer. A wrapper's own vocabulary is all it adds. */
	const DEPARTMENTS = [
		{ code: 'layout', label: 'Layout' },
		{ code: 'anim', label: 'Animation' },
		{ code: 'light', label: 'Lighting' },
		{ code: 'comp', label: 'Compositing' },
		{ code: 'fx', label: 'Effects' },
		{ code: 'mm', label: 'Matchmove' },
		{ code: 'rig', label: 'Rigging' },
		{ code: 'edit', label: 'Editorial' }
	];

	let one = $state<string[]>([]);
	let many = $state<string[]>(['anim', 'light']);
	let oneQuery = $state('');
	let manyQuery = $state('');

	const labelOf = (code: string) => DEPARTMENTS.find((d) => d.code === code)?.label ?? code;
	const matching = (query: string) => DEPARTMENTS.filter((d) => matchesTokens(query, d.label, d.code));
	const singleRows = $derived(matching(oneQuery));
	const multiRows = $derived(matching(manyQuery));
	const chipClass = cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX.md);

	// The primitive writes the chosen label into its own copy of the input value;
	// mirroring it here makes the clear on close a change the caret sees.
	function pick(keys: string[]): void {
		one = keys;
		oneQuery = labelOf(keys[0] ?? '');
	}

	const field = 'flex w-full flex-col gap-2';
	const label = 'text-muted-foreground text-xs';
	const readout = 'text-muted-foreground font-mono text-xs';
</script>

<div class="flex flex-col gap-4">
	<div class={field} data-demo-case="inline">
		<span class={label}>Inline, one department: the caret sits beside the chip</span>
		<div class="relative flex w-full min-w-0 items-center">
			<PickerControl
				slot="department-picker"
				picker="department"
				keys={one}
				onSelect={pick}
				labels={one.map(labelOf)}
				rowCount={singleRows.length}
				placeholder="Select a department"
				bind:query={oneQuery}
				onRemoveAt={() => (one = [])}
				onClear={() => (one = [])}
				empty={singleRows.length === 0}
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					<span
						data-slot="department-picker-chip"
						data-chip=""
						{hidden}
						class={cn(chipClass, armed && PICKER_ARMED)}>{labelOf(one[index] ?? '')}</span
					>
				{/snippet}

				{#snippet rows()}
					{#each singleRows as department (department.code)}
						<Combobox.Item
							data-slot="department-picker-option"
							value={department.code}
							label={department.label}
							class={PICKER_ROW}>{department.label}</Combobox.Item
						>
					{/each}
				{/snippet}
			</PickerControl>
		</div>
		<span class={readout}>{JSON.stringify(one)}</span>
	</div>

	<div class={field} data-demo-case="summary">
		<span class={label}>Summary, several departments: the search box moves into the popup</span>
		<div class="relative flex w-full min-w-0 items-center">
			<PickerControl
				slot="department-multi-picker"
				picker="department-multi"
				multiple
				chipRow
				inline={false}
				keys={many}
				onSelect={(keys) => (many = keys)}
				labels={many.map(labelOf)}
				chipKeys={many}
				rowCount={multiRows.length}
				placeholder="Select departments"
				searchPlaceholder="Search departments…"
				bind:query={manyQuery}
				onRemoveAt={(index) => (many = many.filter((_, i) => i !== index))}
				onClear={() => (many = [])}
				empty={multiRows.length === 0}
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					<span
						data-slot="department-multi-picker-chip"
						data-chip=""
						{hidden}
						class={cn(chipClass, armed && PICKER_ARMED)}
						><span class="truncate">{labelOf(many[index] ?? '')}</span></span
					>
				{/snippet}

				{#snippet rows()}
					{#each multiRows as department (department.code)}
						<Combobox.Item
							data-slot="department-multi-picker-option"
							value={department.code}
							label={department.label}
							class={PICKER_ROW}>{department.label}</Combobox.Item
						>
					{/each}
				{/snippet}
			</PickerControl>
		</div>
		<span class={readout}>{JSON.stringify(many)}</span>
	</div>
</div>
