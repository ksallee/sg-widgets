import type { PropsFile } from './_types';

export default {
  page: 'collection-control',
  declares: { react: 'CollectionSourceOptions', svelte: 'CollectionSourceOptions' },
  props: [
    { name: 'source', type: '`EntitySource`', default: 'required', meaning: 'The rows, the filter, the sort and the page behind them.' },
    { name: 'paging', type: '`\'pages\' | \'more\' | \'scroll\'`', default: 'required', meaning: 'How the set is walked. The source\'s mode follows it rather than the other way round.' },
    { name: 'sort', type: '`SortSpec[]`', default: '—', meaning: 'The source\'s sort, two-way.' },
    { name: 'onSortChange', type: '`(sort: SortSpec[]) => void`', default: '—', meaning: 'React: the source\'s sort changed. Svelte writes it back through `sort`.', only: 'react' },
    { name: 'filters', type: '`FilterNode | WireGroup | null`', default: '—', meaning: 'The source\'s filter, two-way.' },
    { name: 'onFiltersChange', type: '`(filters: FilterNode | WireGroup | null) => void`', default: '—', meaning: 'React: the source\'s filter changed. Svelte writes it back through `filters`.', only: 'react' },
  ],
} satisfies PropsFile;
