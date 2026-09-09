<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type {
		ConditionValue,
		EntityRef,
		FieldSchema,
		FilterCondition,
		FilterGroup,
		NodePath,
		Operator,
		Scalar,
		TimeUnit
	} from '@sg-widgets/core';
	import { TIME_UNITS, timeUnitLabel } from '@sg-widgets/core';

	/** What the field slot is given. Its job is to call `onSelect` with a dotted path. */
	export interface FieldChooserArgs {
		entityType: string;
		/** The path the row holds now, empty on a new row. */
		path: string;
		hidePaths: string[];
		/** Only fields the API can filter on. Always true here. */
		filterableOnly: true;
		disabled: boolean;
		onSelect: (path: string) => void;
	}

	/** What a value slot is given. Its job is to call `onChange` with the value the operator expects. */
	export interface ValueEditorArgs {
		field: FieldSchema | null;
		dataType: string;
		operator: Operator;
		value: ConditionValue;
		/** The arity the operator's wire shape asks for. */
		arity: 'none' | 'one' | 'many' | 'two' | 'relative';
		disabled: boolean;
		onChange: (value: ConditionValue) => void;
	}

	const UNITS = TIME_UNITS;

	function unitLabel(unit: string): string {
		return timeUnitLabel(unit as TimeUnit, 2);
	}

	/** The `type` a plain input takes for a value editor kind. */
	function inputType(kind: string): 'text' | 'number' | 'date' | 'datetime-local' {
		if (kind === 'number') return 'number';
		if (kind === 'date') return 'date';
		if (kind === 'date_time') return 'datetime-local';
		return 'text';
	}

	/** A `datetime-local` control edits `YYYY-MM-DDTHH:MM`; the wire is `YYYY-MM-DDTHH:MM:SSZ` (field_types/date_time). */
	function scalarText(value: Scalar | undefined): string {
		if (value === null || value === undefined || typeof value === 'object') return '';
		const text = String(value);
		return /^\d{4}-\d{2}-\d{2}T/.test(text) ? text.slice(0, 16) : text;
	}

	function parseScalar(kind: string, text: string): Scalar {
		if (text === '') return '';
		if (kind === 'number') return Number(text);
		if (kind === 'date_time') return `${text.length === 16 ? text : text.slice(0, 16)}:00Z`;
		return text;
	}

	function entityRefs(value: ConditionValue): EntityRef[] {
		if (Array.isArray(value)) return value.filter((v) => v !== null && typeof v === 'object') as EntityRef[];
		return value !== null && typeof value === 'object' ? [value as EntityRef] : [];
	}

	function sameRef(a: EntityRef, b: EntityRef): boolean {
		return a.type === b.type && a.id === b.id;
	}

	/** `is` takes one entity hash and `in` a list of them; a list under `is` is a 400 (field_types/entity). */
	function toggleRef(refs: EntityRef[], ref: EntityRef, arity: string): ConditionValue {
		if (arity !== 'many') return refs.some((r) => sameRef(r, ref)) ? '' : ref;
		return refs.some((r) => sameRef(r, ref)) ? refs.filter((r) => !sameRef(r, ref)) : [...refs, ref];
	}
</script>

