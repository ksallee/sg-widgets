<script lang="ts">
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { cn } from '$lib/utils.js';

	type Props = {
		/** The accessible name of the block, from `stateLine('loading', …)`. */
		label: string;
		/** How many rows the read stands in for. */
		lines?: number;
		/** The leading slot's shape: a thumbnail, a row glyph. */
		lead?: string;
		/** The `data-slot` the block carries. Omitted where the widget names none. */
		slotName?: string;
	};

	let { label, lines = 3, lead = 'h-6 w-10 shrink-0', slotName }: Props = $props();
</script>

<!--
	The rows a search widget draws while its read is in flight. Skeletons are shaped
	like the rows they stand in for, so the block belongs beside them rather than in
	`state-line`, which draws the empty and the error line.
-->
<div data-slot={slotName} class="flex flex-col gap-2 p-1" aria-busy="true" aria-label={label}>
	{#each { length: lines } as _, line (line)}
		<div class="flex items-center gap-2 px-2 py-1.5">
			<Skeleton class={cn(lead)} />
			<div class="flex min-w-0 flex-1 flex-col gap-1">
				<Skeleton class="h-3 w-1/2" />
				<Skeleton class="h-2.5 w-1/4" />
			</div>
		</div>
	{/each}
</div>
