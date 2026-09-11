<!--
	One screen built from the widgets, so the set can be read as one hand.

	Every part carries `data-qa-widget`, and a control carries `data-qa-size`, so
	`tools/drives/consistency.js` measures a widget without knowing its markup. A cell
	marked `data-qa-popup` names the control the drive opens to reach a popup.
-->
<script lang="ts">
	import type {
		CollectionColumn,
		EntityRef,
		FieldSchema,
		FilterGroup,
		SortKey,
		StatusRecord,
		UrlValue,
		UrlWriteValue
	} from '@sg-widgets/core';
	import { createEntitySource, emptyFilter, resolveColumns, toSortSpecs } from '@sg-widgets/core';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Popover from '$lib/components/ui/popover/index.js';
	import CheckboxEditor from '$lib/registry/components/checkbox-editor.svelte';
	import ColorEditor from '$lib/registry/components/color-editor.svelte';
	import ColumnPicker from '$lib/registry/components/column-picker.svelte';
	import ContextSelector, {
		type WorkContext
	} from '$lib/registry/components/context-selector.svelte';
	import DateEditor from '$lib/registry/components/date-editor.svelte';
	import DateTimeEditor from '$lib/registry/components/date-time-editor.svelte';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import EntityGrid from '$lib/registry/components/entity-grid.svelte';
	import EntityMultiPicker from '$lib/registry/components/entity-multi-picker.svelte';
	import EntityPicker from '$lib/registry/components/entity-picker.svelte';
	import EntityTable from '$lib/registry/components/entity-table.svelte';
	import EntityTree from '$lib/registry/components/entity-tree.svelte';
	import EntityTypeMultiPicker from '$lib/registry/components/entity-type-multi-picker.svelte';
	import EntityTypePicker from '$lib/registry/components/entity-type-picker.svelte';
	import FieldPicker from '$lib/registry/components/field-picker.svelte';
	import FilterBar from '$lib/registry/components/filter-bar.svelte';
	import GlobalSearch from '$lib/registry/components/global-search.svelte';
	import ListPicker from '$lib/registry/components/list-picker.svelte';
	import NumberEditor from '$lib/registry/components/number-editor.svelte';
	import ProjectPicker from '$lib/registry/components/project-picker.svelte';
	import SortPicker from '$lib/registry/components/sort-picker.svelte';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import StatusMultiPicker from '$lib/registry/components/status-multi-picker.svelte';
	import StatusPicker from '$lib/registry/components/status-picker.svelte';
	import TextEditor from '$lib/registry/components/text-editor.svelte';
	import UrlEditor from '$lib/registry/components/url-editor.svelte';
	import UserAvatar from '$lib/registry/components/user-avatar.svelte';
	import UserMultiPicker from '$lib/registry/components/user-multi-picker.svelte';
	import UserPicker from '$lib/registry/components/user-picker.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';

	type Size = 'sm' | 'md' | 'lg';

	const SIZES: Size[] = ['sm', 'md', 'lg'];
	const WIDTHS: Record<string, number> = {
		code: 220,
		sg_status_list: 140,
		user: 150,
		description: 220
	};
	const SHOWN = Object.keys(WIDTHS);

	const context = createDemoContext();
	setDemoContext(context);

	const projectId = context.projectId;
	const project: EntityRef = context.live
		? { type: 'Project', id: projectId }
		: { type: 'Project', id: projectId, name: 'Blue Moon Rising' };
	const asset: EntityRef = { type: 'Asset', id: 1226, name: 'charAda' };
	const person: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };
	const shot: EntityRef = { type: 'Shot', id: 862, name: 'sh010_0010' };
	const work: WorkContext = { project, entity: asset, task: null };

	const versionType: Pick<FieldSchema, 'displayName' | 'mandatory' | 'validValues'> = {
		displayName: 'Version Type',
		mandatory: false,
		validValues: ['Type A', 'Type B', 'Type C']
	};

	const source = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: SHOWN,
		mode: 'pages',
		pageSize: 8
	});

	const gridSource = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: ['code', 'image', 'sg_status_list', 'user'],
		pageSize: 8
	});

	let columns = $state<CollectionColumn[]>([]);
	let filter = $state<FilterGroup>(emptyFilter());
	let sortKeys = $state<SortKey[]>([]);
	let paths = $state<string[]>([...SHOWN]);

	let note = $state<string | null>('Plate handed over with the cut change.');
	let frames = $state<number | null>(1001);
	let turnover = $state<string | null>('2026-09-02');
	let approvedAt = $state<string | null>('2026-03-04T13:06:07Z');
	let flagged = $state(true);
	let listValue = $state<string | null>('Type A');
	let colour = $state<string | null>('0,126,174');
	let movie = $state<UrlValue | null>({
		url: 'https://example.com/plate.mov',
		name: 'plate.mov',
		link_type: 'web'
	});

	async function load(): Promise<{ statuses: Record<string, StatusRecord>; field: FieldSchema }> {
		const [resolved, table, fields] = await Promise.all([
			resolveColumns(
				context.schema,
				'Version',
				SHOWN.map((path) => ({ path, width: WIDTHS[path] }))
			),
			context.statuses.byCode(),
			context.client.fields('Version')
		]);
		columns = resolved;
		return {
			statuses: Object.fromEntries(table),
			field: fields['sg_status_list'] as FieldSchema
		};
	}

	async function pickColumns(next: string[]): Promise<void> {
		paths = next;
		columns = await resolveColumns(
			context.schema,
			'Version',
			next.map((path) => ({ path, width: WIDTHS[path] ?? 160 }))
		);
	}

	const page = 'flex w-full min-w-0 flex-col gap-6';
	const section = 'flex min-w-0 flex-col gap-3';
	const heading = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const field = 'flex min-w-0 flex-col gap-2';
	const fieldLabel = 'text-sm font-medium';
	const cell = 'flex min-w-0 flex-col gap-2';
	const cellLabel = 'text-muted-foreground text-xs';
