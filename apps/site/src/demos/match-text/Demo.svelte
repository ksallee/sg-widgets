<script lang="ts">
	import MatchText from '$lib/registry/components/match-text.svelte';

	/** Labels of the shape a text search answers: a name, a path, a person. */
	const LABELS = [
		'sh010_0030_characterfx_v006',
		'Ada Lovelace',
		'Blue Moon Rising / Sequence sq020 / sh020_0050',
		'propCrate_model_v002',
		'anna.van.der.meer@example.com'
	];

	let query = $state('ad mo');

	const group = 'flex flex-col gap-2';
	const label = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
</script>

<div class="flex flex-col gap-4">
	<section class={group}>
		<h4 class={label}>Query</h4>
		<input
			data-slot="input"
			aria-label="Query"
			bind:value={query}
			class="border-input bg-background h-8 w-64 rounded-lg border px-3 text-sm outline-none"
		/>
	</section>

	<section class={group}>
		<h4 class={label}>Every word, wherever it occurs</h4>
		<ul data-demo="labels" class="flex flex-col gap-1.5 text-sm">
			{#each LABELS as text (text)}
				<li class="min-w-0 truncate"><MatchText {text} {query} /></li>
			{/each}
		</ul>
	</section>

	<section class={group}>
		<h4 class={label}>In a muted line, where weight is the only mark</h4>
		<p class="text-muted-foreground text-xs">
			<MatchText text="Review submission for sh010_0030, waiting on Ada" {query} />
		</p>
	</section>
</div>
