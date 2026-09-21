import type { PropsFile } from './_types';

export default {
  declares: { react: 'CollectionControlOptions', svelte: 'CollectionControlOptions' },
  props: [
    { name: 'source', type: '`EntitySource`', default: 'required', meaning: 'The rows, the filter, the sort and the page behind them.' },
    { name: 'paging', type: '`\'pages\' | \'more\' | \'scroll\'`', default: 'required', meaning: 'How the set is walked: a page number, a load-more row, or the scroller. The source follows it.' },
    { name: 'sort', type: '`SortSpec[]`', default: '—', meaning: 'The source\'s sort, two-way.' },
    { name: 'filters', type: '`FilterNode | WireGroup | null`', default: '—', meaning: 'The source\'s filter, two-way.' },
    { name: 'selection', type: '`EntityRef[]`', default: '`[]`', meaning: 'The selected rows, two-way. Names loaded rows only.' },
    { name: 'getRowId', type: '`(row) => string`', default: '—', meaning: 'How a row is keyed, in the DOM and in the selection. Default `Type:id`.' },
    { name: 'isRowDisabled', type: '`(row) => boolean`', default: '—', meaning: 'True for a row the selection refuses and the cursor skips.' },
    { name: 'loadingLabel', type: '`string`', default: '`\'Loading…\'`', meaning: 'Names the skeletons a read stands behind, for a screen reader.' },
  ],
  events: [
    { name: 'onSortChange', payload: '`SortSpec[]`', when: 'React: the source’s sort changed. Svelte writes it back through `sort`.', only: 'react' },
    { name: 'onFiltersChange', payload: '`FilterNode | WireGroup | null`', when: 'React: the source’s filter changed. Svelte writes it back through `filters`.', only: 'react' },
    { name: 'onSelectionChange', payload: '`EntityRef[]`', when: 'React: the selection changed. Svelte writes it back through `selection`.', only: 'react' },
  ],
  keyboard: [
    { key: '<kbd>Tab</kbd>', does: 'Reaches the collection. It is one tab stop, and the cursor holds the focus inside it.' },
    { key: '<kbd>↑</kbd> <kbd>↓</kbd>', does: 'Moves the cursor over the rows it can land on, never a disabled one, and brings it into view.' },
    { key: '<kbd>↓</kbd> on the last loaded row', does: 'In `more` and `scroll`, asks for the next page. The cursor waits where it is and lands on the first of the new rows.' },
  ],
} satisfies PropsFile;
