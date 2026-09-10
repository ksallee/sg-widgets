<!--
	Every picker control, empty beside filled, at the three sizes.

	Each cell carries `data-qa-picker`, `data-qa-case` and `data-qa-size`, so a drive
	script reads the pair without knowing a widget's markup. The values are fixed: this
	harness is read, not operated.
-->
<script lang="ts">
	import type { EntityRef } from '@sg-widgets/core';
	import { createSchemaService } from '@sg-widgets/core';
	import ContextSelector, {
		type WorkContext
	} from '$lib/registry/components/context-selector.svelte';
	import EntityMultiPicker from '$lib/registry/components/entity-multi-picker.svelte';
	import EntityPicker from '$lib/registry/components/entity-picker.svelte';
	import EntityTypePicker from '$lib/registry/components/entity-type-picker.svelte';
	import FieldPicker from '$lib/registry/components/field-picker.svelte';
	import ProjectMultiPicker from '$lib/registry/components/project-multi-picker.svelte';
	import ProjectPicker from '$lib/registry/components/project-picker.svelte';
	import StatusMultiPicker from '$lib/registry/components/status-multi-picker.svelte';
	import StatusPicker from '$lib/registry/components/status-picker.svelte';
	import UserMultiPicker from '$lib/registry/components/user-multi-picker.svelte';
	import UserPicker from '$lib/registry/components/user-picker.svelte';
	import { createDemoContext } from '../_shared/client';
	import { setDemoClient } from '../_shared/svelte';

	type Size = 'sm' | 'md' | 'lg';

	const context = createDemoContext();
	const client = setDemoClient(context.client);
	const schema = createSchemaService(client);
	const projectId = context.projectId;
	const project: EntityRef = context.live
		? { type: 'Project', id: projectId }
		: { type: 'Project', id: projectId, name: 'Blue Moon Rising' };

	const SIZES: Size[] = ['md', 'sm', 'lg'];
	const ASSET: EntityRef = { type: 'Asset', id: 1226, name: 'charAda' };
	const PERSON: EntityRef = { type: 'HumanUser', id: 20, name: 'Ada Lovelace' };
	const EMPTY_WORK: WorkContext = { project: null, entity: null, task: null };
	const FULL_WORK: WorkContext = { project, entity: ASSET, task: null };

	const section = 'flex flex-col gap-3';
	const heading = 'text-muted-foreground text-xs font-medium tracking-wide uppercase';
	const columns = 'grid grid-cols-2 gap-4';
	const stack = 'flex min-w-0 flex-col gap-3';
	const cell = 'flex min-w-0 flex-col gap-1';
	const caption = 'text-muted-foreground text-xs';
</script>

{#snippet column(size: Size, filled: boolean)}
	<div class={stack}>
		<span class={caption}>{filled ? 'Filled' : 'Empty'}</span>

		<div
			class={cell}
			data-qa-picker="entity-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>entity-picker</span>
			<EntityPicker {client} entityTypes={['Asset']} {size} value={filled ? ASSET : null} />
		</div>

		<div
			class={cell}
			data-qa-picker="entity-multi-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>entity-multi-picker</span>
			<EntityMultiPicker {client} entityTypes={['Asset']} {size} value={filled ? [ASSET] : []} />
		</div>

		<div
			class={cell}
			data-qa-picker="user-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>user-picker</span>
			<UserPicker {client} {size} value={filled ? PERSON : null} />
		</div>

		<div
			class={cell}
			data-qa-picker="user-multi-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>user-multi-picker</span>
			<UserMultiPicker {client} {size} value={filled ? [PERSON] : []} />
		</div>

		<div
			class={cell}
			data-qa-picker="project-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>project-picker</span>
			<ProjectPicker {client} {size} value={filled ? project : null} />
		</div>

		<div
			class={cell}
			data-qa-picker="project-multi-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>project-multi-picker</span>
			<ProjectMultiPicker {client} {size} value={filled ? [project] : []} />
		</div>

		<div
			class={cell}
			data-qa-picker="status-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>status-picker</span>
			<StatusPicker
				{client}
				entityType="Version"
				{projectId}
				{size}
				value={filled ? 'ip' : undefined}
			/>
		</div>

		<div
			class={cell}
			data-qa-picker="status-multi-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>status-multi-picker</span>
			<StatusMultiPicker
				{client}
				entityType="Version"
				{projectId}
				{size}
				value={filled ? ['ip', 'apr'] : []}
			/>
		</div>

		<div
			class={cell}
			data-qa-picker="entity-type-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>entity-type-picker</span>
			<EntityTypePicker {schema} {size} value={filled ? 'Shot' : null} />
		</div>

		<div
			class={cell}
			data-qa-picker="entity-type-multi-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>entity-type-multi-picker</span>
			<EntityTypePicker {schema} multiple {size} value={filled ? ['Shot', 'Asset'] : []} />
		</div>

		<div
			class={cell}
			data-qa-picker="field-picker"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>field-picker</span>
			<FieldPicker {schema} entityType="Version" {size} value={filled ? 'code' : ''} />
		</div>

		<div
			class={cell}
			data-qa-picker="context-selector"
			data-qa-case={filled ? 'filled' : 'empty'}
			data-qa-size={size}
		>
			<span class={caption}>context-selector</span>
			<ContextSelector
				{client}
				{size}
				context={filled ? FULL_WORK : EMPTY_WORK}
				currentUser={PERSON}
			/>
		</div>
	</div>
{/snippet}

<div class="flex flex-col gap-6">
	{#each SIZES as size (size)}
		<section class={section}>
			<h4 class={heading}>Size {size}</h4>
			<div class={columns}>
				{@render column(size, false)}
				{@render column(size, true)}
			</div>
		</section>
	{/each}
</div>
