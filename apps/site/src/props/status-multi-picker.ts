import type { PropsFile } from './_types';

export default {
  extends: { name: 'status-picker' },
  props: [
    { name: 'value', type: '`string[]`', default: '`[]`', meaning: 'The selected codes. `bind:value` in Svelte, `value` with `onValueChange` in React.' },
    { name: 'placeholder', type: '`string`', default: '`\'Select statuses\'`', meaning: 'Shown with nothing selected.' },
    { name: 'searchPlaceholder', type: '`string`', default: '`\'Search statuses…\'`', meaning: 'Placeholder of the search box.' },
    { name: 'emptyLabel', type: '`string`', default: '`\'No match\'`', meaning: 'Shown when the search matches nothing.' },
    { name: 'summary', type: '`\'chips\' | \'ellipsis\' | \'count\'`', default: '`\'ellipsis\'`', meaning: 'How many of the selection the control shows.' },
    { name: 'badge', type: '`\'both\' | \'icon\' | \'text\'`', default: '`\'both\'`', meaning: 'What one selected status is drawn as.' },
    { name: 'max', type: '`number`', default: '`0`', meaning: 'Badges drawn before the rest becomes `+n`. `0` lets the row fit what it can, and `badge="icon"` draws twice as many.' },
  ],
  keyboard: [
    { key: '<kbd>Space</kbd>, <kbd>Enter</kbd>', does: 'On the chevron, opens the list' },
    { key: 'any text', does: 'Narrows the rows, from the caret under `chips` and from the popup\'s search box otherwise' },
    { key: '<kbd>↑</kbd> <kbd>↓</kbd>', does: 'Moves the highlight and keeps it in view; the last row holds it rather than wrapping' },
    { key: '<kbd>Home</kbd> <kbd>End</kbd>', does: 'First and last row' },
    { key: '<kbd>Enter</kbd>', does: 'Toggles the highlighted status; the list stays open' },
    { key: '<kbd>Backspace</kbd>', does: 'In an empty search box, highlights the last chip; a second one removes it' },
    { key: '<kbd>Esc</kbd>', does: 'Closes, keeps the selection and clears the query; on a closed control it does nothing' },
  ],
  events: [
    { name: 'onValueChange', payload: '`string[]`', when: 'A status was ticked or unticked.' },
  ],
} satisfies PropsFile;
