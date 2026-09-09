<script lang="ts">
	import type { CellEditorProps } from '$lib/registry/components/entity-table.svelte';
	import FieldEditor from '$lib/registry/components/field-editor.svelte';

	let { value, dataType, field, commit, cancel }: CellEditorProps = $props();

	let draft = $state(value);
</script>

<!--
	The cell's editor: the type's own control from the field-editor item, with Enter
	committing through the source and Escape restoring the value.
-->
<div
	onkeydown={(event) => {
		if (event.key === 'Enter') {
			event.preventDefault();
			commit(draft);
		} else if (event.key === 'Escape') {
			event.preventDefault();
			cancel();
		}
	}}
>
	<FieldEditor value={draft} onValueChange={(next) => (draft = next)} {dataType} {field} mode="edit" size="sm" />
</div>
