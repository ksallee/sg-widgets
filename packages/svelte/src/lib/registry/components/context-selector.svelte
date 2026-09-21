<script lang="ts" module>
	import type { EntityRef, FieldSpec } from 'sg-widgets-core';

	import { CONTROL_GLYPH, type ControlSize } from '$lib/registry/components/control-classes.js';

	export type ContextSelectorSize = ControlSize;

	/**
	 * Controls follow the input ladder of `docs/design-rules.md`. `data-empty` takes the
	 * leading and the vertical inset down one step, so an empty control is tighter than a
	 * filled one; `min-h` holds the ladder and the trailing inset stays reserve for the
	 * clear and open controls.
	 */
	const BOX: Record<ContextSelectorSize, string> = {
		sm: 'min-h-7 pr-2 pl-0.75 py-0.75 data-empty:pl-1.5 data-empty:py-0',
		md: 'min-h-8 pr-3 pl-0.75 py-0.75 data-empty:pl-2 data-empty:py-0',
		lg: 'min-h-9 pr-3 pl-[5px] py-[5px] data-empty:pl-2 data-empty:py-0'
	};
	/** A chip inside a control sits one step down the leaf ladder. */
	const CHIP: Record<ContextSelectorSize, 'xs' | 'sm'> = { sm: 'xs', md: 'sm', lg: 'sm' };
	/** A skeleton stands in for a row, so its leading slot is the row's picture. */
	const LEAD: Record<ContextSelectorSize, string> = { sm: 'size-6', md: 'size-8', lg: 'size-10' };

	/** What a widget or a publish needs to know about where the user is working. */
	export interface WorkContext {
		project: EntityRef | null;
		/** The row the task hangs off: a Shot, an Asset, a Sequence. */
		entity: EntityRef | null;
		task: EntityRef | null;
	}

	/** One assigned task, ready to draw. */
	export interface MyTask {
		task: EntityRef;
		project: EntityRef | null;
		entity: EntityRef | null;
		step: string;
		status: string;
		/** Every field the read answered, so the row anatomy can draw from it. */
		values: Record<string, unknown>;
	}

	export const EMPTY_CONTEXT: WorkContext = { project: null, entity: null, task: null };

	/**
	 * The context a picked row implies. A Task carries its own link and project, so a
	 * path is only read for the rows a search returns.
	 */
	export function contextFromPath(leaf: EntityRef, path: EntityRef[]): WorkContext {
		const project = path.find((r) => r.type === 'Project') ?? null;
		const task = leaf.type === 'Task' ? leaf : null;
		const entity = task
			? ([...path].reverse().find((r) => r.type !== 'Project' && r.type !== 'Task') ?? null)
			: leaf.type === 'Project'
				? null
				: leaf;
		return { project, entity, task };
	}

	function label(context: WorkContext): string {
		return context.task?.name ?? context.entity?.name ?? context.project?.name ?? 'No context';
	}

	function keyOf(context: WorkContext): string {
		return [context.project, context.entity, context.task].map((r) => (r ? `${r.type}:${r.id}` : '-')).join('|');
	}
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { PickerRow, SgContext } from 'sg-widgets-core';
	import { NO_ROWS_LABEL, pathOf, prependRecent, rowFields, watchOverflow } from 'sg-widgets-core';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import History from '@lucide/svelte/icons/history';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import HierarchicalSearch from '$lib/registry/components/hierarchical-search.svelte';
	import { LIST_FADE } from '$lib/registry/components/picker-classes.js';
	import Row from '$lib/registry/components/picker-row.svelte';
	import SearchControl, { type SearchAnswer } from '$lib/registry/components/search-control.svelte';
	import StateLine from '$lib/registry/components/state-line.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The widget context. Every read goes through it, so widgets on a page share one cache. */
		context: SgContext;
		/** The project, the row and the task the user is working in. */
		workContext?: WorkContext;
		/** The person whose tasks the middle section lists. */
		currentUser?: EntityRef | null;
		/** Contexts used before, newest first. Held by the caller. */
		recents?: WorkContext[];
		recentLimit?: number;
		onRecentsChange?: (recents: WorkContext[]) => void;
		onWorkContextChange?: (workContext: WorkContext) => void;
		/** Field holding the thumbnail URL. `false` leaves every task row on its glyph. */
		thumbnail?: string | false;
		/** Field holding a task row's label. Defaults to the task's own name. */
		labelField?: string;
		/** The muted line under the label: a path, or a resolved column. */
		subLabelField?: FieldSpec | null;
		/** The muted line of the caller's own making. Wins over `subLabelField`. */
		subLabel?: (task: MyTask) => string;
		/** The right-aligned value: a path, or a resolved column so it renders by type. */
		secondaryField?: FieldSpec | null;
		/** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
		secondary?: (task: MyTask) => string;
		/** Show the row's `code` beside the label when the two differ. */
		showCode?: boolean;
		/** Extra fields to request, so a caller's own sub-label or secondary can read them. */
		fields?: string[];
		/** Shown when the person has no task assigned. */
		emptyLabel?: string;
		/** The accessible name of the skeletons a read stands behind. */
		loadingLabel?: string;
		/** Shown in place of what the failed read said. */
		errorLabel?: string;
		size?: ContextSelectorSize;
		/** Whether the popover is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	};

	let {
		context,
		workContext = EMPTY_CONTEXT,
		currentUser = null,
		recents = [],
		recentLimit = 5,
		onRecentsChange,
		onWorkContextChange,
		thumbnail = 'image',
		labelField,
		subLabelField = null,
		subLabel,
		secondaryField = 'sg_status_list',
		secondary,
		showCode = false,
		fields = [],
		emptyLabel = NO_ROWS_LABEL,
		loadingLabel,
		errorLabel,
		size = 'md',
		open = $bindable(false),
		onOpenChange,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// Each section fades at whichever edge has more past it, per rule 9 of the design rules.
	let recentsEl = $state<HTMLDivElement | null>(null);
	let tasksEl = $state<HTMLDivElement | null>(null);
	$effect(() => watchOverflow(recentsEl));
	$effect(() => watchOverflow(tasksEl));

	const rootPath = $derived(workContext.project ? `/Project/${workContext.project.id}` : '/');
	const chips = $derived(
		[workContext.project, workContext.entity, workContext.task].filter((r): r is EntityRef => r !== null)
	);

	/** Tasks under their project, in the order the projects first appear. */
	function groupTasks(tasks: MyTask[]): Array<{ project: EntityRef | null; tasks: MyTask[] }> {
		const groups = new Map<string, { project: EntityRef | null; tasks: MyTask[] }>();
		for (const row of tasks) {
			const key = row.project ? `${row.project.type}:${row.project.id}` : '-';
			const group = groups.get(key);
			if (group) group.tasks.push(row);
			else groups.set(key, { project: row.project, tasks: [row] });
		}
		return [...groups.values()];
	}

	/** The tasks assigned to the current user. */
	async function loadTasks(): Promise<SearchAnswer<MyTask>> {
		const user = currentUser;
		if (!user) return { items: [] };
		const result = await context.client.search('Task', {
			// `task_assignees` is a multi_entity of Group and HumanUser (entity_types/Task).
			filters: { logical_operator: 'and', conditions: [['task_assignees', 'in', [{ type: user.type, id: user.id }]]] },
			// A Task is named by `content`: it has no `code` and no `name` (entity_types/Task).
			fields: rowFields({ thumbnail, labelField, subLabelField, secondaryField, showCode, fields }, [
				'content',
				'sg_status_list',
				'project',
				'entity',
				'step'
			]),
			page: { size: 50 }
		});
		return {
			items: result.data.map((row) => {
				const values: Record<string, unknown> = { ...row.attributes };
				for (const [name, link] of Object.entries(row.relationships)) values[name] = link?.data ?? null;
				const named = labelField ? values[labelField] : undefined;
				const label =
					typeof named === 'string' && named.length > 0 ? named : String(row.attributes['content'] ?? `Task #${row.id}`);
				return {
					task: { type: 'Task', id: row.id, name: label },
					project: (row.relationships['project']?.data as EntityRef | null) ?? null,
					entity: (row.relationships['entity']?.data as EntityRef | null) ?? null,
					step: (row.relationships['step']?.data as EntityRef | null)?.name ?? '',
					status: String(row.attributes['sg_status_list'] ?? ''),
					values
				};
			})
		};
	}

	function setOpen(next: boolean): void {
		if (next === open) return;
		open = next;
		onOpenChange?.(next);
	}

	/** The row a task draws as: the reference and every field the read answered. */
	function rowOf(task: MyTask): PickerRow {
		return { type: 'Task', id: task.task.id, name: task.task.name ?? '', values: task.values };
	}

	/**
	 * The muted line under the label. With no field and no function of the caller's,
	 * it is what the task hangs off and the step it belongs to.
	 */
	function subLabelOf(task: MyTask): string | undefined {
		if (subLabel) return subLabel(task);
		if (pathOf(subLabelField)) return undefined;
		return [task.entity?.name, task.step].filter(Boolean).join(' · ');
	}

	function apply(next: WorkContext): void {
		onRecentsChange?.(prependRecent(recents, next, recentLimit, keyOf));
		onWorkContextChange?.(next);
		setOpen(false);
	}

	const heading = 'text-muted-foreground px-2 py-1.5 text-xs font-medium';
	const rowClass =
		'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2';
	/** A recent is a row of chips, and the chips carry the hover; the row itself stays quiet. */
	const recentClass =
		'focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2';
