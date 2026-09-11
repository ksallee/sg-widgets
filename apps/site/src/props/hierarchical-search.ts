import type { PropsFile } from './_types';

export default {
  extends: { name: 'search-control', omit: ['load', 'query', 'onQueryChange', 'request', 'enabled', 'readsEmpty', 'paging', 'debounceMs', 'shell', 'commandClass', 'onKeyDown', 'open', 'onOpenChange', 'title', 'description', 'errorSlot', 'loadingSlot', 'emptySlot', 'skeletonLines', 'skeletonLead', 'rows', 'empty'] },
  props: [
    { name: 'context', type: '`SgContext`', default: 'required', meaning: 'The widget context. Every read goes through it, so widgets on a page share one cache.' },
    { name: 'rootPath', type: '`string`', default: '`\'/\'`', meaning: 'Where the tree starts. `/Project/70` scopes it to that project.' },
    { name: 'entityTypes', type: '`string[] | Record<string, WireCondition[] | null>`', default: 'Shot, Asset, Sequence, Task', meaning: 'Types a search may end on.' },
    { name: 'thumbnail', type: '`string | false`', default: '`\'image\'`', meaning: 'Field holding the thumbnail URL. A row with no picture falls back to its type glyph.' },
    { name: 'labelField', type: '`string`', default: '—', meaning: 'Field holding the row label.' },
    { name: 'subLabelField', type: '`string | CollectionColumn | null`', default: '`null`', meaning: 'The muted line under the label. A resolved column renders it by type.' },
    { name: 'subLabel', type: '`(row) => string`', default: '—', meaning: 'The muted line of your own. Wins over `subLabelField`.' },
    { name: 'secondaryField', type: '`string | CollectionColumn | null`', default: '`null`', meaning: 'The right-aligned value, drawn by its data type.' },
    { name: 'secondary', type: '`(row) => string`', default: '—', meaning: 'Right-aligned text of your own. Wins over `secondaryField`.' },
    { name: 'showCode', type: '`boolean`', default: '`false`', meaning: 'Shows the row\'s `code` beside the label when the two differ.' },
    { name: 'fields', type: '`string[]`', default: '`[]`', meaning: 'Extra fields to request, so your own sub-label or secondary can read them.' },
    { name: 'placeholder', type: '`string`', default: '`\'Search the hierarchy…\'`', meaning: 'Text in the search input.' },
    { name: 'emptyLabel', type: '`string`', default: '`\'No rows\'`', meaning: 'Shown when a level holds nothing.' },
    { name: 'noMatchLabel', type: '`string`', default: '`\'No match\'`', meaning: 'Shown when a query matches nothing.' },
    { name: 'loadingLabel', type: '`string`', default: '`\'Loading…\'`', meaning: 'Names the skeletons a read stands behind, for a screen reader.' },
    { name: 'errorLabel', type: '`string`', default: '—', meaning: 'Shown in place of what the failed read said.' },
    { name: 'size', type: '`\'sm\' | \'md\' | \'lg\'`', default: '`\'md\'`', meaning: 'Row text, leading slot and glyphs.' },
    { name: 'class / className', type: '`string`', default: '—', meaning: 'Merged after the widget\'s own classes.' },
  ],
  events: [
    { name: 'onSelect', payload: '`EntityRef`, `EntityRef[]`', when: 'A row was picked. The second argument is every row its path runs through, root first.' },
  ],
  keyboard: [
    { key: '`Down` / `Up`', does: 'Moves through the level.' },
    { key: '`Enter`', does: 'Picks the row, or opens it when it is not a searchable type.' },
    { key: '`Right`', does: 'Opens the level below the row.' },
    { key: '`Left` / `Backspace`', does: 'Goes back up one level.' },
    { key: '`Escape`', does: 'Clears the query.' },
  ],
} satisfies PropsFile;
