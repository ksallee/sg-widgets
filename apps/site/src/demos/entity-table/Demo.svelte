<script lang="ts">
	import type { BulkEdit, CollapseState, CollectionColumn, EditorPlacement, EntityRef, EntityRow, FilterGroup, PagingMode, SortKey, StatusRecord } from 'sg-widgets-core';
	import {
		collapseAll,
		condition,
		createEntitySource,
		emptyFilter,
		expandAll,
		group,
		resolveColumns,
		toSortSpecs
	} from 'sg-widgets-core';
	import EntityTable from '$lib/registry/components/entity-table.svelte';
	import { Button } from '$lib/components/ui/button/index.js';
	import * as Dialog from '$lib/components/ui/dialog/index.js';
	import FilterBar from '$lib/registry/components/filter-bar.svelte';
	import SortPicker from '$lib/registry/components/sort-picker.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoContext } from '../_shared/svelte';

	const WIDTHS: Record<string, number> = {
		code: 260,
		entity: 150,
		'entity.Shot.sg_turnover_date': 170,
		sg_status_list: 150,
		image: 90,
		description: 260,
		client_approved: 130,
		frame_count: 90,
		user: 160,
		created_at: 170,
		updated_at: 170
	};
	const PATHS = Object.keys(WIDTHS);
	const SHOWN = ['code', 'entity', 'entity.Shot.sg_turnover_date', 'sg_status_list', 'image', 'description', 'client_approved', 'frame_count', 'user'];
	const FACETS = ['sg_status_list'];
	const PAGING: Array<{ value: PagingMode; label: string }> = [
		{ value: 'pages', label: 'Pages' },
		{ value: 'more', label: 'Load more' },
		{ value: 'scroll', label: 'Scroll' }
	];

	const context = createDemoContext({ counts: { versions: 320 } });
	setDemoContext(context);

	// The mock's rows are one project's already; a real site's are not.
	const scope = context.live
		? group('and', [condition('project', 'is', { type: 'Project', id: context.projectId })])
		: null;

	const source = createEntitySource({
		client: context.client,
		entityType: 'Version',
		fields: PATHS,
		filters: scope,
		mode: 'pages',
		pageSize: 25
	});

	let columns = $state<CollectionColumn[]>([]);
	let filter = $state<FilterGroup>(emptyFilter());
	let sortKeys = $state<SortKey[]>([]);
	let selected = $state<EntityRef[]>([]);
	let grouped = $state(false);
	let collapsed = $state<CollapseState>(expandAll());
	let compact = $state(false);
	let paging = $state<PagingMode>('pages');
	let placement = $state<EditorPlacement>('popover');
	let editOnClick = $state(false);
	const PLACEMENTS: Array<{ value: EditorPlacement; label: string }> = [
		{ value: 'popover', label: 'Popover editor' },
		{ value: 'inline', label: 'Inline editor' }
	];

	async function load(): Promise<{ statuses: Record<string, StatusRecord> }> {
		const [resolved, table] = await Promise.all([
			resolveColumns(
				context.schema,
				'Version',
				SHOWN.map((path) => ({ path, width: WIDTHS[path] }))
			),
			context.statuses.byCode()
		]);
		columns = resolved;
		return { statuses: Object.fromEntries(table) };
	}

	/** Every row the filter matches, read a page of ids at a time: the table never reads past its own pages. */
	async function selectAllMatching(): Promise<void> {
		const refs: EntityRef[] = [];
		for (let number = 1; ; number += 1) {
			const page = await context.client.search('Version', { filters: source.filters, fields: ['id'], page: { size: 500, number } });
			refs.push(...page.data.map((row) => ({ type: row.type, id: row.id })));
			if (!page.hasMore) break;
		}
		selected = refs;
	}

	/** An approved Version keeps its description: one cell the table locks, with the reason on it. */
	function editLock(row: EntityRow, column: CollectionColumn): string | null {
		return column.path === 'description' && row.attributes['sg_status_list'] === 'apr' ? 'An approved Version keeps its description.' : null;
	}

	/** The bulk edit waiting on an answer, and how to give it. */
	let asking = $state<{ edit: BulkEdit; answer: (ok: boolean) => void } | null>(null);
	const askingHeader = $derived(asking ? (columns.find((column) => column.path === asking?.edit.path)?.header ?? asking.edit.path) : '');

	function confirmBulkEdit(edit: BulkEdit): Promise<boolean> {
		return new Promise((answer) => (asking = { edit, answer }));
	}

	function settle(ok: boolean): void {
		asking?.answer(ok);
		asking = null;
	}

	const toggle =
		'inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2 text-sm shadow-xs ' +
		'text-muted-foreground outline-none transition-colors duration-150 hover:bg-accent hover:text-accent-foreground ' +
		'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ' +
		'aria-pressed:bg-accent aria-pressed:text-accent-foreground aria-pressed:font-medium';
