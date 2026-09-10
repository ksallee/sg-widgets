<script lang="ts" module>
	import type { FieldSpec, PickerRow as PickerRowData, SgContext } from '@sg-widgets/core';

	export type PickerRowSize = 'sm' | 'md' | 'lg';

	/** The leading slot follows the thumbnail ladder of `docs/design-rules.md`. */
	const LEAD: Record<PickerRowSize, string> = { sm: 'size-6', md: 'size-8', lg: 'size-10' };
	const GLYPH: Record<PickerRowSize, string> = { sm: 'size-3.5', md: 'size-4', lg: 'size-5' };
	/** A row's text, on the leaf ladder of `docs/design-rules.md`. */
	const TEXT: Record<PickerRowSize, string> = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

	const PEOPLE = ['HumanUser', 'ApiUser', 'ClientUser'];

	/** Everything rule 9 of `docs/design-rules.md` gives a row, as one props object. */
	export interface PickerRowProps {
		/** The row to draw: the reference, its label and the values a read answered. */
		row: PickerRowData;
		/** The query whose matched runs are bold. */
		query?: string;
		/** Crumbs drawn before the label, muted and separated by `›`. */
		crumbs?: string[];
		/** Field holding the thumbnail URL. `false` hides the leading slot. */
		thumbnail?: string | false;
		roundThumbnail?: boolean;
		/** Show the row's `code` beside the label when the two differ. */
		showCode?: boolean;
		/** The muted line under the label: a path, or a resolved column. */
		subLabelField?: FieldSpec | null;
		/** The muted line of the caller's own making. Wins over `subLabelField`. */
		subLabel?: string;
		/** The right-aligned value: a path, or a resolved column so it renders by type. */
		secondaryField?: FieldSpec | null;
		/** Right-aligned text of the caller's own making. Wins over `secondaryField`. */
		secondary?: string;
		size?: PickerRowSize;
		/** The widget context. The secondary's schema and the status table are read through it. */
		context?: SgContext;
		/** The site the status sprite is served from. Defaults to the context's. */
		siteUrl?: string;
	}
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { FieldSchema, StatusRecord } from '@sg-widgets/core';
	import {
		highlightRuns,
		isEmptyValue,
		pathOf,
		renderKindFor,
		rowCode,
		rowSecondary,
		rowSubLabel,
		rowThumbnail,
		secondaryType
	} from '@sg-widgets/core';
	import { cn } from '$lib/utils.js';
	import FieldValue from '$lib/registry/components/field-value.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';
	import UserAvatar from '$lib/registry/components/user-avatar.svelte';

	type Props = PickerRowProps & {
		/** Drawn in the leading slot when the row carries no picture. */
		glyph?: Snippet;
	};

	let {
		row,
		query = '',
		crumbs = [],
		thumbnail = 'image',
		roundThumbnail = false,
		showCode = false,
		subLabelField = null,
		subLabel,
		secondaryField = null,
		secondary,
		size = 'md',
		context,
		siteUrl,
		glyph
	}: Props = $props();

	const anatomy = $derived({ thumbnail, subLabelField, secondaryField, showCode });
	const site = $derived(siteUrl ?? context?.siteUrl);
	const picture = $derived(rowThumbnail(row.values, anatomy));
	const sub = $derived(subLabel ?? rowSubLabel(row.values, anatomy));
	const code = $derived(rowCode(row.values, row.name, showCode));
	const raw = $derived(rowSecondary(row, anatomy));
	const secondaryPath = $derived(pathOf(secondaryField));
	/** An id is a code, and codes are the mono treatment of `docs/design-rules.md`. */
	const secondaryIsId = $derived(secondaryPath === 'id');
	const person = $derived(PEOPLE.includes(row.type));
	const title = $derived([...crumbs, row.name].join(' › '));

	interface SecondaryPlan {
		field: FieldSchema | null;
		/** `Status` rows by code, read only when the field is a status (probe 010). */
		statuses: Record<string, StatusRecord> | null;
	}

	/**
	 * What the secondary column draws with. A resolved column already carries its
	 * field, so only a bare path costs a schema read, and that read is the context's
	 * cached one. The read hangs off the props through a derived rather than an
	 * effect with a "last seen" key.
	 */
	function loadSecondary(type: string, spec: FieldSpec | null, ctx: SgContext | undefined): SecondaryPlan {
		const plan = $state<SecondaryPlan>({
			field: spec && typeof spec !== 'string' ? spec.field : null,
			statuses: null
		});
		const path = pathOf(spec);
		if (!ctx || path.length === 0 || path === 'id') return plan;
		const resolved = spec && typeof spec !== 'string' ? Promise.resolve(spec.field ?? undefined) : ctx.schema.field(type, path);
		const declared = spec && typeof spec !== 'string' ? spec.dataType : undefined;
		void Promise.resolve(resolved).then(async (found) => {
			plan.field = found ?? null;
			const dataType = declared ?? found?.dataType;
			if (dataType && renderKindFor(dataType) === 'status') {
				plan.statuses = Object.fromEntries(await ctx.statuses.byCode());
			}
		}, () => {
			// A secondary the schema cannot answer renders as text, which is always readable.
		});
		return plan;
	}

	const plan = $derived(loadSecondary(row.type, secondaryField, context));
	const dataType = $derived(secondaryType(anatomy, plan.field?.dataType));
