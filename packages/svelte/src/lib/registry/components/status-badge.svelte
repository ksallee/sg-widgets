<script lang="ts" module>
	/** How much of the status to show. */
	export type StatusBadgeVariant = 'both' | 'icon' | 'text';
	export type StatusBadgeSize = 'sm' | 'md' | 'lg';

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
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import type { FieldSchema, StatusRecord } from '@sg-widgets/core';
	import { foregroundFor, parseBgColor, rgbToCss, statusLabel } from '@sg-widgets/core';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> & {
		/** The stored code, e.g. `ip`. A row may hold a code outside the usable set; that is legal (probe 009). */
		code: string;
		/** The resolved `Status` row, when the app has read `GET /entity/statuses` (probe 010). */
		status?: StatusRecord | null;
		/** The field schema, whose `display_values` is the only other source of a label (field_types/status_list). */
		field?: Pick<FieldSchema, 'displayValues'> | null;
		variant?: StatusBadgeVariant;
		size?: StatusBadgeSize;
	};

	let {
		code,
		status = null,
		field = null,
		variant = 'both',
		size = 'md',
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	const known = $derived(Boolean(status) || field?.displayValues?.[code] !== undefined);
	const label = $derived(status?.name || (field ? statusLabel(field, code) : code) || code);
	const rgb = $derived(parseBgColor(status?.bgColor));
	const style = $derived(
		rgb
			? `background-color:${rgbToCss(rgb)};color:${foregroundFor(rgb) === 'black' ? '#000' : '#fff'}`
			: undefined
	);
	// An `html` icon carries the label itself, so it replaces the text rather than
	// preceding it, and such a status has no image to show in icon-only mode
	// (010_status_icons).
	const icon = $derived(status?.icon ?? null);
	const textIcon = $derived(icon?.displayType === 'html' ? icon.html || label : null);
	const showGlyph = $derived(variant !== 'text' && icon !== null && textIcon === null);
	const showText = $derived(variant !== 'icon' || textIcon !== null);
</script>

<!--
	One status, as a coloured badge.

	The label comes from the `Status` row's `name`, else from the field's
	`display_values`, else it is the raw code: a status_list value is a bare code with
	no entity behind it, so a dotted read gives nothing (field_types/status_list). An
	unknown code is therefore never blank - it renders as itself in the muted token
	pair. The colour comes from `bg_color`, comma-separated decimal RGB and never hex
	(probe 010), and is the one raw colour the design rules allow.

	`display_type` picks one of three icon renderings (010_status_icons): `image` is a
	self-contained data URI, `html` is the label itself and so replaces the text rather
	than preceding it, and `image_map` names a sprite that lives in the customer site's
	own stylesheet and is not in the API. For `image_map` the key is emitted as
	`data-status-icon` and a block in the badge's own foreground stands in, so an app can
	point the key at its own sprite with one CSS rule:

	    [data-status-icon='icon_apr'] {
	      background: url('/images/sg_icon_image_map.png') -89px -11px no-repeat;
	    }
-->
{#if code}
	<span
		bind:this={ref}
		data-slot="status-badge"
		data-status-code={code}
		data-status-known={known ? 'true' : 'false'}
		title={label}
		{style}
		class={cn(
			'inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border border-transparent px-2 align-middle font-medium ring-1 ring-current/10 ring-inset',
			BOX[size],
			variant === 'icon' && 'justify-center',
			!rgb && 'bg-muted text-muted-foreground',
			className
		)}
		{...rest}
	>
		{#if showGlyph && icon}
			{#if icon.displayType === 'image'}
				<img
					src={icon.dataUrl}
					alt=""
					aria-hidden="true"
					class={cn('shrink-0 [image-rendering:crisp-edges]', GLYPH[size])}
				/>
			{:else if icon.displayType === 'image_map'}
				<span
					data-status-icon={icon.imageMapKey}
					aria-hidden="true"
					class={cn(
						'shrink-0 rounded-sm bg-current bg-center bg-no-repeat opacity-70',
						GLYPH[size]
					)}
				></span>
			{/if}
		{/if}
		<span class={cn('truncate', !showText && 'sr-only')}>{textIcon ?? label}</span>
	</span>
{/if}
