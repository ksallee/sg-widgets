import type { PropsFile } from './_types';

export default {
  extends: { name: 'value-editor', omit: ['slotName', 'message', 'render'] },
  props: [
    { name: 'value', type: '`string | null`', default: '`null`', meaning: 'The stored day. Two-way in Svelte.' },
    { name: 'onValueChange', type: '`(value: string | null) => void`', default: '—', meaning: 'Called when the input commits or a day is picked.' },
    { name: 'field', type: '`Pick<FieldSchema, \'displayName\' | \'mandatory\'> | null`', default: '`null`', meaning: 'Supplies the accessible label and the required flag.' },
    { name: 'inline', type: '`boolean`', default: '`false`', meaning: 'The row form: the button takes the width of its value.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Button height.' },
    { name: 'disabled', type: '`boolean`', default: '`false`' },
    { name: 'readonly', type: '`boolean`', default: '`false`', meaning: 'Keeps the value readable and does not open the popover.' },
    { name: 'invalid', type: '`boolean`', default: '`false`', meaning: 'Forced invalid state.' },
    { name: 'error', type: '`string | null`', default: '`null`', meaning: 'A message from the caller, shown in place of the parse error.' },
    { name: 'onErrorChange', type: '`(error: string | null) => void`', default: '—', meaning: 'Called when the parse error appears or clears.' },
    { name: 'placeholder', type: '`string`', default: '`\'YYYY-MM-DD\'`', meaning: 'Shown on the button and in the typed day while the field is unset.' },
    { name: 'open', type: '`boolean`', default: '`false`', meaning: 'Whether the calendar popover is showing. Two-way in Svelte.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  keyboard: [
    { key: '`Enter`', does: 'On the button, opens the popover. In the typed day, commits it and closes the popover.' },
    { key: '`Escape`', does: 'In the popover, restores the stored day and closes the popover.' },
    { key: '`Space`', does: 'Opens the popover, from the button.' },
    { key: '`Tab`', does: 'Moves from the typed day to the calendar.' },
    { key: 'arrows', does: 'Move between days, inside the calendar.' },
  ],
  events: [
    { name: 'onOpenChange', payload: '`boolean`', when: 'The calendar opened or closed.' },
  ],
} satisfies PropsFile;
