<!--
  The `hello` demo, Svelte side.

  It exists to prove the harness end to end: the shadcn-svelte Button is imported
  through the `$lib` alias straight out of packages/svelte, its classes are generated
  by the site's Tailwind build, and the button reads through the demo context.
-->
<script lang="ts">
	import { Button } from '$lib/components/ui/button/index.js';
	import { getSgContext, setDemoContext } from '../_shared/svelte';

	setDemoContext();
	const context = getSgContext();

	let output = $state<string | null>(null);
	let busy = $state(false);

	async function loadEntityTypes() {
		busy = true;
		try {
			const types = await context.client.entityTypes();
			output = types.map((t) => t.displayName).join(' · ');
		} finally {
			busy = false;
		}
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-2">
		<Button onclick={loadEntityTypes} disabled={busy}>Load entity types</Button>
		<Button variant="secondary">Secondary</Button>
		<Button variant="outline">Outline</Button>
		<Button variant="ghost">Ghost</Button>
		<Button variant="destructive">Destructive</Button>
	</div>
	<p class="text-muted-foreground text-sm" data-demo-output>
		{output ?? 'Nothing loaded yet.'}
	</p>
</div>
