import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'types', type: '`readonly string[]`', default: '`[]`', meaning: 'The data types on offer, by API name, in the order they are listed.' },
    { name: 'value', type: '`string | null`', default: '`null`', meaning: 'The chosen data type, by API name, or `null` when nothing is chosen. `bind:value` in Svelte, `value` with `onValueChange` in React.' },
    { name: 'labels', type: '`Readonly<Record<string, string>>`', default: '—', meaning: 'Labels of the caller\'s own, by API name. They win over the built-in ones.' },
    { name: 'placeholder', type: '`string`', default: '`\'Select a data type\'`', meaning: 'Shown with no selection.' },
    { name: 'emptyLabel', type: '`string`', default: '`\'No rows\'`', meaning: 'Shown when no type is on offer.' },
    { name: 'searchable', type: '`boolean`', default: '`false`', meaning: 'Offers a search box, which narrows the set in the browser.' },
    { name: 'searchPlaceholder', type: '`string`', default: '`\'Search data types…\'`', meaning: 'Placeholder of the search box.' },
    { name: 'clearable', type: '`boolean`', default: '`false`', meaning: 'Offers a control that clears the value.' },
    { name: 'readonly', type: '`boolean`', default: '`false`', meaning: 'Keeps full contrast and drops the chevron, the popup and the clear control.' },
    { name: 'disabled', type: '`boolean`', default: '`false`', meaning: 'Greys the control and takes it out of the tab order.' },
    { name: 'invalid', type: '`boolean`', default: '`false`', meaning: 'Sets `aria-invalid` and the destructive ring.' },
    { name: 'showCode', type: '`boolean`', default: '`true`', meaning: 'Draws the API name as a row\'s right-aligned secondary, when it says more than the label.' },
    { name: 'secondary', type: '`(option) => string`', default: 'the API name', meaning: 'A row\'s right-aligned value, of the caller\'s own making.' },
    { name: 'subLabel', type: '`(option) => string`', default: '—', meaning: 'The muted line under a row\'s label.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Control height: 7, 8 and 9.' },
    { name: 'open', type: '`boolean`', default: '`false`', meaning: 'Whether the popup is showing. Two-way in Svelte.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  keyboard: [
    { key: '<kbd>Space</kbd>, <kbd>Enter</kbd>, <kbd>↓</kbd>', does: 'Opens the list' },
    { key: '<kbd>↑</kbd> <kbd>↓</kbd>', does: 'Moves the highlight' },
    { key: 'typing', does: 'Narrows the list, where the picker is searchable' },
    { key: '<kbd>Enter</kbd>', does: 'Selects the highlighted data type and closes' },
    { key: '<kbd>Backspace</kbd>', does: 'In an empty search box, clears the data type, where the picker is clearable' },
    { key: '<kbd>Esc</kbd>', does: 'Closes and keeps the selection' },
    { key: '<kbd>Tab</kbd>', does: 'Leaves the control, or reaches the clear control when there is one' },
  ],
  events: [
    { name: 'onValueChange', payload: '`string | null`', when: 'A data type was chosen, or the clear control was pressed.' },
    { name: 'onOpenChange', payload: '`boolean`', when: 'The popup opened or closed.' },
  ],
} satisfies PropsFile;
