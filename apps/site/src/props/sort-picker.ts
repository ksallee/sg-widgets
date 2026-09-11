import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'entityType', type: '`string`', default: 'required', meaning: 'Type the field list is read on.' },
    { name: 'context', type: '`SgContext`', default: 'required', meaning: 'The widget context. Every read goes through it, so widgets on a page share one cache.' },
    { name: 'value', type: '`SortKey[]`', default: '`[]`', meaning: 'The keys, in order. Two-way in Svelte through `bind:value`.' },
    { name: 'hidePaths', type: '`string[]`', default: '`[]`', meaning: 'Paths kept out of the field list. A pattern hides itself and everything under it.' },
    { name: 'paths', type: '`string[]`', default: '—', meaning: 'Only these paths are offered, so a table\'s toolbar sorts on the columns it shows. A link stays in the list while an offered path runs through it.' },
    { name: 'disabled', type: '`boolean`', default: '`false`', meaning: 'Blocks the trigger.' },
    { name: 'open', type: '`boolean`', default: '`false`', meaning: 'Whether the popover is showing. Two-way in Svelte.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Trigger heights 8, 9 and 10.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  events: [
    { name: 'onChange', payload: '`SortKey[]`, `string`', when: 'The keys and the `sort` string changed, on every edit. Svelte also binds it with `bind:value`.' },
    { name: 'onOpenChange', payload: '`boolean`', when: 'The popover opened or closed. Svelte also binds it with `bind:open`.' },
  ],
  keyboard: [
    { key: '`Enter`, `Space`', does: 'Opens the list, and toggles a direction or a move control inside it.' },
    { key: '`Tab`', does: 'Moves through each key\'s grip, direction, move and remove controls, then to the field search.' },
    { key: '`Arrow` keys', does: 'Move the cursor in the field list, and between ascending and descending.' },
    { key: '`Right arrow`', does: 'Descends into the highlighted link in the field picker.' },
    { key: '`Left arrow`', does: 'Goes back one level in the field picker.' },
    { key: '`Space`, `Enter` on the grip', does: 'Picks the key up for the arrow keys.' },
    { key: '`Up`, `Down` while carrying a key', does: 'Move it one place.' },
    { key: '`Space`, `Enter` while carrying a key', does: 'Drop it where it is.' },
    { key: '`Escape` while carrying a key', does: 'Put it back where it was.' },
    { key: '`Alt` + `Up`, `Alt` + `Down`', does: 'Move the key holding focus one place.' },
    { key: '`Escape`', does: 'Closes the list.' },
  ],
} satisfies PropsFile;