</script>

<!--
	One entity row, the anatomy of rule 9 in `docs/design-rules.md`: a picture, the
	label with the matched runs bold, a muted sub-label and a right-aligned secondary
	rendered by its data type. Every picker, search and tree row is this one row, so a
	caller learns the six props once.

	The component draws the row's contents, not its box: the caller owns the list item,
	its selection state and anything it puts in front, such as a checkbox.
-->
{#if thumbnail !== false}
	<span data-slot="picker-row-leading" class={cn('flex shrink-0 items-center justify-center', LEAD[size])}>
		{#if person}
			<UserAvatar
				name={row.name}
				image={picture}
				{size}
				color="auto"
				apiUser={row.type === 'ApiUser'}
				inactive={row.values['sg_status_list'] === 'dis'}
			/>
		{:else if picture === null && glyph}
			<span class={cn('text-muted-foreground flex items-center justify-center', GLYPH[size])}>
				{@render glyph()}
			</span>
		{:else}
			<Thumbnail
				src={picture}
				aspect="square"
				{size}
				class={roundThumbnail ? 'rounded-full' : undefined}
			/>
		{/if}
	</span>
{/if}

<span data-slot="picker-row-text" class={cn('flex min-w-0 flex-1 flex-col', TEXT[size])}>
	<span data-slot="picker-row-label" class="flex min-w-0 items-center gap-1.5" {title}>
		<span class="truncate"
			>{#each crumbs as crumb, i (i)}<span class="text-muted-foreground">{crumb}</span><span
					aria-hidden="true"
					class="text-muted-foreground">{' › '}</span
				>{/each}<span
				data-slot="picker-row-name"
				class={crumbs.length > 0 ? 'font-medium' : undefined}
				>{#each highlightRuns(row.name, query) as run, i (i)}<span
						class={run.match ? 'font-semibold' : undefined}>{run.text}</span
					>{/each}</span
			></span
		>
		{#if code}
			<span data-slot="picker-row-code" class="text-muted-foreground shrink-0 font-mono text-xs">{code}</span>
		{/if}
	</span>
	{#if sub}
		<!-- Highlighted too, so a row matched on its login or its email shows why. -->
		<span data-slot="picker-row-sub-label" class="text-muted-foreground truncate text-xs" title={sub}
			>{#each highlightRuns(sub, query) as run, i (i)}<span class={run.match ? 'font-semibold' : undefined}
					>{run.text}</span
				>{/each}</span
		>
	{/if}
</span>

{#if secondary}
	<span data-slot="picker-row-secondary" class="text-muted-foreground shrink-0 text-xs">{secondary}</span>
{:else if secondaryPath && !isEmptyValue(raw)}
	<span
		data-slot="picker-row-secondary"
		class={cn(
			'text-muted-foreground flex shrink-0 items-center text-xs',
			secondaryIsId && 'font-mono tabular-nums'
		)}
	>
		<FieldValue
			value={raw}
			{dataType}
			field={plan.field}
			statuses={plan.statuses}
			{context}
			siteUrl={site}
			class="w-auto justify-end text-xs"
		/>
	</span>
{/if}