<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import type { SchemaService, SgClient, TextSearchRow } from '@sg-widgets/core';
	import {
		appendAt,
		applyPreset,
		condition as makeCondition,
		createSchemaService,
		defaultCondition,
		emptyFilter,
		filterableFields,
		group as makeGroup,
		operatorMenu,
		presetById,
		presetIdOf,
		removeAt,
		replaceAt,
		valueArity,
		valueEditorFor
	} from '@sg-widgets/core';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Checkbox } from '$lib/components/ui/checkbox/index.js';
	import * as Command from '$lib/components/ui/command/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import * as Select from '$lib/components/ui/select/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { cn } from '$lib/utils.js';

	type Props = {
		/** Type the root of every field path is read on. */
		entityType: string;
		client: SgClient;
		/** Share one across a page so two widgets asking for the same type cost one request. */
		schema?: SchemaService;
		value: FilterGroup;
		/** Paths to keep out of the field list, each hiding itself and everything under it. */
		hidePaths?: string[];
		disabled?: boolean;
		onChange?: (value: FilterGroup) => void;
		fieldChooser?: Snippet<[FieldChooserArgs]>;
		valueEditor?: Snippet<[ValueEditorArgs]>;
		class?: string;
	};

	let {
		entityType,
		client,
		schema,
		value = $bindable(emptyFilter()),
		hidePaths = [],
		disabled = false,
		onChange,
		fieldChooser,
		valueEditor,
		class: className
	}: Props = $props();

	const service = $derived(schema ?? createSchemaService(client));
	let fields = $state<Record<string, FieldSchema>>({});

	// The schema service caches, so this reaches the network once per type however
	// often the tree is edited (probe 002).
	$effect(() => {
		let live = true;
		void service.fields(entityType).then((loaded) => {
			if (live) fields = loaded;
		});
		return () => {
			live = false;
		};
	});

	/* The entity fallback combobox: one popover is open at a time, so one query. */
	let search = $state('');
	let searchTypes = $state<string[]>([]);
	const results = $derived(runSearch(searchTypes, search));

	async function runSearch(types: string[], text: string): Promise<TextSearchRow[]> {
		// `_text_search` needs two characters to be worth a round trip and every word must
		// match; it caps at 25 rows (053_text_search_matching).
		if (types.length === 0 || text.trim().length < 2) return [];
		const scope: Record<string, null> = {};
		for (const type of types) scope[type] = null;
		return client.textSearch(text, scope, { size: 10 });
	}

	/** The leaf field of a dotted path. A flat name resolves against the root type. */
	function fieldOf(path: string): FieldSchema | null {
		if (!path) return null;
		const parts = path.split('.');
		return fields[parts[parts.length - 1] as string] ?? null;
	}

	function dataTypeOf(path: string): string {
		return fieldOf(path)?.dataType ?? '';
	}

	function commit(next: FilterGroup): void {
		value = next;
		onChange?.(next);
	}

	function edit(path: NodePath, node: FilterCondition | FilterGroup): void {
		commit(replaceAt(value, path, node));
	}

	function pickField(path: NodePath, current: FilterCondition, chosen: string): void {
		const before = dataTypeOf(current.path);
		const after = dataTypeOf(chosen);
		// The operator vocabulary is per data type, so moving to another type resets the row.
		edit(path, before === after && current.path ? { ...current, path: chosen } : defaultCondition(chosen, after));
	}

	function pickPreset(path: NodePath, current: FilterCondition, id: string): void {
		const dataType = dataTypeOf(current.path);
		const preset = presetById(dataType, id);
		if (preset) edit(path, applyPreset(current, preset, dataType));
	}
</script>

