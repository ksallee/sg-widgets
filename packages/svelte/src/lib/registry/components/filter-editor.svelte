<script lang="ts" module>
	import type { Snippet } from 'svelte';
	import type {
		ConditionValue,
		EntityRef,
		FieldSchema,
		FilterCondition,
		FilterGroup,
		FilterNode,
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

	/** The six types NumberEditor parses. `footage` is numeric to the API and reads as a plain number. */
	const NUMERIC_EDITORS = ['number', 'float', 'percent', 'duration', 'timecode', 'currency'] as const;
	type NumericEditor = (typeof NUMERIC_EDITORS)[number];

	function numericType(dataType: string): NumericEditor {
		return (NUMERIC_EDITORS as readonly string[]).includes(dataType) ? (dataType as NumericEditor) : 'number';
	}

	function textValue(value: Scalar | undefined): string | null {
		if (value === null || value === undefined) return null;
		return typeof value === 'object' ? null : String(value);
	}

	function numberValue(value: Scalar | undefined): number | string | null {
		if (value === null || value === undefined || value === '') return null;
		return typeof value === 'number' || typeof value === 'string' ? value : null;
	}

	function codes(value: ConditionValue): string[] {
		if (!Array.isArray(value)) return [];
		return (value as Scalar[]).filter((v): v is string => typeof v === 'string');
	}

	function scalarText(value: Scalar | undefined): string {
		if (value === null || value === undefined || typeof value === 'object') return '';
		return String(value);
	}

	function parseScalar(kind: string, text: string): Scalar {
		if (text === '') return '';
		return kind === 'number' ? Number(text) : text;
	}

	/** `is` takes one entity hash and `in` a list of them; a list under `is` is a 400 (field_types/entity). */
	function entityRefs(value: ConditionValue): EntityRef[] {
		if (Array.isArray(value)) return value.filter((v) => v !== null && typeof v === 'object') as EntityRef[];
		return value !== null && typeof value === 'object' ? [value as EntityRef] : [];
	}

	function entityRef(value: ConditionValue): EntityRef | null {
		return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as EntityRef) : null;
	}

	/** Every dotted path the tree holds. A flat name needs no resolution. */
	function dottedPaths(node: FilterNode, out: string[] = []): string[] {
		if (node.kind === 'condition') {
			if (node.path.includes('.')) out.push(node.path);
			return out;
		}
		for (const child of node.conditions) dottedPaths(child, out);
		return out;
	}
</script>