</script>

{#await load()}
	<p class="text-muted-foreground text-sm">Loading the site…</p>
{:then { statuses }}
	<div class="flex w-full min-w-0 flex-col gap-3" data-collapsed={JSON.stringify(collapsed)}>
		<div class="flex flex-wrap items-center gap-2">
			<button type="button" class={toggle} aria-pressed={grouped} onclick={() => (grouped = !grouped)}>
				Group by status
			</button>
			<button type="button" class="{toggle} disabled:pointer-events-none disabled:opacity-50" data-demo="collapse-all" disabled={!grouped} onclick={() => (collapsed = collapseAll())}>
				Collapse all
			</button>
			<button type="button" class="{toggle} disabled:pointer-events-none disabled:opacity-50" data-demo="expand-all" disabled={!grouped} onclick={() => (collapsed = expandAll())}>
				Expand all
			</button>
			<button type="button" class={toggle} aria-pressed={compact} onclick={() => (compact = !compact)}>
				Compact
			</button>
			<div class="flex flex-wrap items-center gap-2" data-testid="paging-modes">
				{#each PAGING as mode (mode.value)}
					<button
						type="button"
						class={toggle}
						aria-pressed={paging === mode.value}
						onclick={() => (paging = mode.value)}
					>
						{mode.label}
					</button>
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-2" data-testid="editor-placements">
				{#each PLACEMENTS as option (option.label)}
					<button
						type="button"
						class={toggle}
						aria-pressed={placement === option.value}
						onclick={() => (placement = option.value)}
					>
						{option.label}
					</button>
				{/each}
			</div>
			<button type="button" class={toggle} data-demo="edit-on-click" aria-pressed={editOnClick} onclick={() => (editOnClick = !editOnClick)}>
				Edit on click
			</button>
			<span class="text-muted-foreground text-xs tabular-nums" data-testid="selection-count">
				{selected.length} selected
			</span>
		</div>
		<EntityTable
			{source}
			bind:columns
			bind:selection={selected}
			onSelectAllMatching={selectAllMatching}
			filters={scope ? group('and', [scope, filter]) : filter}
			sort={toSortSpecs(sortKeys)}
			{statuses}
			{context}
			selectable
			columnPicker
			editable
			bulkEdit
			{confirmBulkEdit}
			{editLock}
			{paging}
			editorPlacement={placement}
			editOn={editOnClick ? 'click' : 'dblclick'}
			density={compact ? 'compact' : 'default'}
			groupBy={grouped ? 'sg_status_list' : null}
			bind:collapsed
		>
			{#snippet toolbarStart()}
				<FilterBar entityType="Version" {context} facets={FACETS} baseFilter={scope} size="sm" bind:value={filter} />
			{/snippet}
			{#snippet toolbarEnd()}
				<SortPicker entityType="Version" {context} size="sm" options={columns.map((column) => column.path)} bind:value={sortKeys} />
			{/snippet}
		</EntityTable>
		<Dialog.Root open={asking !== null} onOpenChange={(open) => !open && settle(false)}>
			<Dialog.Content class="sm:max-w-md" data-demo="bulk-confirm">
				{#if asking}
					<Dialog.Header>
						<Dialog.Title>Change {askingHeader} on {asking.edit.rows.length} Versions?</Dialog.Title>
						<Dialog.Description>
							Every selected row gets the same value.
							{#if asking.edit.skipped.length > 0}{asking.edit.skipped.length} selected {asking.edit.skipped.length === 1 ? 'row is' : 'rows are'} left as they are.{/if}
						</Dialog.Description>
					</Dialog.Header>
					<Dialog.Footer>
						<Button variant="outline" onclick={() => settle(false)}>Cancel</Button>
						<Button data-demo="bulk-confirm-ok" onclick={() => settle(true)}>Change {asking.edit.rows.length}</Button>
					</Dialog.Footer>
				{/if}
			</Dialog.Content>
		</Dialog.Root>
	</div>
{:catch error}
	<p class="text-destructive text-sm">{error.message}</p>
{/await}
