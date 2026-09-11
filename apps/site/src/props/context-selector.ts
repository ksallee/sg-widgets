import type { PropsFile } from './_types';

export default {
  extends: { name: 'search-control', omit: ['load', 'query', 'onQueryChange', 'request', 'enabled', 'readsEmpty', 'paging', 'debounceMs', 'shell', 'commandClass', 'onKeyDown', 'title', 'description', 'placeholder', 'errorSlot', 'loadingSlot', 'emptySlot', 'skeletonLines', 'skeletonLead', 'rows', 'empty'] },
  props: [
    { name: 'context', type: '`SgContext`', default: 'required', meaning: 'The widget context. Every read goes through it, so widgets on a page share one cache.' },
    { name: 'workContext', type: '`WorkContext`', default: 'empty', meaning: 'The project, row and task on show.' },
    { name: 'currentUser', type: '`EntityRef | null`', default: '`null`', meaning: 'Whose assigned tasks the second section lists.' },
    { name: 'recents', type: '`WorkContext[]`', default: '`[]`', meaning: 'Contexts used before, newest first.' },
    { name: 'recentLimit', type: '`number`', default: '`5`', meaning: 'How many recents survive a change.' },
    { name: 'thumbnail', type: '`string | false`', default: '`\'image\'`', meaning: 'Field holding a task row\'s thumbnail URL. A task with no picture falls back to its glyph.' },
    { name: 'labelField', type: '`string`', default: '`\'content\'`', meaning: 'Field holding a task row\'s label.' },
    { name: 'subLabelField', type: '`string | CollectionColumn | null`', default: '`null`', meaning: 'The muted line under the label. A resolved column renders it by type.' },
    { name: 'subLabel', type: '`(task) => string`', default: '—', meaning: 'The muted line of your own. Wins over `subLabelField`.' },
    { name: 'secondaryField', type: '`string | CollectionColumn | null`', default: '`\'sg_status_list\'`', meaning: 'The right-aligned value, drawn by its data type.' },
    { name: 'secondary', type: '`(task) => string`', default: '—', meaning: 'Right-aligned text of your own. Wins over `secondaryField`.' },
    { name: 'showCode', type: '`boolean`', default: '`false`', meaning: 'Shows the row\'s `code` beside the label when the two differ.' },
    { name: 'fields', type: '`string[]`', default: '`[]`', meaning: 'Extra fields to request, so your own sub-label or secondary can read them.' },
    { name: 'emptyLabel', type: '`string`', default: '`\'No rows\'`', meaning: 'Shown when the person has no task assigned.' },
    { name: 'loadingLabel', type: '`string`', default: '`\'Loading…\'`', meaning: 'Names the skeletons a read stands behind, for a screen reader.' },
    { name: 'errorLabel', type: '`string`', default: '—', meaning: 'Shown in place of what the failed read said.' },
    { name: 'open', type: '`boolean`', default: '`false`', meaning: 'Whether the popover is open.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Trigger heights 8, 9 and 10, and the chips inside it.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  events: [
    { name: 'onWorkContextChange', payload: '`WorkContext`', when: 'The project, entity or task changed.' },
    { name: 'onRecentsChange', payload: '`WorkContext[]`', when: 'The recents list changed, the newest first.' },
    { name: 'onOpenChange', payload: '`boolean`', when: 'The popover opened or closed. Svelte also binds it with `bind:open`.' },
  ],
  keyboard: [
    { key: '`Enter` / `Space`', does: 'Opens the popover from the trigger, and picks the row under focus.' },
    { key: '`Tab`', does: 'Moves through the recents, the assigned tasks and into the tree.' },
    { key: '`Down` / `Up`', does: 'Moves through the tree, once focus is in its input.' },
    { key: '`Right` / `Left`', does: 'Opens the level below a tree row, and goes back up.' },
    { key: '`Escape`', does: 'Closes the popover and returns focus to the trigger.' },
  ],
} satisfies PropsFile;
