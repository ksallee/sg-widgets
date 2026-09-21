import type { PropsFile } from './_types';

export default {
  props: [
    { name: 'load', type: '`(request) => Promise<SearchAnswer<T>>`', default: 'required', meaning: 'The read behind the list. Takes the query and the page, answers the rows and `hasMore`.' },
    { name: 'query', type: '`string`', default: '`\'\'`', meaning: 'What the caret holds. Two-way in Svelte.' },
    { name: 'onQueryChange', type: '`(query: string) => void`', default: '—', meaning: 'Called when the caret changes.' },
    { name: 'request', type: '`string`', default: '`\'\'`', meaning: 'What the read depends on besides the query. A change reads again at once.' },
    { name: 'enabled', type: '`boolean`', default: '`true`', meaning: 'Nothing is read while this is off.' },
    { name: 'readsEmpty', type: '`boolean`', default: '`false`', meaning: 'An empty query reads too, rather than emptying the list.' },
    { name: 'paging', type: '`boolean`', default: '`false`', meaning: 'A further page is asked for on a load-more row under the rows.' },
    { name: 'debounceMs', type: '`number`', default: '`250`', meaning: 'The pause before a typed query is asked for.' },
    { name: 'shell', type: '`\'command\' | \'dialog\' | \'bare\'`', default: '`\'command\'`', meaning: 'What is drawn around the list.' },
    { name: 'commandClass', type: '`string`', default: '—', meaning: 'Classes on the command box.' },
    { name: 'onKeyDown', type: '`(event, items) => void`', default: '—', meaning: 'Keys the wrapper owns, on the command box, with the rows they act on. Spelled `onkeydown` in Svelte.' },
    { name: 'open', type: '`boolean`', default: '`false`', meaning: 'Whether the dialog is showing. Two-way in Svelte.' },
    { name: 'onOpenChange', type: '`(open: boolean) => void`', default: '—' },
    { name: 'title', type: '`string`', default: '`\'Search\'`', meaning: 'The dialog\'s accessible name.' },
    { name: 'description', type: '`string`', default: '—', meaning: 'The line under it.' },
    { name: 'placeholder', type: '`string`', default: '`\'Search…\'`' },
    { name: 'emptyLabel', type: '`string`', default: '`\'No match\'`', meaning: 'Shown when the read answered nothing.' },
    { name: 'loadingLabel', type: '`string`', default: '`\'Loading…\'`', meaning: 'The accessible name of the skeletons.' },
    { name: 'errorLabel', type: '`string`', default: 'what the read said', meaning: 'Shown in place of the failed read\'s own message.' },
    { name: 'errorSlot', type: '`string | null`', default: '`\'search-error\'`', meaning: 'The `data-slot` of the error line.' },
    { name: 'loadingSlot', type: '`string | null`', default: '`\'search-loading\'`', meaning: 'The `data-slot` of the skeleton block.' },
    { name: 'emptySlot', type: '`string | null`', default: '`\'search-empty\'`', meaning: 'The `data-slot` of the empty line.' },
    { name: 'skeletonLines', type: '`number`', default: '`3`', meaning: 'How many rows the skeletons stand in for.' },
    { name: 'skeletonLead', type: '`string`', default: '`\'h-6 w-10 shrink-0\'`', meaning: 'The leading slot of a skeleton row.' },
  ],
  slots: [
    { name: 'rows', receives: 'the rows read, the query and whether a read is in flight', draws: 'The rows of the list, as items of the command box or as plain rows under a bare shell.' },
    { name: 'empty', receives: 'nothing', draws: 'Drawn in place of the empty line.' },
  ],
  keyboard: [
    { key: '`ArrowDown` / `ArrowUp`', does: 'Moves the highlight, through a load-more page.' },
    { key: '`Enter`', does: 'Takes the highlighted row, or reads the next page on the load-more row.' },
    { key: '`Escape`', does: 'With a query, clears it and the rows and keeps the caret in the box. With no query, the shell takes it: a dialog or a popover closes, and the inline box does nothing.' },
  ],
} satisfies PropsFile;
