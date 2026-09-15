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
<div data-slot={slotName} class="flex flex-col" aria-busy="true" aria-label={label}>
	{#each { length: lines } as _, line (line)}
		<div class="flex items-center gap-2 px-2 py-1.5">
			<Skeleton class={cn(lead)} />
			<!-- The two bars sit in the line boxes of the label and the sub-label they stand in for. -->
			<div class="flex min-w-0 flex-1 flex-col">
				<span class="flex h-5 items-center">
					<Skeleton class="h-3 w-1/2" />
				</span>
				<span class="flex h-4 items-center">
					<Skeleton class="h-2.5 w-1/4" />
				</span>
			</div>
		</div>
	{/each}
</div>
