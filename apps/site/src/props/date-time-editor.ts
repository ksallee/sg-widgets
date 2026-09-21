import type { PropsFile } from './_types';

export default {
  extends: { name: 'value-editor', omit: ['slotName', 'message', 'render'] },
  props: [
    { name: 'value', type: '`string | null`', default: '`null`', meaning: 'The stored instant, UTC. Two-way in Svelte.' },
    { name: 'onValueChange', type: '`(value: string | null) => void`', default: '—', meaning: 'Called when either input commits or a day is picked.' },
    { name: 'field', type: '`Pick<FieldSchema, \'displayName\' | \'mandatory\'> | null`', default: '`null`', meaning: 'Supplies the accessible label and the required flag.' },
    { name: 'timeZone', type: '`string`', default: 'the runtime\'s', meaning: 'IANA zone the typed wall-clock time is read in.' },
    { name: 'showSeconds', type: '`boolean`', default: '`false`', meaning: 'Seconds in the time input and on the button.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Button height.' },
    { name: 'hint', type: '`boolean`', default: '`true`', meaning: 'Name the zone under the button.' },
    { name: 'inline', type: '`boolean`', default: '`false`', meaning: 'The row form: the button takes the width of its value and the zone line goes.' },
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
    { key: '`Enter`', does: 'On the button, opens the popover. In the typed day or the time, commits both and closes the popover.' },
    { key: '`Escape`', does: 'In the popover, restores the stored instant and closes the popover.' },
    { key: '`Space`', does: 'Opens the popover, from the button.' },
    { key: '`Tab`', does: 'Moves through the typed day, the calendar and the time.' },
    { key: 'arrows', does: 'Move between days inside the calendar, and between segments inside the time.' },
  ],
  events: [
    { name: 'onOpenChange', payload: '`boolean`', when: 'The calendar opened or closed.' },
  ],
} satisfies PropsFile;
