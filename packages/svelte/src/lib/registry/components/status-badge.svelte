<script lang="ts" module>
	/** How much of the status to show. */
	export type StatusBadgeVariant = 'both' | 'icon' | 'text';
	export type StatusBadgeSize = 'sm' | 'md' | 'lg';
	/** Which of the two names the badge puts on show; the other one goes in the tooltip. */
	export type StatusBadgeLabel = 'name' | 'code';

	/**
	 * Leaf atoms follow the thumbnail/avatar ladder of `docs/design-rules.md`
	 * (6 / 8 / 10); the input ladder (8 / 9 / 10) is for controls.
	 */
	const BOX: Record<StatusBadgeSize, string> = {
		sm: 'h-6 text-xs',
		md: 'h-8 text-sm',
		lg: 'h-10 text-sm'
	};
	const GLYPH: Record<StatusBadgeSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};

	/** `spriteStyle()` keys are camelCase; an inline style attribute wants CSS spelling. */
	function inlineStyle(style: Record<string, string>): string {
		return Object.entries(style)
			.map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`)
			.join(';');
	}
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema, StatusRecord } from '@sg-widgets/core';
	import {
		foregroundFor,
		parseBgColor,
		rgbToCss,
		spriteStyle,
		statusLabel,
		stockIconSource
	} from '@sg-widgets/core';
	import X from '@lucide/svelte/icons/x';
	import { cn, type WithElementRef } from '$lib/utils.js';

	// `color` is a deprecated HTML attribute Svelte types as `never`, so it is dropped
	// before the badge's own prop of that name is declared.
	type Props = WithElementRef<Omit<HTMLAttributes<HTMLSpanElement>, 'color'>, HTMLSpanElement> & {
		/** The stored code, e.g. `ip`. A row may hold a code outside the usable set; that is legal (probe 009). */
		code: string;
		/** The resolved `Status` row, when the app has read `GET /entity/statuses` (probe 010). */
		status?: StatusRecord | null;
		/** The field schema, whose `display_values` is the only other source of a label (field_types/status_list). */
		field?: Pick<FieldSchema, 'displayValues'> | null;
		variant?: StatusBadgeVariant;
		size?: StatusBadgeSize;
		/** Paint the badge in the status colour instead of the neutral surface. */
		color?: boolean;
		label?: StatusBadgeLabel;
		/** The site the stock sprite is served from, for icons the package does not bundle. */
		siteUrl?: string;
		/** Draw a remove control inside the pill. The icon-only variant has no room for it and ignores this. */
		removable?: boolean;
		onRemove?: (code: string) => void;
		/** Accessible label for the remove control. */
		removeLabel?: string;
	};

	let {
		code,
		status = null,
		field = null,
		variant = 'both',
		size = 'md',
		color = false,
		label = 'name',
		siteUrl = undefined,
		removable = false,
		onRemove,
		removeLabel,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const known = $derived(Boolean(status) || field?.displayValues?.[code] !== undefined);
	const name = $derived(status?.name || (field ? statusLabel(field, code) : code) || code);
	const text = $derived(label === 'code' ? code : name);
	const other = $derived(label === 'code' ? name : code);
	const rgb = $derived(color ? parseBgColor(status?.bgColor) : null);
	const style = $derived(
		rgb
			? `background-color:${rgbToCss(rgb)};color:${foregroundFor(rgb) === 'black' ? '#000' : '#fff'}`
			: undefined
	);
	// An `html` icon carries the label itself, so it replaces the text rather than
	// preceding it, and such a status has no image to show in icon-only mode
	// (010_status_icons).
	const icon = $derived(status?.icon ?? null);
	const textIcon = $derived(icon?.displayType === 'html' ? icon.html || text : null);
	const showGlyph = $derived(variant !== 'text' && icon !== null && textIcon === null);
	const showText = $derived(variant !== 'icon' || textIcon !== null);
	const stock = $derived(
		icon?.displayType === 'image_map' ? stockIconSource(icon.imageMapKey, siteUrl) : null
	);
	// A bare icon is the glyph and nothing else, so there is no room for a cross.
	const showRemove = $derived(removable && variant !== 'icon');
</script>

<!--
	One status, as a badge.

	The label comes from the `Status` row's `name`, else from the field's
	`display_values`, else it is the raw code: a status_list value is a bare code with
	no entity behind it, so a dotted read gives nothing (field_types/status_list). An
	unknown code is therefore never blank - it renders as itself. Whichever of the name
	and the code is not on show is the tooltip, so a code is always one hover away from
	its name. The badge is neutral by default; `color` paints it in `bg_color`,
	comma-separated decimal RGB and never hex (probe 010), the one raw colour the design
	rules allow.

	`display_type` picks one of three icon renderings (010_status_icons): `image` is a
	self-contained data URI, `html` is the label itself and so replaces the text rather
	than preceding it, and `image_map` names a cell of the stock sprite. Cells of the
	shipped statuses are bundled in core and draw with no site access; any other stock
	icon draws from the site's own copy of the sprite, so it needs `siteUrl`. The key
	stays on the element as `data-status-icon`.

	`removable` draws a cross inside the pill, after the label, in the badge's own
	foreground: under `color` that is the readable black or white the status colour
	gives, so the cross keeps its contrast on every colour. Its hover is a translucent
	wash of that foreground rather than the destructive tint the entity chip uses, since
	the pill already carries a colour of its own.
-->
{#snippet content()}
	{#if showGlyph && icon}
		{#if icon.displayType === 'image'}
			<img
				src={icon.dataUrl}
				alt=""
				aria-hidden="true"
				class={cn('shrink-0 [image-rendering:crisp-edges]', GLYPH[size])}
			/>
		{:else if icon.displayType === 'image_map' && stock}
			{#if stock.kind === 'data'}
				<img
					src={stock.src}
					alt=""
					aria-hidden="true"
					data-status-icon={icon.imageMapKey}
					style="width:{stock.cell.w}px;height:{stock.cell.h}px"
					class="shrink-0 [image-rendering:crisp-edges]"
				/>
			{:else if stock.kind === 'sprite'}
				<span
					aria-hidden="true"
					data-status-icon={icon.imageMapKey}
					style={inlineStyle(spriteStyle(stock))}
					class="shrink-0"
				></span>
			{:else}
				<span
					aria-hidden="true"
					data-status-icon={icon.imageMapKey}
					class="bg-muted-foreground/40 size-2 shrink-0 rounded-full"
				></span>
			{/if}
		{/if}
	{/if}
	<span class={cn('truncate', !showText && 'sr-only')}>{textIcon ?? text}</span>
{/snippet}

{#if code}
	<span
		bind:this={ref}
		data-slot="status-badge"
		data-status-code={code}
		data-status-known={known ? 'true' : 'false'}
		title={other}
		{style}
		class={cn(
			'border-border bg-background inline-flex max-w-full min-w-0 items-center rounded-md border px-1.5 align-middle text-xs font-medium',
			'gap-1.5',
			BOX[size],
			variant === 'icon' && 'justify-center',
			rgb && 'border-transparent ring-1 ring-current/10 ring-inset',
			color && !rgb && 'bg-muted text-muted-foreground border-transparent',
			className
		)}
		{...rest}
	>
		{#if showRemove}
			<span class="flex min-w-0 items-center gap-1.5">{@render content()}</span>
			<button
				type="button"
				data-slot="status-badge-remove"
				aria-label={removeLabel ?? `Remove ${text}`}
				onclick={() => onRemove?.(code)}
				class="hover:bg-current/15 focus-visible:ring-ring focus-visible:ring-offset-background pointer-events-auto shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
			>
				<X aria-hidden="true" class="size-3" />
			</button>
		{:else}
			{@render content()}
		{/if}
	</span>
{/if}
