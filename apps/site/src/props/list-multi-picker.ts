import type { PropsFile } from './_types';

export default {
  extends: { name: 'list-picker', omit: ['loadError', 'loading', 'loadingLabel', 'errorLabel', 'mark', 'valueChip'] },
  props: [
    { name: 'value', type: '`string[]`', default: '`[]`', meaning: 'The chosen values. Two-way in Svelte.' },
    { name: 'onValueChange', type: '`(value: string[]) => void`', default: '—', meaning: 'Called on every change, with the whole list.' },
    { name: 'slot', type: '`string`', default: '`\'list-multi-picker\'`', meaning: 'The `data-slot` prefix every part of this picker carries.' },
    { name: 'readonly', type: '`boolean`', default: '`false`', meaning: 'Keeps full contrast and drops the chevron, the popup and the remove controls.' },
    { name: 'placeholder', type: '`string`', default: '`\'Select values\'`', meaning: 'Shown while nothing is chosen.' },
    { name: 'clearable', type: '`boolean`', default: 'the field', meaning: 'Offers a control that clears the selection. Unset, it follows the field: a mandatory one is never clearable.' },
    { name: 'summary', type: '`\'chips\' | \'ellipsis\' | \'count\'`', default: '`\'ellipsis\'`', meaning: 'What the control shows for the selection.' },
    { name: 'max', type: '`number`', default: '`0`', meaning: 'Chips drawn before the rest becomes `+n`. `0` lets the row fit what it can.' },
  ],
  keyboard: [
    { key: '<kbd>Enter</kbd>', does: 'Checks or unchecks the highlighted row. The list stays open' },
    { key: '<kbd>Backspace</kbd>', does: 'Highlights the last chip; a second press removes it' },
    { key: '<kbd>Esc</kbd>', does: 'Closes the list and keeps the selection' },
  ],
  events: [
  ],
} satisfies PropsFile;
