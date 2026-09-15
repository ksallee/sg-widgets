import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'context', type: '`SgContext`', default: 'required', meaning: 'The widget context. The options and the status table are read through it, once per page.' },
    { name: 'entityType', type: '`string`', default: 'required', meaning: 'The type whose status field is offered.' },
    { name: 'projectId', type: '`number`', default: '—', meaning: 'Offer the codes this project allows.' },
    { name: 'projectIds', type: '`number[]`', default: '—', meaning: 'Offer the codes every one of these projects allows.' },
    { name: 'field', type: '`string`', default: 'status field', meaning: 'A list or status field other than the type\'s own.' },
    { name: 'value', type: '`string`', default: '—', meaning: 'The selected code. `bind:value` in Svelte, `value` with `onValueChange` in React.' },
    { name: 'placeholder', type: '`string`', default: '`\'Select a status\'`', meaning: 'Shown with no selection.' },
    { name: 'emptyLabel', type: '`string`', default: '`\'No rows\'`', meaning: 'Shown when the field offers nothing.' },
    { name: 'loadingLabel', type: '`string`', default: '`\'Loading…\'`', meaning: 'Names the skeletons a read stands behind, for a screen reader.' },
    { name: 'errorLabel', type: '`string`', default: '—', meaning: 'Shown in place of what the failed read said.' },
    { name: 'clearable', type: '`boolean`', default: 'the field', meaning: 'Offers a control that clears the value. Unset, it follows the field: a mandatory one is never clearable.' },
    { name: 'readonly', type: '`boolean`', default: '`false`', meaning: 'Keeps full contrast and drops the chevron, the popup and the clear control.' },
    { name: 'disabled', type: '`boolean`', default: '`false`', meaning: 'Greys the control and takes it out of the tab order.' },
    { name: 'invalid', type: '`boolean`', default: '`false`', meaning: 'Sets `aria-invalid` and the destructive ring.' },
    { name: 'showCode', type: '`boolean`', default: '`true`', meaning: 'Draws the code as a row\'s right-aligned secondary, when it says more than the label.' },
    { name: 'secondary', type: '`(option) => string`', default: 'the code', meaning: 'A row\'s right-aligned value, of the caller\'s own making.' },
    { name: 'subLabel', type: '`(option) => string`', default: '—', meaning: 'The muted line under a row\'s label.' },
    { name: 'siteUrl', type: '`string`', default: 'the context\'s', meaning: 'Passed to every badge, for a sprite cell outside the status icon set.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Control height: 8, 9 and 10.' },
    { name: 'open', type: '`boolean`', default: '`false`', meaning: 'Whether the popup is showing. Two-way in Svelte.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  keyboard: [
    { key: '<kbd>Space</kbd>, <kbd>Enter</kbd>, <kbd>↓</kbd>', does: 'Opens the list' },
    { key: '<kbd>↑</kbd> <kbd>↓</kbd>', does: 'Moves the highlight' },
    { key: '<kbd>Enter</kbd>', does: 'Selects the highlighted status and closes' },
    { key: '<kbd>Backspace</kbd>', does: 'In an empty search box, clears the status' },
    { key: '<kbd>Esc</kbd>', does: 'Closes and keeps the selection' },
    { key: '<kbd>Tab</kbd>', does: 'Leaves the control, or reaches the clear control when there is one' },
  ],
  events: [
    { name: 'onValueChange', payload: '`string | null`', when: 'A status was chosen, or the clear control was pressed.' },
    { name: 'onOpenChange', payload: '`boolean`', when: 'The popup opened or closed.' },
  ],
} satisfies PropsFile;
