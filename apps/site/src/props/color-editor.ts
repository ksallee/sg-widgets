import type { PropsFile } from './_types';

export default {
  extends: { name: 'value-editor', omit: ['inline', 'slotName', 'message', 'render'] },
  props: [
    { name: 'value', type: '`string | null`', default: '`null`', meaning: 'The stored string. Two-way in Svelte.' },
    { name: 'onValueChange', type: '`(value: string | null) => void`', default: '—', meaning: 'Called when the input commits.' },
    { name: 'field', type: '`FieldSchema | null`', default: '`null`', meaning: 'Supplies the accessible label and the required flag.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Control height, and the size of the swatch.' },
    { name: 'hint', type: '`boolean`', default: '`true`', meaning: 'Explain the pipeline-step token under the control.' },
    { name: 'disabled', type: '`boolean`', default: '`false`' },
    { name: 'readonly', type: '`boolean`', default: '`false`' },
    { name: 'invalid', type: '`boolean`', default: '`false`', meaning: 'Forced invalid state.' },
    { name: 'error', type: '`string | null`', default: '`null`', meaning: 'A message from the caller, shown in place of the parse error.' },
    { name: 'onErrorChange', type: '`(error: string | null) => void`', default: '—', meaning: 'Called when the parse error appears or clears.' },
    { name: 'placeholder', type: '`string`', default: '`\'255,128,0\'`' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  keyboard: [
    { key: '`Enter`', does: 'Commits.' },
    { key: '`Escape`', does: 'Restores the stored value.' },
    { key: '`Tab`', does: 'Commits by leaving the control.' },
  ],
} satisfies PropsFile;