</script>

<!--
	The project, the row and the task the user is working on.

	The three ways in are the three sections: contexts used before, the tasks assigned
	to the current user, and a drill-down over the navigation tree. Assigned tasks are
	one `_search` on Task filtered by `task_assignees`, grouped under their project.
-->
{#snippet noTasks()}
	<StateLine state="empty" slotName="context-tasks-empty" icon={ListChecks} label={emptyLabel} />
{/snippet}

{#snippet taskRows({ items }: { items: MyTask[]; query: string; loading: boolean })}
	{#each groupTasks(items) as group (group.project ? `${group.project.type}:${group.project.id}` : '-')}
		<h5 class={heading}>{group.project?.name ?? 'No project'}</h5>
		{#each group.tasks as row (row.task.id)}
			<button
				type="button"
				class={rowClass}
				data-entity-type="Task"
				data-entity-id={row.task.id}
				onclick={() => apply({ project: row.project, entity: row.entity, task: row.task })}
			>
				<Row
					row={rowOf(row)}
					{thumbnail}
					{showCode}
					{subLabelField}
					subLabel={subLabelOf(row)}
					{secondaryField}
					secondary={secondary ? secondary(row) : undefined}
					{size}
					{context}
				>
					{#snippet glyph()}<ListChecks aria-hidden="true" class="size-4" />{/snippet}
				</Row>
			</button>
		{/each}
	{/each}
{/snippet}

<div bind:this={ref} data-slot="context-selector" class={cn('w-full', className)} {...rest}>
	<Popover.Root bind:open={() => open, setOpen}>
		<Popover.Trigger
			data-slot="context-selector-trigger"
			data-size={size}
			data-empty={chips.length === 0 ? '' : undefined}
			class={cn(
				'border-input bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 items-center gap-1.5 rounded-lg border text-left text-sm shadow-xs outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
				BOX[size]
			)}
			aria-label={`Context: ${label(workContext)}`}
		>
			<span class="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
				{#if chips.length === 0}
					<span class="text-muted-foreground text-sm">No context</span>
				{:else}
					{#each chips as chip (`${chip.type}:${chip.id}`)}
						<EntityChip entity={chip} size={CHIP[size]} {context} />
					{/each}
				{/if}
			</span>
			<ChevronDown aria-hidden="true" class={cn('text-muted-foreground shrink-0', CONTROL_GLYPH[size])} />
		</Popover.Trigger>

		<!-- Fixed: the Command list inside scrolls its cursor into view on mount, and an absolute
		     wrapper still at the page origin would drag the page there with it. -->
		<Popover.Content
			strategy="fixed"
			align="start"
			class="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 p-3"
		>
			<section data-slot="context-recents" class="flex min-h-0 flex-col">
				<h4 class={heading}>Recent</h4>
				<div bind:this={recentsEl} class={cn('flex max-h-28 flex-col overflow-y-auto', LIST_FADE)}>
					{#if recents.length === 0}
						<StateLine state="empty" slotName="context-recents-empty" icon={History} label="Nothing yet." />
					{:else}
						{#each recents as recent (keyOf(recent))}
							<button type="button" class={recentClass} onclick={() => apply(recent)}>
								<span class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
									{#each [recent.project, recent.entity, recent.task].filter((r) => r !== null) as chip (`${chip.type}:${chip.id}`)}
										<EntityChip entity={chip} size={CHIP[size]} {context} />
									{/each}
								</span>
							</button>
						{/each}
					{/if}
				</div>
			</section>

			<section data-slot="context-my-tasks" class="flex min-h-0 flex-col">
				<h4 class={heading}>My tasks</h4>
				<div bind:this={tasksEl} class={cn('flex max-h-52 flex-col overflow-y-auto', LIST_FADE)}>
					<SearchControl
						load={loadTasks}
						shell="bare"
						readsEmpty
						enabled={currentUser !== null}
						request={currentUser ? `${currentUser.type}:${currentUser.id}` : ''}
						errorSlot="context-tasks-error"
						loadingSlot={null}
						skeletonLines={2}
						skeletonLead={cn('shrink-0', LEAD[size])}
						{loadingLabel}
						{errorLabel}
						rows={taskRows}
						empty={noTasks}
					/>
				</div>
			</section>

			<section data-slot="context-hierarchy" class="flex flex-col">
				<h4 class={heading}>Browse</h4>
				<HierarchicalSearch
					{context}
					{rootPath}
					{size}
					{thumbnail}
					{labelField}
					{subLabelField}
					{showCode}
					{fields}
					onSelect={(leaf, path) => apply(contextFromPath(leaf, path))}
					placeholder="Search for a task or a shot…"
				/>
			</section>
		</Popover.Content>
	</Popover.Root>
</div>
