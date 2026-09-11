/**
 * Deprecated. `ListSelect` is `ListPicker`: install `list-picker` and import that.
 * This module keeps an installed item resolving for one release.
 */
export { default, default as ListSelect } from '$lib/registry/components/list-picker.svelte';
export type {
	ListOption,
	ListPickerSize as ListSelectSize
} from '$lib/registry/components/list-picker.svelte';
