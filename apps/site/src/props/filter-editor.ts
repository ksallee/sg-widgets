import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'entityType', type: '`string`', default: 'required', meaning: 'Type the root of every field path is read on.' },
    { name: 'context', type: '`SgContext`', default: 'required', meaning: 'The widget context. Every read goes through it, so widgets on a page share one cache.' },
    { name: 'value', type: '`FilterGroup`', default: '`emptyFilter()`', meaning: 'The tree. Two-way in Svelte through `bind:value`.' },
    { name: 'hidePaths', type: '`string[]`', default: '`[]`', meaning: 'Paths kept out of the field list. A pattern hides itself and everything under it.' },
    { name: 'projectId', type: '`number`', default: '—', meaning: 'Scopes the status pickers to the codes one project allows.' },
    { name: 'emptyLabel', type: '`string`', default: '`\'Nothing chosen\'`', meaning: 'Shown when a group holds no condition.' },
    { name: 'disabled', type: '`boolean`', default: '`false`', meaning: 'Dims the editor and blocks every control.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Condition-row heights 7, 8 and 9: a row is a control inside a control, so its ladder sits one step down.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  events: [
    { name: 'onChange', payload: '`FilterGroup`', when: 'The whole tree changed, on every edit. Svelte also binds it with `bind:value`.' },
  ],
  slots: [
    { name: 'fieldChooser', receives: '`entityType`, the current `path`, `hidePaths`, `filterableOnly`, `disabled`, `onSelect(path)`.' },
    { name: 'valueEditor', receives: '`field`, `dataType`, `operator`, `value`, `arity`, `disabled`, `onChange(value)`.' },
    { name: 'entityEditor', receives: 'The same arguments as the value editor.' },
  ],
  keyboard: [
    { key: '`Tab`', does: 'Moves between field, operator, value and the remove control of each row.' },
    { key: '`Enter`, `Space`', does: 'Opens the field chooser, the operator menu or a value popover.' },
    { key: '`Arrow` keys', does: 'Move the cursor in an open menu or list; move between All and Any.' },
    { key: '`Right arrow`', does: 'Descends into the highlighted link in the field chooser.' },
    { key: '`Left arrow`', does: 'Goes back one level in the field chooser.' },
    { key: '`Enter`', does: 'Chooses the highlighted field, operator or value. In a multi-value list it checks the highlighted entry and the list stays open.' },
    { key: '`Escape`', does: 'Closes the open menu or popover.' },
    { key: '`Backspace`', does: 'In an entity picker\'s empty search box, takes the caret to the last chip; a second press removes it.' },
  ],
} satisfies PropsFile;
