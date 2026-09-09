<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import ContextSelector, {
		type WorkContext
	} from '$lib/registry/components/context-selector.svelte';
	import { setDemoClient } from '../_shared/svelte';

	const client = setDemoClient();

	/* The mock's first person, as the app would pass the signed-in user. */
	const currentUser: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };

	let context = $state<WorkContext>({
		project: { type: 'Project', id: 70, name: 'Blue Moon Rising' },
		entity: { type: 'Shot', id: 862, name: 'sh010_0010' },
		task: { type: 'Task', id: 5700, name: 'Comp' }
	});

	let recents = $state<WorkContext[]>([
		{
			project: { type: 'Project', id: 70, name: 'Blue Moon Rising' },
			entity: { type: 'Asset', id: 1226, name: 'charAda' },
			task: { type: 'Task', id: 5730, name: 'Model' }
		},
		{
			project: { type: 'Project', id: 71, name: 'Harbour Lights' },
			entity: { type: 'Shot', id: 889, name: 'hb010_0010' },
			task: null
		}
	]);
</script>

<div class="flex flex-col gap-4">
	<section class="flex flex-col gap-2">
		<h4 class="text-muted-foreground text-xs font-medium tracking-wide uppercase">
			Current context, with recents and Ada's tasks
		</h4>
		<ContextSelector
			{client}
			{context}
			{currentUser}
			{recents}
			onRecentsChange={(next) => (recents = next)}
			onContextChange={(next) => (context = next)}
		/>
	</section>

	<p data-demo="context" class="text-muted-foreground text-sm">
		project {context.project?.name ?? '-'} / entity {context.entity?.name ?? '-'} / task {context
			.task?.name ?? '-'}
	</p>
</div>
