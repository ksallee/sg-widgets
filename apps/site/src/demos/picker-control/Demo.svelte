<script lang="ts">
	import { matchesEveryWord } from '@sg-widgets/core';
	import { Combobox } from 'bits-ui';
	import PickerControl from '$lib/registry/components/picker-control.svelte';
	import {
		PICKER_ARMED,
		PICKER_ROW,
		PICKER_TEXT_CHIP,
		PICKER_TEXT_CHIP_BOX
	} from '$lib/registry/components/picker-classes.js';
	import { cn } from '$lib/utils.js';

	/** The rows every control offers. A wrapper's own vocabulary is all it adds. */
	const DEPARTMENTS = [
		{ code: 'layout', label: 'Layout', lead: 'Anna van der Meer' },
		{ code: 'anim', label: 'Animation', lead: 'Piet Oosterhuis' },
		{ code: 'light', label: 'Lighting', lead: 'Mira Halloran' },
		{ code: 'comp', label: 'Compositing', lead: 'Tomas Bergqvist' },
		{ code: 'fx', label: 'Effects', lead: 'Iris Nakamura' },
		{ code: 'mm', label: 'Matchmove', lead: 'Ravi Chandrasekar' },
		{ code: 'rig', label: 'Rigging', lead: 'Elena Duarte' },
		{ code: 'edit', label: 'Editorial', lead: 'Jonas Klein' }
	];
	const SIZES = ['sm', 'md', 'lg'] as const;

	const labelOf = (code: string) => DEPARTMENTS.find((d) => d.code === code)?.label ?? code;
	const leadOf = (code: string) => DEPARTMENTS.find((d) => d.code === code)?.lead ?? '';
	const matching = (query: string) =>
		DEPARTMENTS.filter((d) => matchesEveryWord(`${d.label} ${d.code}`, query));

	let one = $state<string[]>([]);
	let oneQuery = $state('');
	let many = $state<string[]>(['anim', 'light']);
	let manyQuery = $state('');
	let text = $state<string[]>(['comp']);
	let textQuery = $state('');
	let tokens = $state<string[]>(['fx', 'mm']);
	let tokensQuery = $state('');
	let crowd = $state<string[]>(DEPARTMENTS.map((d) => d.code));
	let crowdQuery = $state('');
	let fixed = $state<string[]>(['rig']);
	let sized = $state<Record<string, string[]>>({ sm: ['layout'], md: ['anim'], lg: ['light'] });
	let sizedQuery = $state<Record<string, string>>({ sm: '', md: '', lg: '' });
	let invalid = $state<string[]>([]);
	let invalidQuery = $state('');
	let named = $state<string[]>([]);
	let namedQuery = $state('');
	let crew = $state<string[]>(['light']);
	let crewQuery = $state('');

	// The primitive writes the chosen label into its own copy of the input value;
	// mirroring it here makes the clear on close a change the caret sees.
	function pickOne(keys: string[]): void {
		one = keys;
		oneQuery = labelOf(keys[0] ?? '');
	}

	const field = 'flex w-full flex-col gap-2';
	const label = 'text-muted-foreground text-xs';
	const readout = 'text-muted-foreground font-mono text-xs';
	const box = 'relative flex w-full min-w-0 items-center';
	/** At most 20rem, so the measured row has something to cut against. */
	const narrow = 'max-w-80';
</script>