</script>

{#snippet pickers(size: Size)}
	<div class="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
		<div
			class={cell}
			data-qa-widget="entity-picker"
			data-qa-size={size}
			data-qa-popup={size === 'md' ? 'entity-picker-trigger' : undefined}
		>
			<span class={cellLabel}>Entity</span>
			<EntityPicker {context} entityTypes={['Asset']} {size} value={asset} />
		</div>
		<div class={cell} data-qa-widget="entity-multi-picker" data-qa-size={size}>
			<span class={cellLabel}>Entities</span>
			<EntityMultiPicker {context} entityTypes={['Asset']} {size} value={[asset]} />
		</div>
		<div class={cell} data-qa-widget="user-picker" data-qa-size={size}>
			<span class={cellLabel}>Artist</span>
			<UserPicker {context} {size} value={person} />
		</div>
		<div class={cell} data-qa-widget="user-multi-picker" data-qa-size={size}>
			<span class={cellLabel}>Reviewers</span>
			<UserMultiPicker {context} {size} value={[person]} />
		</div>
		<div class={cell} data-qa-widget="project-picker" data-qa-size={size}>
			<span class={cellLabel}>Project</span>
			<ProjectPicker {context} {size} value={project} />
		</div>
		<div
			class={cell}
			data-qa-widget="status-picker"
			data-qa-size={size}
			data-qa-popup={size === 'md' ? 'status-picker-control' : undefined}
		>
			<span class={cellLabel}>Status</span>
			<StatusPicker {context} entityType="Version" {projectId} {size} value="ip" />
		</div>
		<div class={cell} data-qa-widget="status-multi-picker" data-qa-size={size}>
			<span class={cellLabel}>Statuses</span>
			<StatusMultiPicker {context} entityType="Version" {projectId} {size} value={['ip', 'apr']} />
		</div>
		<div class={cell} data-qa-widget="entity-type-picker" data-qa-size={size}>
			<span class={cellLabel}>Type</span>
			<EntityTypePicker {context} {size} value="Shot" />
		</div>
		<div class={cell} data-qa-widget="entity-type-multi-picker" data-qa-size={size}>
			<span class={cellLabel}>Types</span>
			<EntityTypeMultiPicker {context} {size} value={['Shot', 'Asset']} />
		</div>
		<div
			class={cell}
			data-qa-widget="field-picker"
			data-qa-size={size}
			data-qa-popup={size === 'md' ? 'field-picker-trigger' : undefined}
		>
			<span class={cellLabel}>Field</span>
			<FieldPicker {context} entityType="Version" {size} value="code" />
		</div>
		<div class={cell} data-qa-widget="context-selector" data-qa-size={size}>
			<span class={cellLabel}>Context</span>
			<ContextSelector {context} {size} workContext={work} currentUser={person} />
		</div>
	</div>
{/snippet}

{#await load()}
	<p class="text-muted-foreground text-sm">Loading the site…</p>
{:then { statuses, field: statusField }}
	<div class={page}>
		<div
			class="flex min-w-0 flex-wrap items-center gap-2"
			data-qa-widget="toolbar"
			data-qa-region="toolbar"
		>
			<div class="min-w-0 flex-1" data-qa-widget="filter-bar" data-qa-size="md">
				<FilterBar entityType="Version" {context} facets={['sg_status_list']} bind:value={filter} />
			</div>
			<div data-qa-widget="sort-picker" data-qa-size="md" data-qa-popup="sort-trigger">
				<SortPicker entityType="Version" {context} bind:value={sortKeys} />
			</div>
			<div data-qa-widget="column-picker" data-qa-size="md">
				<Popover.Root>
					<Popover.Trigger>
						{#snippet child({ props })}
							<Button variant="outline" {...props}>Columns</Button>
						{/snippet}
					</Popover.Trigger>
					<Popover.Content strategy="fixed" align="start" class="w-72">
						<ColumnPicker
							{context}
							entityType="Version"
							deepLinks={false}
							filter={(_field, path) => SHOWN.includes(path)}
							value={paths}
							onValueChange={(next) => void pickColumns(next)}
						/>
					</Popover.Content>
				</Popover.Root>
			</div>
			<div class="w-64 min-w-0" data-qa-widget="global-search" data-qa-size="md">
				<GlobalSearch
					{context}
					entityTypes={['Shot', 'Asset', 'Version', 'Task']}
					{projectId}
					inline
					placeholder="Search this project…"
				/>
			</div>
		</div>

		<div class="grid min-w-0 gap-4 lg:grid-cols-3">
			<div class="min-w-0 lg:col-span-2" data-qa-widget="entity-table" data-qa-size="md">
				<EntityTable
					{source}
					bind:columns
					filters={filter}
					sort={toSortSpecs(sortKeys)}
					{statuses}
					{context}
					editable
					paging="pages"
					maxHeight="22rem"
				/>
			</div>
			<div class="min-w-0" data-qa-widget="entity-tree" data-qa-size="md">
				<EntityTree
					{context}
					rootPath={`/Project/${projectId}`}
					searchable
					maxHeight="22rem"
				/>
			</div>
		</div>

		<section class={section} data-qa-widget="entity-grid" data-qa-size="sm">
			<h4 class={heading}>Versions</h4>
			<EntityGrid source={gridSource} {context} size="sm" maxHeight="20rem" />
		</section>

		<section class={section}>
			<h4 class={heading}>Version details</h4>
			<div class="grid min-w-0 gap-4 sm:grid-cols-2">
				<div class={field} data-qa-widget="text-editor" data-qa-size="md">
					<span class={fieldLabel}>Description</span>
					<TextEditor bind:value={note} field={{ displayName: 'Description', mandatory: false }} />
				</div>
				<div class={field} data-qa-widget="number-editor" data-qa-size="md">
					<span class={fieldLabel}>Frame count</span>
					<NumberEditor
						bind:value={frames}
						dataType="number"
						field={{ displayName: 'Frame Count', mandatory: false }}
					/>
				</div>
				<div class={field} data-qa-widget="date-editor" data-qa-size="md" data-qa-popup="date-editor-trigger">
					<span class={fieldLabel}>Turnover date</span>
					<DateEditor
						bind:value={turnover}
						field={{ displayName: 'Turnover Date', mandatory: false }}
					/>
				</div>
				<div class={field} data-qa-widget="date-time-editor" data-qa-size="md">
					<span class={fieldLabel}>Client approved at</span>
					<DateTimeEditor
						bind:value={approvedAt}
						timeZone="America/Los_Angeles"
						field={{ displayName: 'Client Approved At', mandatory: false }}
					/>
				</div>
				<div class={field} data-qa-widget="checkbox-editor" data-qa-size="md">
					<span class={fieldLabel}>Flagged</span>
					<CheckboxEditor bind:value={flagged} field={{ displayName: 'Flagged', mandatory: false }} />
				</div>
				<div class={field} data-qa-widget="list-picker" data-qa-size="md">
					<span class={fieldLabel}>Version type</span>
					<ListPicker bind:value={listValue} field={versionType} />
				</div>
				<div class={field} data-qa-widget="color-editor" data-qa-size="md">
					<span class={fieldLabel}>Colour</span>
					<ColorEditor bind:value={colour} field={{ displayName: 'Color', mandatory: false }} />
				</div>
				<div class={field} data-qa-widget="url-editor" data-qa-size="md">
					<span class={fieldLabel}>Uploaded movie</span>
					<UrlEditor
						value={movie}
						onValueChange={(next: UrlWriteValue | null) => (movie = next as UrlValue | null)}
						field={{ displayName: 'Uploaded Movie', mandatory: false }}
					/>
				</div>
			</div>
		</section>

		<section class={section}>
			<h4 class={heading}>Pickers</h4>
			{#each SIZES as size (size)}
				{@render pickers(size)}
			{/each}
		</section>

		<p class="text-sm" data-qa-widget="inline-atoms">
			The plate is
			<span data-qa-widget="status-badge" data-qa-size="md">
				<StatusBadge code="ip" status={statuses['ip']} field={statusField} />
			</span>
			on
			<span data-qa-widget="entity-chip" data-qa-size="md">
				<EntityChip entity={shot} />
			</span>
			and
			<span data-qa-widget="user-avatar" data-qa-size="md">
				<UserAvatar name={person.name ?? ''} />
			</span>
			has it until the turnover.
		</p>
	</div>
{:catch error}
	<p class="text-destructive text-sm">{error.message}</p>
{/await}
