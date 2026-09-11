import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'entityType', type: '`string`', default: 'required', meaning: 'Type the editor reads its fields on.' },
    { name: 'context', type: '`SgContext`', default: 'required', meaning: 'The widget context. Every read goes through it, so widgets on a page share one cache.' },
    { name: 'value', type: '`FilterGroup`', default: '`emptyFilter()`', meaning: 'The applied tree. Two-way in Svelte through `bind:value`.' },
    { name: 'hidePaths', type: '`string[]`', default: '`[]`', meaning: 'Passed through to the editor.' },
    { name: 'label', type: '`string`', default: '—', meaning: 'Replaces both button labels.' },
    { name: 'title', type: '`string`', default: '`\'Filters\'`', meaning: 'Dialog title.' },
    { name: 'disabled', type: '`boolean`', default: '`false`', meaning: 'Blocks both buttons.' },
    { name: 'open', type: '`boolean`', default: '`false`', meaning: 'Whether the dialog is showing. Two-way in Svelte.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Launcher heights 8, 9 and 10. Passed to the editor inside.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  events: [
    { name: 'onChange', payload: '`FilterGroup`', when: 'The tree was applied, by Apply, Clear all or the clear control, never while editing. Svelte also binds it with `bind:value`.' },
    { name: 'onOpenChange', payload: '`boolean`', when: 'The dialog opened or closed. Svelte also binds it with `bind:open`.' },
  ],
  keyboard: [
    { key: '`Enter`, `Space`', does: 'Opens the dialog from the launcher.' },
    { key: '`Tab`', does: 'Cycles inside the dialog while it is open.' },
    { key: '`Escape`', does: 'Closes the dialog and drops the staged edits.' },
  ],
  slots: [
    { name: 'fieldChooser', receives: '`entityType`, the current `path`, `hidePaths`, `filterableOnly`, `disabled`, `onSelect(path)`', draws: 'The field chooser, in place of FieldPicker.' },
    { name: 'valueEditor', receives: '`field`, `dataType`, `operator`, `value`, `arity`, `disabled`, `onChange(value)`', draws: 'Every value control in the editor.' },
    { name: 'entityEditor', receives: 'the same arguments as the value editor', draws: 'The two entity pickers alone.' },
  ],
} satisfies PropsFile;
