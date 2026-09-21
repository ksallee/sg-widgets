import type { PropsFile } from './_types';

export default {
  extends: { name: 'value-editor', omit: ['inline', 'slotName', 'message', 'render'] },
  props: [
    { name: 'value', type: '`UrlValue | null`', default: '`null`', meaning: 'The stored object. Two-way in Svelte.' },
    { name: 'onValueChange', type: '`(value: UrlWriteValue | null) => void`', default: '—', meaning: 'Called when either input commits.' },
    { name: 'field', type: '`Pick<FieldSchema, \'displayName\' | \'mandatory\'> | null`', default: '`null`', meaning: 'Supplies the accessible label and the required flag.' },
    { name: 'disabled', type: '`boolean`', default: '`false`' },
    { name: 'readonly', type: '`boolean`', default: '`false`' },
    { name: 'invalid', type: '`boolean`', default: '`false`', meaning: 'Forced invalid state.' },
    { name: 'error', type: '`string | null`', default: '`null`', meaning: 'A message from the caller, shown in place of the parse error.' },
    { name: 'onErrorChange', type: '`(error: string | null) => void`', default: '—', meaning: 'Called when the parse error appears or clears.' },
    { name: 'placeholder', type: '`string`', default: 'an example address', meaning: 'Placeholder of the address input.' },
    { name: 'namePlaceholder', type: '`string`', default: '`\'Name\'`', meaning: 'Placeholder of the name input.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  keyboard: [
    { key: '`Enter`', does: 'Commits both inputs.' },
    { key: '`Escape`', does: 'Restores the stored value.' },
    { key: '`Tab`', does: 'Moves between address and name.' },
  ],
} satisfies PropsFile;
