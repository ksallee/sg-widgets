import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'errorMessage', type: '`(message: string) => ReactNode`', default: '—', meaning: 'Draws the line under the control.' },
    { name: 'value', type: '`boolean`', default: '`false`', meaning: 'The stored boolean. Two-way in Svelte.' },
    { name: 'onValueChange', type: '`(value: boolean) => void`', default: '—', meaning: 'Called on every change.' },
    { name: 'field', type: '`FieldSchema | null`', default: '`null`', meaning: 'Supplies the accessible label.' },
    { name: 'labels', type: '`{ on: string; off: string }`', default: '`{ on: \'Yes\', off: \'No\' }`', meaning: 'The word shown beside the switch.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Row height.' },
    { name: 'disabled', type: '`boolean`', default: '`false`' },
    { name: 'readonly', type: '`boolean`', default: '`false`', meaning: 'Keeps full contrast and refuses the change.' },
    { name: 'invalid', type: '`boolean`', default: '`false`' },
    { name: 'error', type: '`string | null`', default: '`null`', meaning: 'A message from the caller.' },
    { name: 'placeholder', type: '`string`', default: '—', meaning: 'Used as the accessible label when there is no field.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  keyboard: [
    { key: '`Space`', does: 'Toggles the switch.' },
    { key: '`Tab`', does: 'Moves off the control.' },
  ],
  events: [
    { name: 'onErrorChange', payload: '`string | null`', when: 'The message changed.' },
  ],
} satisfies PropsFile;
