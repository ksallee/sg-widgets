import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'dataType', type: '`\'list\' | \'status_list\'`', default: '`\'list\'`', meaning: 'The field\'s data type: an ordered list of strings, or status codes.' },
    { name: 'value', type: '`string[]`', default: '`[]`', meaning: 'The valid values: strings in drop-down order, or status codes. `bind:value` in Svelte, `value` with `onValueChange` in React.' },
    { name: 'context', type: '`SgContext`', default: '—', meaning: 'The widget context. A status list picks from the site\'s statuses through it; without one its codes are typed.' },
    { name: 'unique', type: '`boolean`', default: '`false`', meaning: 'Drops a value the list already holds, keeping the first. Off, a repeated value is kept.' },
    { name: 'placeholder', type: '`string`', default: 'by data type', meaning: 'Shown in the add row, or in an empty status picker.' },
    { name: 'emptyLabel', type: '`string`', default: '`\'No values\'`', meaning: 'Shown in a read-only editor that holds no value.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Row height. A box of one row stands at 28, 32 and 36.' },
    { name: 'disabled', type: '`boolean`', default: '`false`', meaning: 'Greys the editor and takes it out of the tab order.' },
    { name: 'readonly', type: '`boolean`', default: '`false`', meaning: 'Keeps full contrast and drops the grips, the remove controls and the add row.' },
    { name: 'invalid', type: '`boolean`', default: '`false`', meaning: 'Sets `aria-invalid` and the destructive ring.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  keyboard: [
    { key: '<kbd>Enter</kbd> in a value', does: 'Commits the value and moves to the next one, or to the add row' },
    { key: '<kbd>Esc</kbd> in a value', does: 'Puts back the value as it was' },
    { key: '<kbd>Backspace</kbd> in an empty value', does: 'Removes the value and moves to the one before' },
    { key: '<kbd>Enter</kbd> in the add row', does: 'Adds the value and stays in the add row' },
    { key: '<kbd>Backspace</kbd> in an empty add row', does: 'Moves to the last value' },
    { key: '<kbd>Alt</kbd> + <kbd>↑</kbd>, <kbd>Alt</kbd> + <kbd>↓</kbd>', does: 'Moves the value holding focus one place' },
    { key: '<kbd>Space</kbd>, <kbd>Enter</kbd> on a grip', does: 'Picks the value up for the arrow keys' },
    { key: '<kbd>↑</kbd> <kbd>↓</kbd> while carrying a value', does: 'Move it one place' },
    { key: '<kbd>Space</kbd>, <kbd>Enter</kbd> while carrying a value', does: 'Drop it where it is' },
    { key: '<kbd>Esc</kbd> while carrying a value', does: 'Put it back where it was' },
    { key: '<kbd>Tab</kbd>', does: 'Moves through each value\'s grip, text and remove control, then to the add row' },
  ],
  events: [
    { name: 'onValueChange', payload: '`string[]`', when: 'A value was committed, added, removed or moved, or a status was picked or removed.' },
  ],
} satisfies PropsFile;
