/**
 * Deprecated. `ListMultiSelect` is `ListMultiPicker`: install `list-multi-picker` and
 * import that. This module keeps an installed item resolving for one release.
 */
export {
	default,
	default as ListMultiSelect
} from '$lib/registry/components/list-multi-picker.svelte';
export type {
	ListOption,
	ListMultiPickerSize as ListMultiSelectSize
} from '$lib/registry/components/list-multi-picker.svelte';
