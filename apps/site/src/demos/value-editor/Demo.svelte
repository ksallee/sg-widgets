<script lang="ts">
	import type { ParseResult } from '@sg-widgets/core';
	import { Input } from '$lib/components/ui/input/index.js';
	import { CONTROL_BOX, type ControlSize } from '$lib/registry/components/control-classes.js';
	import ValueEditor from '$lib/registry/components/value-editor.svelte';
	import {
		createValueSession,
		type ValueSession
	} from '$lib/registry/components/value-editor.svelte.js';

	/** What this editor stores: the first and the last frame of a range. */
	type Range = { first: number; last: number } | null;

	const format = (value: Range) => (value ? `${value.first}-${value.last}` : '');

	function parse(draft: string): ParseResult<Range> {
		const raw = draft.trim();
		if (!raw) return { value: null };
		const match = /^(\d+)\s*-\s*(\d+)$/.exec(raw);
		if (!match) return { error: 'A range reads as two frames, 1001-1120.' };
		const first = Number(match[1]);
		const last = Number(match[2]);
		if (last < first) return { error: 'The last frame comes before the first.' };
		return { value: { first, last } };
	}

	/** A pair is a new object every parse, so identity is not what says it changed. */
	const same = (next: Range, current: Range) =>
		next?.first === current?.first && next?.last === current?.last;

	let cut = $state<Range>({ first: 1001, last: 1120 });
	let delivery = $state<Range>({ first: 1001, last: 1064 });

	const cutSession = createValueSession<Range, string>({
		value: () => cut,
		format,
		parse,
		same,
		onValueChange: (next) => (cut = next)
	});

	const deliverySession = createValueSession<Range, string>({
		value: () => delivery,
		format,
		parse,
		same,
		onValueChange: (next) => (delivery = next),
		error: () => 'The site refused this range.'
	});

	const field = 'flex w-full min-w-0 flex-col gap-2';
	const label = 'text-muted-foreground text-xs';
	const readout = 'text-muted-foreground font-mono text-xs';
</script>

{#snippet editor(
	name: string,
	caption: string,
	session: ValueSession<Range, string>,
	value: Range,
	size: ControlSize,
	inline: boolean
)}
	<div class={field} data-demo-case={name}>
		<span class={label}>{caption}</span>
		<ValueEditor slotName="range-editor" {size} {inline} message={session.message}>
			<Input
				bind:value={session.draft}
				type="text"
				placeholder="1001-1120"
				class={CONTROL_BOX[size]}
				aria-invalid={session.invalid}
				aria-label={caption}
				onfocus={session.onfocus}
				onblur={session.onblur}
				onkeydown={session.onkeydown}
			/>
		</ValueEditor>
		<span class={readout} data-demo-value>{JSON.stringify(value)}</span>
	</div>
{/snippet}

<div class="flex flex-col gap-4">
	{@render editor(
		'cut',
		'Cut range: commits on Enter and on leaving, restores on Escape',
		cutSession,
		cut,
		'md',
		false
	)}
	{@render editor(
		'delivery',
		'Delivery range: the row form, small, with a message the caller named',
		deliverySession,
		delivery,
		'sm',
		true
	)}
</div>
