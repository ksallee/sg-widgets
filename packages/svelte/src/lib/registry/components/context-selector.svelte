<script lang="ts" module>
	import type { EntityRef } from '@sg-widgets/core';

	export type ContextSelectorSize = 'sm' | 'md' | 'lg';

	/** The trigger follows the input ladder of `docs/design-rules.md`. */
	const BOX: Record<ContextSelectorSize, string> = {
		sm: 'min-h-8 px-2 py-1',
		md: 'min-h-9 px-2 py-1.5',
		lg: 'min-h-10 px-3 py-1.5'
	};
	const GLYPH: Record<ContextSelectorSize, string> = { sm: 'size-4', md: 'size-4', lg: 'size-5' };
	/** A chip inside a control sits one step down the leaf ladder. */
	const CHIP: Record<ContextSelectorSize, 'sm' | 'md'> = { sm: 'sm', md: 'sm', lg: 'md' };

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
	import type { FieldSchema, SgClient, StatusRecord } from '@sg-widgets/core';
	import { createSchemaService } from '@sg-widgets/core';
	import ChevronDown from '@lucide/svelte/icons/chevron-down';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import HierarchicalSearch from '$lib/registry/components/hierarchical-search.svelte';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** Where rows come from. Wrap it in `createQueryCache` once for the whole app. */
		client: SgClient;
		context?: WorkContext;
		/** The person whose tasks the middle section lists. */
		currentUser?: EntityRef | null;
		/** Contexts used before, newest first. Held by the caller. */
		recents?: WorkContext[];
		recentLimit?: number;
		onRecentsChange?: (recents: WorkContext[]) => void;
		onContextChange?: (context: WorkContext) => void;
		size?: ContextSelectorSize;
		/** Whether the popover is showing, two-way. */
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
		class?: string;
	};

	let {
		client,
		context = EMPTY_CONTEXT,
		currentUser = null,
		recents = [],
		recentLimit = 5,
		onRecentsChange,
		onContextChange,
		size = 'md',
		open = $bindable(false),
		onOpenChange,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const schema = $derived(createSchemaService(client));

	let tasks = $state<MyTask[]>([]);
	/** True until the first read of the assigned tasks lands. */
	let loading = $state(true);
	let failure = $state<string | null>(null);
	let statuses = $state<Record<string, StatusRecord>>({});
	let statusField = $state<FieldSchema | null>(null);

	const rootPath = $derived(context.project ? `/Project/${context.project.id}` : '/');
	const chips = $derived(
		[context.project, context.entity, context.task].filter((r): r is EntityRef => r !== null)
	);
	/** Tasks under their project, in the order the projects first appear. */
	const byProject = $derived.by(() => {
		const groups = new Map<string, { project: EntityRef | null; tasks: MyTask[] }>();
		for (const row of currentUser ? tasks : []) {
			const key = row.project ? `${row.project.type}:${row.project.id}` : '-';
			const group = groups.get(key);
			if (group) group.tasks.push(row);
			else groups.set(key, { project: row.project, tasks: [row] });
		}
		return [...groups.values()];
	});

	$effect(() => {
		let live = true;
		void Promise.all([client.statuses(), schema.field('Task', 'sg_status_list')])
			.then(([rows, field]) => {
				if (!live) return;
				statuses = Object.fromEntries(rows.map((s) => [s.code, s]));
				statusField = field ?? null;
			})
			.catch(() => {
				// A badge falls back to the raw code, which is always readable.
			});
		return () => {
			live = false;
		};
	});

	$effect(() => {
		const user = currentUser;
		if (!user) return;
		let live = true;
		void client
			.search('Task', {
				// `task_assignees` is a multi_entity of Group and HumanUser (entity_types/Task).
				filters: { logical_operator: 'and', conditions: [['task_assignees', 'in', [{ type: user.type, id: user.id }]]] },
				// A Task is named by `content`: it has no `code` and no `name` (entity_types/Task).
				fields: ['content', 'sg_status_list', 'project', 'entity', 'step'],
				page: { size: 50 }
			})
			.then((result) => {
				if (!live) return;
				tasks = result.data.map((row) => ({
					task: { type: 'Task', id: row.id, name: String(row.attributes['content'] ?? `Task #${row.id}`) },
					project: (row.relationships['project']?.data as EntityRef | null) ?? null,
					entity: (row.relationships['entity']?.data as EntityRef | null) ?? null,
					step: (row.relationships['step']?.data as EntityRef | null)?.name ?? '',
					status: String(row.attributes['sg_status_list'] ?? '')
				}));
			})
			.catch((error: unknown) => {
				if (!live) return;
				failure = error instanceof Error ? error.message : String(error);
				tasks = [];
			})
			.finally(() => {
				if (live) loading = false;
			});
		return () => {
			live = false;
		};
	});

	function setOpen(next: boolean): void {
		if (next === open) return;
		open = next;
		onOpenChange?.(next);
	}

	function apply(next: WorkContext): void {
		onRecentsChange?.([next, ...recents.filter((r) => keyOf(r) !== keyOf(next))].slice(0, recentLimit));
		onContextChange?.(next);
		setOpen(false);
	}

	const heading = 'text-muted-foreground px-2 py-1.5 text-xs font-medium';
	const rowClass =
		'hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2';
</script>

<!--
	The project, the row and the task the user is working on.

	The three ways in are the three sections: contexts used before, the tasks assigned
	to the current user, and a drill-down over the navigation tree. Assigned tasks are
	one `_search` on Task filtered by `task_assignees`, grouped under their project.
-->
<div bind:this={ref} data-slot="context-selector" class={cn('w-full', className)} {...rest}>
	<Popover.Root bind:open={() => open, setOpen}>
		<Popover.Trigger
			data-slot="context-selector-trigger"
			data-size={size}
			class={cn(
				'border-border bg-background hover:bg-accent hover:text-accent-foreground focus-visible:ring-ring focus-visible:ring-offset-background flex w-full min-w-0 items-center gap-2 rounded-md border text-left outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2',
				BOX[size]
			)}
			aria-label={`Context: ${label(context)}`}
		>
			<span class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
				{#if chips.length === 0}
					<span class="text-muted-foreground text-sm">No context</span>
				{:else}
					{#each chips as chip (`${chip.type}:${chip.id}`)}
						<EntityChip entity={chip} size={CHIP[size]} />
					{/each}
				{/if}
			</span>
			<ChevronDown aria-hidden="true" class={cn('text-muted-foreground shrink-0', GLYPH[size])} />
		</Popover.Trigger>

		<!-- Fixed: the Command list inside scrolls its cursor into view on mount, and an absolute
		     wrapper still at the page origin would drag the page there with it. -->
		<Popover.Content
			strategy="fixed"
			align="start"
			class="flex w-96 max-w-[calc(100vw-2rem)] flex-col gap-3 p-3"
		>
			<section data-slot="context-recents" class="flex max-h-28 flex-col overflow-y-auto">
				<h4 class={heading}>Recent</h4>
				{#if recents.length === 0}
					<p class="text-muted-foreground px-2 py-1.5 text-sm">Nothing yet.</p>
				{:else}
					{#each recents as recent (keyOf(recent))}
						<button type="button" class={rowClass} onclick={() => apply(recent)}>
							<span class="flex min-w-0 flex-1 flex-wrap items-center gap-2">
								{#each [recent.project, recent.entity, recent.task].filter((r) => r !== null) as chip (`${chip.type}:${chip.id}`)}
									<EntityChip entity={chip} size={CHIP[size]} />
								{/each}
							</span>
						</button>
					{/each}
				{/if}
			</section>

			<section data-slot="context-my-tasks" class="flex max-h-52 flex-col overflow-y-auto">
				<h4 class={heading}>My tasks</h4>
				{#if failure !== null}
					<p class="text-muted-foreground flex items-center justify-center gap-1.5 py-6 text-sm">
						<TriangleAlert aria-hidden="true" class="size-4" />
						<span class="truncate">{failure}</span>
					</p>
				{:else if loading && currentUser}
					<div class="flex flex-col gap-2 p-1" aria-busy="true">
						{#each [0, 1] as line (line)}
							<div class="flex items-center gap-2 px-2 py-1.5">
								<Skeleton class="size-4 shrink-0" />
								<div class="flex min-w-0 flex-1 flex-col gap-1">
									<Skeleton class="h-3 w-1/2" />
									<Skeleton class="h-2.5 w-1/4" />
								</div>
							</div>
						{/each}
					</div>
				{:else if byProject.length === 0}
					<p class="text-muted-foreground px-2 py-1.5 text-sm">No tasks assigned.</p>
				{:else}
					{#each byProject as group (group.project ? `${group.project.type}:${group.project.id}` : '-')}
						<h5 class={heading}>{group.project?.name ?? 'No project'}</h5>
						{#each group.tasks as row (row.task.id)}
							<button
								type="button"
								class={rowClass}
								data-entity-type="Task"
								data-entity-id={row.task.id}
								onclick={() => apply({ project: row.project, entity: row.entity, task: row.task })}
							>
								<ListChecks aria-hidden="true" class="text-muted-foreground size-4 shrink-0" />
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="truncate" title={row.task.name}>{row.task.name}</span>
									<span class="text-muted-foreground truncate text-xs">
										{[row.entity?.name, row.step].filter(Boolean).join(' · ')}
									</span>
								</span>
								<StatusBadge
									code={row.status}
									status={statuses[row.status]}
									field={statusField}
									size={CHIP[size]}
								/>
							</button>
						{/each}
					{/each}
				{/if}
			</section>

			<section data-slot="context-hierarchy" class="flex flex-col gap-2">
				<h4 class={heading}>Browse</h4>
				<HierarchicalSearch
					{client}
					{rootPath}
					{size}
					onSelect={(leaf, path) => apply(contextFromPath(leaf, path))}
					placeholder="Search for a task or a shot…"
				/>
			</section>
		</Popover.Content>
	</Popover.Root>
</div>
