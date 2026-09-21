import type { PropsFile } from './_types';

export default {
  extends: { name: 'picker-control', omit: ['onOpenChange', 'slot', 'picker', 'label', 'multiple', 'keys', 'onSelect', 'labels', 'items', 'rowCount', 'chipKeys', 'chipsSlot', 'summary', 'max', 'chipRow', 'inline', 'tokenInput', 'inputPlaceholder', 'searchable', 'textValue', 'rowKey', 'inert', 'query', 'onQueryChange', 'onRemoveAt', 'onClear', 'anchored', 'loading', 'count', 'error', 'empty', 'hasMore', 'onLoadMore', 'clearLabel', 'triggerLabel', 'overflowLabel', 'itemToStringLabel', 'controlProps', 'chip', 'rows'] },
  props: [
    { name: 'context', type: '`SgContext`', default: 'required', meaning: 'The widget context. The site\'s enabled types are read through it, once per page.' },
    { name: 'value', type: '`string | null`', default: '`null`', meaning: 'The chosen type code. Two-way in Svelte.' },
    { name: 'allow', type: '`string[]`', default: '—', meaning: 'Codes on offer. Empty or absent means every enabled type.' },
    { name: 'deny', type: '`string[]`', default: '—', meaning: 'Codes withheld, applied after `allow`.' },
    { name: 'placeholder', type: '`string`', default: '`\'Select an entity type\'`', meaning: 'Shown while nothing is chosen.' },
    { name: 'searchPlaceholder', type: '`string`', default: '`\'Search types…\'`', meaning: 'Shown in the search box.' },
    { name: 'emptyLabel', type: '`string`', default: '`\'No match\'`', meaning: 'Shown when the search matches nothing.' },
    { name: 'loadingLabel', type: '`string`', default: '`\'Loading…\'`', meaning: 'Names the skeletons a read stands behind, for a screen reader.' },
    { name: 'errorLabel', type: '`string`', default: '—', meaning: 'Shown in place of what the failed read said.' },
    { name: 'clearable', type: '`boolean`', default: '`true`', meaning: 'Show the clear control once something is chosen.' },
    { name: 'readonly', type: '`boolean`', default: '`false`', meaning: 'Keeps full contrast and removes the chevron and the clear control.' },
    { name: 'invalid', type: '`boolean`', default: '`false`', meaning: 'Applies the invalid ring and `aria-invalid`.' },
    { name: 'showCode', type: '`boolean`', default: '`true`', meaning: 'Shows the code under the display name where the two differ.' },
    { name: 'className / class', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  events: [
    { name: 'onValueChange', payload: '`string | null`', when: 'A type is chosen, or the clear control is pressed.' },
    { name: 'onOpenChange', payload: '`boolean`', when: 'The popup opened or closed. Svelte also binds it with `bind:open`.' },
  ],
  keyboard: [
    { key: 'any text', does: 'Narrows the rows, from the caret in the control.' },
    { key: '`Enter`, `Space`', does: 'On the chevron, opens the list.' },
    { key: '`Down`, `Up`', does: 'Move the cursor through the rows and keep it in view. The last row holds it rather than wrapping.' },
    { key: '`Enter`', does: 'Choose the highlighted type and close the list.' },
    { key: '`Backspace`', does: 'In an empty search box, clears the value.' },
    { key: '`Escape`', does: 'Close, keeping the value and clearing the query. On a closed picker it does nothing.' },
  ],
} satisfies PropsFile;
