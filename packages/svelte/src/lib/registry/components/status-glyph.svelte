<script lang="ts" module>
	/** `spriteStyle()` keys are camelCase; an inline style attribute wants CSS spelling. */
	function inlineStyle(style: Record<string, string>): string {
		return Object.entries(style)
			.map(([key, value]) => `${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}:${value}`)
			.join(';');
	}
</script>

<script lang="ts">
	import type { StatusRecord } from '@sg-widgets/core';
	import { statusGlyph } from '@sg-widgets/core';
	import { cn } from '$lib/utils.js';

	type Props = {
		/** The resolved `Status` row. A plain `list` field has none, so it draws no icon. */
		status?: StatusRecord | null;
		/** The site the stock sprite is served from, for icons the package does not bundle. */
		siteUrl?: string;
		/** Draw the dot for a status that names no icon, so every row carries a leading mark. */
		fallback?: boolean;
		/** Sizes the `image` drawing. A sprite cell carries its own size. */
		class?: string;
	};

	let { status = null, siteUrl = undefined, fallback = false, class: className }: Props = $props();

	const glyph = $derived(statusGlyph(status, siteUrl));
	const picture = $derived(
		glyph.kind === 'image' || glyph.kind === 'cell' || glyph.kind === 'sprite'
	);
	const dot = $derived(!picture && (fallback || glyph.kind === 'dot'));
</script>

<!--
	One status icon, at whatever size the caller draws it (010_status_icons).

	An `image` icon is a self-contained data URI. An `image_map` icon names a cell of the
	stock sprite: cells of the shipped statuses are bundled in core and draw with no site
	access, any other stock icon draws from the site's own copy of the sprite and so needs
	`siteUrl`, and a key with neither resolves to a neutral dot. The key stays on the
	element as `data-status-icon`. An `html` icon is the label itself, so it draws no
	picture at all; `fallback` gives it the dot instead, which is what a list row wants.
-->
{#if glyph.kind === 'image'}
	<img
		src={glyph.src}
		alt=""
		aria-hidden="true"
		data-slot="status-glyph"
		class={cn('shrink-0 [image-rendering:crisp-edges]', className)}
	/>
{:else if glyph.kind === 'cell'}
	<img
		src={glyph.src}
		alt=""
		aria-hidden="true"
		data-slot="status-glyph"
		data-status-icon={glyph.imageMapKey}
		style="width:{glyph.cell.w}px;height:{glyph.cell.h}px"
		class="shrink-0 [image-rendering:crisp-edges]"
	/>
{:else if glyph.kind === 'sprite'}
	<span
		aria-hidden="true"
		data-slot="status-glyph"
		data-status-icon={glyph.imageMapKey}
		style={inlineStyle(glyph.style)}
		class="shrink-0"
	></span>
{:else if dot}
	<span
		aria-hidden="true"
		data-slot="status-glyph"
		data-status-icon={glyph.kind === 'dot' ? glyph.imageMapKey : undefined}
		class="bg-muted-foreground/40 size-2 shrink-0 rounded-full"
	></span>
{/if}