<script lang="ts">
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import XIcon from '@lucide/svelte/icons/x';
	import type { SchemaService, SgClient } from '@sg-widgets/core';
	import {
		appendAt,
		applyPreset,
		condition as makeCondition,
		createSchemaService,
		defaultCondition,
		emptyFilter,
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
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import * as ToggleGroup from '$lib/components/ui/toggle-group/index.js';
	import { cn } from '$lib/utils.js';
	import CheckboxEditor from '$lib/registry/components/checkbox-editor.svelte';
	import DateEditor from '$lib/registry/components/date-editor.svelte';
	import DateTimeEditor from '$lib/registry/components/date-time-editor.svelte';
	import EntityMultiPicker from '$lib/registry/components/entity-multi-picker.svelte';
	import EntityPicker from '$lib/registry/components/entity-picker.svelte';
	import FieldPicker from '$lib/registry/components/field-picker.svelte';
	import ListSelect from '$lib/registry/components/list-select.svelte';
	import NumberEditor from '$lib/registry/components/number-editor.svelte';
	import StatusMultiPicker from '$lib/registry/components/status-multi-picker.svelte';
	import StatusPicker from '$lib/registry/components/status-picker.svelte';
	import TextEditor from '$lib/registry/components/text-editor.svelte';

	type Props = {
		/** Type the root of every field path is read on. */
		entityType: string;
		client: SgClient;
		/** Share one across a page so two widgets asking for the same type cost one request. */
		schema?: SchemaService;
		value: FilterGroup;
		/** Paths to keep out of the field list, each hiding itself and everything under it. */
		hidePaths?: string[];
		/** Scopes the status pickers to the codes one project allows. */
		projectId?: number;
		disabled?: boolean;
		onChange?: (value: FilterGroup) => void;
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
		projectId,
		disabled = false,
		onChange,
		fieldChooser,
		valueEditor,
		entityEditor,
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

	/**
	 * The leaf schema of every dotted path the tree holds, added once and kept.
	 * `resolving` is a plain map, so filling the cache never re-triggers the walk.
	 */
	let leaves = $state<Record<string, FieldSchema | null>>({});
	const resolving = new Map<string, Promise<FieldSchema | null>>();

	function leafKey(path: string): string {
		return `${entityType}|${path}`;
	}

	function resolveLeaf(path: string): Promise<FieldSchema | null> {
		const key = leafKey(path);
		let job = resolving.get(key);
		if (!job) {
			job = service.resolvePath(entityType, path).then(
				(segments) => segments[segments.length - 1]?.field ?? null,
				// A path the schema no longer holds still has to be editable, so the row keeps it.
				() => null
			);
			resolving.set(key, job);
			void job.then((leaf) => {
				leaves = { ...leaves, [key]: leaf };
			});
		}
		return job;
	}

	$effect(() => {
		for (const path of dottedPaths(value)) void resolveLeaf(path);
	});

	/** The leaf field of a path. A flat name is a field of the root type. */
	function fieldOf(path: string): FieldSchema | null {
		if (!path) return null;
		if (!path.includes('.')) return fields[path] ?? null;
		return leaves[leafKey(path)] ?? null;
	}

	function dataTypeOf(path: string): string {
		return fieldOf(path)?.dataType ?? '';
	}

	/** True while a dotted path is still being walked; its leaf decides the whole row. */
	function unresolved(path: string): boolean {
		return path.includes('.') && !(leafKey(path) in leaves);
	}

	function commit(next: FilterGroup): void {
		value = next;
		onChange?.(next);
	}

	function edit(path: NodePath, node: FilterCondition | FilterGroup): void {
		commit(replaceAt(value, path, node));
	}

	async function pickField(path: NodePath, current: FilterCondition, chosen: string): Promise<void> {
		const before = dataTypeOf(current.path);
		const after = chosen.includes('.') ? ((await resolveLeaf(chosen))?.dataType ?? '') : dataTypeOf(chosen);
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
	<div data-slot="filter-field" class="w-56 shrink-0">
		{#if fieldChooser}
			{@render fieldChooser({
				entityType,
				path: node.path,
				hidePaths,
				filterableOnly: true,
				disabled,
				onSelect: (next: string) => void pickField(path, node, next)
			})}
		{:else}
			<FieldPicker
				schema={service}
				{entityType}
				{hidePaths}
				{disabled}
				value={node.path}
				deepLinks
				filterableOnly
				clearable={false}
				size="sm"
				placeholder="Select a field"
				onValueChange={(next) => void pickField(path, node, next)}
			/>
		{/if}
	</div>
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

{#snippet scalarEditor(kind: string, dataType: string, label: string, current: Scalar, set: (v: Scalar) => void)}
	{#if kind === 'number'}
		<NumberEditor
			class="min-w-0 flex-1"
			size="sm"
			{disabled}
			dataType={numericType(dataType)}
			field={{ displayName: label, mandatory: false }}
			value={numberValue(current)}
			onValueChange={(next) => set(next ?? '')}
		/>
	{:else if kind === 'date'}
		<DateEditor
			class="min-w-0 flex-1"
			size="sm"
			{disabled}
			field={{ displayName: label, mandatory: false }}
			value={textValue(current)}
			onValueChange={(next) => set(next ?? '')}
		/>
	{:else if kind === 'date_time'}
		<DateTimeEditor
			class="min-w-0 flex-1"
			size="sm"
			hint={false}
			{disabled}
			field={{ displayName: label, mandatory: false }}
			value={textValue(current)}
			onValueChange={(next) => set(next ?? '')}
		/>
	{:else}
		<TextEditor
			class="min-w-0 flex-1"
			size="sm"
			{disabled}
			field={{ displayName: label, mandatory: false }}
			value={textValue(current)}
			onValueChange={(next) => set(next ?? '')}
		/>
	{/if}
{/snippet}

{#snippet entityValue(field: FieldSchema | null, arity: string, current: ConditionValue, set: (v: ConditionValue) => void)}
	{@const types = field?.validTypes?.length ? field.validTypes : [entityType]}
	{#if arity === 'many'}
		<EntityMultiPicker
			class="min-w-0 flex-1"
			size="sm"
			{client}
			{disabled}
			{projectId}
			entityTypes={types}
			placeholder="Search entities"
			value={entityRefs(current)}
			onValueChange={(next) => set([...next])}
		/>
	{:else}
		<EntityPicker
			class="min-w-0 flex-1"
			size="sm"
			{client}
			{disabled}
			{projectId}
			entityTypes={types}
			placeholder="Search entities"
			value={entityRef(current)}
			onValueChange={(next) => set(next ?? '')}
		/>
	{/if}
{/snippet}

{#snippet valueSlot(path: NodePath, node: FilterCondition)}
	{@const field = fieldOf(node.path)}
	{@const dataType = field?.dataType ?? ''}
	{@const kind = valueEditorFor(dataType, node.operator)}
	{@const arity = valueArity(node.operator)}
	{@const set = (v: ConditionValue) => edit(path, { ...node, value: v })}
	<div class="flex min-w-0 grow basis-48 flex-wrap items-center gap-2" data-slot="filter-value">
		{#if unresolved(node.path)}
			<Skeleton class="h-8 min-w-0 flex-1" />
		{:else if valueEditor}
			<!-- Integration point: a caller's own editors replace every one below. -->
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
			<!-- `is empty` and the calendar presets pin their value; there is nothing to edit. -->
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
		{:else if kind === 'entity'}
			{#if entityEditor}
				<!-- Integration point: EntityMultiPicker plugs in here. -->
				{@render entityEditor({
					field,
					dataType,
					operator: node.operator,
					value: node.value,
					arity,
					disabled,
					onChange: set
				})}
			{:else}
				{@render entityValue(field, arity, node.value, set)}
			{/if}
		{:else if kind === 'checkbox'}
			<CheckboxEditor
				class="min-w-0 flex-1"
				size="sm"
				{disabled}
				field={{ displayName: field?.displayName ?? 'Value', mandatory: false }}
				value={node.value === true}
				onValueChange={(next) => set(next)}
			/>
		{:else if kind === 'options' && dataType === 'status_list' && arity === 'many'}
			<StatusMultiPicker
				class="min-w-0 flex-1"
				size="sm"
				{client}
				{disabled}
				{projectId}
				entityType={field?.entityType ?? entityType}
				field={field?.name}
				value={codes(node.value)}
				onValueChange={(next) => set([...next])}
			/>
		{:else if kind === 'options' && dataType === 'status_list'}
			<StatusPicker
				class="min-w-0 flex-1"
				size="sm"
				{client}
				{disabled}
				{projectId}
				entityType={field?.entityType ?? entityType}
				field={field?.name}
				value={typeof node.value === 'string' && node.value !== '' ? node.value : undefined}
				onValueChange={(next) => set(next ?? '')}
			/>
		{:else if kind === 'options' && arity === 'many'}
			{@const picked = codes(node.value)}
			<Popover.Root>
				{@render pickerTrigger(
					picked.length === 0
						? 'Select values…'
						: picked.map((c) => field?.displayValues?.[c] ?? c).join(', '),
					picked.length
				)}
				<Popover.Content strategy="fixed" class="w-64 p-0" align="start">
					<Command.Root>
						<Command.Input placeholder="Search values…" />
						<Command.List>
							<Command.Empty>No value.</Command.Empty>
							{#each field?.validValues ?? [] as code (code)}
								<Command.Item
									value="{field?.displayValues?.[code] ?? code} {code}"
									data-option={code}
									onSelect={() =>
										set(picked.includes(code) ? picked.filter((c) => c !== code) : [...picked, code])}
								>
									<Checkbox checked={picked.includes(code)} tabindex={-1} aria-hidden="true" />
									<span class="min-w-0 flex-1 truncate">{field?.displayValues?.[code] ?? code}</span>
								</Command.Item>
							{/each}
						</Command.List>
					</Command.Root>
				</Popover.Content>
			</Popover.Root>
		{:else if kind === 'options'}
			<ListSelect
				class="min-w-0 flex-1"
				size="sm"
				{disabled}
				{field}
				placeholder="Select a value…"
				value={typeof node.value === 'string' && node.value !== '' ? node.value : null}
				onValueChange={(next) => set(next ?? '')}
			/>
		{:else if arity === 'two'}
			{@const pair = (Array.isArray(node.value) ? node.value : [null, null]) as [Scalar, Scalar]}
			{@render scalarEditor(kind, dataType, 'From', pair[0], (v) => set([v, pair[1]] as ConditionValue))}
			<span class="text-muted-foreground shrink-0 text-sm">and</span>
			{@render scalarEditor(kind, dataType, 'To', pair[1], (v) => set([pair[0], v] as ConditionValue))}
		{:else if arity === 'many'}
			{@const items = (Array.isArray(node.value) ? node.value : []) as Scalar[]}
			<!-- A list of dates, numbers or strings has no per-value editor: one line, comma separated. -->
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
			{@render scalarEditor(kind, dataType, field?.displayName ?? 'Value', node.value as Scalar, (v) => set(v))}
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

	The field is chosen with FieldPicker, which descends through links, so a row may
	filter on a dotted path; the leaf of that path is resolved through the schema
	service and is what picks the operator menu and the value editor. An operator that
	pins its value draws no editor at all.
-->
<div
	class={cn('flex w-full min-w-0 flex-col gap-3', disabled && 'opacity-50', className)}
	data-slot="filter-editor"
	data-entity-type={entityType}
	aria-disabled={disabled ? 'true' : undefined}
>
	{@render groupNode([], value)}
</div>
