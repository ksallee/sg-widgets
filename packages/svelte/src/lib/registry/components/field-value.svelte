<script lang="ts" module>
	import {
		formatDuration,
		formatCurrency,
		formatFloat,
		formatPercent,
		formatTimecode
	} from '@sg-widgets/core';

	/** The numeric family shares one render kind; the exact format comes from the data type. */
	function formatNumber(value: unknown, dataType: string, hoursPerDay: number | undefined, precision: number | undefined, symbol: string | undefined, locale: string | undefined): string {
		switch (dataType) {
			case 'duration':
				return formatDuration(Number(value), hoursPerDay === undefined ? {} : { hoursPerDay });
			case 'percent':
				return formatPercent(value as number);
			case 'timecode':
				return formatTimecode(Number(value));
			case 'currency':
			  return formatCurrency(value as string, { ...(symbol === undefined ? {} : { symbol }), ...(precision === undefined ? {} : { decimals: precision }), ...(locale === undefined ? {} : { locale }) });
			case 'float':
				return formatFloat(value as string, precision === undefined ? {} : { decimals: precision });
			default:
				return String(value);
		}
	}
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { EntityRef, FieldSchema, StatusRecord, UrlLinkInfo } from '@sg-widgets/core';
	import {
		COLOR_SENTINEL,
		formatDate,
		formatDateTime,
		isEmptyValue,
		parseBgColor,
		renderKindFor,
		rgbToCss,
		urlLink
	} from '@sg-widgets/core';
	import { Switch } from '$lib/components/ui/switch/index.js';
	import { cn, type WithElementRef } from '$lib/utils.js';
	import EntityChip from '$lib/registry/components/entity-chip.svelte';
	import StatusBadge from '$lib/registry/components/status-badge.svelte';
	import Thumbnail from '$lib/registry/components/thumbnail.svelte';

	type Props = WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> & {
		/** The raw attribute (or relationship) value, exactly as the API returned it. */
		value: unknown;
		/** The field's `data_type`. Anything unknown renders as text. */
		dataType: string;
		/** The field schema, for a status label out of `display_values` (probe 009). */
		field?: Pick<FieldSchema, 'displayValues'> | null;
		/** `Status` rows by code, for the status name and icon (probe 010). */
		statuses?: Record<string, StatusRecord> | null;
		/** The site the stock sprite is served from, for a status icon the package does not bundle. */
		siteUrl?: string;
		/** The site's `hours_per_day` from `GET /preferences`; durations then render in days (field_types/duration). */
		hoursPerDay?: number;
		locale?: string;
		/** Decimals shown on a float, zeros kept. Default shows what the API sent, trailing zeros dropped. */
		precision?: number;
		/** Shown before a currency value. */
		currencySymbol?: string;
		/** Rewrites the href of a local file link. Default opens `file:`, which browsers refuse from an http page. */
		localHref?: (link: UrlLinkInfo) => string | null;
		/** What to show when the value is empty. Never a dash: a dash reads like a value. */
		emptyLabel?: string;
	};

	let {
		value,
		dataType,
		field = null,
		statuses = null,
		siteUrl,
		hoursPerDay,
		locale,
		precision,
		currencySymbol,
		localHref,
		emptyLabel = 'empty',
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const kind = $derived(renderKindFor(dataType));
	// A checkbox is two-state and never null, so it is the one kind whose "empty"
	// value is a real one (field_types/checkbox).
	const empty = $derived(kind !== 'checkbox' && (kind === 'empty' || isEmptyValue(value)));
	const dateOptions = $derived(locale === undefined ? {} : { locale });
	const rawLink = $derived(kind === 'url' ? urlLink(value) : null);
	// A local link opens through `file:`; an app that opens paths its own way rewrites the href.
	const link = $derived(rawLink && rawLink.local && localHref ? { ...rawLink, href: localHref(rawLink) } : rawLink);
	const rgb = $derived(kind === 'color' ? parseBgColor(String(value)) : null);
	const text = $derived(
		kind === 'number'
			? formatNumber(value, dataType, hoursPerDay, precision, currencySymbol, locale)
			: kind === 'date'
				? formatDate(String(value), dateOptions)
				: kind === 'datetime'
					? formatDateTime(String(value), dateOptions)
					: String(value)
	);
	/** Single-line renderings carry the full value in a `title`, per the design rules. */
	const titleText = $derived(
		empty || kind === 'entity' || kind === 'multi_entity' || kind === 'image' || kind === 'checkbox'
			? undefined
			: kind === 'url'
				? (link?.local?.path ?? link?.label ?? undefined)
				: kind === 'date' || kind === 'datetime'
					? String(value)
					: text
	);
</script>

<!--
	Any attribute value, rendered for display.

	The rendering is chosen by `data_type` through core's `renderKindFor`, and the value
	shapes are the ones the API actually returns: an entity link is a `{type, id, name}`
	hash under `relationships`, a status is a bare code, a float comes back quoted, a
	`url` is an object whose keys depend on `link_type`, and a date carries no zone
	(sg-groundtruth `findings/field_types/*`).
-->
<span
	bind:this={ref}
	data-slot="field-value"
	data-data-type={dataType}
	title={titleText}
	class={cn('inline-flex w-full min-w-0 items-center text-sm', className)}
	{...rest}
>
	{#if empty}
		<span class="text-muted-foreground text-xs italic select-none">{emptyLabel}</span>
	{:else if kind === 'entity'}
		<EntityChip entity={value as EntityRef} size="sm" />
	{:else if kind === 'multi_entity'}
		<span class="flex min-w-0 flex-wrap items-center gap-2">
			{#each value as EntityRef[] as entity (`${entity.type}:${entity.id}`)}
				<EntityChip {entity} size="sm" />
			{/each}
		</span>
	{:else if kind === 'status'}
		<StatusBadge
			code={String(value)}
			status={statuses?.[String(value)] ?? null}
			{field}
			size="sm"
			{siteUrl}
		/>
	{:else if kind === 'image'}
		<Thumbnail src={String(value)} size="sm" alt="" />
	{:else if kind === 'checkbox'}
		<Switch
			size="sm"
			checked={value === true}
			disabled
			aria-readonly="true"
			aria-label={value === true ? 'Yes' : 'No'}
			tabindex={-1}
			class="data-disabled:cursor-default data-disabled:opacity-100"
		/>
	{:else if kind === 'url'}
		{#if link?.href}
			<a
				href={link.href}
				rel="noreferrer"
				class="focus-visible:ring-ring focus-visible:ring-offset-background truncate underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
			>
				{link.label}
			</a>
		{:else}
			<span class="truncate">{link?.label}</span>
		{/if}
	{:else if kind === 'date' || kind === 'datetime'}
		<time datetime={String(value)} class="truncate">{text}</time>
	{:else if kind === 'color'}
		<!-- `Task.color` holds the token `pipeline_step` rather than a colour (field_types/color). -->
		{#if String(value) === COLOR_SENTINEL}
			<span class="text-muted-foreground truncate">pipeline step</span>
		{:else if rgb}
			<span class="flex min-w-0 items-center gap-1.5">
				<span
					aria-hidden="true"
					style="background-color:{rgbToCss(rgb)}"
					class="ring-border size-4 shrink-0 rounded-sm ring-1"
				></span>
				<span class="text-muted-foreground truncate font-mono text-xs tabular-nums">{text}</span>
			</span>
		{:else}
			<span class="truncate">{text}</span>
		{/if}
	{:else if kind === 'number'}
		<span class="truncate tabular-nums">{text}</span>
	{:else if kind === 'list'}
		<span class="truncate">{text}</span>
	{:else}
		<!-- `text` keeps its newlines: a description is free text and often multi-line. -->
		<span class="min-w-0 break-words whitespace-pre-wrap">{text}</span>
	{/if}
</span>