{#snippet fieldSlot(path: NodePath, node: FilterCondition)}
	{@const chosen = fieldOf(node.path)}
	{#if fieldChooser}
		<!-- Integration point: the drill-down field picker plugs in here. -->
		{@render fieldChooser({
			entityType,
			path: node.path,
			hidePaths,
			filterableOnly: true,
			disabled,
			onSelect: (next: string) => pickField(path, node, next)
		})}
	{:else}
		<Popover.Root>
			<Popover.Trigger
				{disabled}
				data-slot="filter-field"
				class={cn(
					'border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 w-56 shrink-0 items-center justify-between gap-1.5 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50',
					!chosen && 'text-muted-foreground'
				)}
			>
				<span class="min-w-0 truncate" title={node.path}>{chosen?.displayName ?? node.path ?? ''}</span>
				<ChevronDownIcon class="text-muted-foreground size-4" />
			</Popover.Trigger>
			<Popover.Content class="w-72 p-0" align="start">
				<Command.Root>
					<Command.Input placeholder="Search fields…" />
					<Command.List>
						<Command.Empty>No field.</Command.Empty>
						{#each filterableFields(fields, { hidePaths }) as f (f.name)}
							<Command.Item
								value="{f.displayName} {f.name}"
								data-field={f.name}
								onSelect={() => pickField(path, node, f.name)}
							>
								<span class="min-w-0 flex-1 truncate">{f.displayName}</span>
								<span class="text-muted-foreground font-mono text-xs">{f.name}</span>
							</Command.Item>
						{/each}
					</Command.List>
				</Command.Root>
			</Popover.Content>
		</Popover.Root>
	{/if}
{/snippet}

{#snippet operatorSlot(path: NodePath, node: FilterCondition)}
	{@const dataType = dataTypeOf(node.path)}
	{@const menu = operatorMenu(dataType)}
	{@const current = presetIdOf(node, dataType)}
	<Select.Root
		type="single"
		value={current}
		disabled={disabled || menu.length === 0}
		onValueChange={(id) => pickPreset(path, node, id)}
	>
		<Select.Trigger class="h-8 w-40 shrink-0" data-slot="filter-operator">
			{presetById(dataType, current)?.label ?? current}
		</Select.Trigger>
		<Select.Content>
			{#each menu as run (run.label)}
				<Select.Group>
					<Select.GroupHeading>{run.label}</Select.GroupHeading>
					{#each run.presets as preset (preset.id)}
						<Select.Item value={preset.id} label={preset.label} data-preset={preset.id} />
					{/each}
				</Select.Group>
			{/each}
		</Select.Content>
	</Select.Root>
{/snippet}

{#snippet pickerTrigger(label: string, count: number)}
	<Popover.Trigger
		{disabled}
		data-slot="filter-value-trigger"
		class="border-border bg-background hover:bg-muted focus-visible:border-ring focus-visible:ring-ring/50 inline-flex h-8 w-full min-w-0 items-center justify-between gap-1.5 rounded-lg border px-2.5 text-sm outline-none focus-visible:ring-3 disabled:pointer-events-none disabled:opacity-50"
	>
		<span class={cn('min-w-0 truncate', count === 0 && 'text-muted-foreground')} title={label}>{label}</span>
		{#if count > 0}
			<Badge variant="secondary" class="shrink-0">{count}</Badge>
		{:else}
			<ChevronDownIcon class="text-muted-foreground size-4" />
		{/if}
	</Popover.Trigger>
{/snippet}

{#snippet valueSlot(path: NodePath, node: FilterCondition)}
	{@const field = fieldOf(node.path)}
	{@const dataType = field?.dataType ?? ''}
	{@const kind = valueEditorFor(dataType, node.operator)}
	{@const arity = valueArity(node.operator)}
	{@const set = (v: ConditionValue) => edit(path, { ...node, value: v })}
	<div class="flex min-w-0 flex-1 flex-wrap items-center gap-2" data-slot="filter-value">
		{#if valueEditor}
			<!-- Integration point: the per-type value editors plug in here. -->
			{@render valueEditor({
				field,
				dataType,
				operator: node.operator,
				value: node.value,
				arity,
				disabled,
				onChange: set
			})}
		{:else if arity === 'none'}
			<span class="text-muted-foreground truncate text-sm">no value</span>
		{:else if arity === 'relative'}
			{@const pair = (Array.isArray(node.value) ? node.value : [1, 'DAY']) as [number, string]}
			<Input
				type="number"
				min="1"
				class="h-8 w-20 shrink-0"
				{disabled}
				aria-label="Count"
				value={String(pair[0] ?? '')}
				oninput={(e) => set([Number(e.currentTarget.value), pair[1]] as ConditionValue)}
			/>
			<Select.Root
				type="single"
				value={String(pair[1])}
				{disabled}
				onValueChange={(unit) => set([pair[0], unit] as ConditionValue)}
			>
				<Select.Trigger class="h-8 w-28 shrink-0">{unitLabel(String(pair[1]))}</Select.Trigger>
				<Select.Content>
					{#each UNITS as unit (unit)}
						<Select.Item value={unit} label={unitLabel(unit)} />
					{/each}
				</Select.Content>
			</Select.Root>
		{:else if kind === 'checkbox'}
			<Select.Root
				type="single"
				value={node.value === false ? 'false' : 'true'}
				{disabled}
				onValueChange={(v) => set(v === 'true')}
			>
				<Select.Trigger class="h-8 w-28" data-slot="filter-value-trigger">
					{node.value === false ? 'No' : 'Yes'}
				</Select.Trigger>
				<Select.Content>
					<Select.Item value="true" label="Yes" data-option="true" />
					<Select.Item value="false" label="No" data-option="false" />
				</Select.Content>
			</Select.Root>
		{:else if kind === 'options' && arity === 'many'}
			{@const codes = (Array.isArray(node.value) ? node.value : []) as string[]}
			<Popover.Root>
				{@render pickerTrigger(
					codes.length === 0
						? 'Select values…'
						: codes.map((c) => field?.displayValues?.[c] ?? c).join(', '),
					codes.length
				)}
				<Popover.Content class="w-64 p-0" align="start">
					<Command.Root>
						<Command.Input placeholder="Search values…" />
						<Command.List>
							<Command.Empty>No value.</Command.Empty>
							{#each field?.validValues ?? [] as code (code)}
								<Command.Item
									value="{field?.displayValues?.[code] ?? code} {code}"
									data-option={code}
									onSelect={() =>
										set(codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code])}
								>
									<Checkbox checked={codes.includes(code)} tabindex={-1} aria-hidden="true" />
									<span class="min-w-0 flex-1 truncate">{field?.displayValues?.[code] ?? code}</span>
								</Command.Item>
							{/each}
						</Command.List>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
		{:else if kind === 'options'}
			<Select.Root
				type="single"
				value={typeof node.value === 'string' ? node.value : ''}
				{disabled}
				onValueChange={(v) => set(v)}
			>
				<Select.Trigger class="h-8 w-full min-w-0" data-slot="filter-value-trigger">
					{typeof node.value === 'string' && node.value
						? (field?.displayValues?.[node.value] ?? node.value)
						: 'Select a value…'}
				</Select.Trigger>
				<Select.Content>
					{#each field?.validValues ?? [] as code (code)}
						<Select.Item
							value={code}
							label={field?.displayValues?.[code] ?? code}
							data-option={code}
						/>
					{/each}
				</Select.Content>
			</Select.Root>
		{:else if kind === 'entity'}
			{@const refs = entityRefs(node.value)}
			<Popover.Root
				onOpenChange={(open) => {
					if (open) {
						search = '';
						searchTypes = field?.validTypes ?? [entityType];
					}
				}}
			>
				{@render pickerTrigger(
					refs.length === 0 ? 'Search…' : refs.map((r) => r.name ?? `${r.type} #${r.id}`).join(', '),
					arity === 'many' ? refs.length : 0
				)}
				<Popover.Content class="w-72 p-0" align="start">
					<Command.Root shouldFilter={false}>
						<Command.Input placeholder="Search…" bind:value={search} />
						<Command.List>
							{#await results}
								<Command.Loading>
									<p class="text-muted-foreground py-6 text-center text-sm">Searching…</p>
								</Command.Loading>
							{:then rows}
								{#if rows.length === 0}
									<Command.Empty>{search.trim().length < 2 ? 'Type to search.' : 'No match.'}</Command.Empty>
								{/if}
								{#each rows as row (`${row.type}:${row.id}`)}
									<Command.Item
										value="{row.type}:{row.id}"
										data-entity="{row.type}:{row.id}"
										onSelect={() =>
											set(toggleRef(refs, { type: row.type, id: row.id, name: row.name }, arity))}
									>
										<Checkbox
											checked={refs.some((r) => r.type === row.type && r.id === row.id)}
											tabindex={-1}
											aria-hidden="true"
										/>
										<span class="min-w-0 flex-1 truncate">{row.name}</span>
										<span class="text-muted-foreground text-xs">{row.type}</span>
									</Command.Item>
								{/each}
							{:catch error}
								<p class="text-destructive py-6 text-center text-sm">{error.message}</p>
							{/await}
						</Command.List>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
		{:else if arity === 'two'}
			{@const pair = (Array.isArray(node.value) ? node.value : [null, null]) as [Scalar, Scalar]}
			<Input
				type={inputType(kind)}
				class="h-8 min-w-0 flex-1"
				{disabled}
				aria-label="From"
				value={scalarText(pair[0])}
				oninput={(e) => set([parseScalar(kind, e.currentTarget.value), pair[1]] as ConditionValue)}
			/>
			<span class="text-muted-foreground shrink-0 text-sm">and</span>
			<Input
				type={inputType(kind)}
				class="h-8 min-w-0 flex-1"
				{disabled}
				aria-label="To"
				value={scalarText(pair[1])}
				oninput={(e) => set([pair[0], parseScalar(kind, e.currentTarget.value)] as ConditionValue)}
			/>
		{:else if arity === 'many'}
			{@const items = (Array.isArray(node.value) ? node.value : []) as Scalar[]}
			<Input
				class="h-8 min-w-0 flex-1"
				{disabled}
				placeholder="value, value"
				aria-label="Values"
				value={items.map(scalarText).join(', ')}
				oninput={(e) =>
					set(
						e.currentTarget.value
							.split(',')
							.map((part) => part.trim())
							.filter(Boolean)
							.map((part) => parseScalar(kind, part)) as ConditionValue
					)}
			/>
		{:else}
			<Input
				type={inputType(kind)}
				class="h-8 min-w-0 flex-1"
				{disabled}
				aria-label="Value"
				value={scalarText(node.value as Scalar)}
				oninput={(e) => set(parseScalar(kind, e.currentTarget.value))}
			/>
		{/if}
	</div>
{/snippet}

{#snippet conditionRow(path: NodePath, node: FilterCondition)}
	<div class="flex min-w-0 flex-wrap items-center gap-2" data-slot="filter-row" data-path={path.join('.')}>
		{@render fieldSlot(path, node)}
		{@render operatorSlot(path, node)}
		{@render valueSlot(path, node)}
		<Button
			variant="ghost"
			size="icon-sm"
			{disabled}
			aria-label="Remove condition"
			data-slot="filter-remove"
			onclick={() => commit(removeAt(value, path))}
		>
			<XIcon />
		</Button>
	</div>
{/snippet}

{#snippet groupNode(path: NodePath, node: FilterGroup)}
	<div
		class="border-border flex min-w-0 flex-col gap-2 rounded-lg border p-3"
		data-slot="filter-group"
		data-path={path.join('.')}
		data-logical-operator={node.logicalOperator}
	>
		<div class="flex min-w-0 items-center gap-2">
			<ToggleGroup.Root
				type="single"
				size="sm"
				variant="outline"
				{disabled}
				value={node.logicalOperator}
				data-slot="filter-logic"
				onValueChange={(next) =>
					next && edit(path, { ...node, logicalOperator: next as FilterGroup['logicalOperator'] })}
			>
				<ToggleGroup.Item value="and" aria-label="Match all">All</ToggleGroup.Item>
				<ToggleGroup.Item value="or" aria-label="Match any">Any</ToggleGroup.Item>
			</ToggleGroup.Root>
			<span class="text-muted-foreground min-w-0 flex-1 truncate text-xs">of these match</span>
			<Button
				variant="ghost"
				size="sm"
				{disabled}
				data-slot="filter-add-condition"
				onclick={() => commit(appendAt(value, path, makeCondition('', 'is', '')))}
			>
				<PlusIcon />
				Condition
			</Button>
			<Button
				variant="ghost"
				size="sm"
				{disabled}
				data-slot="filter-add-group"
				onclick={() => commit(appendAt(value, path, makeGroup('or')))}
			>
				<PlusIcon />
				Group
			</Button>
			{#if path.length > 0}
				<Button
					variant="ghost"
					size="icon-sm"
					{disabled}
					aria-label="Remove group"
					data-slot="filter-remove"
					onclick={() => commit(removeAt(value, path))}
				>
					<XIcon />
				</Button>
			{/if}
		</div>
		<div class="flex min-w-0 flex-col gap-2">
			{#each node.conditions as child, i (i)}
				{#if child.kind === 'group'}
					{@render groupNode([...path, i], child)}
				{:else}
					{@render conditionRow([...path, i], child)}
				{/if}
			{/each}
			{#if node.conditions.length === 0}
				<p class="text-muted-foreground py-6 text-center text-sm">No conditions.</p>
			{/if}
		</div>
	</div>
{/snippet}

<!--
	A filter tree, edited.

	A row is a field, an operator and a value; a group nests rows under `All` or
	`Any`. The operator menu and the value editor both come from the field's
	`data_type` through core, so a row can only build a filter the API accepts
	(017_filter_operators). A row with no field, or one whose operator still has no
	value, is dropped on serialisation rather than sent.

	The field chooser and the value editors are slots. Left empty they fall back to
	a flat list of the type's filterable fields and to plain inputs and selects; the
	drill-down field picker and the per-type editors plug into the same two slots.
-->
<div
	class={cn('flex w-full min-w-0 flex-col gap-3', disabled && 'opacity-50', className)}
	data-slot="filter-editor"
	data-entity-type={entityType}
	aria-disabled={disabled ? 'true' : undefined}
>
	{@render groupNode([], value)}
</div>
