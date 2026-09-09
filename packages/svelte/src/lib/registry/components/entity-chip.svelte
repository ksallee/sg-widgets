<script lang="ts" module>
	export type EntityChipSize = 'sm' | 'md' | 'lg';

	/** Leaf atoms follow the thumbnail/avatar ladder of `docs/design-rules.md`. */
	const BOX: Record<EntityChipSize, string> = {
		sm: 'h-6 text-xs',
		md: 'h-8 text-sm',
		lg: 'h-10 text-sm'
	};
	const GLYPH: Record<EntityChipSize, string> = {
		sm: 'size-4',
		md: 'size-4',
		lg: 'size-5'
	};
</script>

<script lang="ts">
	import type { HTMLAttributes, MouseEventHandler } from 'svelte/elements';
	import type { EntityRef } from '@sg-widgets/core';
	import Box from '@lucide/svelte/icons/box';
	import Clapperboard from '@lucide/svelte/icons/clapperboard';
	import FileBox from '@lucide/svelte/icons/file-box';
	import Film from '@lucide/svelte/icons/film';
	import Folder from '@lucide/svelte/icons/folder';
	import ListChecks from '@lucide/svelte/icons/list-checks';
	import MessageSquare from '@lucide/svelte/icons/message-square';
	import Tag from '@lucide/svelte/icons/tag';
	import User from '@lucide/svelte/icons/user';
	import Video from '@lucide/svelte/icons/video';
	import X from '@lucide/svelte/icons/x';
	import { cn, type WithElementRef } from '$lib/utils.js';

	type Props = WithElementRef<HTMLAttributes<HTMLSpanElement>, HTMLSpanElement> & {
		/** `{type, id, name}` exactly as an entity field returns it under `relationships` (field_types/entity). */
		entity: EntityRef;
		/** A thumbnail URL for the linked row. Presigned and short-lived, so pass a fresh one (field_types/image). */
		thumbnail?: string | null;
		href?: string;
		onclick?: MouseEventHandler<HTMLButtonElement>;
		size?: EntityChipSize;
		removable?: boolean;
		onremove?: (entity: EntityRef) => void;
		/** Accessible label for the remove control. */
		removeLabel?: string;
	};

	let {
		entity,
		thumbnail = null,
		href,
		onclick,
		size = 'md',
		removable = false,
		onremove,
		removeLabel,
		class: className,
		ref = $bindable(null),
		...rest
	}: Props = $props();

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

	const named = $derived(Boolean(entity.name && entity.name.length > 0));
	const label = $derived(named ? (entity.name as string) : `${entity.type} #${entity.id}`);
	const Glyph = $derived(GLYPHS[entity.type] ?? Tag);
	const interactive = $derived(Boolean(href || onclick));
	const innerClass = $derived(
		cn(
			'inline-flex min-w-0 items-center gap-1.5 rounded-[inherit] outline-none',
			interactive &&
				'focus-visible:ring-ring focus-visible:ring-offset-background transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]'
		)
	);
</script>

<!--
	One linked row, as a chip.

	`name` is the target's `cached_display_name` and is filled on every type measured,
	so a chip needs no second call (probe 060). When it is missing the chip shows
	`Type #id`, which is always addressable, in the mono/tabular treatment the design
	rules give ids.
-->
{#snippet body()}
	{#if thumbnail}
		<img
			src={thumbnail}
			alt=""
			aria-hidden="true"
			loading="lazy"
			decoding="async"
			class={cn('shrink-0 rounded-sm object-cover', GLYPH[size])}
		/>
	{:else}
		<Glyph aria-hidden="true" class={cn('shrink-0 opacity-70', GLYPH[size])} />
	{/if}
	<span class={cn('truncate', !named && 'font-mono tabular-nums')}>{label}</span>
{/snippet}

<span
	bind:this={ref}
	data-slot="entity-chip"
	data-entity-type={entity.type}
	data-entity-id={entity.id}
	title={label}
	class={cn(
		'bg-secondary text-secondary-foreground inline-flex max-w-full min-w-0 items-center gap-1.5 rounded-md border px-2 align-middle whitespace-nowrap',
		BOX[size],
		interactive && 'hover:bg-accent hover:text-accent-foreground transition-colors duration-150',
		className
	)}
	{...rest}
>
	{#if href}
		<a {href} class={innerClass}>{@render body()}</a>
	{:else if onclick}
		<button type="button" {onclick} class={innerClass}>{@render body()}</button>
	{:else}
		<span class={innerClass}>{@render body()}</span>
	{/if}
	{#if removable}
		<button
			type="button"
			aria-label={removeLabel ?? `Remove ${label}`}
			onclick={() => onremove?.(entity)}
			class="hover:bg-destructive/15 hover:text-destructive focus-visible:ring-ring focus-visible:ring-offset-background shrink-0 rounded-sm p-0.5 opacity-70 outline-none transition-colors duration-150 hover:opacity-100 focus-visible:ring-2 focus-visible:ring-offset-2 motion-safe:active:scale-[0.98]"
		>
			<X aria-hidden="true" class="size-3" />
		</button>
	{/if}
</span>
