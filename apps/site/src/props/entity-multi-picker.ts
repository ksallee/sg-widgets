import type { PropsFile } from './_types';

export default {
  extends: { name: 'entity-picker' },
  props: [
    { name: 'value', type: '`EntityRef[]`', default: '`[]`', meaning: 'The chosen rows, in the order they were ticked. Two-way in Svelte.' },
    { name: 'exclude', type: '`EntityRef[]`', default: '—', meaning: 'Rows kept out of the results, per type.' },
    { name: 'clearable', type: '`boolean`', default: '`true`', meaning: 'Shows the clear-all control.' },
    { name: 'summary', type: '`\'chips\' | \'ellipsis\' | \'count\'`', default: '`\'ellipsis\'`', meaning: 'What the control shows for the selection.' },
    { name: 'max', type: '`number`', default: '`0`', meaning: 'Chips drawn before the rest becomes `+n`. `0` lets the row fit what it can.' },
  ],
  events: [
    { name: 'onValueChange', payload: '`EntityRef[]`, `PickerRow[]`', when: 'The selection changed.' },
  ],
  keyboard: [
    { key: 'any text', does: 'Searches the server, from the caret under `chips` and from the popup\'s search box otherwise.' },
    { key: '`Enter`', does: 'Ticks or unticks the highlighted row. The list stays open.' },
    { key: '`Backspace`', does: 'In an empty search box, highlights the last chip. A second one removes it. Any other key releases it.' },
    { key: '`Tab`', does: 'Moves through the chips\' remove controls, then `+n`, the clear control and the chevron.' },
  ],
} satisfies PropsFile;
