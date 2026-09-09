<script lang="ts" module>
	import type { ThumbnailSize } from '$lib/registry/components/thumbnail.svelte';

	export type EntityCardSize = 'sm' | 'md' | 'lg';

	/** Cards and detail panes take the top of the thumbnail ladder (`docs/design-rules.md`). */
	const THUMB: Record<EntityCardSize, ThumbnailSize> = { sm: 'xl', md: 'xl', lg: '2xl' };
	const HEADER: Record<EntityCardSize, string> = { sm: 'gap-2', md: 'gap-3', lg: 'gap-3' };
	const STACK: Record<EntityCardSize, string> = { sm: 'gap-2', md: 'gap-3', lg: 'gap-4' };
	const NAME: Record<EntityCardSize, string> = { sm: 'text-sm', md: 'text-sm', lg: 'text-base' };
	const ROWS: Record<EntityCardSize, string> = { sm: 'gap-y-1.5', md: 'gap-y-2', lg: 'gap-y-2' };
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type {
		EntityCardColumn,
		EntityCardModel,
		EntityRef,
		EntityRow,
		SgContext,
		StatusRecord
	} from '@sg-widgets/core';
	import {
		describeEntityCard,
		entityDetailUrl,
		fieldText,
		isEmptyValue,
		loadEntityCard,
		renderKindFor,
		urlLink
	} from '@sg-widgets/core';
	import Box from '@lucide/svelte/icons/box';
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import FileBox from '@lucide/svelte/icons/file-box';
	import Film from '@lucide/svelte/icons/film';
	import Folder from '@lucide/svelte/icons/folder';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Tag from '@lucide/svelte/icons/tag';
	import User from '@lucide/svelte/icons/user';
	import Video from '@lucide/svelte/icons/video';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';

	type Props = WithElementRef<Omit<HTMLAttributes<HTMLDivElement>, 'children'>, HTMLDivElement> & {
		/** The cached client, the schema service and the site url the card reads through. */
		context: SgContext;
		/** The row to show. Given, nothing is read. */
		row?: EntityRow | null;
		/** The row to read, when no `row` is given. */
		entity?: EntityRef | null;
		/** Dotted field paths for the grid, in order. */
		fields?: string[];
		size?: EntityCardSize;
		/** The `image` field the thumbnail comes from. */
		imagePath?: string;
		/** The web app the row lives on. Defaults to the context's. */
		siteUrl?: string;
		/** The site's `hours_per_day` from `GET /preferences`; durations then render in days. */
		hoursPerDay?: number;
		locale?: string;
		/** What a field with no value shows. */
		emptyLabel?: string;
	};

	let {
		context,
		row = null,
		entity = null,
		fields = [],
		size = 'md',
		imagePath = 'image',
		siteUrl,
		hoursPerDay,
		locale,
		emptyLabel = 'empty',
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	interface Loaded {
		card: EntityCardModel;
		statuses: Record<string, StatusRecord>;
	}

	/**
	 * A glyph per entity type. A stock site has 114 types plus any number of custom
	 * ones, so this covers the types a widget meets constantly and falls back to a tag.
	 */
	const GLYPHS: Record<string, typeof Tag> = {
		Shot: Clapperboard,
		Asset: Box,
		Sequence: Film,
		Version: Video,
		Task: ListChecks,
		HumanUser: User,
		Project: Folder,
		Note: MessageSquare,
		PublishedFile: FileBox
	};

	async function build(
		source: { row: EntityRow | null; entity: EntityRef | null },
		paths: string[]
	): Promise<Loaded> {
		const options = { fields: paths, imagePath };
		const card = source.row
			? await describeEntityCard(context, source.row, options)
			: source.entity
				? await loadEntityCard(context, source.entity, options)
				: null;
		if (!card) throw new Error('An entity card needs a row or a reference.');
		return { card, statuses: Object.fromEntries(await context.statuses.byCode()) };
	}

	// The read hangs off the props through a derived, so a new row or a new path
	// list is a new promise and no effect has to guard against the last one.
	const loaded = $derived(build({ row, entity }, fields));
	const site = $derived(siteUrl ?? context.siteUrl);
	const stateClass = 'text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm';
	const linkClass =
		'focus-visible:ring-ring focus-visible:ring-offset-background truncate underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-offset-2';

	/** An entity value and a multi_entity value are the same shape, one boxed (field_types/multi_entity). */
	function refsOf(value: unknown): EntityRef[] {
		return Array.isArray(value) ? (value as EntityRef[]) : [value as EntityRef];
	}

	function textOf(column: EntityCardColumn): string {
		return fieldText(column.value, column.dataType, {
			...(hoursPerDay === undefined ? {} : { hoursPerDay }),
			...(locale === undefined ? {} : { locale }),
			...(column.field?.displayValues === undefined ? {} : { displayValues: column.field.displayValues })
		});
	}
</script>

<!--
	One row as a card: thumbnail, name, type, status and a grid of field values.

	Given a reference the card reads the row itself: one search asking for the
	type's identity chain, its thumbnail, its status field and the caller's paths
	at once, through the context's cache, so a second card on the same row costs
	nothing. Every path is labelled through the schema, and a hop names the type it
	travels through only when the field could have gone somewhere else, which is
	the same ambiguity the projection resolves (probe 059).

	Values are drawn here rather than through FieldValue: FieldValue draws a linked
	row as a chip, and a chip's own hover card is this card, so the two would
	depend on each other and neither registry CLI can install a cycle. A card is a
	compact surface, so a linked row is a link and the rest is one line of text
	through core's `fieldText`.
-->
{#snippet cell(column: EntityCardColumn, statuses: Record<string, StatusRecord>)}
	{@const kind = renderKindFor(column.dataType)}
	{#if kind === 'empty' || isEmptyValue(column.value)}
		<span class="text-muted-foreground text-xs italic select-none">{emptyLabel}</span>
	{:else if kind === 'status'}
		<StatusBadge
			code={String(column.value)}
			status={statuses[String(column.value)] ?? null}
			field={column.field}
			size="sm"
			siteUrl={site}
		/>
	{:else if kind === 'image'}
		<Thumbnail src={String(column.value)} size="sm" alt="" />
	{:else if kind === 'entity' || kind === 'multi_entity'}
		<span class="flex min-w-0 flex-wrap items-center gap-2">
			{#each refsOf(column.value) as target (`${target.type}:${target.id}`)}
				{@const url = entityDetailUrl(site, target)}
				{@const name = fieldText(target, 'entity')}
				{#if url}
					<a href={url} target="_blank" rel="noreferrer" title={name} class={linkClass}>{name}</a>
				{:else}
					<span title={name} class="truncate">{name}</span>
				{/if}
			{/each}
		</span>
	{:else if kind === 'url'}
		{@const link = urlLink(column.value)}
		{#if link?.href}
			<a href={link.href} rel="noreferrer" title={link.label} class={linkClass}>{link.label}</a>
		{:else}
			<span title={link?.label} class="truncate">{link?.label}</span>
		{/if}
	{:else if kind === 'text'}
		<!-- `text` keeps its newlines: a description is free text and often multi-line. -->
		<span class="min-w-0 break-words whitespace-pre-wrap">{textOf(column)}</span>
	{:else}
		{@const text = textOf(column)}
		<span title={text} class={cn('truncate', kind === 'number' && 'tabular-nums')}>{text}</span>
	{/if}
{/snippet}

<div
	bind:this={ref}
	data-slot="entity-card"
	data-size={size}
	class={cn('flex w-full min-w-0 flex-col', STACK[size], className)}
	{...rest}
>
	{#await loaded}
		<div class={cn('flex min-w-0 items-start', HEADER[size])}>
			<Skeleton class={cn('aspect-video shrink-0', size === 'lg' ? 'h-24' : 'h-16')} />
			<div class="flex min-w-0 flex-1 flex-col gap-2">
				<Skeleton class="h-4 w-3/4" />
				<Skeleton class="h-3 w-1/2" />
			</div>
		</div>
		<div class={cn('grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3', ROWS[size])}>
			{#each fields as path (path)}
				<Skeleton class="h-3 w-16" />
				<Skeleton class="h-3 w-full" />
			{/each}
		</div>
	{:then { card, statuses }}
		{@const Glyph = GLYPHS[card.entity.type] ?? Tag}
		{@const url = entityDetailUrl(site, card.entity)}
		<div class={cn('flex min-w-0 items-start', HEADER[size])}>
			<Thumbnail src={card.thumbnail} size={THUMB[size]} alt="" />
			<div class="flex min-w-0 flex-1 flex-col gap-1.5">
				{#if url}
					<a
						href={url}
						target="_blank"
						rel="noreferrer"
						title={card.name}
						class={cn(linkClass, 'font-medium', NAME[size])}>{card.name}</a
					>
				{:else}
					<span title={card.name} class={cn('truncate font-medium', NAME[size])}>{card.name}</span>
				{/if}
				<div class="flex min-w-0 flex-wrap items-center gap-2">
					<span class="text-muted-foreground inline-flex min-w-0 items-center gap-1.5 text-xs">
						<Glyph aria-hidden="true" class="size-4 shrink-0 opacity-70" />
						<span class="truncate">{card.typeLabel}</span>
					</span>
					{#if card.status}
						<StatusBadge
							code={card.status.code}
							status={statuses[card.status.code] ?? null}
							field={card.status.field}
							size="sm"
							siteUrl={site}
						/>
					{/if}
				</div>
			</div>
		</div>
		{#if card.columns.length > 0}
			<dl class={cn('grid min-w-0 grid-cols-[minmax(0,auto)_minmax(0,1fr)] gap-x-3', ROWS[size])}>
				{#each card.columns as column (column.path)}
					<dt class="text-muted-foreground truncate text-xs" title={column.label}>{column.label}</dt>
					<dd data-data-type={column.dataType} class="flex min-w-0 items-center text-sm">
						{@render cell(column, statuses)}
					</dd>
				{/each}
			</dl>
		{/if}
	{:catch error}
		<p class={cn(stateClass, 'text-destructive')}>
			<CircleAlert aria-hidden="true" class="size-4 shrink-0" />
			{error.message}
		</p>
	{/await}
</div>
