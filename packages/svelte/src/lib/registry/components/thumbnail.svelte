<script lang="ts" module>
	export type ThumbnailAspect = '16:9' | 'square';
	export type ThumbnailSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl';

	/** The thumbnail ladder of `docs/design-rules.md`. Width comes from the aspect, never a fixed class. */
	const BOX: Record<ThumbnailSize, string> = {
		sm: 'h-6',
		md: 'h-8',
		lg: 'h-10',
		xl: 'h-16',
		'2xl': 'h-24'
	};
	const GLYPH: Record<ThumbnailSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5',
		xl: 'size-6',
		'2xl': 'size-8'
	};
	/** The play badge is decorative chrome, not control iconography, so it scales with the box. */
	const PLAY_BADGE: Record<ThumbnailSize, string> = {
		sm: 'size-4',
		md: 'size-5',
		lg: 'size-6',
		xl: 'size-8',
		'2xl': 'size-10'
	};
	const PLAY_GLYPH: Record<ThumbnailSize, string> = {
		sm: 'size-2.5',
		md: 'size-3',
		lg: 'size-3.5',
		xl: 'size-4',
		'2xl': 'size-5'
	};
</script>

<script lang="ts">
	import type { HTMLAttributes } from 'svelte/elements';
	import { imageState } from '@sg-widgets/core';
	import Hourglass from '@lucide/svelte/icons/hourglass';
	import ImageOff from '@lucide/svelte/icons/image-off';
	import Play from '@lucide/svelte/icons/play';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		/** The `image` field's value, or null. Presigned and re-signed on every read (field_types/image). */
		src?: string | null;
		alt?: string;
		aspect?: ThumbnailAspect;
		size?: ThumbnailSize;
		/** Draws a centred play badge, the way the desktop tk-framework-qtwidgets label marks playable media. */
		playable?: boolean;
	};

	let {
		src = null,
		alt = '',
		aspect = '16:9',
		size = 'md',
		playable = false,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

	// Held as the failing URL, not a flag, so a new `src` retries on its own.
	let failed = $state<string | null>(null);
	const imgState = $derived(failed !== null && failed === src ? 'none' : imageState(src));
</script>

<!--
	A row's thumbnail.

	The value of an `image` field is the only state marker there is: null means the row
	never had one, and the `/images/status/transient/` prefix means it is still
	transcoding, so neither is tested for truthiness (field_types/image). Both states
	get an explicit glyph rather than an empty box, as does a URL that fails to load:
	the value is presigned and expires, so a stale one is a normal outcome. Corners
	follow `--radius` through `rounded-md`, and the height comes from the size ladder
	while the width follows the aspect, so the atom never sets a fixed width.
-->
<div
	bind:this={ref}
	data-slot="thumbnail"
	data-state={imgState}
	class={cn(
		'bg-muted relative isolate inline-flex shrink-0 items-center justify-center overflow-hidden rounded-md border align-middle',
		aspect === 'square' ? 'aspect-square' : 'aspect-video',
		BOX[size],
		className
	)}
	{...rest}
>
	{#if imgState === 'ready'}
		<img
			{src}
			{alt}
			loading="lazy"
			decoding="async"
			onerror={() => (failed = src)}
			class="size-full object-cover"
		/>
	{:else if imgState === 'pending'}
		<span
			role="img"
			aria-label="Thumbnail still processing"
			class="text-muted-foreground flex items-center justify-center"
		>
			<Hourglass aria-hidden="true" class={cn(GLYPH[size], 'motion-safe:animate-pulse')} />
		</span>
	{:else}
		<span
			role="img"
			aria-label="No image"
			class="text-muted-foreground flex items-center justify-center"
		>
			<ImageOff aria-hidden="true" class={GLYPH[size]} />
		</span>
	{/if}

	{#if playable}
		<span class="pointer-events-none absolute inset-0 flex items-center justify-center">
			<span
				class={cn(
					'bg-background/70 text-foreground ring-border flex items-center justify-center rounded-full shadow-sm ring-1',
					PLAY_BADGE[size]
				)}
			>
				<Play aria-hidden="true" class={cn('fill-current', PLAY_GLYPH[size])} />
			</span>
		</span>
	{/if}
</div>