{#snippet chipOf(slot: string, name: string, armed: boolean, hidden: boolean, size: 'sm' | 'md' | 'lg')}
	<span
		data-slot={`${slot}-chip`}
		data-chip=""
		data-armed={armed ? 'true' : undefined}
		{hidden}
		class={cn(PICKER_TEXT_CHIP, PICKER_TEXT_CHIP_BOX[size], armed && PICKER_ARMED)}
	>
		<span class="truncate">{name}</span>
	</span>
{/snippet}

{#snippet plainRows(slot: string, list: typeof DEPARTMENTS)}
	{#each list as department (department.code)}
		<Combobox.Item
			data-slot={`${slot}-option`}
			value={department.code}
			label={department.label}
			class={PICKER_ROW}>{department.label}</Combobox.Item
		>
	{/each}
{/snippet}

<div class="flex flex-col gap-4">
	<div class={field} data-demo-case="inline">
		<span class={label}>Single, inline: the caret sits beside the chip</span>
		<div class={box}>
			<PickerControl
				slot="department-picker"
				picker="department"
				keys={one}
				onSelect={pickOne}
				labels={one.map(labelOf)}
				rowCount={matching(oneQuery).length}
				placeholder="Select a department"
				bind:query={oneQuery}
				onRemoveAt={() => (one = [])}
				onClear={() => (one = [])}
				empty={matching(oneQuery).length === 0}
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					{@render chipOf('department-picker', labelOf(one[index] ?? ''), armed, hidden, 'md')}
				{/snippet}
				{#snippet rows()}{@render plainRows('department-picker', matching(oneQuery))}{/snippet}
			</PickerControl>
		</div>
		<span class={readout}>{JSON.stringify(one)}</span>
	</div>

	<div class={field} data-demo-case="named">
		<span class={label}>Named by a label of its own, with no placeholder</span>
		<div class={box}>
			<PickerControl
				slot="department-named-picker"
				picker="department-named"
				keys={named}
				onSelect={(keys) => (named = keys)}
				labels={named.map(labelOf)}
				rowCount={matching(namedQuery).length}
				label="Department"
				bind:query={namedQuery}
				onRemoveAt={() => (named = [])}
				onClear={() => (named = [])}
				empty={matching(namedQuery).length === 0}
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					{@render chipOf('department-named-picker', labelOf(named[index] ?? ''), armed, hidden, 'md')}
				{/snippet}
				{#snippet rows()}{@render plainRows('department-named-picker', matching(namedQuery))}{/snippet}
			</PickerControl>
		</div>
	</div>

	<div class={field} data-demo-case="text">
		<span class={label}>Single, summary: the value reads as plain text, the way a select does</span>
		<div class={box}>
			<PickerControl
				slot="department-text-picker"
				picker="department-text"
				anchored
				inline={false}
				textValue
				keys={text}
				onSelect={(keys) => (text = keys)}
				labels={text.map(labelOf)}
				rowCount={matching(textQuery).length}
				placeholder="Select a department"
				searchPlaceholder="Search departments…"
				bind:query={textQuery}
				onRemoveAt={() => (text = [])}
				onClear={() => (text = [])}
				empty={matching(textQuery).length === 0}
				triggerLabel="Show the departments"
			>
				{#snippet chip()}
					<span data-slot="department-text-picker-text" class="truncate"
						>{labelOf(text[0] ?? '')}</span
					>
				{/snippet}
				{#snippet rows()}{@render plainRows('department-text-picker', matching(textQuery))}{/snippet}
			</PickerControl>
		</div>
		<span class={readout}>{JSON.stringify(text)}</span>
	</div>

	<div class={field} data-demo-case="tokens">
		<span class={label}>Several, inline: a token field, chips and query on one line</span>
		<div class={box}>
			<PickerControl
				slot="department-token-picker"
				picker="department-token"
				multiple
				chipRow
				keys={tokens}
				onSelect={(keys) => (tokens = keys)}
				labels={tokens.map(labelOf)}
				chipKeys={tokens}
				rowCount={matching(tokensQuery).length}
				placeholder="Select departments"
				bind:query={tokensQuery}
				onRemoveAt={(index) => (tokens = tokens.filter((_, i) => i !== index))}
				onClear={() => (tokens = [])}
				empty={matching(tokensQuery).length === 0}
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					{@render chipOf(
						'department-token-picker',
						labelOf(tokens[index] ?? ''),
						armed,
						hidden,
						'md'
					)}
				{/snippet}
				{#snippet rows()}{@render plainRows('department-token-picker', matching(tokensQuery))}{/snippet}
			</PickerControl>
		</div>
		<span class={readout}>{JSON.stringify(tokens)}</span>
	</div>

	<div class={field} data-demo-case="summary">
		<span class={label}>Several, summary: the search box moves into the popup</span>
		<div class={box}>
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
				rowCount={matching(manyQuery).length}
				placeholder="Select departments"
				searchPlaceholder="Search departments…"
				bind:query={manyQuery}
				onRemoveAt={(index) => (many = many.filter((_, i) => i !== index))}
				onClear={() => (many = [])}
				empty={matching(manyQuery).length === 0}
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					{@render chipOf('department-multi-picker', labelOf(many[index] ?? ''), armed, hidden, 'md')}
				{/snippet}
				{#snippet rows()}{@render plainRows('department-multi-picker', matching(manyQuery))}{/snippet}
			</PickerControl>
		</div>
		<span class={readout}>{JSON.stringify(many)}</span>
	</div>

	<div class={field} data-demo-case="overflow">
		<span class={label}>Eight selected in 20rem: whole chips, then a `+n` pill</span>
		<div class={cn(box, narrow)}>
			<PickerControl
				slot="department-multi-picker"
				picker="department-multi"
				multiple
				chipRow
				inline={false}
				summary="ellipsis"
				keys={crowd}
				onSelect={(keys) => (crowd = keys)}
				labels={crowd.map(labelOf)}
				chipKeys={crowd}
				rowCount={matching(crowdQuery).length}
				placeholder="Select departments"
				searchPlaceholder="Search departments…"
				bind:query={crowdQuery}
				onRemoveAt={(index) => (crowd = crowd.filter((_, i) => i !== index))}
				onClear={() => (crowd = [])}
				empty={matching(crowdQuery).length === 0}
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					{@render chipOf(
						'department-multi-picker',
						labelOf(crowd[index] ?? ''),
						armed,
						hidden,
						'md'
					)}
				{/snippet}
				{#snippet rows()}{@render plainRows('department-multi-picker', matching(crowdQuery))}{/snippet}
			</PickerControl>
		</div>
		<span class={readout}>{crowd.length} selected</span>
	</div>

	<div class={field} data-demo-case="fixed">
		<span class={label}>A fixed set: no search row, and one caret out of sight for the keys</span>
		<div class={box}>
			<PickerControl
				slot="department-fixed-picker"
				picker="department-fixed"
				anchored
				inline={false}
				textValue
				searchable={false}
				keys={fixed}
				onSelect={(keys) => (fixed = keys)}
				labels={fixed.map(labelOf)}
				rowCount={DEPARTMENTS.length}
				placeholder="Select a department"
				onRemoveAt={() => (fixed = [])}
				onClear={() => (fixed = [])}
				triggerLabel="Show the departments"
			>
				{#snippet chip()}
					<span data-slot="department-fixed-picker-text" class="truncate"
						>{labelOf(fixed[0] ?? '')}</span
					>
				{/snippet}
				{#snippet rows()}{@render plainRows('department-fixed-picker', DEPARTMENTS)}{/snippet}
			</PickerControl>
		</div>
		<span class={readout}>{JSON.stringify(fixed)}</span>
	</div>

	<div class={field} data-demo-case="sizes">
		<span class={label}>The three heights</span>
		{#each SIZES as size (size)}
			<div class={box}>
				<PickerControl
					slot="department-picker"
					picker="department"
					{size}
					keys={sized[size] ?? []}
					onSelect={(keys) => {
						sized = { ...sized, [size]: keys };
						sizedQuery = { ...sizedQuery, [size]: labelOf(keys[0] ?? '') };
					}}
					labels={(sized[size] ?? []).map(labelOf)}
					rowCount={matching(sizedQuery[size] ?? '').length}
					placeholder="Select a department"
					bind:query={sizedQuery[size]}
					onRemoveAt={() => (sized = { ...sized, [size]: [] })}
					onClear={() => (sized = { ...sized, [size]: [] })}
					empty={matching(sizedQuery[size] ?? '').length === 0}
					triggerLabel="Show the departments"
				>
					{#snippet chip(index: number, armed: boolean, hidden: boolean)}
						{@render chipOf(
							'department-picker',
							labelOf((sized[size] ?? [])[index] ?? ''),
							armed,
							hidden,
							size
						)}
					{/snippet}
					{#snippet rows()}
						{@render plainRows('department-picker', matching(sizedQuery[size] ?? ''))}
					{/snippet}
				</PickerControl>
			</div>
		{/each}
	</div>

	<div class={field} data-demo-case="states">
		<span class={label}>Disabled, read-only and invalid</span>
		<div class={box}>
			<PickerControl
				slot="department-picker"
				picker="department"
				disabled
				keys={['comp']}
				onSelect={() => {}}
				labels={['Compositing']}
				placeholder="Select a department"
				query=""
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					{@render chipOf('department-picker', 'Compositing', armed, hidden, 'md')}
				{/snippet}
				{#snippet rows()}{@render plainRows('department-picker', DEPARTMENTS)}{/snippet}
			</PickerControl>
		</div>
		<div class={box}>
			<PickerControl
				slot="department-picker"
				picker="department"
				readonly
				keys={['edit']}
				onSelect={() => {}}
				labels={['Editorial']}
				placeholder="Select a department"
				query=""
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					{@render chipOf('department-picker', 'Editorial', armed, hidden, 'md')}
				{/snippet}
				{#snippet rows()}{@render plainRows('department-picker', DEPARTMENTS)}{/snippet}
			</PickerControl>
		</div>
		<div class={box}>
			<PickerControl
				slot="department-picker"
				picker="department"
				invalid
				keys={invalid}
				onSelect={(keys) => (invalid = keys)}
				labels={invalid.map(labelOf)}
				rowCount={matching(invalidQuery).length}
				placeholder="A department is required"
				bind:query={invalidQuery}
				onRemoveAt={() => (invalid = [])}
				onClear={() => (invalid = [])}
				empty={matching(invalidQuery).length === 0}
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					{@render chipOf('department-picker', labelOf(invalid[index] ?? ''), armed, hidden, 'md')}
				{/snippet}
				{#snippet rows()}{@render plainRows('department-picker', matching(invalidQuery))}{/snippet}
			</PickerControl>
		</div>
	</div>

	<div class={field} data-demo-case="custom">
		<span class={label}>A row and a chip of the caller's own</span>
		<div class={box}>
			<PickerControl
				slot="department-token-picker"
				picker="department-token"
				multiple
				chipRow
				keys={crew}
				onSelect={(keys) => (crew = keys)}
				labels={crew.map(labelOf)}
				chipKeys={crew}
				rowCount={matching(crewQuery).length}
				placeholder="Select departments"
				bind:query={crewQuery}
				onRemoveAt={(index) => (crew = crew.filter((_, i) => i !== index))}
				onClear={() => (crew = [])}
				empty={matching(crewQuery).length === 0}
				triggerLabel="Show the departments"
			>
				{#snippet chip(index: number, armed: boolean, hidden: boolean)}
					{@const code = crew[index] ?? ''}
					<span
						data-slot="department-token-picker-chip"
						data-chip=""
						data-armed={armed ? 'true' : undefined}
						{hidden}
						class={cn(
							PICKER_TEXT_CHIP,
							PICKER_TEXT_CHIP_BOX.md,
							'gap-1',
							armed && PICKER_ARMED
						)}
					>
						<span class="font-mono text-xs uppercase opacity-60">{code}</span>
						<span class="truncate">{labelOf(code)}</span>
					</span>
				{/snippet}
				{#snippet rows()}
					{#each matching(crewQuery) as department (department.code)}
						<Combobox.Item
							data-slot="department-token-picker-option"
							value={department.code}
							label={department.label}
							class={cn(PICKER_ROW, 'items-start')}
						>
							<span class="flex min-w-0 flex-1 flex-col">
								<span class="truncate">{department.label}</span>
								<span class="text-muted-foreground truncate text-xs">{leadOf(department.code)}</span>
							</span>
							<span class="text-muted-foreground shrink-0 font-mono text-xs">{department.code}</span>
						</Combobox.Item>
					{/each}
				{/snippet}
			</PickerControl>
		</div>
		<span class={readout}>{JSON.stringify(crew)}</span>
	</div>
</div>
