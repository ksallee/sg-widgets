<!--
	The empty and error line at each of its paddings: inside a popup-sized box, in a
	table body, and under rows already drawn.

	Each case carries `data-demo-case`, so a drive script reads it without knowing the
	surrounding markup. Nothing here is read from a site.
-->
<script lang="ts">
	import CircleAlert from '@lucide/svelte/icons/circle-alert';
	import Inbox from '@lucide/svelte/icons/inbox';
	import SearchX from '@lucide/svelte/icons/search-x';
	import TriangleAlert from '@lucide/svelte/icons/triangle-alert';
	import StateLine from '$lib/registry/components/state-line.svelte';

	/** The rows the last case draws its line under. */
	const DEPARTMENTS = ['Layout', 'Animation', 'Lighting'];

	const stack = 'flex flex-col gap-4';
	const section = 'flex flex-col gap-2';
	const heading = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const spread = 'flex flex-wrap items-start gap-4';
	const popoverBox = 'border-border w-72 rounded-md border p-1';
	const bodyBox = 'border-border w-full min-w-0 rounded-md border';
	const listRow = 'flex items-center px-2 py-1.5 text-sm';
</script>

<div class={stack}>
	<section class={section} data-demo-case="popover">
		<h4 class={heading}>In a popup list</h4>
		<div class={spread}>
			<div class={popoverBox}>
				<StateLine state="empty" icon={SearchX} label="No department matches" />
			</div>
			<div class={popoverBox}>
				<StateLine state="error" icon={TriangleAlert} label="The read was refused" />
			</div>
		</div>
	</section>

	<section class={section} data-demo-case="table">
		<h4 class={heading}>In a table body</h4>
		<div class={spread}>
			<div class={bodyBox}>
				<StateLine state="empty" pad="table" icon={Inbox} label="No shot in this window" />
			</div>
			<div class={bodyBox}>
				<StateLine state="error" pad="table" icon={CircleAlert} label="The read timed out" />
			</div>
		</div>
	</section>

	<section class={section} data-demo-case="under-rows">
		<h4 class={heading}>Under rows already drawn</h4>
		<div class={bodyBox}>
			<div class="flex flex-col">
				{#each DEPARTMENTS as department (department)}
					<div class={listRow}>{department}</div>
				{/each}
				<StateLine
					state="error"
					pad="none"
					slotName="state-line-page-error"
					icon={CircleAlert}
					label="The next page did not arrive"
					class="p-2"
				/>
			</div>
		</div>
	</section>
</div>
